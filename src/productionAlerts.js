// A configurable monitoring rule, not an estimate of expected solar yield.
export function lowProductionAlert(samples, { now = Date.now(), threshold = 1.5, timeZone } = {}) {
  if (!Number.isFinite(threshold) || threshold <= 0) return null
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' })
  const inWindow = (timestamp) => {
    const hour = Number(formatter.format(new Date(timestamp)))
    return hour >= 9 && hour < 15
  }
  if (!inWindow(now)) return null
  const ordered = [...new Map(samples.filter((row) => {
    const time = Date.parse(row.timestamp)
    return Number.isFinite(time) && time <= now && time >= now - 30 * 60000 && Number.isFinite(row.solar_kw) && row.solar_kw >= 0
  }).map((row) => [Date.parse(row.timestamp), row])).values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
  const latest = ordered.at(-1)
  if (!latest || now - Date.parse(latest.timestamp) > 5 * 60000) return null
  let start = Date.parse(latest.timestamp)
  for (let i = ordered.length - 1; i >= 0; i--) {
    const row = ordered[i]
    const time = Date.parse(row.timestamp)
    if (row.solar_kw >= threshold || !inWindow(time) || start - time > 5 * 60000) break
    start = time
  }
  if (Date.parse(latest.timestamp) - start < 10 * 60000) return null
  const format = (value) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  return {
    title: 'Baixa produção no horário de pico',
    detail: `Produção abaixo de ${format(threshold)} kW por pelo menos 10 minutos, entre 9h e 15h. Última leitura: ${format(latest.solar_kw)} kW. Nuvens, sombreamento ou condições do sistema podem reduzir a geração; a causa não foi confirmada.`,
  }
}
