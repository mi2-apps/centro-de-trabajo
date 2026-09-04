// Historico de turnos de Hora por Hora (2026-09-04, a peticion explicita del usuario --
// "Ver historico... Fecha desde, Fecha hasta, Turno, Area/Linea... Fecha, Turno, Area, Esperado,
// Real, Gap, Cumplimiento, Perdidas, Principal causa"). Solo lectura -- el detalle hora por hora
// de un registro especifico se pide aparte via GET /api/hora-por-hora/sessions/[id].
import { and, asc, eq, gte, lte } from 'drizzle-orm'
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
      .select()
      .from(hourlyProductionEntry)
      .where(eq(hourlyProductionEntry.sessionId, session.id))

    const entryIds = entries.map((e) => e.id)
    let incidentRows = []
    if (entryIds.length > 0) {
      incidentRows = await db
        .select({
          entryId: hourlyProductionIncident.entryId,
          causeId: hourlyProductionIncident.causeId,
          causeName: hourlyProductionDowntimeCause.name,
          measurementType: hourlyProductionIncident.measurementType,
          value: hourlyProductionIncident.value,
        })
        .from(hourlyProductionIncident)
        .innerJoin(
          hourlyProductionEntry,
          eq(hourlyProductionIncident.entryId, hourlyProductionEntry.id),
        )
        .leftJoin(
          hourlyProductionDowntimeCause,
          eq(hourlyProductionIncident.causeId, hourlyProductionDowntimeCause.id),
        )
        .where(eq(hourlyProductionEntry.sessionId, session.id))
    }

    const expected = entries.reduce((sum, e) => sum + e.standardQty, 0)
    const actual = entries.reduce((sum, e) => sum + (e.actualQty ?? 0), 0)
    const minutesLost = incidentRows
      .filter((i) => i.measurementType === 'MINUTES')
      .reduce((sum, i) => sum + i.value, 0)
    const piecesLost = incidentRows
      .filter((i) => i.measurementType === 'PIECES')
      .reduce((sum, i) => sum + i.value, 0)

    const byCause = {}
    for (const row of incidentRows) {
      const key = row.causeName || 'Otra'
      byCause[key] = (byCause[key] || 0) + row.value
    }
    const topCause = Object.entries(byCause).sort((a, b) => b[1] - a[1])[0]?.[0] || null

    results.push({
      id: session.id,
      date: session.date,
      shift: session.shift,
      areaId: session.areaId,
      status: session.status,
      expected,
      actual,
      gap: actual - expected,
      compliancePct: expected > 0 ? Math.round((actual / expected) * 1000) / 10 : null,
      minutesLost,
      piecesLost,
      topCause,
    })
  }

  return res.status(200).json({ sessions: results })
})
