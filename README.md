# Solar Casa

Painel web de monitoramento e simulação solar com React, Three.js e Recharts. A cena 3D representa aproximadamente a casa das fotos fornecidas; não é um levantamento arquitetônico.

## Iniciar

```bash
npm install
python -m pip install -r bridge/requirements.txt
npm run dev
```

Abra o endereço exibido pelo Vite (normalmente `http://localhost:5173`). `npm run dev` inicia o site e a ponte BLE no mesmo terminal; se a ponte já estiver ativa na porta 3001, reutiliza essa instância. A ponte pode levar alguns segundos para localizar o inversor e tenta novamente se a conexão cair. Use `npm run dev:web` para iniciar só o site. Para gerar a versão de produção, execute `npm run build`.

## Monitoramento

Em **Visão geral**, o painel reúne seis visualizações: Vista externa, Fluxo de energia, Corte interno, Planta da casa, Dashboard e Diagrama técnico. A cena oferece iluminação diurna/noturna, câmeras aérea/fachada/telhado e ampliação. O dashboard alterna entre temas claro e escuro.

O menu oferece **Visão geral, Solar, Energia, Histórico, Dispositivos, Casa inteligente, Alertas e Relatórios**. As páginas de monitoramento usam apenas os campos fornecidos pela fonte. Campos ausentes aparecem como não informados, sem serem tratados como zero.

## Casa inteligente

A aba **Casa inteligente** começa em modo demonstração: os botões alteram somente os estados exibidos neste navegador. Para controlar aparelhos reais, clique em **Conectar Home Assistant**, informe a URL base da instalação e um token de acesso de longa duração criado no perfil do Home Assistant. O painel lista entidades dos domínios `light`, `switch`, `fan` e `input_boolean`, e envia comandos `turn_on`/`turn_off` pela API REST. Estados são atualizados a cada 30 segundos e após cada comando.

O navegador precisa conseguir acessar o Home Assistant, e a instalação deve permitir CORS para a origem do painel. Ao usar HTTPS no painel, use HTTPS também no Home Assistant. A URL é salva no armazenamento local; o token fica apenas na sessão da aba e é apagado ao desconectar. Os dados solares e a conexão Home Assistant são independentes.

O modelo residencial foi ajustado pelas fotos da fachada, dos fundos e do lote visto de cima. Representa um duplex em terreno estreito e comprido, com recuo pavimentado, fachada bege com faixa de pedra e ciprestes, varanda coberta e quintal gramado. As câmeras **Fachada** e **Fundos** destacam a unidade. O corte e a planta oferecem três quartos no andar superior; a disposição das divisórias, as dimensões e a distribuição dos 12 módulos entre as águas do telhado são ilustrativas até haver uma planta e medidas reais.

## Clima e previsão

No header, busque uma cidade ou use a localização do navegador para ver temperatura, índice UV, irradiância solar estimada e a previsão dos próximos sete dias, com máxima, mínima e condição do tempo. Os dados meteorológicos vêm da [Open-Meteo](https://open-meteo.com/en/docs), separadamente das leituras do inversor.

## Sistema real

### Captura AUXSOL por BLE (arquivo)

A sessão do app AUXSOL no celular confirmou serviço `00000077`, característica `00007701` e uma resposta de telemetria com 84 registradores a partir de 10000. Nesta estação, duas respostas reais foram salvas em `auxsol_apk/ble_7701_telemetria.tsv`. Para convertê-las em um CSV compatível com o painel:

```powershell
python auxsol_apk/convert_7701.py
```

No painel, abra **Conectar dados → Arquivo CSV** e escolha `auxsol_apk/auxsol_telemetria.csv`. As leituras aparecerão nas páginas **Visão geral**, **Solar**, **Histórico** e **Dispositivos**. O CSV inclui potência CA, geração diária e total, tensão CA e tensão do MPPT1. Campos não medidos nessa captura, como consumo da casa e fluxo da rede, permanecem não informados. O arquivo contém apenas duas amostras de 15/11/2026; importá-lo não cria monitoramento contínuo. O conversor valida o formato e CRC das notificações gravadas e não acessa Bluetooth ou o inversor. Veja `auxsol_apk/RELATORIO_TECNICO_BLE.md` para os detalhes técnicos.

Os APKs, a decompilação, os logs, o TSV e o CSV de leituras reais são **arquivos locais não versionados**. Após clonar o repositório em outro computador, será necessário fornecer uma nova captura ao conversor ou usar a ponte ao vivo. O relatório técnico e o código do conversor são versionados.

### Monitoramento AUXSOL ao vivo

A ponte `bridge/auxsol_live.py` consulta o inversor diretamente pelo Bluetooth do computador e fornece `http://127.0.0.1:3001/api/solar` ao painel. A leitura ativa requer uma escrita GATT na característica `00007701` com a requisição de função `04` observada na captura; isso solicita telemetria, embora a operação BLE se chame escrita. O comando é limitado a 84 registradores a partir de 10000 e não contém função de ajuste de parâmetros. A ponte foi testada em 15/11/2026 com leituras válidas a cada 60 segundos.

Com o Bluetooth do computador ligado, `npm run dev` já inicia a ponte. Se houver disputa pela conexão, desconecte o app AUXSOL do inversor. Para executar **somente** a ponte, sem o servidor Vite:

```powershell
python bridge/auxsol_live.py --scan
python bridge/auxsol_live.py --allow-gatt-write
```

Se houver mais de um dispositivo AUXSOL no alcance, acrescente `--address ENDERECO` ao último comando. Mantenha a ponte aberta. Em um navegador sem fonte salva, o painel detecta automaticamente a ponte local quando ela já recebeu uma amostra. Caso contrário, escolha **Conectar dados → Ponte local / API**, informe `http://127.0.0.1:3001/api/solar` e clique **Testar e carregar**. O painel consulta o endpoint a cada 60 segundos. A ponte escuta somente em `127.0.0.1` e mantém as últimas 1440 amostras na memória. Para parar a execução manual, pressione `Ctrl+C`; se ela tiver sido iniciada em segundo plano, encerre o processo `bridge/auxsol_live.py`. Para validar o endpoint sem Bluetooth: `python bridge/auxsol_live.py --csv auxsol_apk/auxsol_telemetria.csv`.

A ponte precisa continuar rodando no PC próximo ao inversor. Ela não é iniciada automaticamente ao ligar o computador, mas volta quando você executar `npm run dev`. Para verificar se está recebendo dados, abra `http://127.0.0.1:3001/api/solar` **nesse PC**: a resposta deve conter `"status": "recebendo"` e uma lista `samples` com horários recentes. Se o processo for reiniciado, as amostras que estavam apenas na memória da ponte se perdem; o dashboard pode continuar mostrando as amostras já salvas no armazenamento local daquele navegador.

### Publicação no Vercel e acesso pelo tablet

**Publicar o frontend no Vercel não publica a ponte BLE.** O site React pode ser servido pela Vercel, mas `bridge/auxsol_live.py` precisa de um computador com Bluetooth próximo ao inversor. As [Vercel Functions](https://vercel.com/docs/functions) executam na infraestrutura da Vercel, fora do alcance do Bluetooth local.

| Onde o dashboard é aberto | Com a arquitetura atual |
|---|---|
| No PC que roda a ponte, pelo Vite local | Funciona enquanto o PC e a ponte estiverem ligados. O navegador consulta `127.0.0.1:3001`. |
| No mesmo PC, pela URL do Vercel | O frontend abre. A consulta à ponte local pode depender das permissões e regras de acesso à rede local do navegador; não é uma solução garantida para produção. |
| No tablet, pela URL do Vercel | O frontend abre, mas **não recebe as leituras da ponte do PC**. `127.0.0.1` no tablet aponta para o próprio tablet. |

Mesmo que PC e tablet estejam no mesmo Wi-Fi, a ponte atual aceita conexões somente de `127.0.0.1` no PC. Trocar a URL por um IP da rede não resolve sozinho: o servidor teria de escutar na rede e um site HTTPS acessando um serviço HTTP local pode enfrentar bloqueio de conteúdo misto ou pedir permissão de acesso à rede local. Consulte [MDN: localhost](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Authority), [conteúdo misto](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content) e [acesso à rede local](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Local_network_access).

Para disponibilizar as **mesmas leituras ao vivo no Vercel e no tablet**, a evolução recomendada é:

```text
Inversor ──BLE──> ponte no PC próximo ao inversor
                        │ envia amostras por HTTPS
                        ▼
                 API/banco de dados
                        │ consulta por HTTPS
                        ▼
             dashboard no Vercel (PC ou tablet)
```

Essa API/banco ainda **não foi implementada neste projeto**. Ela precisará receber os dados da ponte, armazená-los e oferecer leitura autenticada ao dashboard. O PC continuará necessário para coletar BLE; se ele ou a ponte parar, a última amostra armazenada permanece visível, mas deixa de ser atualizada. O armazenamento local do navegador não é compartilhado entre PC e tablet, portanto importar CSV ou salvar a URL em um deles não configura o outro.

### Sem medidor inteligente

Use **Leituras Enel** para salvar uma primeira leitura dos três registros acumulados: energia recebida da rede, energia enviada à rede e geração total AUXSOL. O painel mostra que essa referência foi registrada e aguarda uma segunda leitura. Nas leituras seguintes, informe novamente os três totais acumulados. As diferenças fornecem importação, exportação e produção do intervalo. O painel calcula o consumo da casa (`produção + recebida − enviada`) e o autoconsumo solar (`produção − enviada`). Os registros não precisam começar em zero. O formulário aceita valores fictícios e intervalos curtos para simulação. O histórico manual pode ser visto por intervalo, dia, mês e ano e exportado em CSV. Ele fica salvo neste navegador.

O **saldo na rede** aparece após a segunda leitura: energia enviada menos energia recebida no intervalo. Um resultado positivo indica mais energia enviada que recebida. O painel também mostra o saldo líquido desde a leitura inicial. Esses números não substituem o saldo de créditos apurado na fatura pela Enel.
O último intervalo salvo também aparece em **Visão geral**, **Solar** e **Energia**. Na Visão geral, os indicadores de energia em kWh, o balanço e a autossuficiência usam as diferenças dos contadores Enel/AUXSOL. Em Solar, aparecem produção e uso direto do solar. Em Energia, aparecem consumo, importação, exportação, uso direto, autossuficiência e saldos. Cada área identifica as datas do intervalo. A potência em kW e suas curvas continuam vindo das amostras do inversor; uma leitura acumulada não informa potência instantânea. Sem dois totais AUXSOL para o intervalo, produção, consumo e uso direto ficam como não informados. Essas leituras manuais pertencem apenas ao navegador e à origem do site onde foram salvas.
O CSV inclui `saldo_rede_kwh` para cada intervalo e `saldo_acumulado_kwh` para o total progressivo desde a primeira leitura; o gráfico manual mostra a evolução desse acumulado.

O botão **Zerar todos os dados**, no menu lateral, apaga as leituras Enel, amostras importadas, configurações e dados locais de demonstração deste site neste navegador. Depois da limpeza, os indicadores de monitoramento começam em zero; a capacidade física cadastrada (12 módulos, 7,56 kWp e inversor de 6 kW) continua sendo a configuração do sistema.

O formulário manual requer o total acumulado de geração do AUXSOL, não a produção de um único dia. Uma leitura do medidor às 18h deve ser acompanhada pelo total AUXSOL registrado às 18h. Leituras antigas sem esse total continuam no histórico, mas o consumo de seus intervalos fica pendente; a primeira nova leitura com total AUXSOL serve como referência solar. Registros inteiros do medidor Enel podem esconder pequenos fluxos quando dois valores consecutivos são iguais. Potência instantânea da casa e créditos da fatura Enel não são inferidos desses registros.

O painel inicia com indicadores de monitoramento zerados. Para visualizar medições reais, use **Conectar dados** e configure uma ponte local ou API autorizada que disponibilize leituras em JSON, ou importe um CSV com `timestamp` e `solar_kw`. A fonte deve permitir CORS. Os campos opcionais incluem consumo, importação/exportação da rede, tensão, corrente, frequência, temperatura, entradas CC e estado do inversor.

As amostras e a URL são guardadas no armazenamento local de **cada navegador**. O datasheet fornecido descreve o inversor AUXSOL ASN-6SL-G2, mas não especifica uma API de monitoramento. A comunicação BLE utilizada aqui foi identificada pela análise estática do app e por uma captura autorizada da sessão do dispositivo; as demais funções do protocolo ainda não foram mapeadas.

## Simulação

A simulação inicial usa 12 módulos e 7,56 kWp, correspondentes a 630 Wp por módulo. É possível ajustar os módulos, alternar dia/noite e configurar horas de sol pleno e perdas. A estimativa não substitui um projeto técnico.

## Percurso do sol na vista 3D

Na Visão geral, o controle acima da casa permite arrastar a hora local entre 00:00 e 23:59, reproduzir as 24 horas ou voltar ao horário atual. O botão da localidade atualiza as coordenadas pelo GPS. A cidade escolhida no clima também fornece latitude, longitude e fuso horário. A posição solar, a luz, as sombras e a passagem dia/noite acompanham a data atual e as coordenadas, usando as equações de posição solar da NOAA.

O norte virtual da cena aponta para o eixo `-Z`. A orientação real da casa não foi medida; portanto, a posição do sol é geográfica, mas a direção das sombras em relação à fachada permanece ilustrativa até a cena ser alinhada com uma bússola ou planta orientada.
