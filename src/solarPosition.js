// Solar coordinates from NOAA's General Solar Position Calculations.
// Azimuth is clockwise from true north; elevation is above the horizon.
const RAD = Math.PI / 180
const DEG = 180 / Math.PI

export function solarPosition(at, latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  const year = at.getUTCFullYear()
  const day = Math.floor((Date.UTC(year, at.getUTCMonth(), at.getUTCDate()) - Date.UTC(year, 0, 1)) / 86400000) + 1
  const days = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365
  const utcMinutes = at.getUTCHours() * 60 + at.getUTCMinutes() + at.getUTCSeconds() / 60
  const gamma = 2 * Math.PI / days * (day - 1 + (utcMinutes / 60 - 12) / 24)
  const equation = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma))
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma)
  const hourAngle = ((utcMinutes + equation + 4 * longitude) / 4 - 180) * RAD
  const lat = latitude * RAD
  const east = -Math.cos(declination) * Math.sin(hourAngle)
  const north = Math.cos(lat) * Math.sin(declination) - Math.sin(lat) * Math.cos(declination) * Math.cos(hourAngle)
  const up = Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle)
  const elevation = Math.asin(Math.max(-1, Math.min(1, up))) * DEG
  const azimuth = (Math.atan2(east, north) * DEG + 360) % 360
  return { azimuth, elevation, east, north, up }
}

export function zoneParts(at, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at)
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
}

// Resolve a wall-clock time in the selected city's time zone to one UTC instant.
export function zonedDayMinuteToDate(day, minute, timeZone) {
  const target = Date.UTC(day.year, day.month - 1, day.day, Math.floor(minute / 60), minute % 60)
  let guess = target
  for (let i = 0; i < 3; i++) {
    const shown = zoneParts(new Date(guess), timeZone)
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute)
    guess += target - shownAsUtc
  }
  return new Date(guess)
}
