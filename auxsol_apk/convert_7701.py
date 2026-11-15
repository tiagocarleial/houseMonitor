"""Converte notificações AUXSOL 7701 já capturadas em CSV do houseMonitor.

Este programa lê um TSV local. Não abre Bluetooth, ADB ou conexão de rede.
"""

import argparse
import csv
from pathlib import Path


FIELDS = {
    "solar_kw": (10006, 2, 0.01),
    "energy_today_kwh": (10008, 4, 0.01),
    "energy_total_kwh": (10010, 4, 0.01),
    "ac_voltage_v": (10012, 2, 0.1),
    "dc1_voltage_v": (10034, 2, 0.1),
}


def modbus_crc(data):
    value = 0xFFFF
    for byte in data:
        value ^= byte
        for _ in range(8):
            value = (value >> 1) ^ (0xA001 if value & 1 else 0)
    return value


def decode_notification(value_hex):
    value = bytes.fromhex(value_hex)
    if len(value) < 18 or value[:4] != bytes.fromhex("02000000"):
        raise ValueError("Prefixo BLE inesperado")
    if value[4] != len(value) - 5:
        raise ValueError("Comprimento do quadro BLE inválido")
    frame = value[5:]
    if frame[:7] != bytes.fromhex("66ffff098200b0"):
        raise ValueError("Não é a resposta AUXSOL de telemetria observada")
    inner = frame[7:-2]
    if inner[:6] != bytes.fromhex("01041027a800") or len(inner) != 176:
        raise ValueError("Resposta Modbus inesperada para os registradores 10000–10083")
    if modbus_crc(inner) != 0:
        raise ValueError("CRC Modbus inválido")
    registers = inner[6:-2]
    if len(registers) != 168:
        raise ValueError("Quantidade de dados inválida")
    result = {}
    for name, (address, width, rate) in FIELDS.items():
        start = (address - 10000) * 2
        result[name] = round(int.from_bytes(registers[start : start + width], "little") * rate, 2)
    return result


def convert(source, target):
    samples = []
    with source.open(newline="", encoding="utf-8-sig") as file:
        for row in csv.DictReader(file, delimiter="\t"):
            if row["direcao"] != "inversor->app":
                continue
            try:
                sample = decode_notification(row["valor_7701_hex"])
            except ValueError:
                continue  # Outras respostas da característica 7701 não são telemetria 10000.
            samples.append({"timestamp": row["timestamp_local"], **sample})
    if not samples:
        raise ValueError("Nenhuma resposta válida para os registradores 10000–10083")
    samples.sort(key=lambda row: row["timestamp"])
    with target.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=["timestamp", *FIELDS])
        writer.writeheader()
        writer.writerows(samples)
    return len(samples)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", nargs="?", type=Path, default=Path(__file__).with_name("ble_7701_telemetria.tsv"))
    parser.add_argument("target", nargs="?", type=Path, default=Path(__file__).with_name("auxsol_telemetria.csv"))
    args = parser.parse_args()
    count = convert(args.source, args.target)
    print(f"{count} leituras gravadas em {args.target}")
