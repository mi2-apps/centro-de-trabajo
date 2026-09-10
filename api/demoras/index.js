// Modulo Demoras (2026-09-04, a peticion explicita del usuario -- catalogo real de causas de
// tiempo muerto + "esto debe de hacer Registro de demora"). Ver src/data/demoras/catalog.js
// (FFT_DOWNTIME_REASONS/SORTING_DOWNTIME_REASONS, UNICA fuente de las causas validas) y
// server-lib/db/schema.js (DowntimeRecord, migracion drizzle/0008_add_downtime_record.sql).
//
// NOTA DE ALCANCE (a peticion explicita del usuario, tras confirmar que la clasificacion real de
// TVs vive en SmartControl/BinManager -- sistema externo, solo lectura desde este repo): este
// endpoint SOLO guarda/lista el registro de demora. No existe ni se intenta un bloqueo tecnico de
// "no dejar clasificar la siguiente TV" -- eso queda como politica de proceso del supervisor, no
// como gate de sistema.
import { and, desc, eq, gte, lt } from 'drizzle-orm'
import { requireAuth } from '../../server-lib/auth.js'
import { db, downtimeReason, downtimeRecord, user } from '../../server-lib/db/client.js'
import { canUserAccessModule } from '../../server-lib/permissionService.js'
import { parseDateOnly } from '../../server-lib/personnel.js'
import {
  FFT_DOWNTIME_REASON_KEYS,
  SORTING_DOWNTIME_REASON_KEYS,
} from '../../src/data/demoras/catalog.js'

// 2026-09-10 (a peticion explicita del usuario, "son dos areas independientes"): duplicado a
// proposito en vez de importar isSortingAreaId de src/data/production/personnelByArea.js -- ese
// archivo importa (transitivamente) production/areaGroup.js, que lee localStorage al cargar el
// modulo; eso no existe en un entorno serverless y tumbaria esta ruta. Mismo criterio ya usado en
// otros lados de este repo: cada endpoint es autosuficiente, sin compartir helpers cliente/server.
function isSortingAreaId(areaId) {
  return typeof areaId === 'string' && areaId.startsWith('SORT_')
}

// reasonKey valido = una de las causas estaticas del area real (FFT o Sorting segun el prefijo
// SORT_ del areaId, catalog.js) O una causa dinamica ACTIVA del mismo grupo, agregada despues por
// un ADMINISTRADOR (ver api/demoras/reasons/*.js, 2026-09-08; areaGroup por causa, 2026-09-10).
async function isValidReasonKey(reasonKey, areaId) {
  const areaGroup = isSortingAreaId(areaId) ? 'SORTING' : 'FFT'
  const staticKeys =
    areaGroup === 'SORTING' ? SORTING_DOWNTIME_REASON_KEYS : FFT_DOWNTIME_REASON_KEYS
  if (staticKeys.has(reasonKey)) return true
  const [row] = await db
    .select({ id: downtimeReason.id })
    .from(downtimeReason)
    .where(
      and(
        eq(downtimeReason.code, reasonKey),
        eq(downtimeReason.active, true),
        eq(downtimeReason.areaGroup, areaGroup),
      ),
    )
    .limit(1)
  return Boolean(row)
}

// dateFrom/dateTo (2026-09-09, a peticion explicita del usuario -- "filtro por fechas" en el
// historial): mismo parseDateOnly (YYYY-MM-DD -> medianoche UTC) que ya usa personnel.js. dateTo
// se compara con `lt` contra el dia SIGUIENTE a medianoche -- asi incluye TODO ese dia sin
// depender de las horas/minutos/milisegundos exactos que traiga cada createdAt real.
async function handleGet(req, res) {
  const { areaId, reasonKey, dateFrom, dateTo } = req.query || {}
  const conditions = []
  if (areaId) conditions.push(eq(downtimeRecord.areaId, areaId))
  if (reasonKey) conditions.push(eq(downtimeRecord.reasonKey, reasonKey))
  if (dateFrom) {
    const from = parseDateOnly(dateFrom)
    if (!from) return res.status(400).json({ error: 'dateFrom invalido, usa YYYY-MM-DD.' })
    conditions.push(gte(downtimeRecord.createdAt, from))
  }
  if (dateTo) {
    const to = parseDateOnly(dateTo)
    if (!to) return res.status(400).json({ error: 'dateTo invalido, usa YYYY-MM-DD.' })
    conditions.push(lt(downtimeRecord.createdAt, new Date(to.getTime() + 24 * 60 * 60 * 1000)))
  }
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
    // 2026-09-09: subido de 500 a 20000 -- el historial ahora se usa tambien para exportar a
    // Excel un rango de fechas completo (posiblemente meses), y 500 registros truncaba un
    // reporte real sin avisar. 20000 sigue siendo un techo de seguridad, no un limite que un
    // uso real de esta pantalla vaya a alcanzar.
    .limit(20000)
  return res.status(200).json({ records: rows })
}

async function handlePost(req, res) {
  const { areaId, stationName, reasonKey, durationMinutes, shift, notes } = req.body || {}
  if (!areaId || typeof areaId !== 'string') {
    return res.status(400).json({ error: 'Falta areaId.' })
  }
  if (!reasonKey || !(await isValidReasonKey(reasonKey, areaId))) {
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
