// Helper compartido del modulo Sorting (2026-09-04) -- carga el detalle completo de una sesion
// (cabecera + horas, cada hora ya con sus columnas fijas de perdida). Mismo shape exacto que
// server-lib/hourlyProduction.js (modulo Hora por Hora) -- mismo formato de captura, tablas
// separadas, a peticion explicita del usuario.
import { asc, eq } from 'drizzle-orm'
import { db, sortingEntry, sortingSession, user } from './db/client.js'

export async function loadSortingSessionDetail(sessionId) {
  const [session] = await db
    .select({
      id: sortingSession.id,
      date: sortingSession.date,
      shift: sortingSession.shift,
      areaId: sortingSession.areaId,
      standardRate: sortingSession.standardRate,
      lossUnit: sortingSession.lossUnit,
      status: sortingSession.status,
      createdAt: sortingSession.createdAt,
      updatedAt: sortingSession.updatedAt,
      updatedByName: user.name,
    })
    .from(sortingSession)
    .leftJoin(user, eq(sortingSession.updatedByUserId, user.id))
    .where(eq(sortingSession.id, sessionId))
    .limit(1)
  if (!session) return null

  const entries = await db
    .select()
    .from(sortingEntry)
    .where(eq(sortingEntry.sessionId, sessionId))
    .orderBy(asc(sortingEntry.startTime))

  return { session, entries }
}
