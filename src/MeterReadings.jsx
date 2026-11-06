import React, { useMemo, useState } from 'react'
import { BarChart3, Download, Info, Save, Trash2 } from 'lucide-react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import './meter-readings.css'
import { meterIntervals } from './meterData.js'

const format = (value) => value == null ? '—' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kWh`
const dateLabel = (value) => new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const round = (value) => Math.round(value * 1000) / 1000
const localNow = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }

function csvDownload(rows) {
  const header = 'inicio,fim,producao_kwh,importacao_kwh,exportacao_kwh,saldo_rede_kwh,saldo_acumulado_kwh,consumo_kwh,autoconsumo_kwh'
  const lines = rows.map((row) => [row.start, row.end, row.solar, row.imported, row.exported, row.gridBalance, row.cumulativeBalance, row.consumption, row.selfUse].map((value) => value ?? '').join(','))
  const url = URL.createObjectURL(new Blob(['\uFEFF', header, '\n', lines.join('\n')], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'leituras-enel-solar.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export default function MeterReadings({ readings, onChange }) {
  const [timestamp, setTimestamp] = useState(localNow)
  const [importText, setImportText] = useState('')
  const [exportText, setExportText] = useState('')
  const [solarTotalText, setSolarTotalText] = useState('')
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('Intervalos')
  const last = readings.at(-1)

  const intervals = useMemo(() => meterIntervals(readings), [readings])

  const totals = intervals.reduce((acc, row) => {
    acc.imported += row.imported
    acc.exported += row.exported
    if (row.solar != null) {
      acc.solar += row.solar
      acc.consumption += row.consumption
      acc.selfUse += row.selfUse
      acc.complete += 1
    }
    return acc
  }, { imported: 0, exported: 0, solar: 0, consumption: 0, selfUse: 0, complete: 0 })

  const chartData = useMemo(() => {
    if (period === 'Intervalos') return intervals.map((row) => ({ label: dateLabel(row.end), solar: row.solar, imported: row.imported, exported: row.exported, consumption: row.consumption, cumulativeBalance: row.cumulativeBalance }))
    const grouped = new Map()
    for (const row of intervals) {
      const date = new Date(row.end)
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const key = period === 'Diário' ? `${month}-${String(date.getDate()).padStart(2, '0')}` : period === 'Mensal' ? month : String(date.getFullYear())
      const value = grouped.get(key) || { label: key, solar: 0, imported: 0, exported: 0, consumption: 0, complete: true }
      value.imported += row.imported
      value.exported += row.exported
      value.cumulativeBalance = row.cumulativeBalance
      if (row.solar == null) value.complete = false
      else { value.solar += row.solar; value.consumption += row.consumption }
      grouped.set(key, value)
    }
    return [...grouped.values()].map((row) => ({ ...row, solar: row.complete ? round(row.solar) : null, consumption: row.complete ? round(row.consumption) : null }))
  }, [intervals, period])

  function persist(next) {
    onChange(next)
  }

  function save(event) {
    event.preventDefault()
    const time = new Date(timestamp).getTime()
    const parse = (value) => Number(value.trim().replace(',', '.'))
    const imported = parse(importText)
    const exported = parse(exportText)
    const solarTotal = parse(solarTotalText)
    if (!Number.isFinite(time) || time > Date.now()) return setError('Informe uma data e hora válidas, até o momento atual.')
    if ([imported, exported, solarTotal].some((value) => !Number.isFinite(value) || value < 0) || !importText.trim() || !exportText.trim() || !solarTotalText.trim()) return setError('Informe os três registros acumulados com números não negativos.')
    if (last && time <= new Date(last.timestamp).getTime()) return setError('A nova leitura precisa ser posterior à última.')
    if (last && (imported < last.importKwh || exported < last.exportKwh)) return setError('Os registros acumulados não podem diminuir. Confira os números do medidor.')
    if (last && solarTotal != null && last.solarTotalKwh != null && solarTotal < last.solarTotalKwh) return setError('O total acumulado AUXSOL não pode diminuir.')
    const next = [...readings, { timestamp: new Date(time).toISOString(), importKwh: imported, exportKwh: exported, solarTotalKwh: solarTotal }]
    persist(next)
    setImportText(''); setExportText(''); setSolarTotalText(''); setTimestamp(localNow()); setError('')
  }

  return <div className="meter-page">
    <div className="meter-steps"><div className={!last ? 'active' : 'done'}><strong>1</strong><span>Salve os três totais acumulados como referência.</span></div><div className={last ? 'active' : ''}><strong>2</strong><span>Na próxima leitura, informe os três novos totais.</span></div><div className={intervals.length ? 'active' : ''}><strong>3</strong><span>Veja as diferenças e o balanço calculado.</span></div></div>
    <div className="detail-info"><Info size={18} /> Anote os valores acumulados em kWh da Enel (recebido e injetado) e da geração total AUXSOL no mesmo horário. O painel calcula as diferenças entre duas leituras. O código 03 ou A costuma indicar energia recebida da rede; 103, 55 ou r indica energia injetada.</div>
    <div className="meter-layout">
      <section className="detail-panel"><div className="card-heading"><div><span className="eyebrow">{last ? 'ETAPA 2 · PRÓXIMA LEITURA' : 'ETAPA 1 · PONTO DE PARTIDA'}</span><h2>{last ? 'Nova leitura' : 'Leitura inicial'}</h2></div></div>
        <p className="detail-description">{last ? 'Copie os três totais acumulados mostrados agora. Os anteriores já estão salvos e serão subtraídos automaticamente.' : 'Copie os três totais acumulados mostrados agora. Esta leitura será o ponto de partida; ainda não há consumo para calcular.'}</p>
        {last && <div className="meter-reference"><strong>Referência anterior · {dateLabel(last.timestamp)}</strong><span>Recebido da Enel: {format(last.importKwh)}</span><span>Injetado na rede: {format(last.exportKwh)}</span>{last.solarTotalKwh != null ? <span>Geração acumulada AUXSOL: {format(last.solarTotalKwh)}</span> : <span>Sem total AUXSOL anterior: a próxima leitura inicia a referência solar.</span>}</div>}
        <form className="meter-form" onSubmit={save}>
          <label>Data e hora da leitura<input type="datetime-local" required value={timestamp} onChange={(event) => setTimestamp(event.target.value)} /></label>
          <label>Consumido da rede · código 03 ou A (kWh)<input type="text" inputMode="decimal" required placeholder={last ? String(last.importKwh) : 'Ex.: 1234,5'} value={importText} onChange={(event) => setImportText(event.target.value)} /></label>
          <label>Injetado na rede · código 103, 55 ou r (kWh)<input type="text" inputMode="decimal" required placeholder={last ? String(last.exportKwh) : 'Ex.: 567,8'} value={exportText} onChange={(event) => setExportText(event.target.value)} /></label>
          <label>Geração total acumulada AUXSOL (kWh)<input type="text" inputMode="decimal" required placeholder={last?.solarTotalKwh != null ? String(last.solarTotalKwh) : 'Total desde a instalação, não produção do dia'} value={solarTotalText} onChange={(event) => setSolarTotalText(event.target.value)} /></label>
          <p className="detail-footnote">{last ? 'Informe o total acumulado AUXSOL, não a produção do dia. Para simular, você pode usar valores fictícios e intervalos curtos.' : 'Os três registros não precisam começar em zero. Você também pode usar valores fictícios para simular.'}</p>
          {error && <div className="error-note">{error}</div>}
          <button className="primary-button" type="submit"><Save size={16} /> Salvar leitura</button>
        </form>
        {readings.length > 0 && <button className="detail-action meter-delete" type="button" onClick={() => { if (window.confirm('Apagar todas as leituras Enel salvas neste navegador? Esta ação não pode ser desfeita.')) { persist([]); setError('') } }}><Trash2 size={16} /> Zerar todas as leituras</button>}
      </section>
      <section className="detail-panel"><div className="card-heading"><div><span className="eyebrow">BALANÇO</span><h2>{intervals.length ? 'Último intervalo' : last ? 'Leitura inicial registrada' : 'Aguardando leitura inicial'}</h2></div></div>
        {intervals.length ? <div className="meter-results"><div className="meter-period"><span>Período calculado</span><strong>{dateLabel(intervals.at(-1).start)} → {dateLabel(intervals.at(-1).end)}</strong></div>{[
          ['Produção AUXSOL', intervals.at(-1).solar], ['Recebido da Enel', intervals.at(-1).imported], ['Enviado à Enel', intervals.at(-1).exported], ['Consumo da casa', intervals.at(-1).consumption], ['Autoconsumo solar', intervals.at(-1).selfUse],
        ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{format(value)}</strong></div>)}<div className="meter-net"><span>Saldo na rede neste intervalo</span><strong>{intervals.at(-1).gridBalance > 0 ? '+' : ''}{format(intervals.at(-1).gridBalance)}</strong></div><div className="meter-net"><span>Saldo acumulado desde a leitura inicial</span><strong>{intervals.at(-1).cumulativeBalance > 0 ? '+' : ''}{format(intervals.at(-1).cumulativeBalance)}</strong></div><p>Saldo na rede = enviado − recebido. O acumulado soma os saldos de todos os intervalos. Consumo = produção + recebido − enviado.</p>{readings.slice(-2).every((reading) => Number.isInteger(reading.importKwh) && Number.isInteger(reading.exportKwh)) && <p>Os registros inteiros da Enel têm resolução limitada: uma diferença de 0 kWh pode esconder um fluxo pequeno.</p>}</div> : last ? <div className="meter-reference"><strong>Referência salva para a próxima leitura</strong><span>Data: {dateLabel(last.timestamp)}</span><span>Recebido da Enel: {format(last.importKwh)}</span><span>Injetado na rede: {format(last.exportKwh)}</span><span>Geração acumulada AUXSOL: {format(last.solarTotalKwh)}</span><p>Nenhum saldo foi calculado ainda. Volte quando tiver uma nova leitura.</p></div> : <p className="detail-description">Salve a primeira leitura. O painel calculará as diferenças quando houver a próxima.</p>}
      </section>
    </div>
    {intervals.length > 0 && <><div className="detail-values meter-totals"><div className="detail-value"><span>Recebido · todos os intervalos</span><strong>{format(round(totals.imported))}</strong></div><div className="detail-value blue"><span>Enviado · todos os intervalos</span><strong>{format(round(totals.exported))}</strong></div><div className="detail-value"><span>Saldo líquido na rede desde a leitura inicial</span><strong>{totals.exported - totals.imported > 0 ? '+' : ''}{format(round(totals.exported - totals.imported))}</strong></div><div className="detail-value orange"><span>Consumo · {totals.complete} intervalos completos</span><strong>{totals.complete ? format(round(totals.consumption)) : '—'}</strong></div></div><div className="detail-info"><Info size={18} /> O saldo acima é apenas a diferença entre energia enviada e recebida nas leituras registradas. O saldo de créditos da Enel é apurado no ciclo de faturamento e aparece na fatura.</div>
      <section className="detail-panel"><div className="card-heading"><div><span className="eyebrow">HISTÓRICO MANUAL</span><h2>Energia por período</h2></div><BarChart3 size={20} /></div><div className="period-tabs">{['Intervalos', 'Diário', 'Mensal', 'Anual'].map((item) => <button key={item} className={period === item ? 'active' : ''} onClick={() => setPeriod(item)}>{item}</button>)}</div><div className="meter-chart"><ResponsiveContainer width="100%" height={300}><ComposedChart data={chartData}><CartesianGrid stroke="#294555" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="label" tick={{ fill: '#91abba', fontSize: 10 }} /><YAxis tick={{ fill: '#91abba', fontSize: 10 }} unit=" kWh" /><Tooltip formatter={(value) => format(value)} contentStyle={{ background: '#102a3a', border: '1px solid #365568', color: '#fff' }} /><Legend /><Bar dataKey="solar" name="Solar" fill="#5be4ad" /><Bar dataKey="imported" name="Recebido" fill="#f48a91" /><Bar dataKey="exported" name="Enviado" fill="#86bdff" /><Bar dataKey="consumption" name="Consumo" fill="#ffb87a" /><Line type="monotone" dataKey="cumulativeBalance" name="Saldo acumulado" stroke="#d9a8ff" strokeWidth={3} dot /></ComposedChart></ResponsiveContainer></div><p className="detail-footnote">A linha mostra o saldo acumulado desde a primeira leitura. Os totais diários, mensais e anuais agrupam cada intervalo pela data da leitura final. Se a leitura ocorrer às 18h, o total diário representa o intervalo até as 18h, não o dia civil.</p></section>
      <section className="detail-panel"><div className="card-heading"><div><span className="eyebrow">REGISTROS SALVOS</span><h2>Leituras do medidor</h2></div></div><div className="reading-table-wrap"><table className="reading-table"><thead><tr><th>Data e hora</th><th>Recebido acumulado</th><th>Enviado acumulado</th><th>AUXSOL acumulado</th><th>Produção do intervalo</th><th>Consumo do intervalo</th></tr></thead><tbody>{readings.slice().reverse().map((row, index) => { const interval = intervals[readings.length - index - 2]; return <tr key={row.timestamp}><td>{dateLabel(row.timestamp)}</td><td>{format(row.importKwh)}</td><td>{format(row.exportKwh)}</td><td>{format(row.solarTotalKwh)}</td><td>{format(interval?.solar)}</td><td>{format(interval?.consumption)}</td></tr> })}</tbody></table></div><div className="meter-actions"><button className="detail-action" onClick={() => csvDownload(intervals)}><Download size={16} /> Exportar CSV</button><button className="detail-action meter-delete" onClick={() => { persist(readings.slice(0, -1)); setError('') }}><Trash2 size={16} /> Excluir última leitura</button></div></section></>}
  </div>
}
