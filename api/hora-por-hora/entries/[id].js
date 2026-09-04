// Captura de produccion real de una hora especifica (y, mediante accion secundaria, override del
// estandar de ESA hora unicamente -- 2026-09-04, a peticion explicita del usuario: "si una hora
// requiere un estandar distinto, permitir editar unicamente esa hora... nunca modificar registros
// historicos cuando despues cambie el rate estandar"). gap/cumplimiento NUNCA se guardan ni se
// reciben del cliente -- son 100% derivados de standardQty/actualQty.
//
// Perdidas (2026-09-04 v2): el body manda `losses: { [causeId]: value }` -- cada causeId DEBE
// pertenecer al catalogo del AREA de esta sesion (nunca se confia en un causeId cruzado de otra
// area, aunque exista de verdad en la tabla). Cada par se guarda como upsert en
// HourlyProductionIncident (unique entryId+causeId) -- nunca se borra la fila al llegar a 0, un
// "0 explicito" es un estado valido (igual que las columnas fijas de la v1).
import { and, eq, inArray } from 'drizzle-orm'
import { requireAuth } from '../../../server-lib/auth.js'
import {
  db,
  hourlyProductionDowntimeCause,
  hourlyProductionEntry,
  hourlyProductionIncident,
  hourlyProductionSession,
} from '../../../server-lib/db/client.js'
import { loadSessionDetail } from '../../../server-lib/hourlyProduction.js'
import { canUserAccessModule } from '../../../server-lib/permissionService.js'
import { resolveHourByHourAreaGroupKey } from '../../../src/data/production/catalog.js'

const ADMIN_ROLES = new Set(['ADMINISTRADOR', 'SUPERVISOR'])

export default requireAuth(async (req, res) => {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })
  const allowed = await canUserAccessModule({
    userId: req.user.id,
    role: req.user.role,
    moduleKey: '/hora-por-hora',
  })
  if (!allowed) return res.status(403).json({ error: 'No autorizado para este modulo' })

  const id = req.query.id ?? req.params?.id
  const { actualQty, standardQty, observations, losses } = req.body || {}

  const [entry] = await db
    .select({ id: hourlyProductionEntry.id, sessionId: hourlyProductionEntry.sessionId })
    .from(hourlyProductionEntry)
    .where(eq(hourlyProductionEntry.id, id))
    .limit(1)
  if (!entry) return res.status(404).json({ error: 'Hora no encontrada.' })

  const [session] = await db
    .select({ status: hourlyProductionSession.status, areaId: hourlyProductionSession.areaId })
    .from(hourlyProductionSession)
    .where(eq(hourlyProductionSession.id, entry.sessionId))
    .limit(1)
  if (session.status === 'FINALIZADO' && !ADMIN_ROLES.has(req.user.role)) {
    return res.status(403).json({ error: 'Este turno ya esta finalizado -- solo lectura.' })
  }

  const values = { updatedByUserId: req.user.id, updatedAt: new Date() }

  if (actualQty !== undefined) {
    const qty = Number(actualQty)
    if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) {
      return res
        .status(400)
        .json({ error: 'Produccion real debe ser un entero mayor o igual a 0.' })
    }
    values.actualQty = qty
  }

  if (standardQty !== undefined) {
    const qty = Number(standardQty)
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
      return res.status(400).json({ error: 'El estandar debe ser un entero mayor a 0.' })
    }
    values.standardQty = qty
  }

  if (observations !== undefined) {
    values.observations = observations === '' ? null : String(observations).slice(0, 2000)
  }

  if (Object.keys(values).length > 2) {
    await db.update(hourlyProductionEntry).set(values).where(eq(hourlyProductionEntry.id, id))
  }

  if (losses && typeof losses === 'object') {
    const causeIds = Object.keys(losses)
    if (causeIds.length > 0) {
      const areaGroupKey = resolveHourByHourAreaGroupKey(session.areaId)
      const validCauses = await db
        .select({ id: hourlyProductionDowntimeCause.id })
        .from(hourlyProductionDowntimeCause)
        .where(
          and(
            eq(hourlyProductionDowntimeCause.areaGroupKey, areaGroupKey || '__none__'),
            inArray(hourlyProductionDowntimeCause.id, causeIds),
          ),
        )
      const validIds = new Set(validCauses.map((c) => c.id))
      for (const causeId of causeIds) {
        if (!validIds.has(causeId)) {
          return res.status(400).json({ error: `Causa invalida para esta area: ${causeId}` })
        }
        const value = Number(losses[causeId])
        if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
          return res
            .status(400)
            .json({ error: 'Las perdidas deben ser un entero mayor o igual a 0.' })
        }
      }
      for (const causeId of causeIds) {
        const value = Number(losses[causeId])
        await db
          .insert(hourlyProductionIncident)
          .values({ entryId: id, causeId, value, updatedByUserId: req.user.id })
          .onConflictDoUpdate({
            target: [hourlyProductionIncident.entryId, hourlyProductionIncident.causeId],
            set: { value, updatedByUserId: req.user.id, updatedAt: new Date() },
          })
      }
    }
  }

  return res.status(200).json(await loadSessionDetail(entry.sessionId))
})
