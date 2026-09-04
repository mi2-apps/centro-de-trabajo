// Historico de turnos de Hora por Hora (2026-09-04, a peticion explicita del usuario --
// "Ver historico... Fecha desde, Fecha hasta, Turno, Area/Linea... Fecha, Turno, Area, Esperado,
// Real, Gap, Cumplimiento, Perdidas, Principal causa"). Solo lectura -- el detalle hora por hora
// de un registro especifico se pide aparte via GET /api/hora-por-hora/sessions/[id].
//
// Perdidas (2026-09-04 v2): topCauseName es el NOMBRE real de la causa (texto libre del catalogo
// por area, ya no una labelKey de i18n -- las causas ahora las escribe el admin, no son fijas).
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm'
import { requireAuth } from '../../../server-lib/auth.js'
import {
  db,
  hourlyProductionDowntimeCause,
  hourlyProductionEntry,
  hourlyProductionIncident,
  hourlyProductionSession,
} from '../../../server-lib/db/client.js'
import { canUserAccessModule } from '../../../server-lib/permissionService.js'

export default requireAuth(async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const allowed = await canUserAccessModule({
    userId: req.user.id,
    role: req.user.role,
    moduleKey: '/hora-por-hora',
  })
  if (!allowed) return res.status(403).json({ error: 'No autorizado para este modulo' })

  const { dateFrom, dateTo, shift, areaId } = req.query || {}
  if (!dateFrom || !dateTo) {
    return res.status(400).json({ error: 'Faltan dateFrom o dateTo.' })
  }

  const conditions = [
    gte(hourlyProductionSession.date, new Date(`${dateFrom}T00:00:00`)),
    lte(hourlyProductionSession.date, new Date(`${dateTo}T00:00:00`)),
  ]
  if (shift) conditions.push(eq(hourlyProductionSession.shift, shift))
  if (areaId) conditions.push(eq(hourlyProductionSession.areaId, areaId))

  const sessions = await db
    .select()
    .from(hourlyProductionSession)
    .where(and(...conditions))
    .orderBy(asc(hourlyProductionSession.date))

  const results = []
  for (const session of sessions) {
    const entries = await db
      .select({
        id: hourlyProductionEntry.id,
        standardQty: hourlyProductionEntry.standardQty,
        actualQty: hourlyProductionEntry.actualQty,
      })
      .from(hourlyProductionEntry)
      .where(eq(hourlyProductionEntry.sessionId, session.id))

    const expected = entries.reduce((sum, e) => sum + e.standardQty, 0)
    const actual = entries.reduce((sum, e) => sum + (e.actualQty ?? 0), 0)

    const entryIds = entries.map((e) => e.id)
    const incidentRows = entryIds.length
      ? await db
          .select({
            causeId: hourlyProductionIncident.causeId,
            value: hourlyProductionIncident.value,
            causeName: hourlyProductionDowntimeCause.name,
          })
          .from(hourlyProductionIncident)
          .innerJoin(
            hourlyProductionDowntimeCause,
            eq(hourlyProductionIncident.causeId, hourlyProductionDowntimeCause.id),
          )
          .where(inArray(hourlyProductionIncident.entryId, entryIds))
      : []

    const totalsByCause = new Map()
    for (const row of incidentRows) {
      totalsByCause.set(row.causeId, {
        name: row.causeName,
        total: (totalsByCause.get(row.causeId)?.total || 0) + row.value,
      })
    }
    const totalLoss = [...totalsByCause.values()].reduce((sum, c) => sum + c.total, 0)
    const topCauseName =
      [...totalsByCause.values()].filter((c) => c.total > 0).sort((a, b) => b.total - a.total)[0]
        ?.name || null

    results.push({
      id: session.id,
      date: session.date,
      shift: session.shift,
      areaId: session.areaId,
      status: session.status,
      lossUnit: session.lossUnit,
      expected,
      actual,
      gap: actual - expected,
      compliancePct: expected > 0 ? Math.round((actual / expected) * 1000) / 10 : null,
      totalLoss,
      topCauseName,
    })
  }

  return res.status(200).json({ sessions: results })
})
