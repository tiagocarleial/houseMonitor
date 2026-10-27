import React, { useMemo, useState } from 'react'
import { Activity, AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, CheckCircle2, Download, Gauge, Info, PanelTop, Sun, Thermometer, Wifi, Zap } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const fmt = (value, decimals = 1) => value == null ? '—' : Number(value).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
const reading = (value, unit, decimals = 1) => value == null ? 'Não informado' : `${fmt(value, decimals)} ${unit}`
const has = (value) => value !== null && value !== undefined

function Panel({ eyebrow, title, icon: Icon, children, className = '' }) {
  return <section className={`detail-panel ${className}`}><div className="card-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{Icon && <Icon size={20} className="heading-icon" />}</div>{children}</section>
}

function ValueCard({ icon: Icon, label, value, note, tone = 'green' }) {
  return <div className={`detail-value ${tone}`}><Icon size={21} /><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>
}

function TimeChart({ samples, keys = ['solar_kw', 'consumption_kw', 'import_kw'], height = 290 }) {
  const lines = [
    { key: 'solar_kw', name: 'Solar', color: '#5be4ad' },
    { key: 'consumption_kw', name: 'Consumo', color: '#ffae6d' },
    { key: 'import_kw', name: 'Importação', color: '#f4777c' },
    { key: 'export_kw', name: 'Exportação', color: '#76b7ff' },
  ].filter((item) => keys.includes(item.key) && samples.some((sample) => has(sample[item.key])))
  return <div className="detail-chart"><div className="detail-legend">{lines.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.name}</span>)}</div><ResponsiveContainer width="100%" height={height}><AreaChart data={samples} margin={{ top: 15, right: 10, left: -15, bottom: 5 }}><CartesianGrid stroke="#263b4c" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="time" tick={{ fill: '#92aabb', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={25} /><YAxis tick={{ fill: '#92aabb', fontSize: 11 }} tickLine={false} axisLine={false} unit=" kW" /><Tooltip contentStyle={{ background: '#102a3a', border: '1px solid #365568', borderRadius: 8, color: '#e9f5f7' }} formatter={(value, name) => [`${fmt(value, 2)} kW`, name]} />{lines.map((item) => <Area key={item.key} type="monotone" dataKey={item.key} name={item.name} stroke={item.color} strokeWidth={2.5} fill={item.color} fillOpacity={0.09} dot={false} connectNulls={false} />)}</AreaChart></ResponsiveContainer></div>
}

function DeviceRow({ label, value }) { return <div className="device-row"><span>{label}</span><strong>{value}</strong></div> }

function exportCsv(samples) {
  const keys = ['timestamp', 'solar_kw', 'consumption_kw', 'import_kw', 'export_kw', 'ac_voltage_v', 'ac_current_a', 'frequency_hz', 'temperature_c', 'dc1_voltage_v', 'dc1_current_a', 'dc2_voltage_v', 'dc2_current_a', 'inverter_status', 'wifi_rssi_dbm', 'alarm_message']
  const rows = [keys.join(','), ...samples.map((sample) => keys.map((key) => {
    const value = sample[key] == null ? '' : String(sample[key])
    return `"${value.replaceAll('"', '""')}"`
  }).join(','))]
  const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = 'solar-casa-medicoes.csv'; link.click(); URL.revokeObjectURL(url)
}

export default function MonitoringDetails({ section, demo, samples, current, totals, endpoint, sourceKind, connectionStatus, lastSync, onConnect }) {
  const [period, setPeriod] = useState('Tudo')
  const filtered = useMemo(() => {
    if (demo || period === 'Tudo') return samples
    const hours = period === '24 h' ? 24 : period === '7 dias' ? 168 : 720
    const end = new Date(samples.at(-1)?.timestamp).getTime()
    if (!Number.isFinite(end)) return samples
    return samples.filter((sample) => end - new Date(sample.timestamp).getTime() <= hours * 3600000)
  }, [demo, period, samples])
  const peak = samples.reduce((max, sample) => Math.max(max, sample.solar_kw || 0), 0)
  const selfUse = has(totals.solar) && has(totals.export) ? Math.max(0, totals.solar - totals.export) : null
  const autonomy = has(totals.consumption) && has(totals.import) && totals.consumption > 0 ? Math.max(0, Math.min(100, (1 - totals.import / totals.consumption) * 100)) : null
  const latestTime = current.timestamp ? new Date(current.timestamp).toLocaleString('pt-BR') : 'Amostra demonstrativa'
  const sampleAge = current.timestamp ? Date.now() - new Date(current.timestamp).getTime() : null
  const stale = !demo && sourceKind === 'wifi' && Number.isFinite(sampleAge) && sampleAge > 10 * 60000
  const reportedState = current.inverter_status || 'Não informado'
  const alerts = [
    ...(connectionStatus === 'error' ? [{ title: 'Falha na atualização da ponte Wi‑Fi', detail: 'Verifique a URL e a conectividade do datalogger/servidor.' }] : []),
    ...(stale ? [{ title: 'Leitura desatualizada', detail: `Última medição recebida: ${latestTime}.` }] : []),
    ...(current.alarm_message ? [{ title: 'Alerta informado pelo equipamento', detail: current.alarm_message }] : []),
  ]

  if (section === 'Solar') return <div className="detail-page"><div className="detail-values"><ValueCard icon={Sun} label="Potência atual" value={reading(current.solar_kw, 'kW', 2)} note="Saída de geração" /><ValueCard icon={BarChart3} label="Pico do período" value={reading(peak, 'kW', 2)} note="Maior amostra recebida" /><ValueCard icon={Zap} label="Energia do período" value={reading(totals.solar, 'kWh')} note="Integrada das leituras" /><ValueCard icon={Gauge} label="Capacidade instalada" value="7,56 kWp" note="12 módulos previstos" /></div><div className="detail-columns"><Panel eyebrow="GERAÇÃO FOTOVOLTAICA" title="Curva de produção" icon={Sun} className="wide"><TimeChart samples={samples} keys={['solar_kw']} height={310} /></Panel><Panel eyebrow="ENTRADAS CC" title="Rastreadores MPPT" icon={Activity}><div className="device-list"><DeviceRow label="MPPT 1 · tensão" value={reading(current.dc1_voltage_v, 'V')} /><DeviceRow label="MPPT 1 · corrente" value={reading(current.dc1_current_a, 'A')} /><DeviceRow label="MPPT 2 · tensão" value={reading(current.dc2_voltage_v, 'V')} /><DeviceRow label="MPPT 2 · corrente" value={reading(current.dc2_current_a, 'A')} /></div><p className="detail-footnote">Valores MPPT aparecem apenas quando a fonte os fornece.</p></Panel></div></div>

  if (section === 'Energia') return <div className="detail-page"><div className="detail-values"><ValueCard icon={Sun} label="Uso direto do solar" value={reading(selfUse, 'kWh')} note="Solar menos exportação" /><ValueCard icon={Gauge} label="Autossuficiência" value={reading(autonomy, '%', 0)} note="Consumo atendido sem importar" tone="blue" /><ValueCard icon={ArrowDownRight} label="Importado da rede" value={reading(totals.import, 'kWh')} note="No período carregado" tone="red" /><ValueCard icon={ArrowUpRight} label="Enviado à rede" value={reading(totals.export, 'kWh')} note="No período carregado" tone="blue" /></div><Panel eyebrow="BALANÇO ELÉTRICO" title="Solar, casa e rede" icon={Zap}><TimeChart samples={samples} keys={['solar_kw', 'consumption_kw', 'import_kw', 'export_kw']} height={345} /></Panel>{!has(current.consumption_kw) && <div className="detail-info"><Info size={18} /> O datalogger não forneceu consumo da casa. Essa medição exige medidor/TC configurado ou outra fonte de dados.</div>}</div>

  if (section === 'Histórico') return <div className="detail-page"><Panel eyebrow="HISTÓRICO DE LEITURAS" title="Evolução da energia" icon={BarChart3}><div className="period-tabs">{['24 h', '7 dias', '30 dias', 'Tudo'].map((item) => <button key={item} className={period === item ? 'active' : ''} onClick={() => setPeriod(item)}>{item}</button>)}</div>{filtered.length ? <TimeChart samples={filtered} height={330} /> : <div className="empty-details">Não há leituras nesse período.</div>}</Panel><Panel eyebrow="REGISTROS" title="Últimas medições" icon={Activity}><div className="reading-table-wrap"><table className="reading-table"><thead><tr><th>Horário</th><th>Solar</th><th>Casa</th><th>Importação</th><th>Exportação</th></tr></thead><tbody>{filtered.slice(-12).reverse().map((row, i) => <tr key={`${row.timestamp || row.time}-${i}`}><td>{row.timestamp ? new Date(row.timestamp).toLocaleString('pt-BR') : row.time}</td><td>{reading(row.solar_kw, 'kW', 2)}</td><td>{reading(row.consumption_kw, 'kW', 2)}</td><td>{reading(row.import_kw, 'kW', 2)}</td><td>{reading(row.export_kw, 'kW', 2)}</td></tr>)}</tbody></table></div></Panel></div>

  if (section === 'Dispositivos') return <div className="detail-page"><div className="detail-columns devices"><Panel eyebrow="EQUIPAMENTO" title="Inversor AUXSOL" icon={PanelTop}><div className="device-status"><span className="status-led" />{reportedState}</div><div className="device-list"><DeviceRow label="Modelo" value="ASN-6SL-G2" /><DeviceRow label="Potência nominal CA" value="6 kW" /><DeviceRow label="Tensão CA" value={reading(current.ac_voltage_v, 'V')} /><DeviceRow label="Corrente CA" value={reading(current.ac_current_a, 'A')} /><DeviceRow label="Frequência" value={reading(current.frequency_hz, 'Hz')} /><DeviceRow label="Temperatura" value={reading(current.temperature_c, '°C')} /></div></Panel><Panel eyebrow="COMUNICAÇÃO" title="Datalogger Wi‑Fi" icon={Wifi}><div className="device-status"><span className={`status-led ${demo || connectionStatus === 'error' ? 'muted' : ''}`} />{demo ? 'Aguardando dados reais' : sourceKind === 'wifi' ? connectionStatus === 'error' ? 'Erro de leitura' : 'Fonte Wi‑Fi configurada' : 'Dados de arquivo CSV'}</div><div className="device-list"><DeviceRow label="Fonte" value={demo ? 'Demonstração' : sourceKind === 'wifi' ? 'Ponte Wi‑Fi / JSON' : 'CSV importado'} /><DeviceRow label="Última medição" value={latestTime} /><DeviceRow label="Sinal Wi‑Fi" value={reading(current.wifi_rssi_dbm, 'dBm', 0)} /><DeviceRow label="Atualização" value={sourceKind === 'wifi' ? 'A cada 60 s' : 'Manual'} /></div><button className="detail-action" onClick={onConnect}><Wifi size={16} /> Configurar fonte</button></Panel></div><div className="detail-info"><Info size={18} /> O estado da conexão acima descreve a fonte de dados deste painel; ele não testa diretamente a rede interna do inversor.</div></div>

  if (section === 'Alertas') return <div className="detail-page"><Panel eyebrow="EVENTOS E DIAGNÓSTICO" title="Alertas de comunicação" icon={AlertCircle}>{alerts.length ? <div className="alert-list">{alerts.map((alert, i) => <div key={i}><AlertCircle size={20} /><div><strong>{alert.title}</strong><span>{alert.detail}</span></div></div>)}</div> : <div className="clear-state"><CheckCircle2 size={25} /><strong>Nenhum alerta recebido nesta fonte</strong><span>{demo ? 'Os dados atuais são demonstrativos.' : 'O painel só mostra eventos disponíveis nas leituras ou erros de comunicação detectados aqui.'}</span></div>}</Panel><div className="detail-info"><Info size={18} /> Proteções e alarmes internos do inversor precisam estar incluídos na fonte de dados para aparecer aqui.</div></div>

  if (section === 'Relatórios') return <div className="detail-page"><div className="detail-values"><ValueCard icon={Sun} label="Geração acumulada" value={reading(totals.solar, 'kWh')} /><ValueCard icon={Zap} label="Consumo acumulado" value={reading(totals.consumption, 'kWh')} tone="orange" /><ValueCard icon={ArrowDownRight} label="Importação" value={reading(totals.import, 'kWh')} tone="red" /><ValueCard icon={ArrowUpRight} label="Exportação" value={reading(totals.export, 'kWh')} tone="blue" /></div><Panel eyebrow="EXPORTAÇÃO" title="Relatório de medições" icon={Download}><p className="detail-description">Exporte as leituras disponíveis como CSV para análise externa. O arquivo identifica as grandezas que não foram fornecidas pela fonte.</p><button className="detail-action" onClick={() => exportCsv(samples)}><Download size={16} /> Baixar CSV das leituras</button><p className="detail-footnote">{demo ? 'Este relatório contém dados de exemplo.' : `${samples.length} leituras reais no navegador.`}</p></Panel></div>

  return null
}
