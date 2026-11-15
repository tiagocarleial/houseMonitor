"""Ponte local para telemetria AUXSOL BLE observada na característica 7701.

O modo ao vivo usa escritas GATT para solicitar registros (função Modbus 04).
Ele exige --allow-gatt-write e nunca altera pontos de configuração.
O modo --csv serve somente para validar o endpoint sem usar Bluetooth.
"""

import argparse
import asyncio
import csv
import json
import sys
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from auxsol_apk.convert_7701 import decode_notification  # noqa: E402

SERVICE_UUID = "00000077-0000-1000-8000-00805f9b34fb"
CHARACTERISTIC_UUID = "00007701-0000-1000-8000-00805f9b34fb"
# Capturado do app AUXSOL: unidade 01, função 04, início 10000, 84 registradores.
READ_REQUEST = bytes.fromhex("020000000f55ffff09080104102754007a01e76b")


class SampleStore:
    def __init__(self):
        self.lock = threading.Lock()
        self.samples = []
        self.status = "aguardando"

    def add(self, sample):
        with self.lock:
            self.samples.append(sample)
            self.samples = self.samples[-1440:]
            self.status = "recebendo"

    def snapshot(self):
        with self.lock:
            return {"samples": list(self.samples), "status": self.status}

    def set_status(self, status):
        with self.lock:
            self.status = status


def start_http(store, port):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path != "/api/solar":
                self.send_error(404)
                return
            data = json.dumps(store.snapshot(), ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            # A ponte só escuta na própria máquina.
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, format_string, *args):
            return

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def load_csv(store, path):
    with path.open(newline="", encoding="utf-8-sig") as file:
        for row in csv.DictReader(file):
            sample = {"timestamp": row["timestamp"]}
            for key, value in row.items():
                if key != "timestamp" and value:
                    sample[key] = float(value)
            store.add(sample)


async def scan_auxsol():
    from bleak import BleakScanner

    found = await BleakScanner.discover(timeout=10, return_adv=True)
    matches = []
    for device, advertisement in found.values():
        name = device.name or advertisement.local_name or ""
        service_uuids = [item.lower() for item in advertisement.service_uuids]
        if SERVICE_UUID in service_uuids or name.upper().startswith("A0"):
            matches.append((device.address, name, service_uuids))
    return matches


async def monitor(store, address, interval):
    from bleak import BleakClient

    def on_notification(_characteristic, data):
        try:
            sample = decode_notification(bytes(data).hex())
        except ValueError:
            return  # A 7701 também transporta outras respostas.
        sample["timestamp"] = datetime.now().astimezone().isoformat(timespec="seconds")
        store.add(sample)
        print(f"{sample['timestamp']}  {sample['solar_kw']:.2f} kW  {sample['energy_today_kwh']:.2f} kWh hoje", flush=True)

    while True:
        try:
            store.set_status("conectando")
            async with BleakClient(address, timeout=20) as client:
                if not client.is_connected:
                    raise RuntimeError("Conexão BLE indisponível")
                characteristic = client.services.get_characteristic(CHARACTERISTIC_UUID)
                if characteristic is None:
                    raise RuntimeError("Característica 7701 não encontrada")
                if characteristic.service_uuid.lower() != SERVICE_UUID:
                    raise RuntimeError("A 7701 não pertence ao serviço AUXSOL observado")
                await client.start_notify(characteristic, on_notification)
                store.set_status("conectado")
                while client.is_connected:
                    # Escrita GATT para solicitar leitura. A função 04 e o intervalo
                    # 10000–10083 foram conferidos na captura; não há função de ajuste.
                    await client.write_gatt_char(characteristic, READ_REQUEST, response=True)
                    await asyncio.sleep(interval)
        except (OSError, RuntimeError, asyncio.TimeoutError) as exc:
            store.set_status(f"desconectado: {exc}")
            print(store.status, file=sys.stderr, flush=True)
            await asyncio.sleep(10)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scan", action="store_true", help="Apenas procura o dispositivo BLE; não conecta")
    parser.add_argument("--address", help="Endereço BLE mostrado por --scan")
    parser.add_argument("--port", type=int, default=3001)
    parser.add_argument("--interval", type=int, default=60, help="Segundos entre leituras (mínimo 30)")
    parser.add_argument("--csv", type=Path, help="Serve um CSV existente sem usar Bluetooth")
    parser.add_argument("--allow-gatt-write", action="store_true", help="Autoriza enviar requisições de leitura via escrita GATT")
    args = parser.parse_args()

    if args.scan:
        for address, name, uuids in asyncio.run(scan_auxsol()):
            print(f"{address}\t{name}\t{', '.join(uuids)}")
        return

    if not args.csv and not args.allow_gatt_write:
        parser.error("O modo ao vivo exige --allow-gatt-write; use --csv para validar o endpoint sem BLE")
    if args.interval < 30:
        parser.error("O intervalo mínimo é 30 segundos")

    store = SampleStore()
    if args.csv:
        load_csv(store, args.csv)
    elif not args.address:
        matches = asyncio.run(scan_auxsol())
        if len(matches) != 1:
            parser.error(f"Foram encontrados {len(matches)} dispositivos AUXSOL; execute --scan e informe --address")
        args.address = matches[0][0]
        print(f"Dispositivo AUXSOL: {matches[0][1]} ({args.address})", flush=True)
    server = start_http(store, args.port)
    print(f"Endpoint: http://127.0.0.1:{args.port}/api/solar", flush=True)
    try:
        if args.csv:
            threading.Event().wait()
        else:
            asyncio.run(monitor(store, args.address, args.interval))
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
