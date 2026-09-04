/* Calculos puros de Hora por Hora (2026-09-04) -- SIEMPRE derivados de standardQty/actualQty,
   nunca un numero que el usuario escriba a mano (a peticion explicita del usuario: "el usuario
   SOLO captura lo necesario... todo eso debe calcularlo el sistema"). Reutilizado tanto por la
   pagina principal como por la exportacion a Excel, para que ambos muestren exactamente el mismo
   numero siempre. */
import { buildShiftBlocks, findActiveBlockIndex } from './shiftBlocks.js'

// gap = real - estandar; cumplimiento = (real/estandar)*100, con estandar=0 manejado sin
// division entre cero (a peticion explicita del usuario).
export function computeGap(standardQty, actualQty) {
  if (actualQty == null) return null
  return actualQty - standardQty
}

export function computeCompliancePct(standardQty, actualQty) {
  if (actualQty == null || !standardQty) return null
  return (actualQty / standardQty) * 100
}

export const STATUS_LABEL_KEY = {
  'SIN CAPTURA': 'statusNoCapture',
  'EN PROCESO': 'statusInProgress',
  'BAJO OBJETIVO': 'statusBelowTarget',
  CUMPLIDO: 'statusMet',
  SUPERADO: 'statusExceeded',
}

export function getEntryStatus(entry, isActive) {
  if (isActive) return 'EN PROCESO'
  if (entry.actualQty == null) return 'SIN CAPTURA'
  const pct = computeCompliancePct(entry.standardQty, entry.actualQty)
  if (pct > 100) return 'SUPERADO'
  if (pct >= 99.95) return 'CUMPLIDO'
  return 'BAJO OBJETIVO'
}

// Indice del bloque activo AHORA para una sesion real (combina la fecha+turno reales de la
// sesion con OFFICIAL_SHIFTS para saber si "ahora" cae dentro de este turno especifico).
export function getActiveEntryIndex(session, shiftConfig, entries) {
  if (!session || !shiftConfig || entries.length === 0) return -1
  const blocks = buildShiftBlocks(session.date, shiftConfig)
  const idx = findActiveBlockIndex(blocks, new Date())
  if (idx < 0 || idx >= entries.length) return -1
  return idx
}

// "Cumulativo a este punto del turno" (2026-09-04, a peticion explicita del usuario -- ver
// seccion ACUMULADO: "08:00 Esperado 65 Real 40, 09:00 Esperado 130 Real 105..."): esperado/real
// SIEMPRE suman solo hasta la hora activa (turno en curso) o hasta el final (turno ya
// terminado/historico) -- nunca el total completo del turno mientras todavia faltan horas por
// llegar, para no mostrar un gap enorme y enganoso a las 07:05 am de un turno de 10 horas.
export function computeCumulativeTotals(entries, activeIndex) {
  const cutoff = activeIndex >= 0 ? activeIndex : entries.length - 1
  const relevant = entries.slice(0, cutoff + 1)
  const expected = relevant.reduce((sum, e) => sum + e.standardQty, 0)
  const actual = relevant.reduce((sum, e) => sum + (e.actualQty ?? 0), 0)
  return {
    expected,
    actual,
    gap: actual - expected,
    compliancePct: expected > 0 ? (actual / expected) * 100 : null,
  }
}

// Serie para la grafica de "Avance acumulado" -- un punto por hora YA TRANSCURRIDA (o toda la
// serie si el turno es historico), esperado/real acumulados hasta esa hora.
export function computeAccumulatedSeries(entries, activeIndex) {
  const cutoff = activeIndex >= 0 ? activeIndex : entries.length - 1
  let expectedAcc = 0
  let actualAcc = 0
  const series = []
  entries.forEach((e, idx) => {
    if (idx > cutoff) return
    expectedAcc += e.standardQty
    actualAcc += e.actualQty ?? 0
    series.push({ hour: e.endTime, expected: expectedAcc, actual: actualAcc })
  })
  return series
}

// Pareto de causas -- NUNCA mezcla minutos con piezas (a peticion explicita del usuario).
export function computeParetoData(entries, measurementType) {
  const byCause = new Map()
  for (const entry of entries) {
    for (const incident of entry.incidents || []) {
      if (incident.measurementType !== measurementType) continue
      const key = incident.causeName || 'Otra'
      byCause.set(key, (byCause.get(key) || 0) + incident.value)
    }
  }
  const total = [...byCause.values()].reduce((s, v) => s + v, 0)
  const sorted = [...byCause.entries()].sort((a, b) => b[1] - a[1])
  let cumulative = 0
  return sorted.map(([cause, value]) => {
    cumulative += value
    return {
      cause,
      value,
      pct: total > 0 ? (value / total) * 100 : 0,
      cumulativePct: total > 0 ? (cumulative / total) * 100 : 0,
    }
  })
}

// Resumen del turno completo (2026-09-04) -- SIEMPRE el turno COMPLETO (no el cutoff parcial de
// arriba), usado en "Resumen del turno" y en el Excel -- ahi si se quiere ver el total real
// acumulado a la fecha de exportacion/consulta, no limitado a "hasta ahora".
export function computeShiftSummary(entries) {
  const expected = entries.reduce((sum, e) => sum + e.standardQty, 0)
  const actual = entries.reduce((sum, e) => sum + (e.actualQty ?? 0), 0)
  const allIncidents = entries.flatMap((e) => e.incidents || [])
  const minutesLost = allIncidents
    .filter((i) => i.measurementType === 'MINUTES')
    .reduce((s, i) => s + i.value, 0)
  const piecesLost = allIncidents
    .filter((i) => i.measurementType === 'PIECES')
    .reduce((s, i) => s + i.value, 0)
  const byCause = new Map()
  for (const i of allIncidents) {
    const key = i.causeName || 'Otra'
    byCause.set(key, (byCause.get(key) || 0) + i.value)
  }
  const topCause = [...byCause.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null
  const capturedHours = entries.filter((e) => e.actualQty != null).length
  const compliantHours = entries.filter((e) => {
    const pct = computeCompliancePct(e.standardQty, e.actualQty)
    return pct != null && pct >= 99.95
  }).length
  return {
    expected,
    actual,
    gap: actual - expected,
    compliancePct: expected > 0 ? (actual / expected) * 100 : null,
    minutesLost,
    piecesLost,
    topCause,
    capturedHours,
    compliantHours,
    totalHours: entries.length,
  }
}
