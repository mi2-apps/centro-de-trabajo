// Captura de produccion real de una hora especifica (y, mediante accion secundaria, override del
// estandar de ESA hora unicamente -- 2026-09-04, a peticion explicita del usuario: "si una hora
// requiere un estandar distinto, permitir editar unicamente esa hora... nunca modificar registros
// historicos cuando despues cambie el rate estandar"). gap/cumplimiento NUNCA se guardan ni se
// reciben del cliente -- son 100% derivados de standardQty/actualQty, calculados donde se
// muestran (mismo criterio que 5S/ProcessAudit: el servidor nunca confia en un total que mande
// el cliente, aqui simplemente no existe ese campo para mandar).
import { eq } from 'drizzle-orm'
import { requireAuth } from '../../../server-lib/auth.js'
import {
  db,
  hourlyProductionEntry,
  hourlyProductionSession,
} from '../../../server-lib/db/client.js'
import { loadSessionDetail } from '../../../server-lib/hourlyProduction.js'
import { canUserAccessModule } from '../../../server-lib/permissionService.js'

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
  const { actualQty, standardQty } = req.body || {}

  const [entry] = await db
    .select({ id: hourlyProductionEntry.id, sessionId: hourlyProductionEntry.sessionId })
    .from(hourlyProductionEntry)
    .where(eq(hourlyProductionEntry.id, id))
    .limit(1)
  if (!entry) return res.status(404).json({ error: 'Hora no encontrada.' })

  const [session] = await db
    .select({ status: hourlyProductionSession.status })
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

  await db.update(hourlyProductionEntry).set(values).where(eq(hourlyProductionEntry.id, id))

  return res.status(200).json(await loadSessionDetail(entry.sessionId))
})
