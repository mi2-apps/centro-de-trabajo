// Catalogo de causas de perdida de Hora por Hora (2026-09-04, a peticion explicita del usuario --
// "implementa un CATALOGO DE CAUSAS... debe ser posible agregar en el futuro nuevas causas sin
// modificar toda la estructura de datos"). GET lo consume tanto el selector de captura (solo
// activas) como la pantalla de configuracion de administrador (todas, via ?includeInactive=1).
// POST (crear causa nueva) es exclusivo de ADMINISTRADOR -- mismo criterio que otras pantallas de
// configuracion administrativa de este proyecto (Developer Manual, roles fijos).
import { asc, eq } from 'drizzle-orm'
import { requireAuth } from '../../../server-lib/auth.js'
import { db, hourlyProductionDowntimeCause } from '../../../server-lib/db/client.js'
import { canUserAccessModule } from '../../../server-lib/permissionService.js'

function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function handleGet(req, res) {
  const includeInactive = req.query?.includeInactive === '1'
  const rows = await db
    .select()
    .from(hourlyProductionDowntimeCause)
    .where(includeInactive ? undefined : eq(hourlyProductionDowntimeCause.active, true))
    .orderBy(asc(hourlyProductionDowntimeCause.sortOrder))
  return res.status(200).json({ causes: rows })
}

async function handlePost(req, res) {
  if (req.user.role !== 'ADMINISTRADOR') {
    return res.status(403).json({ error: 'Solo un administrador puede crear causas.' })
  }
  const name = req.body?.name?.trim()
  if (!name) return res.status(400).json({ error: 'Falta el nombre de la causa.' })

  const baseCode = slugify(name) || 'causa'
  const rows = await db
    .select({
      code: hourlyProductionDowntimeCause.code,
      sortOrder: hourlyProductionDowntimeCause.sortOrder,
    })
    .from(hourlyProductionDowntimeCause)
  const existingCodes = new Set(rows.map((r) => r.code))
  let code = baseCode
  let n = 2
  while (existingCodes.has(code)) {
    code = `${baseCode}-${n}`
    n += 1
  }
  const nextOrder = rows.length > 0 ? Math.max(...rows.map((r) => r.sortOrder)) + 10 : 10

  const [created] = await db
    .insert(hourlyProductionDowntimeCause)
    .values({ name, code, sortOrder: nextOrder })
    .returning()

  return res.status(201).json({ cause: created })
}

export default requireAuth(async (req, res) => {
  const allowed = await canUserAccessModule({
    userId: req.user.id,
    role: req.user.role,
    moduleKey: '/hora-por-hora',
  })
  if (!allowed) return res.status(403).json({ error: 'No autorizado para este modulo' })

  if (req.method === 'GET') return handleGet(req, res)
  if (req.method === 'POST') return handlePost(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
})
