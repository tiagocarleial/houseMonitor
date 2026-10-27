import React, { useEffect, useState } from 'react'
import { Activity, ArrowDownLeft, ArrowUpRight, BarChart3, Box, ChevronRight, CircleDot, Expand, Home, Layers3, LocateFixed, Map, Moon, Move3D, Network, Pause, Play, RotateCcw, Sun, Wifi, X, Zap } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ResidenceScene from './ResidenceScene.jsx'
import { solarPosition, zoneParts, zonedDayMinuteToDate } from './solarPosition.js'
import { RESIDENCE_ROOMS } from './residenceLayout.js'
import './visual.css'

const number = (value, digits = 2) => value == null ? '—' : Number(value).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const LOCATION_KEY = 'solar-monitor-weather-location'
function savedSolarLocation() {
  try {
    const value = JSON.parse(localStorage.getItem(LOCATION_KEY) || 'null')
    return Number.isFinite(value?.latitude) && Number.isFinite(value?.longitude) ? value : null
  } catch { return null }
}
const VIEWS = [
  { id: 'exterior', name: 'Vista externa', icon: Home, caption: 'Sua residência em 3D' },
  { id: 'flow', name: 'Fluxo de energia', icon: Activity, caption: 'O caminho da energia' },
  { id: 'interior', name: 'Corte interno', icon: Box, caption: 'Explore os ambientes' },
  { id: 'plan', name: 'Planta da casa', icon: Map, caption: 'Distribuição dos ambientes' },
  { id: 'dashboard', name: 'Dashboard', icon: BarChart3, caption: 'Tudo sobre a sua energia' },
  { id: 'technical', name: 'Diagrama técnico', icon: Network, caption: 'Visão do sistema elétrico' },
]

function EnergyCard({ icon: Icon, label, power, energy, tone, detail }) {
  return <div className={`visual-energy-card ${tone}`}><span className="visual-energy-icon"><Icon size={24} /></span><div><small>{label}</small><strong>{number(power)} <em>kW</em></strong><span>{detail || `${number(energy, 1)} kWh no período`}</span></div></div>
}
function Chart({ samples, light = false }) {
  const tick = light ? '#76818c' : '#83a0af'
  return <ResponsiveContainer width="100%" height={270}><AreaChart data={samples} margin={{ top: 12, left: -25, right: 4, bottom: 0 }}><defs><linearGradient id="visual-production-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#39db9b" stopOpacity={.3} /><stop offset="1" stopColor="#39db9b" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke={light ? '#e0e6e9' : '#243a47'} vertical={false} strokeDasharray="3 5" /><XAxis dataKey="time" axisLine={false} tickLine={false} minTickGap={35} tick={{ fontSize: 10, fill: tick }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} /><Tooltip contentStyle={{ background: light ? '#fff' : '#0e2434', border: '1px solid #31515e', borderRadius: 8, fontSize: 11 }} formatter={(value, name) => [`${number(value)} kW`, name]} /><Area type="monotone" name="Solar" dataKey="solar_kw" stroke="#3add9d" fill="url(#visual-production-fill)" strokeWidth={2.5} /><Area type="monotone" name="Casa" dataKey="consumption_kw" stroke="#ffa74b" fill="transparent" strokeWidth={2} /><Area type="monotone" name="Importação" dataKey="import_kw" stroke="#fa737a" fill="transparent" strokeWidth={1.6} /><Area type="monotone" name="Exportação" dataKey="export_kw" stroke="#78b5ff" fill="transparent" strokeWidth={1.6} /></AreaChart></ResponsiveContainer>
}
function Balance({ totals }) {
  const max = Math.max(totals.solar || 0, totals.consumption || 0, 1)
  return <div className="visual-balance">{[
    ['Solar', totals.solar, '#4ce4a2'], ['Casa', totals.consumption, '#ffb259'], ['Importação', totals.import, '#fa747d'], ['Exportação', totals.export, '#78b5ff'],
  ].map(([label, value, color]) => <div key={label}><span>{label}</span><div><i style={{ width: `${Math.min(100, (value || 0) / max * 100)}%`, background: color }} /></div><b>{number(value, 1)} <small>kWh</small></b></div>)}</div>
}
function Autonomy({ totals }) {
  const value = totals.consumption > 0 && totals.import != null ? Math.round(Math.max(0, Math.min(100, (1 - totals.import / totals.consumption) * 100))) : null
  return <div className="autonomy-widget"><div className="autonomy-ring" style={{ '--portion': `${value || 0}%` }}><div><strong>{value == null ? '—' : `${value}%`}</strong><span>Autossuficiência</span></div></div><p>Parcela do consumo atendida sem importar energia.</p></div>
}

function TechnicalView({ current, totals, demo }) {
  const exported = current.export_kw > 0
  return <div className="technical-view"><div className="technical-title"><span><Network size={18} /> DIAGRAMA DO SISTEMA</span><small>{demo ? 'Leituras demonstrativas' : 'Última leitura recebida'}</small></div><div className="technical-network">
    <div className={`technical-node solar ${current.solar_kw > 0 ? 'energized' : ''}`}><small>CAMPO FOTOVOLTAICO</small><Sun size={42} /><strong>{number(current.solar_kw)} <em>kW</em></strong><span>12 módulos · 7,56 kWp</span><div className="solar-symbol">{Array.from({ length: 6 }, (_, i) => <i key={i} />)}</div></div>
    <div className={`technical-link green ${current.solar_kw > 0 ? 'moving' : ''}`}><span>CC</span><i /><b>→</b></div>
    <div className="technical-node inverter"><small>INVERSOR AUXSOL</small><div className="inverter-illustration"><b>AUXSOL</b><span><Sun size={16} /></span><i /></div><strong>ASN-6SL-G2</strong><span>Saída CA · 6 kW nominal</span></div>
    <div className={`technical-link amber ${current.solar_kw > 0 ? 'moving' : ''}`}><span>CA</span><i /><b>→</b></div>
    <div className="technical-node home"><small>QUADRO DA CASA</small><Home size={46} /><strong>{number(current.consumption_kw)} <em>kW</em></strong><span>Consumo da residência</span></div>
    <div className={`technical-link blue ${current.import_kw > 0 || exported ? 'moving' : ''} ${!exported ? 'reverse' : ''}`}><span>REDE</span><i /><b>{exported ? '→' : current.import_kw > 0 ? '←' : '↔'}</b></div>
    <div className="technical-node grid"><small>REDE ELÉTRICA</small><Zap size={46} /><strong>{number(current.import_kw > 0 ? current.import_kw : current.export_kw ?? current.import_kw)} <em>kW</em></strong><span>{exported ? 'Exportando excedente' : current.import_kw > 0 ? 'Importando energia' : 'Sem fluxo informado'}</span></div>
  </div><div className="technical-bottom"><section><h3>Energia no período</h3><Balance totals={totals} /></section><section><h3>Tensão e corrente</h3><dl><div><dt>Saída CA</dt><dd>{number(current.ac_voltage_v, 1)} V</dd></div><div><dt>Corrente</dt><dd>{number(current.ac_current_a, 1)} A</dd></div><div><dt>Frequência</dt><dd>{number(current.frequency_hz, 1)} Hz</dd></div></dl></section><section><h3>Estado do inversor</h3><div className="technical-status"><CircleDot size={17} /><strong>{current.inverter_status || 'Não informado'}</strong></div><p>{demo ? 'Estado ilustrativo, sem conexão ao inversor.' : 'Estado recebido da fonte de dados.'}</p><div className="technical-temperature">Temperatura <b>{number(current.temperature_c, 1)} °C</b></div></section></div></div>
}

export default function VisualMonitor({ night, setNight, current, totals, samples, demo, onConnect }) {
  const [view, setView] = useState('exterior')
  const [camera, setCamera] = useState('aerial')
  const [flow, setFlow] = useState(true)
  const [floor, setFloor] = useState('ground')
  const [room, setRoom] = useState('Sala')
  const [expanded, setExpanded] = useState(false)
  const [lightCharts, setLightCharts] = useState(false)
  const [sceneKey, setSceneKey] = useState(0)
  const [solarLocation, setSolarLocation] = useState(savedSolarLocation)
  const [clockNow, setClockNow] = useState(() => new Date())
  const [selectedMinute, setSelectedMinute] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [gpsError, setGpsError] = useState('')
  useEffect(() => {
    const onLocation = () => { setSolarLocation(savedSolarLocation()); setGpsError('') }
    window.addEventListener('solar-monitor-location-change', onLocation)
    window.addEventListener('storage', onLocation)
    const timer = window.setInterval(() => setClockNow(new Date()), 30000)
    return () => { window.removeEventListener('solar-monitor-location-change', onLocation); window.removeEventListener('storage', onLocation); window.clearInterval(timer) }
  }, [])
  const timeZone = solarLocation?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const localDay = zoneParts(clockNow, timeZone)
  const nowMinute = localDay.hour * 60 + localDay.minute
  const minute = selectedMinute ?? nowMinute
  const sun = solarLocation ? solarPosition(zonedDayMinuteToDate(localDay, minute, timeZone), solarLocation.latitude, solarLocation.longitude) : null
  const sceneNight = sun ? sun.elevation < -0.833 : night
  const sceneCurrent = demo && sun && samples.length >= 24 ? samples[Math.min(samples.length - 1, Math.floor(minute / 60))] : current
  const timeLabel = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setSelectedMinute((value) => ((value ?? nowMinute) + 5) % 1440), 200)
    return () => window.clearInterval(timer)
  }, [playing, nowMinute])
  function useGps() {
    if (!navigator.geolocation) { setGpsError('GPS indisponível neste navegador.'); return }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const place = { name: 'Minha localização', latitude: coords.latitude, longitude: coords.longitude, source: 'gps' }
      localStorage.setItem(LOCATION_KEY, JSON.stringify(place))
      window.dispatchEvent(new CustomEvent('solar-monitor-location-change', { detail: place }))
    }, () => setGpsError('Não foi possível obter o GPS. Escolha uma cidade no header.'), { enableHighAccuracy: false, timeout: 10000 })
  }
  useEffect(() => {
    if (!expanded) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const escape = (event) => { if (event.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', escape)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', escape) }
  }, [expanded])
  const inside = view === 'interior' || view === 'plan'
  const selected = VIEWS.find((item) => item.id === view)
  const roomNames = RESIDENCE_ROOMS[floor].map((item) => item.name)
  function selectView(id) { setView(id); if (id === 'flow') setFlow(true) }
  const energyCards = <div className="visual-energy-dock"><EnergyCard icon={Sun} label="Produção solar" power={sceneCurrent.solar_kw} energy={totals.solar} tone="solar" /><EnergyCard icon={Home} label="Consumo da casa" power={sceneCurrent.consumption_kw} energy={totals.consumption} tone="home" /><EnergyCard icon={ArrowDownLeft} label="Importação da rede" power={sceneCurrent.import_kw} energy={totals.import} tone="import" /><EnergyCard icon={ArrowUpRight} label="Exportação para rede" power={sceneCurrent.export_kw} energy={totals.export} tone="export" /></div>
  return <div className={`visual-monitor ${expanded ? 'expanded' : ''}`}>
    <div className="visual-toolbar"><div><span className="visual-eyebrow">SOLAR CASA / EXPERIÊNCIA VISUAL</span><h1>{selected.caption}<span>{String(VIEWS.findIndex((item) => item.id === view) + 1).padStart(2, '0')}</span></h1></div><div className="visual-toolbar-actions"><span className={`visual-source ${demo ? 'demo' : ''}`}><i />{demo ? 'Demonstração' : 'Dados recebidos'}</span><button onClick={onConnect} aria-label="Conectar dados"><Wifi size={16} /><span>Conectar dados</span></button><button className="expand-button" onClick={() => setExpanded(!expanded)} aria-label={expanded ? 'Sair da vista ampliada' : 'Ampliar visualização'}>{expanded ? <X size={18} /> : <Expand size={18} />}</button></div></div>
    <div className="visual-view-tabs">{VIEWS.map(({ id, name, icon: Icon }, i) => <button key={id} aria-pressed={view === id} className={view === id ? 'active' : ''} onClick={() => selectView(id)}><Icon size={18} /><span>{name}</span><small>0{i + 1}</small></button>)}</div>
    {view === 'dashboard' ? <div className={`visual-dashboard ${lightCharts ? 'light-charts' : ''}`}><div className="dashboard-display-title"><span>PAINEL DE ENERGIA</span><button onClick={() => setLightCharts(!lightCharts)}>{lightCharts ? <Moon size={16} /> : <Sun size={16} />}{lightCharts ? 'Tema escuro' : 'Tema claro'}</button></div>{energyCards}<div className="visual-chart-grid"><section className="visual-chart-main"><header><div><small>POTÊNCIA / kW</small><h3>Geração e consumo</h3></div><div className="visual-chart-legend"><span>● Solar</span><span>● Casa</span><span>● Importação</span><span>● Exportação</span></div></header><Chart samples={samples} light={lightCharts} /></section><section><header><div><small>ORIGEM DO CONSUMO</small><h3>Independência da rede</h3></div></header><Autonomy totals={totals} /></section><section className="visual-chart-main"><header><div><small>ENERGIA / kWh</small><h3>Balanço do período</h3></div></header><ResponsiveContainer width="100%" height={210}><BarChart data={[{ name: 'Solar', value: totals.solar, color: '#4cdda2' }, { name: 'Casa', value: totals.consumption, color: '#ffb05e' }, { name: 'Importação', value: totals.import, color: '#f87980' }, { name: 'Exportação', value: totals.export, color: '#77b7fb' }]}><CartesianGrid vertical={false} stroke={lightCharts ? '#e2e8ec' : '#273b47'} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#87a0b2' }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#87a0b2' }} /><Tooltip contentStyle={{ background: lightCharts ? '#fff' : '#102938', border: '1px solid #426477', borderRadius: 8 }} formatter={(value) => [`${number(value, 1)} kWh`, 'Energia']} /><Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={75}>{['#4cdda2', '#ffb05e', '#f87980', '#77b7fb'].map((color) => <Cell key={color} fill={color} />)}</Bar></BarChart></ResponsiveContainer></section><section><header><div><small>SISTEMA INSTALADO</small><h3>Sua usina solar</h3></div></header><div className="system-capacity"><Sun size={30} /><strong>7,56 <small>kWp</small></strong><span>12 módulos · Inversor de 6 kW</span></div></section></div></div> : view === 'technical' ? <TechnicalView current={current} totals={totals} demo={demo} /> : <>
      <div className="sun-timeline" aria-label="Percurso do sol em 24 horas">
        <button className="sun-gps" onClick={useGps} title="Atualizar coordenadas pelo GPS"><LocateFixed size={15} />GPS · {solarLocation?.name || 'Usar localização'}</button>
        <button className="sun-play" onClick={() => { if (!solarLocation) { useGps(); return } if (selectedMinute == null) setSelectedMinute(nowMinute); setPlaying(!playing) }} aria-label={playing ? 'Pausar percurso do sol' : 'Reproduzir percurso do sol'} disabled={!solarLocation && !!gpsError}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
        <label className="sun-range"><span className="sr-only">Hora local da simulação solar</span><input type="range" min="0" max="1439" step="1" value={minute} disabled={!solarLocation} onChange={(event) => { setPlaying(false); setSelectedMinute(Number(event.target.value)) }} /></label>
        <strong className="sun-time">{timeLabel}</strong>
        <button className="sun-now" onClick={() => { setPlaying(false); setSelectedMinute(null); setClockNow(new Date()) }} disabled={!solarLocation}>Agora</button>
        <span className="sun-angle">{sun ? `${sun.elevation < -0.833 ? 'Noite' : 'Sol'} · ${Math.round(sun.azimuth)}° az · ${Math.round(sun.elevation)}° alt` : gpsError || 'Selecione uma cidade ou use o GPS'}</span>
      </div>
      <div className={`visual-stage ${sceneNight ? 'night' : 'day'} ${inside ? 'inside' : ''}`}>
        <ResidenceScene key={sceneKey} night={sceneNight} sun={sun} current={sceneCurrent} labels={!inside && camera !== 'street' && camera !== 'rear'} showFlow={flow} cameraPreset={camera} mode={inside ? view : 'exterior'} focused={view === 'flow' || camera === 'street' || camera === 'rear'} floor={floor} selectedRoom={room} onRoomSelect={setRoom} />
        <div className="visual-stage-heading"><span><i />{inside ? 'PLANTA ILUSTRATIVA' : view === 'flow' ? 'FLUXO ANIMADO DE ENERGIA' : 'VISTA 3D DA RESIDÊNCIA'}</span><div className="scene-light-switch">{sun ? <span className="sun-scene-status">{sceneNight ? <Moon size={16} /> : <Sun size={16} />}{sceneNight ? 'Noite' : 'Dia'}</span> : <><button aria-pressed={!night} className={!night ? 'active' : ''} onClick={() => setNight(false)} aria-label="Iluminação diurna"><Sun size={16} />Dia</button><button aria-pressed={night} className={night ? 'active' : ''} onClick={() => setNight(true)} aria-label="Iluminação noturna"><Moon size={16} />Noite</button></>}</div></div>
        <div className="visual-scene-title"><span>MINHA RESIDÊNCIA</span><h2>{inside ? floor === 'ground' ? 'Pavimento térreo' : 'Pavimento superior' : sceneNight ? 'Energia que acompanha sua casa.' : 'Cada raio de sol, mais energia.'}</h2><p>{inside ? floor === 'upper' ? '3 quartos · distribuição interna aproximada' : 'Sala e cozinha · distribuição aproximada' : 'Duplex · 3 quartos no andar superior'}</p></div>
        <aside className={`scene-information ${inside ? 'room-information' : ''}`}>
          {inside ? <>
            <span className="visual-eyebrow">AMBIENTES DO DUPLEX</span>
            <div className="floor-toggle"><button className={floor === 'ground' ? 'active' : ''} onClick={() => { setFloor('ground'); setRoom('Sala') }}>Térreo</button><button className={floor === 'upper' ? 'active' : ''} onClick={() => { setFloor('upper'); setRoom('Quarto 1') }}>Superior</button></div>
            {roomNames.map((name) => <button className={`room-list-item ${room === name ? 'active' : ''}`} key={name} onClick={() => setRoom(name)}><Home size={16} />{name}<ChevronRight size={15} /></button>)}
            <div className="room-reading"><small>{room} · consumo</small><strong>— <span>W</span></strong><p>Medição por ambiente não configurada.</p></div>
            <p className="visual-note">Os três quartos ficam no andar superior. Medidas e divisórias são ilustrativas até recebermos a planta.</p>
          </> : <>
            <span className="visual-eyebrow">SISTEMA FOTOVOLTAICO</span><div className="capacity-display"><Sun size={27} /><strong>7,56 <span>kWp</span></strong></div>
            <div className="scene-info-row"><span>Módulos no telhado</span><b>12</b></div><div className="scene-info-row"><span>Inversor AUXSOL</span><b>6 kW</b></div>
            <div className="scene-info-row"><span>Residência</span><b>Duplex</b></div><div className="scene-info-row"><span>Quartos</span><b>3 · Superior</b></div>
            <div className="scene-info-divider" /><span className="visual-eyebrow">ENERGIA NO PERÍODO</span><Balance totals={totals} /><div className="scene-source-note"><CircleDot size={13} />{demo ? 'Valores demonstrativos' : 'Última leitura da fonte'}</div>
          </>}
        </aside>
        <div className="visual-camera-tools">
          {!inside && <div className="camera-presets">{[['aerial', 'Aérea'], ['street', 'Fachada'], ['rear', 'Fundos'], ['top', 'Telhado']].map(([id, label]) => <button key={id} className={camera === id ? 'active' : ''} onClick={() => setCamera(id)}>{id === 'aerial' ? <Move3D size={15} /> : id === 'top' ? <Layers3 size={15} /> : <Home size={15} />}{label}</button>)}</div>}
          <button className="visual-tool" onClick={() => { setCamera('aerial'); setSceneKey((key) => key + 1) }} aria-label="Restaurar câmera" title="Restaurar câmera"><RotateCcw size={16} /></button>
          {!inside && <button className={`visual-tool ${flow ? 'active' : ''}`} onClick={() => setFlow(!flow)} aria-label="Alternar fluxo animado" aria-pressed={flow} title="Alternar fluxo animado"><Activity size={16} /></button>}
          <span className="orbit-help">{view === 'plan' ? 'Role para aproximar' : 'Arraste para explorar · role para aproximar'}</span>
        </div>
        <div className="visual-compass"><span>N</span><i /><small>S</small></div>
      </div>
      {energyCards}
    </>}
    <div className="visual-footer"><span><CircleDot size={12} />{demo ? 'Prévia visual com dados de exemplo' : 'Leituras recebidas da fonte configurada'}</span><span>Modelo arquitetônico aproximado a partir das fotos</span></div>
  </div>
}
