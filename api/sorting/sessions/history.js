// Historico de turnos de Sorting -- solo lectura, el detalle hora por hora de un registro
// especifico se pide aparte via GET /api/sorting/sessions/[id].
import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { requireAuth } from '../../../server-lib/auth.js'
import { db, sortingEntry, sortingSession } from '../../../server-lib/db/client.js'
import { canUserAccessModule } from '../../../server-lib/permissionService.js'
import { LOSS_COLUMNS } from '../../../src/data/shiftProduction/lossColumns.js'

export default requireAuth(async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const allowed = await canUserAccessModule({
    userId: req.user.id,
    role: req.user.role,
    moduleKey: '/sorting',
  })
  if (!allowed) return res.status(403).json({ error: 'No autorizado para este modulo' })

  const { dateFrom, dateTo, shift, areaId } = req.query || {}
  if (!dateFrom || !dateTo) {
    return res.status(400).json({ error: 'Faltan dateFrom o dateTo.' })
  }

  const conditions = [
    gte(sortingSession.date, new Date(`${dateFrom}T00:00:00`)),
    lte(sortingSession.date, new Date(`${dateTo}T00:00:00`)),
  ]
  if (shift) conditions.push(eq(sortingSession.shift, shift))
  if (areaId) conditions.push(eq(sortingSession.areaId, areaId))

  const sessions = await db
    .select()
    .from(sortingSession)
    .where(and(...conditions))
    .orderBy(asc(sortingSession.date))

  const results = []
  for (const session of sessions) {
    const entries = await db
      .select()
      .from(sortingEntry)
      .where(eq(sortingEntry.sessionId, session.id))

    const expected = entries.reduce((sum, e) => sum + e.standardQty, 0)
    const actual = entries.reduce((sum, e) => sum + (e.actualQty ?? 0), 0)

    const totalsByColumn = LOSS_COLUMNS.map((c) => ({
      labelKey: c.labelKey,
      total: entries.reduce((sum, e) => sum + (e[c.key] || 0), 0),
    }))
    const totalLoss = totalsByColumn.reduce((sum, c) => sum + c.total, 0)
    const topCauseKey =
      totalsByColumn.filter((c) => c.total > 0).sort((a, b) => b.total - a.total)[0]?.labelKey ||
      null

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
      topCauseKey,
    })
  }

  return res.status(200).json({ sessions: results })
})
