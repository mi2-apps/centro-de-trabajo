// Helper compartido del modulo Hora por Hora (2026-09-04) -- carga el detalle completo de una
// sesion (cabecera + horas, cada hora ya con sus columnas fijas de perdida) para no duplicar
// esta consulta en cada endpoint que necesita el detalle completo (sessions/index.js,
// sessions/[id].js).
import { asc, eq } from 'drizzle-orm'
import { db, hourlyProductionEntry, hourlyProductionSession, user } from './db/client.js'

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

  const entries = await db
    .select()
    .from(hourlyProductionEntry)
    .where(eq(hourlyProductionEntry.sessionId, sessionId))
    .orderBy(asc(hourlyProductionEntry.startTime))

  return { session, entries }
}
