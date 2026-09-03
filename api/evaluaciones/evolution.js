// "Evolución 5S" mensual (2026-09-03, a peticion explicita del usuario, idea tomada de la
// presentacion 5S original -- Ene..Dic con el resultado de cada mes). Datos 100% reales: para
// cada mes del año pedido, el totalScore de la auditoria MAS RECIENTE de esa entidad
// (areaId + stationName si se especifica) ese mes -- null si no hubo ninguna. NUNCA mezcla
// auditorias de areas/puestos distintos en la misma tendencia (a peticion explicita).
import { and, eq, gte, isNull, lte } from 'drizzle-orm'
import { requireAuth } from '../../server-lib/auth.js'
import { db, fiveSAudit } from '../../server-lib/db/client.js'
import { canUserAccessModule } from '../../server-lib/permissionService.js'

export default requireAuth(async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const allowed = await canUserAccessModule({
    userId: req.user.id,
    role: req.user.role,
    moduleKey: '/evaluaciones',
  })
  if (!allowed) return res.status(403).json({ error: 'No autorizado para este modulo' })

  const { areaId, stationName } = req.query || {}
  if (!areaId) return res.status(400).json({ error: 'Falta areaId.' })
  const year = Number(req.query.year) || new Date().getFullYear()

  const conditions = [
    eq(fiveSAudit.areaId, areaId),
    gte(fiveSAudit.auditDate, new Date(Date.UTC(year, 0, 1))),
    lte(fiveSAudit.auditDate, new Date(Date.UTC(year, 11, 31, 23, 59, 59))),
  ]
  if (stationName) conditions.push(eq(fiveSAudit.stationName, stationName))
  else conditions.push(isNull(fiveSAudit.stationName))

  const rows = await db
    .select({
      auditDate: fiveSAudit.auditDate,
      totalScore: fiveSAudit.totalScore,
      createdAt: fiveSAudit.createdAt,
    })
    .from(fiveSAudit)
    .where(and(...conditions))

  const byMonth = Array(12).fill(null)
  for (const row of rows) {
    const month = new Date(row.auditDate).getUTCMonth()
    const existing = byMonth[month]
    if (!existing || new Date(row.createdAt) > new Date(existing.createdAt)) {
      byMonth[month] = { totalScore: row.totalScore, createdAt: row.createdAt }
    }
  }

  return res.status(200).json({
    year,
    months: byMonth.map((m) => (m ? m.totalScore : null)),
  })
})
