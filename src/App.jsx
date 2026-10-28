import React, { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, CalendarDays,
  Check, ChevronDown, CircleHelp, CloudSun, Download, FileUp, Gauge, Home,
  Info, Layers3, Lightbulb, Maximize, Menu, Minimize, Minus, Moon, PanelTop, Play, Plus, RotateCcw, Settings2,
  SlidersHorizontal, Sun, Wifi, X, Zap,
} from 'lucide-react'
import ResidenceScene from './ResidenceScene.jsx'
import VisualMonitor from './VisualMonitor.jsx'
import MonitoringDetails from './MonitoringDetails.jsx'
import WeatherPanel from './WeatherPanel.jsx'
import SmartHome from './SmartHome.jsx'

const fmt = (value, decimals = 2) => value == null ? '—' : Number(value).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
const shown = (value, decimals = 2) => value == null ? '—' : fmt(value, decimals)
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const DEMO = Array.from({ length: 25 }, (_, hour) => {
  const light = Math.max(0, Math.sin(Math.PI * (hour - 5.7) / 12.4))
  const solar = hour === 12 ? 4.85 : +(5.7 * light ** 1.65 * (1 - 0.045 * Math.sin(hour * 4))).toFixed(2)
  const home = hour === 12 ? 3.2 : +(0.72 + 0.24 * Math.sin(hour * 0.62 + 0.4) ** 2 + (hour > 18 && hour < 23 ? 1.25 + 0.45 * Math.sin(hour * 1.2) ** 2 : 0) + (hour > 10 && hour < 15 ? 0.65 : 0)).toFixed(2)
  return { time: `${String(hour).padStart(2, '0')}:00`, solar_kw: solar, consumption_kw: home, import_kw: +Math.max(0, home - solar).toFixed(2), export_kw: +Math.max(0, solar - home).toFixed(2), ac_voltage_v: +(219 + 2 * Math.sin(hour / 3)).toFixed(1), ac_current_a: +(solar * 1000 / 220).toFixed(1), frequency_hz: 60, temperature_c: +(30 + 7 * light).toFixed(1), dc1_voltage_v: light ? 350 : 0, dc1_current_a: +(solar * 1000 / 700).toFixed(1), dc2_voltage_v: light ? 348 : 0, dc2_current_a: +(solar * 1000 / 700).toFixed(1), inverter_status: light ? 'Operando' : 'Aguardando sol', wifi_rssi_dbm: -58 }
})

function normalizeSample(raw) {
  const sample = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key.trim().toLowerCase(), value]))
  const num = (key, required = false) => {
    const value = sample[key]
    if (value === undefined || value === null || value === '') {
      if (required) throw new Error(`Coluna ausente ou vazia: ${key}`)
      return null
    }
    const parsed = Number(String(value).trim().replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Valor inválido em ${key}`)
    return parsed
  }
  const timestamp = sample.timestamp || sample.time || sample.hora
  if (!timestamp) throw new Error('Cada registro precisa de timestamp.')
  const date = new Date(timestamp)
  const time = Number.isNaN(date.getTime()) ? String(timestamp).slice(0, 5) : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return {
    timestamp: String(timestamp), time,
    solar_kw: num('solar_kw', true), consumption_kw: num('consumption_kw'),
    import_kw: num('import_kw'), export_kw: num('export_kw'),
    ac_voltage_v: num('ac_voltage_v'), ac_current_a: num('ac_current_a'),
    frequency_hz: num('frequency_hz'), temperature_c: num('temperature_c'),
    dc1_voltage_v: num('dc1_voltage_v'), dc1_current_a: num('dc1_current_a'),
    dc2_voltage_v: num('dc2_voltage_v'), dc2_current_a: num('dc2_current_a'),
    energy_today_kwh: num('energy_today_kwh'), wifi_rssi_dbm: sample.wifi_rssi_dbm === undefined || sample.wifi_rssi_dbm === '' || !Number.isFinite(Number(sample.wifi_rssi_dbm)) ? null : Number(sample.wifi_rssi_dbm),
    inverter_status: sample.inverter_status || null,
    alarm_message: sample.alarm_message || null,
  }
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) throw new Error('O CSV precisa conter cabeçalho e pelo menos uma linha.')
  const separator = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(separator).map((x) => x.trim().replace(/^"|"$/g, ''))
  for (const key of ['timestamp', 'solar_kw']) {
    if (!headers.includes(key)) throw new Error(`Coluna ausente: ${key}`)
  }
  return lines.slice(1).map((line) => normalizeSample(Object.fromEntries(line.split(separator).map((value, i) => [headers[i], value.replace(/^"|"$/g, '')]))))
}

function readSavedSamples() {
  try {
    const saved = JSON.parse(localStorage.getItem('solar-monitor-samples') || '[]')
    return Array.isArray(saved) ? saved.map(normalizeSample) : []
  } catch { return [] }
}

const navItems = [
  { label: 'Visão geral', icon: Home },
  { label: 'Solar', icon: Sun },
  { label: 'Energia', icon: Zap },
  { label: 'Histórico', icon: BarChart3 },
  { label: 'Dispositivos', icon: PanelTop },
  { label: 'Casa inteligente', icon: Lightbulb },
  { label: 'Alertas', icon: Activity },
  { label: 'Relatórios', icon: Download },
]
const sectionDescriptions = {
  'Visão geral': 'Sua casa e a energia em uma única visão.',
  Solar: 'Produção fotovoltaica, pico e rastreadores MPPT.',
  Energia: 'Consumo, uso direto do solar e trocas com a rede.',
  Histórico: 'Curvas de potência e leituras registradas.',
  Dispositivos: 'Estado do inversor e comunicação do datalogger.',
  'Casa inteligente': 'Controle as luzes e os aparelhos conectados da sua casa.',
  Alertas: 'Eventos informados pela fonte e falhas de comunicação.',
  Relatórios: 'Resumo e exportação das leituras disponíveis.',
}

function HouseView({ night, setNight, simulation, panelCount, setPanelCount, current, showFlow, setShowFlow }) {
  const gridPower = current.import_kw > 0 ? current.import_kw : current.export_kw
  return <div className={`scene-shell ${night ? 'is-night' : ''}`}>
    <ResidenceScene night={night} panelCount={panelCount} simulation={simulation} onPanelToggle={(index) => setPanelCount(index < panelCount ? index : index + 1)} showFlow={showFlow} current={current} />
    <div className="scene-topline"><span className="scene-tag"><span className="pulse-dot" /> MODELO 3D DA CASA</span><span className="scene-hint">Arraste para girar · role para aproximar</span></div>
    {!simulation && <div className="scene-nodes">
      <div className="scene-node solar-node"><Sun size={19} /><span>Solar<strong>{shown(current.solar_kw)} kW</strong></span></div>
      <div className="scene-node home-node"><Home size={19} /><span>Casa<strong>{shown(current.consumption_kw)} kW</strong></span></div>
      <div className="scene-node grid-node"><Zap size={19} /><span>Rede<strong>{shown(gridPower)} kW</strong></span></div>
    </div>}
    <div className="scene-controls">
      <div className="segmented small"><button className={!night ? 'active' : ''} onClick={() => setNight(false)} aria-label="Vista dia"><Sun size={16} /> Dia</button><button className={night ? 'active' : ''} onClick={() => setNight(true)} aria-label="Vista noite"><Moon size={16} /> Noite</button></div>
      <button className={`icon-button glass ${showFlow ? 'selected' : ''}`} onClick={() => setShowFlow(!showFlow)} title="Alternar linhas de energia"><Activity size={18} /></button>
    </div>
    {simulation && <div className="scene-bottom-note"><Layers3 size={16} /> Clique em uma posição no telhado para ajustar os módulos</div>}
  </div>
}

function DataModal({ close, onImport, endpoint, setEndpoint, refresh, error, busy, clearData, realCount }) {
  const [tab, setTab] = useState('wifi')
  async function upload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try { onImport(parseCsv(await file.text())) } catch (err) { onImport(null, err.message) }
    event.target.value = ''
  }
  const template = 'timestamp,solar_kw,consumption_kw,import_kw,export_kw,ac_voltage_v,ac_current_a,frequency_hz,temperature_c,dc1_voltage_v,dc1_current_a,dc2_voltage_v,dc2_current_a,inverter_status\n2026-10-25T12:00:00-03:00,4.85,3.20,0,1.65,220,22,60,34,350,7,348,7,Operando\n'
  return <div className="modal-backdrop" onMouseDown={close}><div className="modal" onMouseDown={(event) => event.stopPropagation()}>
    <div className="modal-header"><div><span className="eyebrow">FONTE DE DADOS</span><h2>Conectar medições reais</h2></div><button className="icon-button" onClick={close}><X size={19} /></button></div>
    <p>O datalogger Wi‑Fi envia dados à plataforma Nansen Solar/AUXSOL. Para exibir essas leituras aqui, informe uma ponte local ou endpoint autorizado que forneça JSON. A conexão Wi‑Fi, sozinha, não revela o protocolo do equipamento.</p>
    <div className="segmented modal-tabs"><button className={tab === 'wifi' ? 'active' : ''} onClick={() => setTab('wifi')}><Wifi size={16} /> Datalogger Wi‑Fi</button><button className={tab === 'csv' ? 'active' : ''} onClick={() => setTab('csv')}><FileUp size={16} /> Arquivo CSV</button></div>
    {tab === 'csv' ? <div className="modal-section">
      <label className="upload-zone"><FileUp size={30} /><strong>Escolher arquivo CSV</strong><span>Obrigatórias: timestamp e solar_kw. As demais medições são opcionais.</span><input type="file" accept=".csv,text/csv" onChange={upload} /></label>
      <button className="text-button" onClick={() => { const blob = new Blob([template], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'modelo-medicoes.csv'; a.click(); URL.revokeObjectURL(url) }}><Download size={16} /> Baixar modelo de CSV</button>
    </div> : <div className="modal-section">
      <div className="wifi-steps"><div><strong>1</strong><span>Confirme que o datalogger aparece no aplicativo Nansen Solar/AUXSOL.</span></div><div><strong>2</strong><span>Use um endpoint autorizado da plataforma ou uma ponte local que converta as leituras em JSON.</span></div><div><strong>3</strong><span>Informe a URL abaixo. O painel atualiza os dados a cada 60 segundos.</span></div></div>
      <label className="field-label">URL da ponte Wi‑Fi ou API autorizada</label>
      <input className="text-input" type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="http://192.168.1.50:3001/api/solar" />
      <p className="code-help">Resposta: <code>{'{ "samples": [{ "timestamp": "...", "solar_kw": 4.85, "ac_voltage_v": 220, "inverter_status": "Operando" }] }'}</code></p>
      <button className="primary-button" disabled={busy || !endpoint} onClick={refresh}>{busy ? 'Conectando...' : 'Testar e carregar'}</button>
      <p className="muted small-text">Aceita HTTPS ou HTTP na rede local. O servidor precisa permitir acesso do navegador (CORS). Consumo, importação e exportação dependem de medidor/TC e não são presumidos.</p>
    </div>}
    {error && <div className="error-note"><Info size={16} /> {error}</div>}
    {realCount > 0 ? <div className="success-note"><Check size={16} /> {realCount} medições carregadas <button onClick={clearData}>Limpar dados</button></div> : null}
  </div></div>
}

export default function App() {
  const [mode, setMode] = useState('real')
  const [section, setSection] = useState('Visão geral')
  const [night, setNight] = useState(false)
  const [panelCount, setPanelCount] = useState(12)
  const [showFlow, setShowFlow] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [realSamples, setRealSamples] = useState(readSavedSamples)
  const [useReal, setUseReal] = useState(() => readSavedSamples().length > 0)
  const [sourceKind, setSourceKind] = useState(() => localStorage.getItem('solar-monitor-source') || 'csv')
  const [lastSync, setLastSync] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('idle')
  const [endpoint, setEndpoint] = useState(() => localStorage.getItem('solar-monitor-endpoint') || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [siteTheme, setSiteTheme] = useState(() => localStorage.getItem('solar-monitor-theme') || 'dark')
  const [fullScreen, setFullScreen] = useState(false)
  const [sunHours, setSunHours] = useState(4.5)
  const [loss, setLoss] = useState(20)
  const samples = useReal && realSamples.length ? realSamples : DEMO
  const demo = !useReal || !realSamples.length
  const current = demo ? DEMO[night ? 20 : 12] : samples[samples.length - 1]
  const installedKwp = panelCount * 0.63
  const expectedDaily = installedKwp * sunHours * (1 - loss / 100)
  const totals = useMemo(() => ['solar', 'consumption', 'import', 'export'].reduce((acc, key) => {
    let sum = 0; let measured = false
    for (let i = 0; i < samples.length - 1; i++) {
      const value = samples[i][`${key}_kw`]
      if (value == null) continue
      let hours = 1
      if (samples[i].timestamp && samples[i + 1].timestamp) {
        hours = (new Date(samples[i + 1].timestamp) - new Date(samples[i].timestamp)) / 3600000
        if (!Number.isFinite(hours) || hours <= 0 || hours > 6) continue
      }
      sum += value * hours; measured = true
    }
    acc[key] = measured ? sum : null
    return acc
  }, {}), [samples])

  useEffect(() => { localStorage.setItem('solar-monitor-endpoint', endpoint) }, [endpoint])
  useEffect(() => { localStorage.setItem('solar-monitor-source', sourceKind) }, [sourceKind])
  useEffect(() => { if (realSamples.length) localStorage.setItem('solar-monitor-samples', JSON.stringify(realSamples)) }, [realSamples])
  useEffect(() => { localStorage.setItem('solar-monitor-theme', siteTheme) }, [siteTheme])
  useEffect(() => {
    const syncFullScreen = () => setFullScreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', syncFullScreen)
    return () => document.removeEventListener('fullscreenchange', syncFullScreen)
  }, [])
  function toggleFullScreen() {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen()
  }

  function importSamples(data, parseError, source = 'csv') {
    if (parseError) { setError(parseError); return }
    if (!data?.length) { setError('Nenhuma medição encontrada.'); return }
    setRealSamples(data)
    setUseReal(true)
    setSourceKind(source)
    setConnectionStatus(source === 'wifi' ? 'connected' : 'imported')
    setLastSync(new Date())
    setError('')
    setShowModal(false)
  }
  async function refresh() {
    setBusy(true); setError('')
    try {
      const url = new URL(endpoint)
      const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.endsWith('.local') || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(url.hostname) || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname) || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(url.hostname)
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error('Use HTTPS ou um endereço HTTP da rede local.')
      if (url.username || url.password) throw new Error('Não coloque usuário ou senha na URL.')
      const response = await fetch(url.toString(), { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const json = await response.json()
      const rows = Array.isArray(json) ? json : json.samples
      if (!Array.isArray(rows)) throw new Error('O JSON precisa conter uma lista samples.')
      importSamples(rows.map(normalizeSample), null, 'wifi')
    } catch (err) { setConnectionStatus('error'); setError(err.message || 'Não foi possível carregar os dados.') }
    finally { setBusy(false) }
  }
  useEffect(() => {
    if (!endpoint || !useReal || sourceKind !== 'wifi') return undefined
    const timer = setInterval(refresh, 60000)
    return () => clearInterval(timer)
  }, [endpoint, useReal, sourceKind])

  const selectSection = (label) => { setSection(label); setMode('real'); setMobileNav(false) }
  return <div className={`app-shell ${mode === 'real' && section === 'Visão geral' ? 'visual-layout' : ''} ${siteTheme === 'light' ? 'site-light' : ''}`}>
    {mobileNav && <button className="nav-backdrop" aria-label="Fechar menu" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Sun size={24} /></div><div><strong>SOLAR<span>CASA</span></strong><small>ENERGY STUDIO</small></div></div>
      <span className="sidebar-label">MENU PRINCIPAL</span>
      <nav>{navItems.map(({ label, icon: Icon }) => <button key={label} aria-label={label} title={label} className={section === label && mode === 'real' ? 'nav-active' : ''} onClick={() => selectSection(label)}><Icon size={19} />{label}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-system"><span className="live-dot" /><div><strong>Seu sistema</strong><small>12 módulos · 7,56 kWp</small></div></div><button className="sidebar-connect" aria-label="Fonte de dados" onClick={() => setShowModal(true)}><Settings2 size={18} /> Fonte de dados</button></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="top-left"><button className="mobile-menu icon-button" onClick={() => setMobileNav(!mobileNav)} aria-label="Abrir menu" aria-expanded={mobileNav}><Menu size={20} /></button><div className="breadcrumb">Residência <span>/</span> {mode === 'sim' ? 'Simulação' : section}</div></div><div className="top-right"><WeatherPanel compact />{section !== 'Casa inteligente' && <button className="icon-button help" onClick={() => setShowModal(true)} title="Ajuda e dados" aria-label="Ajuda e dados"><CircleHelp size={18} /></button>}<button className="theme-toggle icon-button" onClick={() => setSiteTheme(siteTheme === 'dark' ? 'light' : 'dark')} aria-label={siteTheme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} title={siteTheme === 'dark' ? 'Tema claro' : 'Tema escuro'}><Lightbulb size={18} /></button><button className="icon-button" onClick={() => setShowModal(true)} aria-label="Conectar dados" title="Conectar dados"><Wifi size={18} /></button><button className="icon-button" onClick={toggleFullScreen} aria-label={fullScreen ? 'Sair da tela cheia' : 'Entrar em tela cheia'} title={fullScreen ? 'Sair da tela cheia' : 'Tela cheia'}>{fullScreen ? <Minimize size={18} /> : <Maximize size={18} />}</button></div></header>

      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow">{section === 'Casa inteligente' ? 'AUTOMAÇÃO RESIDENCIAL' : 'MONITORAMENTO RESIDENCIAL'}</div><h1>{mode === 'sim' ? 'Simulação solar' : section}</h1><p>{mode === 'sim' ? 'Planeje a posição dos módulos e estime a geração.' : sectionDescriptions[section]}</p></div></div>
        {section !== 'Casa inteligente' && <div className="tabbar"><button className={mode === 'real' ? 'active' : ''} onClick={() => setMode('real')}><Activity size={18} /> Monitoramento</button><button className={mode === 'sim' ? 'active' : ''} onClick={() => setMode('sim')}><Layers3 size={18} /> Simulação</button></div>}

        {section === 'Casa inteligente' ? <SmartHome /> : mode === 'real' ? <>
          {demo && section !== 'Visão geral' && <div className="notice"><Info size={17} /><span>Visualização demonstrativa. Conecte a ponte do datalogger Wi‑Fi ou importe leituras para mostrar dados reais.</span><button onClick={() => setShowModal(true)}>Configurar <ArrowRight size={14} /></button></div>}
          {!demo && current.consumption_kw == null && <div className="detail-info data-gap"><Info size={17} /> A fonte não informou consumo da casa. Campos de consumo e rede ficam indisponíveis até haver medidor/TC ou outra medição.</div>}
          {section === 'Visão geral' ? <VisualMonitor night={night} setNight={setNight} current={current} totals={totals} samples={samples} demo={demo} onConnect={() => setShowModal(true)} /> : <MonitoringDetails section={section} demo={demo} samples={samples} current={current} totals={totals} endpoint={endpoint} sourceKind={sourceKind} connectionStatus={connectionStatus} lastSync={lastSync} onConnect={() => setShowModal(true)} />}
        </> : <>
          <div className="sim-intro"><div><Sun size={18} /> Dimensionamento inicial: 12 módulos × 630 W = 7,56 kWp</div><span>Estimativa simplificada</span></div>
          <div className="sim-layout"><div className="scene-card sim-scene"><div className="card-heading"><div><span className="eyebrow">PROJETO INTERATIVO</span><h2>Telhado da sua casa</h2></div><span className="card-pill"><Layers3 size={16} /> Vista 3D</span></div><HouseView night={night} setNight={setNight} panelCount={panelCount} setPanelCount={setPanelCount} simulation current={current} showFlow={showFlow} setShowFlow={setShowFlow} /></div><div className="sim-panel"><div className="card-heading"><div><span className="eyebrow">CONFIGURAÇÃO DO SISTEMA</span><h2>Placas solares</h2></div><SlidersHorizontal size={20} className="heading-icon" /></div><div className="sim-power"><span>Potência simulada</span><strong>{fmt(installedKwp)} <small>kWp</small></strong><div>{panelCount} de 12 módulos posicionados</div></div><div className="control-block"><div className="control-label"><span>Quantidade de módulos</span><strong>{panelCount}</strong></div><div className="quantity-control"><button onClick={() => setPanelCount(clamp(panelCount - 1, 0, 12))} aria-label="Remover módulo"><Minus size={20} /></button><input type="range" min="0" max="12" value={panelCount} onChange={(event) => setPanelCount(Number(event.target.value))} aria-label="Quantidade de módulos" /><button onClick={() => setPanelCount(clamp(panelCount + 1, 0, 12))} aria-label="Adicionar módulo"><Plus size={20} /></button></div><small>Cada módulo acrescenta 630 Wp ao projeto.</small></div><div className="control-block"><div className="control-label"><span>Horas de sol pleno por dia</span><strong>{fmt(sunHours, 1)} h</strong></div><input type="range" min="2" max="7" step="0.1" value={sunHours} onChange={(event) => setSunHours(Number(event.target.value))} /><small>Ajuste conforme a média da sua localidade.</small></div><div className="control-block"><div className="control-label"><span>Perdas estimadas</span><strong>{loss}%</strong></div><input type="range" min="0" max="40" step="1" value={loss} onChange={(event) => setLoss(Number(event.target.value))} /><small>Inclui temperatura, cabos, sujeira e outras perdas.</small></div><div className="estimate"><Sun size={22} /><div><span>Geração diária estimada</span><strong>{fmt(expectedDaily, 1)} kWh</strong></div></div><button className="reset-button" onClick={() => { setPanelCount(12); setSunHours(4.5); setLoss(20) }}><RotateCcw size={16} /> Restaurar projeto inicial</button></div></div>
          <div className="sim-notes"><Info size={17} /><span>O modelo 3D reproduz a volumetria aproximada das fotos. A posição final das placas exige medidas do telhado, orientação, sombreamento e ficha técnica dos módulos.</span></div>
        </>}
      </div>
    </main>
    {showModal && <DataModal close={() => { setShowModal(false); setError('') }} onImport={importSamples} endpoint={endpoint} setEndpoint={setEndpoint} refresh={refresh} error={error} busy={busy} realCount={realSamples.length} clearData={() => { localStorage.removeItem('solar-monitor-samples'); setRealSamples([]); setUseReal(false) }} />}
  </div>
}
