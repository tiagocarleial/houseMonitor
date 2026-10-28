import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Camera, Fan, Home, Lightbulb, LockKeyhole, PlugZap, Power, Settings2, Thermometer, Wifi, WifiOff, Plus, Search, Activity } from 'lucide-react'
import './smart-home.css'

const URL_KEY = 'solar-casa-ha-url'
const TOKEN_KEY = 'solar-casa-ha-token'
const DEMO_KEY = 'solar-casa-smart-demo'
const DEVICES_KEY = 'solar-casa-smart-devices'
const ROOMS_KEY = 'solar-casa-smart-rooms'
const SUPPORTED = new Set(['light', 'switch', 'fan', 'input_boolean', 'climate', 'cover', 'lock', 'camera', 'sensor'])
const EXAMPLES = [
  { entity_id: 'light.sala', attributes: { friendly_name: 'Luz da sala' }, state: 'on', room: 'Sala' },
  { entity_id: 'climate.ar_condicionado', attributes: { friendly_name: 'Ar-condicionado' }, state: 'off', room: 'Sala', temperature: 23 },
  { entity_id: 'switch.tomada_quarto', attributes: { friendly_name: 'Tomada inteligente' }, state: 'on', room: 'Quarto' },
  { entity_id: 'sensor.medidor_power', attributes: { friendly_name: 'Consumo da casa', device_class: 'power', unit_of_measurement: 'W' }, state: '640', room: 'Sala' },
]
const DEFAULT_ROOMS = ['Todos', 'Sala', 'Quarto']

function readJson(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value ?? fallback } catch { return fallback }
}
function savedDemo() { return readJson(DEMO_KEY, {}) }
function normalizeUrl(value) {
  const url = new URL(value.trim())
  const local = ['localhost', '127.0.0.1'].includes(url.hostname) || url.hostname.endsWith('.local') || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(url.hostname) || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname) || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error('Use HTTPS ou HTTP em um endereço da rede local.')
  if (url.username || url.password || url.search || url.hash) throw new Error('Informe apenas o endereço base, sem credenciais ou parâmetros.')
  return url.origin
}
async function haRequest(baseUrl, token, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, cache: 'no-store' })
  if (!response.ok) throw new Error(response.status === 401 ? 'Token inválido ou sem permissão.' : `Home Assistant respondeu HTTP ${response.status}.`)
  return response.json()
}
function domainOf(device) { return device.entity_id?.split('.')[0] || '' }
function isEnergySensor(device) {
  const a = device.attributes || {}
  return domainOf(device) === 'sensor' && (['power', 'energy', 'current', 'voltage'].includes(a.device_class) || /w|kw|kwh|wh|a|v/i.test(a.unit_of_measurement || ''))
}
function isSupported(device) { return SUPPORTED.has(domainOf(device)) && (domainOf(device) !== 'sensor' || isEnergySensor(device)) }
function deviceIcon(domain) {
  if (domain === 'light') return Lightbulb
  if (domain === 'fan') return Fan
  if (domain === 'climate') return Thermometer
  if (domain === 'camera') return Camera
  if (domain === 'lock') return LockKeyhole
  return PlugZap
}
function labelFor(domain) { return ({ light: 'Luz', switch: 'Tomada', fan: 'Ventilador', climate: 'Ar-condicionado', camera: 'Câmera', lock: 'Fechadura', cover: 'Persiana', sensor: 'Medidor' })[domain] || 'Aparelho' }

function CameraPreview({ device, connection }) {
  const [imageUrl, setImageUrl] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!connection) return undefined
    let objectUrl
    let cancelled = false
    async function load() {
      try {
        const response = await fetch(`${connection.url}/api/camera_proxy/${device.entity_id}`, { headers: { Authorization: `Bearer ${connection.token}` }, cache: 'no-store' })
        if (!response.ok) throw new Error('Image unavailable')
        const blob = await response.blob()
        if (!cancelled) { objectUrl = URL.createObjectURL(blob); setImageUrl(objectUrl); setFailed(false) }
      } catch { if (!cancelled) setFailed(true) }
    }
    load()
    const timer = setInterval(load, 30000)
    return () => { cancelled = true; clearInterval(timer); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [connection, device.entity_id])
  if (!connection) return <div className="smart-camera-placeholder">Camera preview appears after connecting Home Assistant.</div>
  return imageUrl ? <img className="smart-camera-preview" src={imageUrl} alt={`Imagem de ${device.attributes?.friendly_name || 'c?mera'}`} /> : <div className="smart-camera-placeholder">{failed ? 'A integra??o n?o forneceu uma imagem.' : 'Carregando imagem?'}</div>
}

export default function SmartHome() {
  const [url, setUrl] = useState(() => localStorage.getItem(URL_KEY) || '')
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '')
  const [connection, setConnection] = useState(null)
  const [connected, setConnected] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [devices, setDevices] = useState([])
  const [demoDevices, setDemoDevices] = useState(() => readJson(DEVICES_KEY, EXAMPLES))
  const [demoStates, setDemoStates] = useState(savedDemo)
  const [rooms, setRooms] = useState(() => readJson(ROOMS_KEY, DEFAULT_ROOMS))
  const [room, setRoom] = useState('Todos')
  const [roomAssignments, setRoomAssignments] = useState(() => readJson('solar-casa-smart-room-assignments', {}))
  const [newName, setNewName] = useState('')
  const [newRoom, setNewRoom] = useState('Sala')
  const [newType, setNewType] = useState('light')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null)
  const [error, setError] = useState('')
  const [climateDraft, setClimateDraft] = useState({})

  const refresh = useCallback(async (base, key) => {
    const states = await haRequest(base, key, '/api/states')
    if (!Array.isArray(states)) throw new Error('A resposta do Home Assistant não contém a lista de dispositivos.')
    setDevices(states.filter(isSupported))
    setConnected(true)
    setError('')
  }, [])

  useEffect(() => {
    const storedUrl = localStorage.getItem(URL_KEY), storedToken = sessionStorage.getItem(TOKEN_KEY)
    if (!storedUrl || !storedToken) return
    refresh(storedUrl, storedToken).then(() => setConnection({ url: storedUrl, token: storedToken })).catch(() => setError('A sessão do Home Assistant não pôde ser restaurada. Conecte novamente.'))
  }, [refresh])
  useEffect(() => {
    if (!connection) return undefined
    const timer = setInterval(() => refresh(connection.url, connection.token).catch(() => setError('Não foi possível atualizar os estados. Verifique a conexão.')), 30000)
    return () => clearInterval(timer)
  }, [connection, refresh])
  useEffect(() => { localStorage.setItem(DEVICES_KEY, JSON.stringify(demoDevices)) }, [demoDevices])
  useEffect(() => { localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms)) }, [rooms])
  useEffect(() => { localStorage.setItem('solar-casa-smart-room-assignments', JSON.stringify(roomAssignments)) }, [roomAssignments])

  async function connect(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const base = normalizeUrl(url)
      if (!token.trim()) throw new Error('Informe um token de acesso do Home Assistant.')
      await refresh(base, token.trim())
      setUrl(base); setConnection({ url: base, token: token.trim() }); localStorage.setItem(URL_KEY, base); sessionStorage.setItem(TOKEN_KEY, token.trim()); setConfigOpen(false)
    } catch (err) {
      setError(err instanceof TypeError ? 'Não foi possível acessar o Home Assistant. Confira a URL, HTTPS e CORS.' : err.message)
    } finally { setBusy(false) }
  }
  function disconnect() {
    setConnected(false); setConnection(null); setDevices([]); setToken(''); sessionStorage.removeItem(TOKEN_KEY); setError(''); setConfigOpen(false)
  }
  async function callService(device, service, data = {}) {
    const domain = domainOf(device)
    setPending(device.entity_id); setError('')
    try {
      await haRequest(connection.url, connection.token, `/api/services/${domain}/${service}`, { method: 'POST', body: JSON.stringify({ entity_id: device.entity_id, ...data }) })
      await refresh(connection.url, connection.token)
    } catch (err) { setError(err instanceof TypeError ? 'Falha de rede ao enviar o comando.' : err.message) }
    finally { setPending(null) }
  }
  async function toggle(device) {
    const domain = domainOf(device)
    if (!connected) {
      const current = demoStates[device.entity_id] ?? device.state
      const next = domain === 'cover' ? (current === 'open' ? 'closed' : 'open') : domain === 'lock' ? (current === 'locked' ? 'unlocked' : 'locked') : (current === 'on' ? 'off' : 'on')
      setDemoStates((old) => { const updated = { ...old, [device.entity_id]: next }; localStorage.setItem(DEMO_KEY, JSON.stringify(updated)); return updated })
      return
    }
    if (domain === 'climate') {
      const mode = device.state === 'off' ? (device.attributes?.hvac_modes?.find((item) => item !== 'off') || 'cool') : 'off'
      await callService(device, 'set_hvac_mode', { hvac_mode: mode }); return
    }
    const on = ['on', 'open', 'unlocked'].includes(device.state)
    const actions = { light: on ? 'turn_off' : 'turn_on', switch: on ? 'turn_off' : 'turn_on', fan: on ? 'turn_off' : 'turn_on', input_boolean: on ? 'turn_off' : 'turn_on', cover: on ? 'close_cover' : 'open_cover', lock: on ? 'lock' : 'unlock' }
    await callService(device, actions[domain] || 'turn_on')
  }
  async function setTemperature(device) {
    const temperature = Number(climateDraft[device.entity_id] ?? device.attributes?.temperature)
    if (!Number.isFinite(temperature)) return
    await callService(device, 'set_temperature', { temperature })
  }
  function addDemoDevice(event) {
    event.preventDefault()
    const title = newName.trim(); if (!title) return
    const entity = `demo.${Date.now()}`
    setDemoDevices((old) => [...old, { entity_id: entity, attributes: { friendly_name: title }, state: newType === 'climate' ? 'off' : 'off', room: newRoom, demoType: newType, ...(newType === 'climate' ? { temperature: 23 } : {}) }])
    setRooms((old) => old.includes(newRoom) ? old : [...old, newRoom])
    setNewName('')
  }

  const rawShown = connected ? devices : demoDevices.map((device) => ({ ...device, state: demoStates[device.entity_id] ?? device.state }))
  const shown = useMemo(() => rawShown.map((device) => ({ ...device, room: connected ? (roomAssignments[device.entity_id] || 'Sem cômodo') : device.room || 'Sem cômodo' })).filter((device) => room === 'Todos' || device.room === room), [connected, rawShown, room, roomAssignments])
  const controlDevices = rawShown.filter((device) => !isEnergySensor(device))
  const active = controlDevices.filter((device) => ['on', 'open', 'unlocked', 'cool', 'heat', 'heat_cool', 'auto'].includes(device.state)).length
  const energySensors = rawShown.filter(isEnergySensor)
  const availableRooms = connected ? ['Todos', 'Sem cômodo', ...rooms.filter((r) => r !== 'Todos')] : rooms

  return <div className="smart-home">
    <section className="smart-hero"><div><span className="eyebrow">CONTROLE DA CASA</span><h2>Seus ambientes, a um toque</h2><p>{connected ? 'Controles conectados ao seu Home Assistant.' : 'Teste aparelhos fictícios ou conecte o Home Assistant para consultar dispositivos compatíveis.'}</p><a href="https://www.home-assistant.io/installation/" target="_blank" rel="noreferrer">Como instalar o Home Assistant</a></div><span className={`smart-mode ${connected ? 'connected' : ''}`}>{connected ? <Wifi size={15} /> : <WifiOff size={15} />}{connected ? 'Conectado' : 'Modo demonstração'}</span></section>

    <div className="smart-summary">
      <div className="smart-stat"><span className="smart-stat-icon"><PlugZap size={19} /></span><div><small>Aparelhos</small><strong>{controlDevices.length}</strong></div></div>
      <div className="smart-stat"><span className="smart-stat-icon"><Power size={19} /></span><div><small>Ligados agora</small><strong>{active}</strong></div></div>
      <div className="smart-stat"><span className="smart-stat-icon"><Home size={19} /></span><div><small>Cômodos</small><strong>{rooms.length - 1}</strong></div></div>
      <button className="smart-connect-action" onClick={() => setConfigOpen(!configOpen)}><Settings2 size={18} /><span>{connected ? 'Configurar conexão' : 'Conectar Home Assistant'}</span></button>
    </div>

    {configOpen && <form className="smart-config" onSubmit={connect}><div><h3>Conexão com Home Assistant</h3><p>Instale o Home Assistant na rede da sua casa. Ele descobre integrações compatíveis e expõe as entidades que este painel consulta.</p></div><div className="smart-fields"><label>Endereço do Home Assistant<input type="url" required placeholder="http://homeassistant.local:8123" value={url} onChange={(event) => setUrl(event.target.value)} /></label><label>Token de acesso<input type="password" required placeholder="Cole seu token" value={token} onChange={(event) => setToken(event.target.value)} /></label></div><p className="smart-hint">O navegador precisa alcançar o servidor e a instalação deve permitir CORS para este site. O token fica nesta sessão. Para publicar o painel para outras pessoas, use um backend para guardar credenciais.</p><div className="smart-config-actions"><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Conectando...' : 'Conectar'}</button>{connected && <button type="button" className="smart-disconnect" onClick={disconnect}>Desconectar</button>}</div></form>}

    {error && <div className="error-note smart-error" role="alert">{error}</div>}
    {!connected && <form className="smart-add-form" onSubmit={addDemoDevice}><div><span className="eyebrow">DEMONSTRAÇÃO LOCAL</span><h3>Cadastrar aparelho fictício</h3></div><input aria-label="Nome do aparelho" placeholder="Ex.: Lâmpada do escritório" value={newName} onChange={(event) => setNewName(event.target.value)} required /><select aria-label="Tipo do aparelho" value={newType} onChange={(event) => setNewType(event.target.value)}><option value="light">Luz</option><option value="switch">Tomada</option><option value="climate">Ar-condicionado</option><option value="fan">Ventilador</option></select><input aria-label="Cômodo" value={newRoom} onChange={(event) => setNewRoom(event.target.value)} list="smart-room-options" placeholder="Cômodo" /><datalist id="smart-room-options">{rooms.filter((r) => r !== 'Todos').map((r) => <option key={r} value={r} />)}</datalist><button type="submit"><Plus size={16} /> Cadastrar</button></form>}
    <div className="smart-section-title"><div><span className="eyebrow">DISPOSITIVOS E SENSORES</span><h3>{connected ? 'Entidades encontradas' : 'Experimente os controles'}</h3></div>{connected && <button onClick={() => { setBusy(true); refresh(connection.url, connection.token).catch((err) => setError(err.message)).finally(() => setBusy(false)) }} disabled={busy}><Search size={15} /> {busy ? 'Buscando...' : 'Buscar / atualizar'}</button>}</div>
    {connected && <p className="smart-discovery-note">A busca atualiza entidades que o Home Assistant já descobriu e integrou. Para integrar novos aparelhos, configure a integração no Home Assistant e atualize aqui.</p>}
    <div className="smart-room-tabs" aria-label="Filtrar por cômodo">{availableRooms.map((item) => <button key={item} className={room === item ? 'active' : ''} onClick={() => setRoom(item)}>{item}</button>)}{connected && <form className="smart-room-create" onSubmit={(event) => { event.preventDefault(); const name = newRoom.trim(); if (name && !rooms.includes(name)) setRooms((old) => [...old, name]); setNewRoom('') }}><input aria-label="Novo cômodo" placeholder="Novo cômodo" value={newRoom} onChange={(event) => setNewRoom(event.target.value)} /><button type="submit" aria-label="Adicionar cômodo"><Plus size={14} /></button></form>}</div>
    {shown.length ? <div className="smart-grid">{shown.map((device) => {
      const domain = device.demoType || domainOf(device), Icon = deviceIcon(domain), sensor = isEnergySensor(device)
      const unavailable = ['unavailable', 'unknown'].includes(device.state)
      const climate = domain === 'climate'
      const openDomain = domain === 'cover', lockDomain = domain === 'lock'
      const on = ['on', 'open', 'unlocked', 'cool', 'heat', 'heat_cool', 'auto'].includes(device.state)
      const value = climate ? device.attributes?.current_temperature : device.state
      const unit = climate ? '°C' : device.attributes?.unit_of_measurement || ''
      return <article className={`smart-device ${on ? 'is-on' : ''} ${sensor ? 'smart-sensor' : ''}`} key={device.entity_id}>
        <div className="smart-device-top"><span className="smart-device-icon"><Icon size={23} /></span><span className={`smart-device-status ${unavailable ? 'unavailable' : ''}`}>{sensor ? 'Leitura' : unavailable ? 'Indisponível' : on ? 'Ligado' : 'Desligado'}</span></div>
        <div className="smart-device-copy"><h4>{device.attributes?.friendly_name || device.entity_id}</h4><span>{device.room || 'Sem cômodo'} · {labelFor(domain)}</span></div>
        {sensor ? <div className="smart-sensor-value"><Activity size={17} /><strong>{value ?? '—'} <small>{unit}</small></strong></div> : climate ? <div className="smart-climate-control"><label>Temperatura desejada<input type="number" min={device.attributes?.min_temp || 16} max={device.attributes?.max_temp || 30} step="0.5" value={climateDraft[device.entity_id] ?? device.attributes?.temperature ?? 23} onChange={(event) => setClimateDraft((old) => ({ ...old, [device.entity_id]: event.target.value }))} /></label><button disabled={!connected || pending === device.entity_id} onClick={() => setTemperature(device)}>Aplicar {value != null ? `· atual ${value} °C` : ''}</button></div> : null}
        {connected && <label className="smart-room-assign">Cômodo<select value={device.room || 'Sem cômodo'} onChange={(event) => { setRoomAssignments((old) => ({ ...old, [device.entity_id]: event.target.value })); if (event.target.value !== 'Sem cômodo') setRooms((old) => old.includes(event.target.value) ? old : [...old, event.target.value]) }}><option>Sem cômodo</option>{rooms.filter((r) => r !== 'Todos').map((r) => <option key={r}>{r}</option>)}</select></label>}
        {domain === 'camera' && <CameraPreview device={device} connection={connected ? connection : null} />}
        {!sensor && <button className="smart-power" aria-label={`${on ? (openDomain ? 'Fechar' : lockDomain ? 'Trancar' : 'Desligar') : (openDomain ? 'Abrir' : lockDomain ? 'Destrancar' : 'Ligar')} ${device.attributes?.friendly_name || device.entity_id}`} aria-pressed={on} disabled={unavailable || pending === device.entity_id || domain === 'camera'} onClick={() => toggle(device)}><Power size={17} /> {pending === device.entity_id ? 'Aguarde...' : domain === 'camera' ? 'Visualização pela integração' : openDomain ? (on ? 'Fechar' : 'Abrir') : lockDomain ? (on ? 'Trancar' : 'Destrancar') : climate ? (on ? 'Desligar ar' : 'Ligar ar') : (on ? 'Desligar' : 'Ligar')}</button>}
      </article>
    })}</div> : <div className="smart-empty">Nenhum aparelho ou sensor neste cômodo.</div>}
    {energySensors.length > 0 && <p className="smart-demo-note">Leituras de energia exibidas quando a integração fornece sensores compatíveis (potência, energia, corrente ou tensão). A compatibilidade do medidor Tuya trifásico e do inversor AUXSOL depende dos modelos e da integração configurada no Home Assistant.</p>}
    {!connected && <p className="smart-demo-note">Os controles da demonstração são locais e não acionam aparelhos reais. Câmeras e sensores podem ser consultados quando integrados; o painel não simula vídeo ou medições reais.</p>}
  </div>
}
