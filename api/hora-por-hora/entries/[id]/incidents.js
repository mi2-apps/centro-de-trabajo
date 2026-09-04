// Registrar una incidencia/perdida dentro de una hora (2026-09-04, a peticion explicita del
// usuario -- "0 incidencias, 1 incidencia, multiples incidencias... no mezclar minutos con
// piezas en un mismo total sin indicar la unidad"). causeId debe existir y estar activa (una
// causa desactivada ya no se puede USAR en incidencias nuevas, pero su historico se conserva
// intacto -- mismo criterio de Skill/Workstation: active=false nunca borra el pasado).
import { eq } from 'drizzle-orm'
import { requireAuth } from '../../../../server-lib/auth.js'
import {
  db,
  hourlyProductionDowntimeCause,
  hourlyProductionEntry,
  hourlyProductionIncident,
  hourlyProductionSession,
} from '../../../../server-lib/db/client.js'
import { loadSessionDetail } from '../../../../server-lib/hourlyProduction.js'
import { canUserAccessModule } from '../../../../server-lib/permissionService.js'

const ADMIN_ROLES = new Set(['ADMINISTRADOR', 'SUPERVISOR'])
const VALID_MEASUREMENT_TYPES = new Set(['MINUTES', 'PIECES'])

export default requireAuth(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const allowed = await canUserAccessModule({
    userId: req.user.id,
    role: req.user.role,
    moduleKey: '/hora-por-hora',
  })
  if (!allowed) return res.status(403).json({ error: 'No autorizado para este modulo' })

  const entryId = req.query.id ?? req.params?.id
  const { causeId, measurementType, value, customDescription, notes } = req.body || {}

  const [entry] = await db
    .select({ id: hourlyProductionEntry.id, sessionId: hourlyProductionEntry.sessionId })
    .from(hourlyProductionEntry)
    .where(eq(hourlyProductionEntry.id, entryId))
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

  if (!VALID_MEASUREMENT_TYPES.has(measurementType)) {
    return res.status(400).json({ error: 'Tipo de afectacion invalido.' })
  }
  const numValue = Number(value)
  if (!Number.isFinite(numValue) || numValue <= 0 || !Number.isInteger(numValue)) {
    return res.status(400).json({ error: 'El valor debe ser un entero mayor a 0.' })
  }

  const [cause] = await db
    .select()
    .from(hourlyProductionDowntimeCause)
    .where(eq(hourlyProductionDowntimeCause.id, causeId))
    .limit(1)
  if (!cause) return res.status(400).json({ error: 'Causa invalida.' })
  if (!cause.active) {
    return res.status(400).json({ error: 'Esta causa esta desactivada, selecciona otra.' })
  }
  if (cause.code === 'otra' && !customDescription?.trim()) {
    return res.status(400).json({ error: 'Escribe una descripcion para "Otra".' })
  }

  await db.insert(hourlyProductionIncident).values({
    entryId,
    causeId,
    measurementType,
    value: numValue,
    customDescription: cause.code === 'otra' ? customDescription.trim() : null,
    notes: notes?.trim() || null,
    createdByUserId: req.user.id,
  })

  return res.status(201).json(await loadSessionDetail(entry.sessionId))
})
