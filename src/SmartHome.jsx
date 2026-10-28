import React, { useCallback, useEffect, useState } from 'react'
import { Fan, Lightbulb, PlugZap, Power, RefreshCw, Settings2, Wifi, WifiOff } from 'lucide-react'
import './smart-home.css'

const URL_KEY = 'solar-casa-ha-url'
const TOKEN_KEY = 'solar-casa-ha-token'
const DEMO_KEY = 'solar-casa-smart-demo'
const SUPPORTED = new Set(['light', 'switch', 'fan', 'input_boolean'])
const EXAMPLES = [
  { entity_id: 'light.sala', attributes: { friendly_name: 'Luz da sala' }, state: 'on' },
  { entity_id: 'light.quarto', attributes: { friendly_name: 'Luz do quarto' }, state: 'off' },
  { entity_id: 'switch.tomada_cozinha', attributes: { friendly_name: 'Tomada da cozinha' }, state: 'off' },
  { entity_id: 'fan.ventilador', attributes: { friendly_name: 'Ventilador' }, state: 'on' },
]

function savedDemo() {
  try {
    const value = JSON.parse(localStorage.getItem(DEMO_KEY) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch { return {} }
}

function normalizeUrl(value) {
  const url = new URL(value.trim())
  const local = ['localhost', '127.0.0.1'].includes(url.hostname) || url.hostname.endsWith('.local') || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(url.hostname) || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname) || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error('Use HTTPS ou HTTP em um endereço da rede local.')
  if (url.username || url.password || url.search || url.hash) throw new Error('Informe apenas o endereço base, sem credenciais ou parâmetros.')
  return url.origin
}

async function haRequest(baseUrl, token, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(response.status === 401 ? 'Token inválido ou sem permissão.' : `Home Assistant respondeu HTTP ${response.status}.`)
  return response.json()
}

function deviceIcon(domain) {
  if (domain === 'light') return Lightbulb
  if (domain === 'fan') return Fan
  return PlugZap
}

export default function SmartHome() {
  const [url, setUrl] = useState(() => localStorage.getItem(URL_KEY) || '')
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '')
  const [connection, setConnection] = useState(null)
  const [connected, setConnected] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [devices, setDevices] = useState([])
  const [demoStates, setDemoStates] = useState(savedDemo)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null)
  const [error, setError] = useState('')

  const refresh = useCallback(async (base, key) => {
    const states = await haRequest(base, key, '/api/states')
    if (!Array.isArray(states)) throw new Error('A resposta do Home Assistant não contém a lista de dispositivos.')
    setDevices(states.filter((item) => SUPPORTED.has(item.entity_id?.split('.')[0])))
    setConnected(true)
    setError('')
  }, [])

  useEffect(() => {
    const storedUrl = localStorage.getItem(URL_KEY)
    const storedToken = sessionStorage.getItem(TOKEN_KEY)
    if (!storedUrl || !storedToken) return
    refresh(storedUrl, storedToken)
      .then(() => setConnection({ url: storedUrl, token: storedToken }))
      .catch(() => setError('A sessão do Home Assistant não pôde ser restaurada. Conecte novamente.'))
  }, [refresh])

  useEffect(() => {
    if (!connection) return undefined
    const timer = setInterval(() => {
      refresh(connection.url, connection.token).catch(() => setError('Não foi possível atualizar os estados. Verifique a conexão.'))
    }, 30000)
    return () => clearInterval(timer)
  }, [connection, refresh])

  async function connect(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const base = normalizeUrl(url)
      if (!token.trim()) throw new Error('Informe um token de acesso do Home Assistant.')
      await refresh(base, token.trim())
      setUrl(base)
      setConnection({ url: base, token: token.trim() })
      localStorage.setItem(URL_KEY, base)
      sessionStorage.setItem(TOKEN_KEY, token.trim())
      setConfigOpen(false)
    } catch (err) {
      setError(err instanceof TypeError ? 'Não foi possível acessar o Home Assistant. Confira a URL, HTTPS e CORS.' : err.message)
    } finally { setBusy(false) }
  }

  function disconnect() {
    setConnected(false)
    setConnection(null)
    setDevices([])
    setToken('')
    sessionStorage.removeItem(TOKEN_KEY)
    setError('')
    setConfigOpen(false)
  }

  async function toggle(device) {
    const domain = device.entity_id.split('.')[0]
    const next = device.state === 'on' ? 'turn_off' : 'turn_on'
    if (!connected) {
      const updated = { ...demoStates, [device.entity_id]: next === 'turn_on' }
      setDemoStates(updated)
      localStorage.setItem(DEMO_KEY, JSON.stringify(updated))
      return
    }
    setPending(device.entity_id)
    setError('')
    try {
      await haRequest(connection.url, connection.token, `/api/services/${domain}/${next}`, {
        method: 'POST',
        body: JSON.stringify({ entity_id: device.entity_id }),
      })
      await refresh(connection.url, connection.token)
    } catch (err) {
      setError(err instanceof TypeError ? 'Falha de rede ao enviar o comando.' : err.message)
    } finally { setPending(null) }
  }

  const shown = connected ? devices : EXAMPLES.map((device) => ({ ...device, state: (demoStates[device.entity_id] ?? device.state === 'on') ? 'on' : 'off' }))
  const active = shown.filter((device) => device.state === 'on').length

  return <div className="smart-home">
    <section className="smart-hero">
      <div><span className="eyebrow">CONTROLE DA CASA</span><h2>Seus ambientes, a um toque</h2><p>{connected ? 'Controles conectados ao seu Home Assistant.' : 'Explore os controles abaixo. Conecte o Home Assistant para acionar aparelhos reais.'}</p></div>
      <span className={`smart-mode ${connected ? 'connected' : ''}`}>{connected ? <Wifi size={15} /> : <WifiOff size={15} />}{connected ? 'Conectado' : 'Modo demonstração'}</span>
    </section>

    <div className="smart-summary"><div><strong>{shown.length}</strong><span>aparelhos</span></div><div><strong>{active}</strong><span>ligados</span></div><button onClick={() => setConfigOpen(!configOpen)}><Settings2 size={17} /> {connected ? 'Configurar conexão' : 'Conectar Home Assistant'}</button></div>

    {configOpen && <form className="smart-config" onSubmit={connect}>
      <div><h3>Conexão com Home Assistant</h3><p>Use o endereço da sua instalação e um token de acesso de longa duração criado no seu perfil do Home Assistant.</p></div>
      <div className="smart-fields"><label>Endereço do Home Assistant<input type="url" required placeholder="http://homeassistant.local:8123" value={url} onChange={(event) => setUrl(event.target.value)} /></label><label>Token de acesso<input type="password" required placeholder="Cole seu token" value={token} onChange={(event) => setToken(event.target.value)} /></label></div>
      <p className="smart-hint">O navegador precisa alcançar esse endereço e a instalação deve permitir CORS para a origem deste painel. O token fica apenas nesta sessão do navegador.</p>
      <div className="smart-config-actions"><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Conectando...' : 'Conectar'}</button>{connected && <button type="button" className="smart-disconnect" onClick={disconnect}>Desconectar</button>}</div>
    </form>}

    {error && <div className="error-note smart-error" role="alert">{error}</div>}
    <div className="smart-section-title"><div><span className="eyebrow">DISPOSITIVOS</span><h3>{connected ? 'Aparelhos disponíveis' : 'Experimente os controles'}</h3></div>{connected && <button onClick={() => { setBusy(true); refresh(connection.url, connection.token).catch((err) => setError(err.message)).finally(() => setBusy(false)) }} disabled={busy}><RefreshCw size={15} /> Atualizar</button>}</div>
    {shown.length ? <div className="smart-grid">{shown.map((device) => {
      const domain = device.entity_id.split('.')[0]
      const Icon = deviceIcon(domain)
      const unavailable = ['unavailable', 'unknown'].includes(device.state)
      const on = device.state === 'on'
      return <article className={`smart-device ${on ? 'is-on' : ''}`} key={device.entity_id}>
        <div className="smart-device-top"><span className="smart-device-icon"><Icon size={23} /></span><span className={`smart-device-status ${unavailable ? 'unavailable' : ''}`}>{unavailable ? 'Indisponível' : on ? 'Ligado' : 'Desligado'}</span></div>
        <div className="smart-device-copy"><h4>{device.attributes?.friendly_name || device.entity_id}</h4><span>{device.entity_id}</span></div>
        <button className="smart-power" aria-label={`${on ? 'Desligar' : 'Ligar'} ${device.attributes?.friendly_name || device.entity_id}`} aria-pressed={on} disabled={unavailable || pending === device.entity_id} onClick={() => toggle(device)}><Power size={17} /> {pending === device.entity_id ? 'Aguarde...' : on ? 'Desligar' : 'Ligar'}</button>
      </article>
    })}</div> : <div className="smart-empty">Nenhuma luz, tomada ou ventilador compatível foi encontrado.</div>}
    {!connected && <p className="smart-demo-note">Os botões acima alteram apenas esta demonstração. Para controlar dispositivos físicos, conecte sua instalação Home Assistant.</p>}
  </div>
}
