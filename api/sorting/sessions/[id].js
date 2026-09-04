// Detalle de una sesion de Sorting (usado por el historico para el drill-down hora por hora de
// un turno pasado) + finalizar/reabrir el turno. Reabrir un turno finalizado
// (FINALIZADO -> ABIERTO) requiere SUPERVISOR/ADMINISTRADOR -- mismo criterio de "permisos
// administrativos" que edicion post-finalizacion (ver entries/[id].js).
import { eq } from 'drizzle-orm'
import { requireAuth } from '../../../server-lib/auth.js'
import { db, sortingSession } from '../../../server-lib/db/client.js'
import { canUserAccessModule } from '../../../server-lib/permissionService.js'
import { loadSortingSessionDetail } from '../../../server-lib/sorting.js'

const MODULE_KEY = '/sorting'
const ADMIN_ROLES = new Set(['ADMINISTRADOR', 'SUPERVISOR'])

async function handleGet(_req, res, id) {
  const detail = await loadSortingSessionDetail(id)
  if (!detail) return res.status(404).json({ error: 'Sesion no encontrada.' })
  return res.status(200).json(detail)
}

async function handlePatch(req, res, id) {
  const { status } = req.body || {}
  if (status !== 'ABIERTO' && status !== 'FINALIZADO') {
    return res.status(400).json({ error: 'Estado invalido.' })
  }

  const [current] = await db
    .select({ status: sortingSession.status })
    .from(sortingSession)
    .where(eq(sortingSession.id, id))
    .limit(1)
  if (!current) return res.status(404).json({ error: 'Sesion no encontrada.' })

  if (status === 'ABIERTO' && current.status === 'FINALIZADO' && !ADMIN_ROLES.has(req.user.role)) {
    return res
      .status(403)
      .json({ error: 'Solo un administrador o supervisor puede reabrir un turno finalizado.' })
  }

  await db
    .update(sortingSession)
    .set({ status, updatedByUserId: req.user.id, updatedAt: new Date() })
    .where(eq(sortingSession.id, id))

  return res.status(200).json(await loadSortingSessionDetail(id))
}

export default requireAuth(async (req, res) => {
  const allowed = await canUserAccessModule({
    userId: req.user.id,
    role: req.user.role,
    moduleKey: MODULE_KEY,
  })
  if (!allowed) return res.status(403).json({ error: 'No autorizado para este modulo' })

  const id = req.query.id ?? req.params?.id
  if (req.method === 'GET') return handleGet(req, res, id)
  if (req.method === 'PATCH') return handlePatch(req, res, id)
  return res.status(405).json({ error: 'Method not allowed' })
})
