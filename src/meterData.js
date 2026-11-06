export const METER_KEY = 'solar-casa-enel-readings-v1'
const round = (value) => Math.round(value * 1000) / 1000

export function loadMeterReadings() {
  try {
    const rows = JSON.parse(localStorage.getItem(METER_KEY) || '[]')
    return Array.isArray(rows) ? rows.filter((row) => Number.isFinite(Date.parse(row.timestamp)) && Number.isFinite(row.importKwh) && Number.isFinite(row.exportKwh)).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)) : []
  } catch { return [] }
}

export function meterIntervals(readings) {
  let runningBalance = 0
  return readings.slice(1).map((row, index) => {
    const previous = readings[index]
    const imported = round(row.importKwh - previous.importKwh)
    const exported = round(row.exportKwh - previous.exportKwh)
    const gridBalance = round(exported - imported)
    runningBalance = round(runningBalance + gridBalance)
    const solar = row.solarTotalKwh != null && previous.solarTotalKwh != null ? round(row.solarTotalKwh - previous.solarTotalKwh) : null
    return { start: previous.timestamp, end: row.timestamp, imported, exported, gridBalance, cumulativeBalance: runningBalance, solar, consumption: solar == null ? null : round(solar + imported - exported), selfUse: solar == null ? null : round(solar - exported) }
  })
}
