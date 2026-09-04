// Detalle de una Auditoria de Proceso ya guardada -- cabecera (ProcessAudit) + respuestas por
// criterio (ProcessAuditAnswer), TAL CUAL se guardaron ese dia -- nunca se vuelve a calcular nada
// aqui, mismo criterio que api/evaluaciones/[id].js.
import { asc, eq } from 'drizzle-orm'
import { requireAuth } from '../../server-lib/auth.js'
import { db, processAudit, processAuditAnswer } from '../../server-lib/db/client.js'
import { canUserAccessModule } from '../../server-lib/permissionService.js'

export default requireAuth(async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const allowed = await canUserAccessModule({
    userId: req.user.id,
    role: req.user.role,
    moduleKey: '/evaluaciones',
  })
  if (!allowed) return res.status(403).json({ error: 'No autorizado para este modulo' })

  const id = req.query.id ?? req.params?.id
  const [audit] = await db.select().from(processAudit).where(eq(processAudit.id, id)).limit(1)
  if (!audit) return res.status(404).json({ error: 'Auditoria no encontrada.' })

  const answers = await db
    .select()
    .from(processAuditAnswer)
    .where(eq(processAuditAnswer.auditId, id))
    .orderBy(asc(processAuditAnswer.category), asc(processAuditAnswer.criterionId))

  return res.status(200).json({ audit, answers })
})
