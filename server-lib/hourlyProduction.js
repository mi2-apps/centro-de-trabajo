// Helper compartido del modulo Hora por Hora (2026-09-04) -- carga el detalle completo de una
// sesion (cabecera + horas + incidencias por hora, con el nombre real de la causa ya resuelto)
// para no duplicar esta consulta en cada endpoint que necesita el detalle completo
// (sessions/index.js, sessions/[id].js, sessions/[id]/finalize implicito via PATCH).
import { asc, eq } from 'drizzle-orm'
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

  const entries = await db
    .select()
    .from(hourlyProductionEntry)
    .where(eq(hourlyProductionEntry.sessionId, sessionId))
    .orderBy(asc(hourlyProductionEntry.startTime))

  const entryIds = entries.map((e) => e.id)
  let incidentsByEntryId = {}
  if (entryIds.length > 0) {
    const incidentRows = await db
      .select({
        id: hourlyProductionIncident.id,
        entryId: hourlyProductionIncident.entryId,
        causeId: hourlyProductionIncident.causeId,
        causeName: hourlyProductionDowntimeCause.name,
        causeCode: hourlyProductionDowntimeCause.code,
        measurementType: hourlyProductionIncident.measurementType,
        value: hourlyProductionIncident.value,
        customDescription: hourlyProductionIncident.customDescription,
        notes: hourlyProductionIncident.notes,
        createdAt: hourlyProductionIncident.createdAt,
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
      .where(eq(hourlyProductionEntry.sessionId, sessionId))
      .orderBy(asc(hourlyProductionIncident.createdAt))

    incidentsByEntryId = incidentRows.reduce((acc, row) => {
      if (!acc[row.entryId]) acc[row.entryId] = []
      acc[row.entryId].push(row)
      return acc
    }, {})
  }

  return {
    session,
    entries: entries.map((e) => ({ ...e, incidents: incidentsByEntryId[e.id] || [] })),
  }
}
