// Modulo Sorting (2026-09-04, a peticion explicita del usuario -- modulo NUEVO y separado de
// Hora por Hora, mismo formato de captura EXACTO). GET busca la sesion real de fecha+turno+area
// (nunca crea nada -- solo lectura); POST es un GET-OR-CREATE real: si ya existe una sesion para
// esa combinacion (indice unico date+shift+areaId), la devuelve tal cual (nunca sobreescribe su
// standardRate ya guardado); si no existe, la crea junto con TODAS sus horas
// (buildShiftBlocks + OFFICIAL_SHIFTS, ver src/data/shiftProduction/shiftBlocks.js), cada una con
// standardQty = snapshot del standardRate recibido (nunca se recalcula despues si cambia el
// rate).
import { and, desc, eq } from 'drizzle-orm'
import { requireAuth } from '../../../server-lib/auth.js'
import { db, sortingEntry, sortingSession } from '../../../server-lib/db/client.js'
import { canUserAccessModule } from '../../../server-lib/permissionService.js'
import { loadSortingSessionDetail } from '../../../server-lib/sorting.js'
import { OFFICIAL_SHIFTS } from '../../../src/data/production/catalog.js'
import { buildShiftBlocks } from '../../../src/data/shiftProduction/shiftBlocks.js'

const MODULE_KEY = '/sorting'
const SHIFT_IDS = new Set(OFFICIAL_SHIFTS.map((s) => s.id))
const LOSS_UNITS = new Set(['PIECES', 'MINUTES'])

function sessionWhere(sessionDate, shift, areaId) {
  return and(
    eq(sortingSession.date, sessionDate),
    eq(sortingSession.shift, shift),
    eq(sortingSession.areaId, areaId),
  )
}

async function handleGet(req, res) {
  const { date, shift, areaId } = req.query || {}
  if (!date || !shift || !areaId) {
    return res.status(400).json({ error: 'Faltan date, shift o areaId.' })
  }

  const [existing] = await db
    .select({ id: sortingSession.id })
    .from(sortingSession)
    .where(sessionWhere(new Date(`${date}T00:00:00`), shift, areaId))
    .limit(1)

  const [lastForArea] = await db
    .select({
      standardRate: sortingSession.standardRate,
      lossUnit: sortingSession.lossUnit,
    })
    .from(sortingSession)
    .where(eq(sortingSession.areaId, areaId))
    .orderBy(desc(sortingSession.createdAt))
    .limit(1)

  if (!existing) {
    return res.status(200).json({
      session: null,
      entries: [],
      lastStandardRate: lastForArea?.standardRate ?? null,
      lastLossUnit: lastForArea?.lossUnit ?? null,
    })
  }
  const detail = await loadSortingSessionDetail(existing.id)
  return res.status(200).json({
    ...detail,
    lastStandardRate: lastForArea?.standardRate ?? null,
    lastLossUnit: lastForArea?.lossUnit ?? null,
  })
}

async function handlePost(req, res) {
  const { date, shift, areaId, standardRate, lossUnit } = req.body || {}
  if (!date || !shift || !areaId) {
    return res.status(400).json({ error: 'Faltan date, shift o areaId.' })
  }
  if (!SHIFT_IDS.has(shift)) return res.status(400).json({ error: 'Turno invalido.' })
  const rate = Number(standardRate)
  if (!Number.isFinite(rate) || rate <= 0) {
    return res.status(400).json({ error: 'El rate estandar debe ser un numero mayor a 0.' })
  }
  const unit = lossUnit && LOSS_UNITS.has(lossUnit) ? lossUnit : 'PIECES'

  const sessionDate = new Date(`${date}T00:00:00`)
  const [existing] = await db
    .select({ id: sortingSession.id })
    .from(sortingSession)
    .where(sessionWhere(sessionDate, shift, areaId))
    .limit(1)
  if (existing) {
    return res.status(200).json(await loadSortingSessionDetail(existing.id))
  }

  const shiftConfig = OFFICIAL_SHIFTS.find((s) => s.id === shift)
  const blocks = buildShiftBlocks(sessionDate, shiftConfig)

  try {
    const [created] = await db
      .insert(sortingSession)
      .values({
        date: sessionDate,
        shift,
        areaId,
        standardRate: Math.round(rate),
        lossUnit: unit,
        createdByUserId: req.user.id,
      })
      .returning()

    await db.insert(sortingEntry).values(
      blocks.map((b) => ({
        sessionId: created.id,
        startTime: b.startTime,
        endTime: b.endTime,
        standardQty: Math.round(rate),
        createdByUserId: req.user.id,
      })),
    )

    return res.status(201).json(await loadSortingSessionDetail(created.id))
  } catch (err) {
    if (err?.code === '23505') {
      const [raceWinner] = await db
        .select({ id: sortingSession.id })
        .from(sortingSession)
        .where(sessionWhere(sessionDate, shift, areaId))
        .limit(1)
      if (raceWinner) return res.status(200).json(await loadSortingSessionDetail(raceWinner.id))
    }
    throw err
  }
}

export default requireAuth(async (req, res) => {
  const allowed = await canUserAccessModule({
    userId: req.user.id,
    role: req.user.role,
    moduleKey: MODULE_KEY,
  })
  if (!allowed) return res.status(403).json({ error: 'No autorizado para este modulo' })

  if (req.method === 'GET') return handleGet(req, res)
  if (req.method === 'POST') return handlePost(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
})
