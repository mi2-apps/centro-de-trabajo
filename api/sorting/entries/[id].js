// Captura de produccion real de una hora especifica de Sorting. gap/cumplimiento NUNCA se
// guardan ni se reciben del cliente -- son 100% derivados de standardQty/actualQty, calculados
// donde se muestran.
import { eq } from 'drizzle-orm'
import { requireAuth } from '../../../server-lib/auth.js'
import { db, sortingEntry, sortingSession } from '../../../server-lib/db/client.js'
import { canUserAccessModule } from '../../../server-lib/permissionService.js'
import { loadSortingSessionDetail } from '../../../server-lib/sorting.js'
import { LOSS_COLUMN_KEYS } from '../../../src/data/shiftProduction/lossColumns.js'

const ADMIN_ROLES = new Set(['ADMINISTRADOR', 'SUPERVISOR'])

export default requireAuth(async (req, res) => {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })
  const allowed = await canUserAccessModule({
    userId: req.user.id,
    role: req.user.role,
    moduleKey: '/sorting',
  })
  if (!allowed) return res.status(403).json({ error: 'No autorizado para este modulo' })

  const id = req.query.id ?? req.params?.id
  const { actualQty, standardQty, observations, ...lossFields } = req.body || {}

  const [entry] = await db
    .select({ id: sortingEntry.id, sessionId: sortingEntry.sessionId })
    .from(sortingEntry)
    .where(eq(sortingEntry.id, id))
    .limit(1)
  if (!entry) return res.status(404).json({ error: 'Hora no encontrada.' })

  const [session] = await db
    .select({ status: sortingSession.status })
    .from(sortingSession)
    .where(eq(sortingSession.id, entry.sessionId))
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

  for (const key of LOSS_COLUMN_KEYS) {
    if (lossFields[key] === undefined) continue
    const value = Number(lossFields[key])
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      return res.status(400).json({ error: 'Las perdidas deben ser un entero mayor o igual a 0.' })
    }
    values[key] = value
  }

  if (observations !== undefined) {
    values.observations = observations === '' ? null : String(observations).slice(0, 2000)
  }

  await db.update(sortingEntry).set(values).where(eq(sortingEntry.id, id))

  return res.status(200).json(await loadSortingSessionDetail(entry.sessionId))
})
