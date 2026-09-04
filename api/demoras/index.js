// Modulo Demoras (2026-09-04, a peticion explicita del usuario -- catalogo real de causas de
// tiempo muerto + "esto debe de hacer Registro de demora"). Ver src/data/demoras/catalog.js
// (DOWNTIME_REASONS, UNICA fuente de las causas validas) y server-lib/db/schema.js
// (DowntimeRecord, migracion drizzle/0008_add_downtime_record.sql).
//
// NOTA DE ALCANCE (a peticion explicita del usuario, tras confirmar que la clasificacion real de
// TVs vive en SmartControl/BinManager -- sistema externo, solo lectura desde este repo): este
// endpoint SOLO guarda/lista el registro de demora. No existe ni se intenta un bloqueo tecnico de
// "no dejar clasificar la siguiente TV" -- eso queda como politica de proceso del supervisor, no
// como gate de sistema.
import { and, desc, eq } from 'drizzle-orm'
import { requireAuth } from '../../server-lib/auth.js'
import { db, downtimeRecord, user } from '../../server-lib/db/client.js'
import { canUserAccessModule } from '../../server-lib/permissionService.js'
import { DOWNTIME_REASON_KEYS } from '../../src/data/demoras/catalog.js'

async function handleGet(req, res) {
  const { areaId, reasonKey } = req.query || {}
  const conditions = []
  if (areaId) conditions.push(eq(downtimeRecord.areaId, areaId))
  if (reasonKey) conditions.push(eq(downtimeRecord.reasonKey, reasonKey))
  const rows = await db
    .select({
      id: downtimeRecord.id,
      areaId: downtimeRecord.areaId,
      stationName: downtimeRecord.stationName,
      reasonKey: downtimeRecord.reasonKey,
      durationMinutes: downtimeRecord.durationMinutes,
      shift: downtimeRecord.shift,
      notes: downtimeRecord.notes,
      createdAt: downtimeRecord.createdAt,
      createdByName: user.name,
    })
    .from(downtimeRecord)
    .leftJoin(user, eq(downtimeRecord.createdByUserId, user.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(downtimeRecord.createdAt))
    .limit(500)
  return res.status(200).json({ records: rows })
}

async function handlePost(req, res) {
  const { areaId, stationName, reasonKey, durationMinutes, shift, notes } = req.body || {}
  if (!areaId || typeof areaId !== 'string') {
    return res.status(400).json({ error: 'Falta areaId.' })
  }
  if (!reasonKey || !DOWNTIME_REASON_KEYS.has(reasonKey)) {
    return res.status(400).json({ error: 'Causa de demora invalida.' })
  }
  const duration = Number(durationMinutes)
  if (!Number.isFinite(duration) || duration <= 0) {
    return res.status(400).json({ error: 'La duracion debe ser un numero de minutos mayor a 0.' })
  }

  const [created] = await db
    .insert(downtimeRecord)
    .values({
      areaId,
      stationName: stationName || null,
      reasonKey,
      durationMinutes: Math.round(duration),
      shift: shift || null,
      notes: notes || null,
      createdByUserId: req.user.id,
    })
    .returning()

  return res.status(201).json({ record: { ...created, createdByName: req.user.name } })
}

export default requireAuth(async (req, res) => {
  const allowed = await canUserAccessModule({
    userId: req.user.id,
    role: req.user.role,
    moduleKey: '/demoras',
  })
  if (!allowed) return res.status(403).json({ error: 'No autorizado para este modulo' })

  if (req.method === 'GET') return handleGet(req, res)
  if (req.method === 'POST') return handlePost(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
})
