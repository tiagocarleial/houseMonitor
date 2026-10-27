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

O menu oferece **Visão geral, Solar, Energia, Histórico, Dispositivos, Alertas e Relatórios**. As páginas usam apenas os campos fornecidos pela fonte. Campos ausentes aparecem como não informados, sem serem tratados como zero.

O modelo residencial foi ajustado pelas fotos da fachada, dos fundos e do lote visto de cima. Representa um duplex em terreno estreito e comprido, com recuo pavimentado, fachada bege com faixa de pedra e ciprestes, varanda coberta e quintal gramado. As câmeras **Fachada** e **Fundos** destacam a unidade. O corte e a planta oferecem três quartos no andar superior; a disposição das divisórias, as dimensões e a distribuição dos 12 módulos entre as águas do telhado são ilustrativas até haver uma planta e medidas reais.

## Clima e previsão

No header, busque uma cidade ou use a localização do navegador para ver temperatura, índice UV, irradiância solar estimada e a previsão dos próximos sete dias, com máxima, mínima e condição do tempo. Os dados meteorológicos vêm da [Open-Meteo](https://open-meteo.com/en/docs), separadamente das leituras do inversor.

## Sistema real

O painel inicia com dados de exemplo. Para visualizar medições reais, use **Conectar dados** e configure uma ponte local ou API autorizada que disponibilize leituras em JSON, ou importe um CSV com `timestamp` e `solar_kw`. A fonte deve permitir CORS. Os campos opcionais incluem consumo, importação/exportação da rede, tensão, corrente, frequência, temperatura, entradas CC e estado do inversor.

As amostras e a URL são guardadas no armazenamento local do navegador. O datasheet fornecido descreve o inversor AUXSOL ASN-6SL-G2, mas não especifica uma API de monitoramento; a integração direta depende do método autorizado para a instalação.

## Simulação

A simulação inicial usa 12 módulos e 7,56 kWp, correspondentes a 630 Wp por módulo. É possível ajustar os módulos, alternar dia/noite e configurar horas de sol pleno e perdas. A estimativa não substitui um projeto técnico.

## Percurso do sol na vista 3D

Na Visão geral, o controle acima da casa permite arrastar a hora local entre 00:00 e 23:59, reproduzir as 24 horas ou voltar ao horário atual. O botão da localidade atualiza as coordenadas pelo GPS. A cidade escolhida no clima também fornece latitude, longitude e fuso horário. A posição solar, a luz, as sombras e a passagem dia/noite acompanham a data atual e as coordenadas, usando as equações de posição solar da NOAA.

O norte virtual da cena aponta para o eixo `-Z`. A orientação real da casa não foi medida; portanto, a posição do sol é geográfica, mas a direção das sombras em relação à fachada permanece ilustrativa até a cena ser alinhada com uma bússola ou planta orientada.
