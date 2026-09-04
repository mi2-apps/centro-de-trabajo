// Modulo Control de Equipo (2026-09-04, a peticion explicita del usuario -- catalogo real de
// equipo fisico + "esto debe de hacer" un registro). Ver src/data/controlEquipo/catalog.js
// (EQUIPMENT_TYPES/EQUIPMENT_STATUSES, UNICA fuente de valores validos) y
// server-lib/db/schema.js (EquipmentItem, migracion drizzle/0009_add_equipment_tables.sql).
//
// Mismo patron GET/POST que api/demoras/index.js -- 1 fila por observacion/evento de estado de
// un equipo real (append-only), nunca un maestro editable.
import { and, desc, eq } from 'drizzle-orm'
import { requireAuth } from '../../server-lib/auth.js'
import { db, equipmentItem, user } from '../../server-lib/db/client.js'
import { canUserAccessModule } from '../../server-lib/permissionService.js'
import { EQUIPMENT_STATUSES, EQUIPMENT_TYPE_KEYS } from '../../src/data/controlEquipo/catalog.js'

async function handleGet(req, res) {
  const { areaId, typeKey } = req.query || {}
  const conditions = []
  if (areaId) conditions.push(eq(equipmentItem.areaId, areaId))
  if (typeKey) conditions.push(eq(equipmentItem.typeKey, typeKey))
  const rows = await db
    .select({
      id: equipmentItem.id,
      typeKey: equipmentItem.typeKey,
      areaId: equipmentItem.areaId,
      stationName: equipmentItem.stationName,
      code: equipmentItem.code,
      status: equipmentItem.status,
      notes: equipmentItem.notes,
      createdAt: equipmentItem.createdAt,
      createdByName: user.name,
    })
    .from(equipmentItem)
    .leftJoin(user, eq(equipmentItem.createdByUserId, user.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(equipmentItem.createdAt))
    .limit(500)
  return res.status(200).json({ items: rows })
}

async function handlePost(req, res) {
  const { typeKey, areaId, stationName, code, status, notes } = req.body || {}
  if (!areaId || typeof areaId !== 'string') {
    return res.status(400).json({ error: 'Falta areaId.' })
  }
  if (!typeKey || !EQUIPMENT_TYPE_KEYS.has(typeKey)) {
    return res.status(400).json({ error: 'Tipo de equipo invalido.' })
  }
  if (!status || !EQUIPMENT_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Estado de equipo invalido.' })
  }

  const [created] = await db
    .insert(equipmentItem)
    .values({
      typeKey,
      areaId,
      stationName: stationName || null,
      code: code || null,
      status,
      notes: notes || null,
      createdByUserId: req.user.id,
    })
    .returning()

  return res.status(201).json({ item: { ...created, createdByName: req.user.name } })
}

export default requireAuth(async (req, res) => {
  const allowed = await canUserAccessModule({
    userId: req.user.id,
    role: req.user.role,
    moduleKey: '/control-equipo',
  })
  if (!allowed) return res.status(403).json({ error: 'No autorizado para este modulo' })

  if (req.method === 'GET') return handleGet(req, res)
  if (req.method === 'POST') return handlePost(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
})
