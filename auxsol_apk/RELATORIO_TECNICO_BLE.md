# Análise estática do BLE do app AUXSOL

Data: 15/11/2026. Escopo: APKs em `auxsol_apk/` e uma sessão do app AUXSOL já em execução no celular conectado por USB. A análise usou ADB para **ler** logs e um bugreport. O próprio app escreveu requisições GATT e recebeu notificações durante a sessão; esta análise não originou qualquer comando BLE ao inversor.

## Artefatos e método

- `base.apk`: código Android, recursos Flutter e `assets/flutter_assets/assets/data/sys-AUXSOL.db`.
- `split_config.arm64_v8a.apk`: `lib/arm64-v8a/libapp.so` (snapshot Dart AOT do app) e bibliotecas de terceiros.
- `split_config.pt.apk`, `split_config.es.apk`, `split_config.xxhdpi.apk`: recursos de idioma/densidade; não há evidência de lógica BLE específica neles.
- Decompilação: JADX 1.5.6 em `auxsol_apk/jadx_base/`, comando `jadx.bat --no-res --threads-count 4 --output-dir auxsol_apk/jadx_base auxsol_apk/base.apk`. O JADX terminou com 16 erros de decompilação, inclusive no método de despacho da ponte BLE. O código Java legível e os trechos de bytecode recuperados continuam úteis, mas não equivalem a uma reconstrução integral.
- Extração de `libapp.so` e do banco em `auxsol_apk/native/`. O arquivo `libapp_strings.tsv` guarda strings ASCII com offsets hexadecimais no binário. São **símbolos/strings extraídos**, não código Dart decompilado; sua presença não comprova chamadas, argumentos ou fluxo de execução.

## UUIDs e características

| Valor | Evidência confirmada | Papel no protocolo AUXSOL |
|---|---|---|
| `00000077-0000-1000-8000-00805f9b34fb` | Descoberta GATT em `ble_session_logcat.txt:51` e cache do Android | **Serviço proprietário confirmado** do dispositivo conectado. |
| `00007701-0000-1000-8000-00805f9b34fb` | Descoberta GATT em `ble_session_logcat.txt:52`, `prop=0x1a`; ativações e eventos em `:88–205` | **Característica confirmada** com propriedades READ (`0x02`), WRITE (`0x08`) e NOTIFY (`0x10`). O app efetivamente escreve nela e recebe notificações. A propriedade de leitura existe, mas não foi observado `readCharacteristic` nela nesta amostra. |
| `0000fff0-0000-1000-8000-00805f9b34fb` | Literal em `libapp.so`, offset `0x64894e` | Candidato a serviço BLE; associação ao fluxo AUXSOL não comprovada. |
| `0000fff1-0000-1000-8000-00805f9b34fb` | Literal em `libapp.so`, offset `0x9d0d74` | Característica candidata; leitura/escrita/notificação não atribuídas. |
| `0000fff2-0000-1000-8000-00805f9b34fb` | Literal em `libapp.so`, offset `0x7cae30` | Característica candidata; papel não atribuído. |
| `0000fff3-0000-1000-8000-00805f9b34fb` | Literal em `libapp.so`, offset `0x7dd7b0` | Característica candidata; papel não atribuído. |
| `00002902-0000-1000-8000-00805f9b34fb` | Literal em `libapp.so`, offset `0xe7b58a` | CCCD padrão, compatível com habilitação de notificação/indicação. |

**Sobre `00007701`:** a análise estática só continha o literal curto `7701` no `libapp.so` (offset `0x993768`). A sessão real confirmou o UUID completo, o serviço, as propriedades e a função bidirecional dessa característica. O cache GATT desta conexão lista somente ela como característica proprietária (`ble_session_logcat.txt:63–65`). Os UUIDs `FFF0`–`FFF3` presentes no snapshot pertencem a outras rotas possíveis do app; **não aparecem no dispositivo observado**.

### Ponte BLE Android confirmada

O arquivo `jadx_base/sources/p005a4/s.java` contém o plugin BLE genérico (nomes ofuscados). Em `s.e` (callback GATT), `onCharacteristicChanged` encaminha notificações (`:3055–3059`), `onCharacteristicRead` encaminha respostas de leitura (`:3063–3073`), `onCharacteristicWrite` trata confirmação de escrita (`:3077–3104`) e `onDescriptorWrite` trata o CCCD (`:3173–3204`). O método grande de despacho, parcialmente não decompilado, contém `setCharacteristicNotification` (`:1773`), seleção de `ENABLE_NOTIFICATION_VALUE`/`ENABLE_INDICATION_VALUE` (`:1843–1867`), `writeCharacteristic` (`:2223–2247`) e `readCharacteristic` (`:2302`). A descoberta GATT enumera UUIDs e propriedades, sem codificar valores AUXSOL (`:879–931`, `:3246–3260`). Essas rotinas comprovam a **capacidade** de ler, escrever e assinar notificações, mas não ligam nenhum UUID específico a uma dessas ações.

## Solicitação de telemetria: o que está confirmado

O snapshot Dart contém as classes/rotinas abaixo. Os caminhos Dart são recuperados como strings de metadados de AOT; não existem arquivos-fonte Dart no APK.

| Componente localizado | Evidência | Interpretação limitada |
|---|---|---|
| `package:base/ble/protol/auxsol/ble_auxsol_cmd.dart`, `BleAuxsolCmd`, `BleAuxsolCmdExtension|get#value` | `libapp_strings.tsv:55017`, `:69871`, `:13165` | Há comandos AUXSOL codificados como valores; os números e bytes dos comandos não foram recuperados. |
| `ble_auxsol_frame.dart`, `ble_auxsol_frame_client.dart`, `BleAuxsolEncodeFrame`, `BleAuxsolDecodeFrame`, `BleAuxsolFrameClient` | `:126869`, `:37189`, `:55020`, `:93278`, `:115208` | Há montagem, envio e interpretação de quadros AUXSOL. Cabeçalho, comprimento, checksum e comandos exatos não foram determinados. |
| `ble_codec_auxsol.dart`, `BleCodecAuxsol`; `ble_tlv.dart`, `decodeTlv`, `encodeTlv` | `:136874`, `:27785`, `:39747`, `:48852`, `:130260` | Indicam uma camada de codec e TLV. Não se pode afirmar que toda resposta de `7701` usa TLV. |
| `ble_modbus_cmd.dart`, `BleModbusCmd`; `BleModbusFrameClient`, `BleModbusClientImpl`; `readHoldingRegisters`, `readInputRegisters`, `readRegisters` | `:56099`, `:82359`, `:31694`, `:50662`, `:36966`, `:83627`, `:51735` | O app inclui requisições de leitura Modbus via BLE. Os nomes das duas primeiras operações e o banco de pontos sustentam funções de leitura 3 e 4; o encapsulamento BLE exato não foi recuperado. |
| `appendModbusRtuCrc`, `verifyModbusRtuCrc`, `calculateBleModbusCrc16` | `:127872`, `:61516`, `:6856` | Há cálculo/verificação de CRC; polinômio, ordem dos bytes e exemplos de quadro não foram verificados no código AOT. |

No banco `sys-AUXSOL.db`, `T_INVERTER_POINT.READ_FUNC` contém valores **3** e **4** em pontos de telemetria. Esses valores correspondem convencionalmente a *Read Holding Registers* e *Read Input Registers*, coerentes com os métodos do snapshot. O banco registra `BASE_ADDR`, `OFFSET`, `DATA_TYPE`, `LENGTH`, `RATE`, `PARSER` e `PARSER_CONFIG`; ele não fornece, por si só, endereço escravo, sequência de inicialização, UUID de transporte ou bytes completos da requisição. `METHODS='RW'` e `WRITE_FUNC=16` aparecem inclusive em contadores de energia: não devem ser confundidos com uma instrução para escrever nesses pontos.

### Comando de telemetria observado no celular

O arquivo `ble_7701_telemetria.tsv` contém dois pares de escrita e notificação, extraídos de `btsnoop_hci.log` do bugreport. Os pacotes são da conexão com handle ACL `7`, escrita ATT no handle `0x002a` e notificação no mesmo handle, entre 11:34:35 e 11:34:49 **no horário local do celular (UTC−03:00)**. Foram selecionados somente esses quatro valores da característica; o bugreport integral, que continha outros dados do aparelho, foi removido após a extração.

- Valor completo escrito **pelo app** na característica: `02 00 00 00 0f 55 ff ff 09 08 01 04 10 27 54 00 7a 01 e7 6b` (20 bytes).
- O trecho interno `01 04 10 27 54 00 7a 01` é verificável como: unidade `01`, função `04`, endereço `0x2710` = **10000** em little endian, quantidade `0x0054` = **84 registradores**, CRC Modbus `0x017a` transmitido como `7a 01`. O CRC calculado sobre `01 04 10 27 54 00` confere. A semântica exata dos bytes externos `02 00 00 00 0f 55 ff ff 09 08` e `e7 6b` ainda não foi verificada.
- A notificação começa com `02 00 00 00 b9 66 ff ff 09 82 00 b0 01 04 10 27 a8 00`; seguem **168 bytes de dados** (`0x00a8`) e CRC do trecho interno, depois dois bytes externos. O CRC Modbus do trecho interno, incluindo o CRC recebido, resulta em zero. O cabeçalho mostra a mesma unidade, função e endereço da requisição.
- A repetição em 11:34:48 enviou a mesma requisição e recebeu nova notificação em 11:34:49. O `btsnoop` também registra outras requisições do app na `7701`; sua finalidade ainda não foi classificada.
- Uma notificação anterior, às 11:34:29, contém a string ASCII `ASN-6SL-G2`, confirmando o modelo anunciado nesta sessão.

## Decodificação de dados do inversor

Rotinas recuperadas do snapshot: `parseByteData` (`libapp_strings.tsv:92362`), `parse32Data` (`:86034`), `parseData` (`:92636`), `parseInverterSVData` (`:129446`), `parseInverterSVBitString` (`:18417`), `parseInverterCurveData` (`:65605`), `decodePoint` (`:28603`), além de `package:auxsol/sqlite/point/parse/sqlite_point_parse.dart` (`:62058`), `parsers/ip_parser.dart` (`:13410`), `enum_parser.dart` (`:15259`), `complex_parser.dart` (`:15452`), `bit_string_parser.dart` (`:117484`) e `time_parser.dart` (`:75905`). O fluxo indicado pelos nomes é: resposta BLE → decodificação de quadro/CRC → registros → interpretação de pontos com tipos, escalas e parsers do SQLite. **A ordem exata e a implementação de cada etapa ainda são hipótese**, pois o Dart AOT não foi decompilado.

Exemplos **confirmados como metadados do banco** (endereço mostrado como `BASE_ADDR + OFFSET`, sem afirmar se há transformação adicional no protocolo):

| ID / ponto | Endereço calculado | Função | Tipo, escala e unidade | Nome em português no banco |
|---|---:|---:|---|---|
| 1558 | 1558 | 3 | U32 × 0,01 kWh | Geração Hoje |
| 1564 | 1564 | 3 | U32 × 0,01 kWh | Geração Total |
| 10006 | 10006 | 4 | U16 × 0,01 kW | AC Potência Ativa |
| 10008 | 10008 | 4 | U32 × 0,01 kWh | AC Geração Hoje |
| 10010 | 10010 | 4 | U32 × 0,01 kWh | AC Geração Total |
| 10012 | 10012 | 4 | U16 × 0,1 V | AC Tensão Fase A |
| 10034 | 10034 | 4 | U16 × 0,1 V | DC Tensão MPPT1 |

Os IDs 1558/1564 e 10008/10010 pertencem a famílias distintas de pontos. A captura confirmou que o app consultou a família `10000` neste dispositivo e permitiu validar alguns campos abaixo. O tratamento de valores inválidos e dos demais parsers ainda não foi resolvido.

### Valores decodificados da captura

Na resposta de 11:34:36, os 168 bytes correspondem a 84 registradores consecutivos a partir de 10000. Para os campos abaixo, a ordem **little endian** reproduz grandezas fisicamente coerentes; a captura seguinte mostra variações pequenas e progressão dos acumulados. A associação entre endereço e campo usa o banco do app. Esses são valores observados, não uma API pronta nem garantia de compatibilidade com todos os firmwares.

| Ponto | Bytes às 11:34:36 → valor | Bytes às 11:34:49 → valor |
|---|---|---|
| 10006, potência ativa AC | `59 02` → 6,01 kW | `59 02` → 6,01 kW |
| 10008, geração do dia | `ff 07 00 00` → 20,47 kWh | `01 08 00 00` → 20,49 kWh |
| 10010, geração total | `50 10 00 00` → 41,76 kWh | `52 10 00 00` → 41,78 kWh |
| 10012, tensão fase A | `1b 09` → 233,1 V | `1a 09` → 233,0 V |
| 10034, tensão MPPT1 | `2a 09` → 234,6 V | `27 09` → 234,3 V |

Para esses cinco campos, `valor = inteiro little endian × RATE`. O CRC foi conferido; as demais posições do bloco não foram validadas individualmente. O banco oferece a definição dos outros pontos.

## Lacunas objetivas

1. O comando observado para o bloco 10000–10083 foi identificado, mas os bytes externos do encapsulamento AUXSOL ainda não foram interpretados integralmente. Esta análise **não recomenda reproduzir a escrita** antes de compreender os outros comandos, tratamento de erros e estados do dispositivo.
2. As outras requisições vistas na mesma característica, seus campos e famílias de pontos ainda não foram classificadas.
3. O JADX decompila a ponte Android, mas não o snapshot Dart em `libapp.so`. O código AOT ainda seria necessário para fechar regras de versão, exceções e todos os parsers.
