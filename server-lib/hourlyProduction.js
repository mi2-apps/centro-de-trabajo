// Helper compartido del modulo Hora por Hora (2026-09-04, v2 -- catalogo de causas por area)
// -- carga el detalle completo de una sesion (cabecera + horas + catalogo de causas del area de
// la sesion + perdidas de cada hora ya fusionadas en entry.losses[causeId]) para no duplicar
// esta consulta en cada endpoint que necesita el detalle completo (sessions/index.js,
// sessions/[id].js, entries/[id].js).
import { asc, eq, inArray } from 'drizzle-orm'
import { resolveHourByHourAreaGroupKey } from '../src/data/production/catalog.js'
import {
  db,
  hourlyProductionDowntimeCause,
  hourlyProductionEntry,
  hourlyProductionIncident,
  hourlyProductionSession,
  user,
} from './db/client.js'

export async function loadSessionDetail(sessionId) {
  const [session] = await db
    .select({
      id: hourlyProductionSession.id,
      date: hourlyProductionSession.date,
      shift: hourlyProductionSession.shift,
      areaId: hourlyProductionSession.areaId,
      standardRate: hourlyProductionSession.standardRate,
      lossUnit: hourlyProductionSession.lossUnit,
      status: hourlyProductionSession.status,
      createdAt: hourlyProductionSession.createdAt,
      updatedAt: hourlyProductionSession.updatedAt,
      updatedByName: user.name,
    })
    .from(hourlyProductionSession)
    .leftJoin(user, eq(hourlyProductionSession.updatedByUserId, user.id))
    .where(eq(hourlyProductionSession.id, sessionId))
    .limit(1)
  if (!session) return null

  const areaGroupKey = resolveHourByHourAreaGroupKey(session.areaId)

  const entries = await db
    .select()
    .from(hourlyProductionEntry)
    .where(eq(hourlyProductionEntry.sessionId, sessionId))
    .orderBy(asc(hourlyProductionEntry.startTime))

  const causes = areaGroupKey
    ? await db
        .select()
        .from(hourlyProductionDowntimeCause)
        .where(eq(hourlyProductionDowntimeCause.areaGroupKey, areaGroupKey))
        .orderBy(asc(hourlyProductionDowntimeCause.sortOrder))
    : []

  const entryIds = entries.map((e) => e.id)
  const incidents = entryIds.length
    ? await db
        .select()
        .from(hourlyProductionIncident)
        .where(inArray(hourlyProductionIncident.entryId, entryIds))
    : []
  const lossesByEntry = new Map()
  for (const inc of incidents) {
    if (!lossesByEntry.has(inc.entryId)) lossesByEntry.set(inc.entryId, {})
    lossesByEntry.get(inc.entryId)[inc.causeId] = inc.value
  }

  return {
    session: { ...session, areaGroupKey },
    entries: entries.map((e) => ({ ...e, losses: lossesByEntry.get(e.id) || {} })),
    causes,
  }
}
