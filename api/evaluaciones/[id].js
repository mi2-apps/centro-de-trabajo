// Detalle de una auditoria 5S ya guardada -- cabecera (FiveSAudit) + respuestas por criterio
// (FiveSAuditAnswer), TAL CUAL se guardaron ese dia (2026-09-03, a peticion explicita del
// usuario: "al entrar a una auditoria anterior DEBE reconstruir EXACTAMENTE su radar con los
// datos guardados, NO recalcular usando configuraciones nuevas") -- nunca se vuelve a calcular
// nada aqui, solo se leen los puntajes/respuestas ya persistidos.
import { asc, eq } from 'drizzle-orm'
import { requireAuth } from '../../server-lib/auth.js'
import { db, fiveSAudit, fiveSAuditAnswer } from '../../server-lib/db/client.js'
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
  const [audit] = await db.select().from(fiveSAudit).where(eq(fiveSAudit.id, id)).limit(1)
  if (!audit) return res.status(404).json({ error: 'Auditoria no encontrada.' })

  const answers = await db
    .select()
    .from(fiveSAuditAnswer)
    .where(eq(fiveSAuditAnswer.auditId, id))
    .orderBy(asc(fiveSAuditAnswer.category), asc(fiveSAuditAnswer.criterionId))

  return res.status(200).json({ evaluation: audit, answers })
})
