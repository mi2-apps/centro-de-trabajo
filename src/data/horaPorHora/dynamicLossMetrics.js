/* Perdidas dinamicas por causa de Hora por Hora (2026-09-04 v2, a peticion explicita del usuario
   -- "cada area tiene sus paros, no todas las areas son iguales... yo pongo el catalogo de cada
   area"). A diferencia de Sorting (src/data/shiftProduction/lossColumns.js, columnas fijas), aqui
   el conjunto de causas varia por area -- cada entry trae `losses: {causeId: value}` y el
   catalogo de causas activo de la sesion se pasa aparte (session.causes, ver
   server-lib/hourlyProduction.js). Funciones deliberadamente separadas de shiftProduction/
   metrics.js para no romper Sorting, que sigue con su propio shape fijo de 11 columnas. */
import { computeCompliancePct } from '../shiftProduction/metrics.js'

export function computeTotalLoss(entry) {
  return Object.values(entry.losses || {}).reduce((sum, v) => sum + (Number(v) || 0), 0)
}

// Solo causas con total > 0 (a peticion explicita del usuario), ordenadas de mayor a menor.
export function computeParetoData(entries, causes) {
  const totalsByCause = causes
    .map((c) => ({
      causeId: c.id,
      name: c.name,
      value: entries.reduce((sum, e) => sum + (Number(e.losses?.[c.id]) || 0), 0),
    }))
    .filter((c) => c.value > 0)
  const total = totalsByCause.reduce((s, c) => s + c.value, 0)
  const sorted = [...totalsByCause].sort((a, b) => b.value - a.value)
  let cumulative = 0
  return sorted.map((c) => {
    cumulative += c.value
    return {
      ...c,
      pct: total > 0 ? (c.value / total) * 100 : 0,
      cumulativePct: total > 0 ? (cumulative / total) * 100 : 0,
    }
  })
}

export function computeShiftSummary(entries, causes) {
  const expected = entries.reduce((sum, e) => sum + e.standardQty, 0)
  const actual = entries.reduce((sum, e) => sum + (e.actualQty ?? 0), 0)
  const totalLoss = entries.reduce((sum, e) => sum + computeTotalLoss(e), 0)
  const lossByCause = causes.map((c) => ({
    causeId: c.id,
    name: c.name,
    value: entries.reduce((sum, e) => sum + (Number(e.losses?.[c.id]) || 0), 0),
  }))
  const topCauseName =
    [...lossByCause].filter((c) => c.value > 0).sort((a, b) => b.value - a.value)[0]?.name || null
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
    totalLoss,
    lossByCause,
    topCauseName,
    capturedHours,
    compliantHours,
    totalHours: entries.length,
  }
}
