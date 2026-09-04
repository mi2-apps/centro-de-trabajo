// Quitar una incidencia registrada por error (2026-09-04). Mismo guard de turno finalizado que
// entries/[id].js e incidents.js -- edicion/eliminacion post-finalizacion requiere
// SUPERVISOR/ADMINISTRADOR.
import { eq } from 'drizzle-orm'
import { requireAuth } from '../../../server-lib/auth.js'
import {
  db,
  hourlyProductionEntry,
  hourlyProductionIncident,
  hourlyProductionSession,
} from '../../../server-lib/db/client.js'
import { loadSessionDetail } from '../../../server-lib/hourlyProduction.js'
import { canUserAccessModule } from '../../../server-lib/permissionService.js'

const ADMIN_ROLES = new Set(['ADMINISTRADOR', 'SUPERVISOR'])

export default requireAuth(async (req, res) => {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })
  const allowed = await canUserAccessModule({
    userId: req.user.id,
    role: req.user.role,
    moduleKey: '/hora-por-hora',
  })
  if (!allowed) return res.status(403).json({ error: 'No autorizado para este modulo' })

  const id = req.query.id ?? req.params?.id
  const [incident] = await db
    .select({ id: hourlyProductionIncident.id, entryId: hourlyProductionIncident.entryId })
    .from(hourlyProductionIncident)
    .where(eq(hourlyProductionIncident.id, id))
    .limit(1)
  if (!incident) return res.status(404).json({ error: 'Incidencia no encontrada.' })

  const [entry] = await db
    .select({ sessionId: hourlyProductionEntry.sessionId })
    .from(hourlyProductionEntry)
    .where(eq(hourlyProductionEntry.id, incident.entryId))
    .limit(1)
  const [session] = await db
    .select({ status: hourlyProductionSession.status })
    .from(hourlyProductionSession)
    .where(eq(hourlyProductionSession.id, entry.sessionId))
    .limit(1)
  if (session.status === 'FINALIZADO' && !ADMIN_ROLES.has(req.user.role)) {
    return res.status(403).json({ error: 'Este turno ya esta finalizado -- solo lectura.' })
  }

  await db.delete(hourlyProductionIncident).where(eq(hourlyProductionIncident.id, id))

  return res.status(200).json(await loadSessionDetail(entry.sessionId))
})
