import React, { useEffect, useState } from 'react'
import { CalendarDays, Cloud, CloudRain, CloudSun, LocateFixed, MapPin, Search, Sun, Thermometer, Waves, Clock3, X } from 'lucide-react'
import './weather.css'

const STORAGE_KEY = 'solar-monitor-weather-location'

function savedLocation() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    return value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude) ? value : null
  } catch { return null }
}

function condition(code) {
  if (code == null) return { label: 'Sem informação', icon: CloudSun }
  if (code <= 1) return { label: 'Céu limpo', icon: Sun }
  if (code <= 3) return { label: 'Parcialmente nublado', icon: CloudSun }
  if (code <= 48) return { label: 'Nublado ou neblina', icon: Cloud }
  if (code >= 95) return { label: 'Tempestade', icon: CloudRain }
  return { label: 'Chuva ou garoa', icon: CloudRain }
}

const display = (value, digits = 0) => Number.isFinite(value) ? value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—'
const uvLabel = (uv) => uv == null ? 'Sem informação' : uv < 3 ? 'Baixo' : uv < 6 ? 'Moderado' : uv < 8 ? 'Alto' : uv < 11 ? 'Muito alto' : 'Extremo'

export default function WeatherPanel({ compact = false }) {
  const [location, setLocation] = useState(savedLocation)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [weather, setWeather] = useState(null)
  const [error, setError] = useState('')
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [now, setNow] = useState(() => new Date())
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const syncLocation = () => {
      setLocation(savedLocation())
      setWeather(null)
    }
    window.addEventListener('solar-monitor-location-change', syncLocation)
    window.addEventListener('storage', syncLocation)
    return () => { window.removeEventListener('solar-monitor-location-change', syncLocation); window.removeEventListener('storage', syncLocation) }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!location) return
    const controller = new AbortController()
    async function load() {
      try {
        const params = new URLSearchParams({
          latitude: String(location.latitude), longitude: String(location.longitude),
          current: 'temperature_2m,uv_index,shortwave_radiation,weather_code,is_day',
          daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
          timezone: 'auto', forecast_days: '7',
        })
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Não foi possível consultar a previsão.')
        const data = await response.json()
        if (!data.current || !data.daily?.time) throw new Error('A previsão veio incompleta.')
        setWeather(data)
        if (data.timezone && data.timezone !== location.timezone) {
          const withTimeZone = { ...location, timezone: data.timezone }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(withTimeZone))
          window.dispatchEvent(new CustomEvent('solar-monitor-location-change', { detail: withTimeZone }))
        }
        setUpdatedAt(new Date())
        setError('')
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message || 'Não foi possível atualizar o clima.')
      }
    }
    load()
    const timer = window.setInterval(load, 15 * 60 * 1000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [location])

  function choose(place) {
    const selected = { name: place.name, admin1: place.admin1 || '', latitude: place.latitude, longitude: place.longitude, timezone: place.timezone || undefined, source: place.source || null }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selected))
    window.dispatchEvent(new CustomEvent('solar-monitor-location-change', { detail: selected }))
    setLocation(selected)
    setWeather(null)
    setUpdatedAt(null)
    setResults([])
    setQuery('')
    setError('')
  }

  async function search(event) {
    event.preventDefault()
    if (query.trim().length < 2) { setError('Digite pelo menos 2 letras da cidade.'); return }
    setSearching(true)
    setError('')
    setResults([])
    try {
      const params = new URLSearchParams({ name: query.trim(), count: '5', language: 'pt' })
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
      if (!response.ok) throw new Error('Não foi possível buscar a cidade.')
      const data = await response.json()
      if (!data.results?.length) throw new Error('Nenhuma cidade encontrada. Tente incluir o estado ou país.')
      setResults(data.results)
    } catch (err) { setError(err.message || 'Falha na busca da cidade.') }
    finally { setSearching(false) }
  }

  function locate() {
    if (!navigator.geolocation) { setError('Localização indisponível neste navegador. Busque sua cidade.'); return }
    setLocating(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { choose({ name: 'Minha localização', latitude: coords.latitude, longitude: coords.longitude, source: 'gps' }); setLocating(false) },
      () => { setError('Não foi possível obter sua localização. Busque sua cidade.'); setLocating(false) },
      { timeout: 10000, enableHighAccuracy: false },
    )
  }

  const current = weather?.current
  const currentCondition = condition(current?.weather_code)
  const CurrentIcon = currentCondition.icon
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: location?.timezone || undefined }).format(now)
  const days = weather?.daily?.time?.slice(0, 7) || []

  if (compact) return <div className="weather-compact">
    <div className="weather-date"><CalendarDays size={14} /><span>{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span></div>
    <div className="weather-compact-values" aria-label="Condições do tempo">
      <CurrentIcon size={17} aria-label={currentCondition.label} />
      <span className="weather-compact-place">{location?.name || 'Clima'}</span>{location && (location.source === 'gps' || location.name?.toLowerCase().includes('localização')) && <LocateFixed className="weather-gps-mark" size={12} aria-label="Localização por GPS" title="Localização por GPS" />}
      <strong>{display(current?.temperature_2m, 0)}°</strong>
      <span className="weather-compact-detail">UV {display(current?.uv_index, 0)}</span>
      <span className="weather-compact-detail">{display(current?.shortwave_radiation)} W/m²</span>
    </div>
    <button className="weather-compact-edit" onClick={() => setSettingsOpen(!settingsOpen)} aria-expanded={settingsOpen} aria-label="Configurar clima" title="Configurar clima"><MapPin size={15} /></button>
    <div className="weather-week" aria-label="Previsão do tempo para sete dias">
      {days.length ? days.map((date, index) => { const info = condition(weather.daily.weather_code?.[index]); const Icon = info.icon; return <div className="weather-week-day" key={date} title={`${info.label} · Chuva ${display(weather.daily.precipitation_probability_max?.[index])}%`}><span>{index === 0 ? 'Hoje' : new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}</span><Icon size={19} aria-label={info.label} /><strong>{display(weather.daily.temperature_2m_max?.[index])}° <small>{display(weather.daily.temperature_2m_min?.[index])}°</small></strong></div> }) : <span className="weather-week-empty">{location ? 'Carregando previsão da semana...' : 'Escolha uma cidade para ver a previsão da semana.'}</span>}
    </div>
    {settingsOpen && <div className="weather-compact-popover">
      <div className="weather-compact-popover-title"><div><strong>Clima e previsão</strong><span>{location ? `${location.name}${location.admin1 ? `, ${location.admin1}` : ''} · ${time}` : 'Escolha uma cidade'}</span></div><button className="weather-popover-close" onClick={() => setSettingsOpen(false)} aria-label="Fechar localização" title="Fechar"><X size={16} /></button></div>
      <div className="weather-location-row">
        <form onSubmit={search} className="weather-search"><label className="sr-only" htmlFor="weather-city">Buscar cidade</label><input id="weather-city" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cidade" /><button type="submit" disabled={searching} aria-label="Buscar cidade"><Search size={16} /></button></form>
        <button className="weather-locate" onClick={locate} disabled={locating}><LocateFixed size={15} /> {locating ? 'Localizando...' : 'Usar localização'}</button>
      </div>
      {results.length > 0 && <div className="weather-results" role="listbox" aria-label="Cidades encontradas">{results.map((place) => <button key={place.id} onClick={(event) => { choose(place); setSettingsOpen(false) }} role="option" aria-selected="false">{place.name}{place.admin1 ? `, ${place.admin1}` : ''} · {place.country}</button>)}</div>}
      {error && <p className="weather-error" role="alert">{error}</p>}
      <div className="weather-compact-popover-metrics"><span>Temperatura <b>{display(current?.temperature_2m, 1)} °C</b></span><span>Índice UV <b>{display(current?.uv_index, 1)}</b></span><span>Irradiância <b>{display(current?.shortwave_radiation)} W/m²</b></span></div>
      <div className="weather-credit">Dados: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a></div>
    </div>}
  </div>

  return <section className="weather-panel" aria-label="Clima e previsão do tempo">
    <div className="weather-header">
      <div><span className="visual-eyebrow">CLIMA E CONDIÇÕES SOLARES</span><h2><CloudSun size={22} /> Tempo na sua região</h2></div>
      <div className="weather-place"><MapPin size={14} />{location ? `${location.name}${location.admin1 ? `, ${location.admin1}` : ''}` : 'Escolha uma cidade'}</div>
    </div>
    <div className="weather-location-row">
      <form onSubmit={search} className="weather-search"><label className="sr-only" htmlFor="weather-city">Buscar cidade</label><input id="weather-city" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cidade" /><button type="submit" disabled={searching} aria-label="Buscar cidade"><Search size={16} /></button></form>
      <button className="weather-locate" onClick={locate} disabled={locating}><LocateFixed size={15} /> {locating ? 'Localizando...' : 'Usar localização'}</button>
      {updatedAt && <span className="weather-updated">Atualizado às {new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(updatedAt)}</span>}
    </div>
    {results.length > 0 && <div className="weather-results" role="listbox" aria-label="Cidades encontradas">{results.map((place) => <button key={place.id} onClick={() => choose(place)} role="option" aria-selected="false">{place.name}{place.admin1 ? `, ${place.admin1}` : ''} · {place.country}</button>)}</div>}
    {error && <p className="weather-error" role="alert">{error}</p>}
    <div className="weather-metrics">
      <div className="weather-metric"><Clock3 size={21} /><span>Hora local</span><strong>{time}</strong><small>{location ? 'No fuso da cidade' : 'No seu dispositivo'}</small></div>
      <div className="weather-metric"><Thermometer size={21} /><span>Temperatura ambiente</span><strong>{display(current?.temperature_2m, 1)} <em>°C</em></strong><small>{current ? currentCondition.label : location ? 'Carregando previsão...' : 'Selecione uma cidade'}</small></div>
      <div className="weather-metric"><Sun size={21} /><span>Índice UV</span><strong>{display(current?.uv_index, 1)}</strong><small>{uvLabel(current?.uv_index)}</small></div>
      <div className="weather-metric"><Waves size={21} /><span>Força do sol</span><strong>{display(current?.shortwave_radiation)} <em>W/m²</em></strong><small>Irradiância solar estimada</small></div>
    </div>
    <div className="weather-forecast"><div className="weather-forecast-title"><CurrentIcon size={17} /><span>Previsão do tempo</span><small>Hoje e próximos 6 dias</small></div><div className="weather-days">{days.length ? days.map((date, index) => { const info = condition(weather.daily.weather_code?.[index]); const Icon = info.icon; return <div className="weather-day" key={date}><span>{index === 0 ? 'Hoje' : new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}</span><Icon size={20} aria-label={info.label} /><b>{display(weather.daily.temperature_2m_max?.[index])}° <small>{display(weather.daily.temperature_2m_min?.[index])}°</small></b><small>Chuva {display(weather.daily.precipitation_probability_max?.[index])}%</small></div> }) : <p>{location ? 'Carregando previsão...' : 'Selecione uma cidade para ver a previsão.'}</p>}</div></div>
    <div className="weather-credit">Dados meteorológicos: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>. Valores estimados para a região; temperatura do inversor é uma leitura separada.</div>
  </section>
}
