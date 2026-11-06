# Solar Casa

Painel web de monitoramento e simulação solar com React, Three.js e Recharts. A cena 3D representa aproximadamente a casa das fotos fornecidas; não é um levantamento arquitetônico.

## Iniciar

```bash
npm install
npm run dev
```

Abra o endereço exibido pelo Vite (normalmente `http://localhost:5173`). Para gerar a versão de produção, execute `npm run build`.

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

### Sem medidor inteligente

Use **Leituras Enel** para salvar uma primeira leitura dos três registros acumulados: energia recebida da rede, energia enviada à rede e geração total AUXSOL. O painel mostra que essa referência foi registrada e aguarda uma segunda leitura. Nas leituras seguintes, informe novamente os três totais acumulados. As diferenças fornecem importação, exportação e produção do intervalo. O painel calcula o consumo da casa (`produção + recebida − enviada`) e o autoconsumo solar (`produção − enviada`). Os registros não precisam começar em zero. O formulário aceita valores fictícios e intervalos curtos para simulação. O histórico manual pode ser visto por intervalo, dia, mês e ano e exportado em CSV. Ele fica salvo neste navegador.

O **saldo na rede** aparece após a segunda leitura: energia enviada menos energia recebida no intervalo. Um resultado positivo indica mais energia enviada que recebida. O painel também mostra o saldo líquido desde a leitura inicial. Esses números não substituem o saldo de créditos apurado na fatura pela Enel.
O CSV inclui `saldo_rede_kwh` para cada intervalo e `saldo_acumulado_kwh` para o total progressivo desde a primeira leitura; o gráfico manual mostra a evolução desse acumulado.

O botão **Zerar todos os dados**, no menu lateral, apaga as leituras Enel, amostras importadas, configurações e dados locais de demonstração deste site neste navegador. Depois da limpeza, os indicadores de monitoramento começam em zero; a capacidade física cadastrada (12 módulos, 7,56 kWp e inversor de 6 kW) continua sendo a configuração do sistema.

O formulário manual requer o total acumulado de geração do AUXSOL, não a produção de um único dia. Uma leitura do medidor às 18h deve ser acompanhada pelo total AUXSOL registrado às 18h. Leituras antigas sem esse total continuam no histórico, mas o consumo de seus intervalos fica pendente; a primeira nova leitura com total AUXSOL serve como referência solar. Registros inteiros do medidor Enel podem esconder pequenos fluxos quando dois valores consecutivos são iguais. Potência instantânea da casa e créditos da fatura Enel não são inferidos desses registros.

O painel inicia com indicadores de monitoramento zerados. Para visualizar medições reais, use **Conectar dados** e configure uma ponte local ou API autorizada que disponibilize leituras em JSON, ou importe um CSV com `timestamp` e `solar_kw`. A fonte deve permitir CORS. Os campos opcionais incluem consumo, importação/exportação da rede, tensão, corrente, frequência, temperatura, entradas CC e estado do inversor.

As amostras e a URL são guardadas no armazenamento local do navegador. O datasheet fornecido descreve o inversor AUXSOL ASN-6SL-G2, mas não especifica uma API de monitoramento; a integração direta depende do método autorizado para a instalação.

## Simulação

A simulação inicial usa 12 módulos e 7,56 kWp, correspondentes a 630 Wp por módulo. É possível ajustar os módulos, alternar dia/noite e configurar horas de sol pleno e perdas. A estimativa não substitui um projeto técnico.

## Percurso do sol na vista 3D

Na Visão geral, o controle acima da casa permite arrastar a hora local entre 00:00 e 23:59, reproduzir as 24 horas ou voltar ao horário atual. O botão da localidade atualiza as coordenadas pelo GPS. A cidade escolhida no clima também fornece latitude, longitude e fuso horário. A posição solar, a luz, as sombras e a passagem dia/noite acompanham a data atual e as coordenadas, usando as equações de posição solar da NOAA.

O norte virtual da cena aponta para o eixo `-Z`. A orientação real da casa não foi medida; portanto, a posição do sol é geográfica, mas a direção das sombras em relação à fachada permanece ilustrativa até a cena ser alinhada com uma bússola ou planta orientada.
