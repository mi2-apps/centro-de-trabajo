// Widget "problemas en planta" al fondo del Dashboard (2026-09-04, a peticion explicita del
// usuario -- "asegurate que indique que problemas hay en la planta con los modulos conectados
// por si hay demora o problema de material, linea saturada, etc"). Mismo criterio de permisos
// que api/dashboard/trends.js (solo requireAuth, sin canUserAccessModule extra) -- es un resumen
// agregado, la visibilidad real de Demoras/Control de Equipo ya la protege cada modulo propio.
//
// Alcance real: agrega SOLO datos que existen de verdad (DowntimeRecord de hoy, EquipmentItem
// con problema reportado hoy) -- "linea saturada" no tiene fuente de datos real todavia, no se
// inventa aqui.
import { and, desc, gte, ne } from 'drizzle-orm'
import { requireAuth } from '../../server-lib/auth.js'
import { db, downtimeRecord, equipmentItem } from '../../server-lib/db/client.js'
import { DELAY_LOG_THRESHOLD_MINUTES } from '../../src/data/demoras/catalog.js'

const MATERIAL_REASON_KEYS = new Set([
  'falta-materiales',
  'falta-accesorios',
  'falta-cushion',
  'falta-protector',
  'falta-bolsas',
  'falta-herramientas',
])

export default requireAuth(async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [downtimeToday, equipmentIssuesToday] = await Promise.all([
    db
      .select({
        id: downtimeRecord.id,
        areaId: downtimeRecord.areaId,
        stationName: downtimeRecord.stationName,
        reasonKey: downtimeRecord.reasonKey,
        durationMinutes: downtimeRecord.durationMinutes,
        createdAt: downtimeRecord.createdAt,
      })
      .from(downtimeRecord)
      .where(gte(downtimeRecord.createdAt, todayStart))
      .orderBy(desc(downtimeRecord.createdAt)),
    db
      .select({
        id: equipmentItem.id,
        typeKey: equipmentItem.typeKey,
        areaId: equipmentItem.areaId,
        stationName: equipmentItem.stationName,
        code: equipmentItem.code,
        status: equipmentItem.status,
        createdAt: equipmentItem.createdAt,
      })
      .from(equipmentItem)
      .where(and(gte(equipmentItem.createdAt, todayStart), ne(equipmentItem.status, 'OPERATIVO')))
      .orderBy(desc(equipmentItem.createdAt)),
  ])

  const totalDowntimeMinutes = downtimeToday.reduce((sum, r) => sum + r.durationMinutes, 0)
  const reportableCount = downtimeToday.filter(
    (r) => r.durationMinutes >= DELAY_LOG_THRESHOLD_MINUTES,
  ).length
  const materialIssuesCount = downtimeToday.filter((r) =>
    MATERIAL_REASON_KEYS.has(r.reasonKey),
  ).length

  const countsByReason = {}
  for (const r of downtimeToday) {
    countsByReason[r.reasonKey] = (countsByReason[r.reasonKey] || 0) + 1
  }
  const topReasons = Object.entries(countsByReason)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reasonKey, count]) => ({ reasonKey, count }))

  return res.status(200).json({
    downtime: {
      totalRecords: downtimeToday.length,
      totalMinutes: totalDowntimeMinutes,
      reportableCount,
      materialIssuesCount,
      topReasons,
      recent: downtimeToday.slice(0, 5),
    },
    equipment: {
      issuesCount: equipmentIssuesToday.length,
      recent: equipmentIssuesToday.slice(0, 5),
    },
    generatedAt: new Date().toISOString(),
  })
})
