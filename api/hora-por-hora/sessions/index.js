// Modulo Hora por Hora (2026-09-04, a peticion explicita del usuario -- convertir a digital el
// formato fisico de produccion "Hora por Hora"). GET busca la sesion real de fecha+turno+area
// (nunca crea nada -- solo lectura); POST es un GET-OR-CREATE real: si ya existe una sesion para
// esa combinacion (indice unico date+shift+areaId), la devuelve tal cual (nunca sobreescribe su
// standardRate ya guardado); si no existe, la crea junto con TODAS sus horas
// (buildShiftBlocks + OFFICIAL_SHIFTS, ver src/data/horaPorHora/shiftBlocks.js), cada una con
// standardQty = snapshot del standardRate recibido (nunca se recalcula despues si cambia el
// rate). Esto es lo que satisface "NO DUPLICAR REGISTROS" del usuario -- el indice unico real en
// DB es la garantia de fondo, esto solo maneja el conflicto de insertar dos veces sin generar un
// error feo al usuario.
import { and, desc, eq } from 'drizzle-orm'
import { requireAuth } from '../../../server-lib/auth.js'
import {
  db,
  hourlyProductionEntry,
  hourlyProductionSession,
} from '../../../server-lib/db/client.js'
import { loadSessionDetail } from '../../../server-lib/hourlyProduction.js'
import { canUserAccessModule } from '../../../server-lib/permissionService.js'
import { buildShiftBlocks } from '../../../src/data/horaPorHora/shiftBlocks.js'
import { OFFICIAL_SHIFTS } from '../../../src/data/production/catalog.js'

const MODULE_KEY = '/hora-por-hora'
const SHIFT_IDS = new Set(OFFICIAL_SHIFTS.map((s) => s.id))

function sessionWhere(sessionDate, shift, areaId) {
  return and(
    eq(hourlyProductionSession.date, sessionDate),
    eq(hourlyProductionSession.shift, shift),
    eq(hourlyProductionSession.areaId, areaId),
  )
}

async function handleGet(req, res) {
  const { date, shift, areaId } = req.query || {}
  if (!date || !shift || !areaId) {
    return res.status(400).json({ error: 'Faltan date, shift o areaId.' })
  }

  const [existing] = await db
    .select({ id: hourlyProductionSession.id })
    .from(hourlyProductionSession)
    .where(sessionWhere(new Date(`${date}T00:00:00`), shift, areaId))
    .limit(1)

  // Ultimo rate usado en esta area (cualquier turno/fecha) -- sugerencia para pre-llenar "Rate
  // estandar" en un area/turno nuevo, nunca un numero inventado (2026-09-04, a peticion explicita
  // del usuario -- "no quiero escribir 65 en cada hora manualmente").
  const [lastForArea] = await db
    .select({ standardRate: hourlyProductionSession.standardRate })
    .from(hourlyProductionSession)
    .where(eq(hourlyProductionSession.areaId, areaId))
    .orderBy(desc(hourlyProductionSession.createdAt))
    .limit(1)

  if (!existing) {
    return res
      .status(200)
      .json({ session: null, entries: [], lastStandardRate: lastForArea?.standardRate ?? null })
  }
  const detail = await loadSessionDetail(existing.id)
  return res.status(200).json({ ...detail, lastStandardRate: lastForArea?.standardRate ?? null })
}

async function handlePost(req, res) {
  const { date, shift, areaId, standardRate } = req.body || {}
  if (!date || !shift || !areaId) {
    return res.status(400).json({ error: 'Faltan date, shift o areaId.' })
  }
  if (!SHIFT_IDS.has(shift)) return res.status(400).json({ error: 'Turno invalido.' })
  const rate = Number(standardRate)
  if (!Number.isFinite(rate) || rate <= 0) {
    return res.status(400).json({ error: 'El rate estandar debe ser un numero mayor a 0.' })
  }

  const sessionDate = new Date(`${date}T00:00:00`)
  const [existing] = await db
    .select({ id: hourlyProductionSession.id })
    .from(hourlyProductionSession)
    .where(sessionWhere(sessionDate, shift, areaId))
    .limit(1)
  if (existing) {
    return res.status(200).json(await loadSessionDetail(existing.id))
  }

  const shiftConfig = OFFICIAL_SHIFTS.find((s) => s.id === shift)
  const blocks = buildShiftBlocks(sessionDate, shiftConfig)

  try {
    const [created] = await db
      .insert(hourlyProductionSession)
      .values({
        date: sessionDate,
        shift,
        areaId,
        standardRate: Math.round(rate),
        createdByUserId: req.user.id,
      })
      .returning()

    await db.insert(hourlyProductionEntry).values(
      blocks.map((b) => ({
        sessionId: created.id,
        startTime: b.startTime,
        endTime: b.endTime,
        standardQty: Math.round(rate),
        createdByUserId: req.user.id,
      })),
    )

    return res.status(201).json(await loadSessionDetail(created.id))
  } catch (err) {
    // Race real: dos personas abrieron el modulo a la vez y ambas mandaron POST -- el indice
    // unico (date+shift+areaId) gana, aqui solo se recupera la sesion real ya creada en vez de
    // mostrar un error de "conflicto" al segundo usuario.
    if (err?.code === '23505') {
      const [raceWinner] = await db
        .select({ id: hourlyProductionSession.id })
        .from(hourlyProductionSession)
        .where(sessionWhere(sessionDate, shift, areaId))
        .limit(1)
      if (raceWinner) return res.status(200).json(await loadSessionDetail(raceWinner.id))
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
