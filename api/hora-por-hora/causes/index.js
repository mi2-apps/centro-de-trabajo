// Catalogo de causas de perdida de Hora por Hora, POR AREA (2026-09-04 v2, a peticion explicita
// del usuario -- "cada area tiene sus paros, no todas las areas son iguales... yo pongo el
// catalogo de cada area"). GET lo consume tanto el selector de captura (solo activas de esa
// area) como la pantalla de administracion (todas, via ?includeInactive=1). POST (crear causa
// nueva en un area) es exclusivo de ADMINISTRADOR -- mismo criterio que otras pantallas de
// configuracion administrativa de este proyecto.
import { and, eq } from 'drizzle-orm'
import { requireAuth } from '../../../server-lib/auth.js'
import { db, hourlyProductionDowntimeCause } from '../../../server-lib/db/client.js'
import { canUserAccessModule } from '../../../server-lib/permissionService.js'

const AREA_GROUP_KEYS = new Set(['LINEAS', 'INSUMOS', 'ACCESORIOS', 'MIDEA', 'PALETIZADO'])

function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function handleGet(req, res) {
  const { areaGroupKey } = req.query || {}
  if (!areaGroupKey || !AREA_GROUP_KEYS.has(areaGroupKey)) {
    return res.status(400).json({ error: 'areaGroupKey invalido.' })
  }
  const includeInactive = req.query?.includeInactive === '1'
  const conditions = [eq(hourlyProductionDowntimeCause.areaGroupKey, areaGroupKey)]
  if (!includeInactive) conditions.push(eq(hourlyProductionDowntimeCause.active, true))
  const rows = await db
    .select()
    .from(hourlyProductionDowntimeCause)
    .where(and(...conditions))
    .orderBy(hourlyProductionDowntimeCause.sortOrder)
  return res.status(200).json({ causes: rows })
}

async function handlePost(req, res) {
  if (req.user.role !== 'ADMINISTRADOR') {
    return res.status(403).json({ error: 'Solo un administrador puede crear causas.' })
  }
  const { areaGroupKey, name } = req.body || {}
  if (!areaGroupKey || !AREA_GROUP_KEYS.has(areaGroupKey)) {
    return res.status(400).json({ error: 'areaGroupKey invalido.' })
  }
  const trimmedName = name?.trim()
  if (!trimmedName) return res.status(400).json({ error: 'Falta el nombre de la causa.' })

  const baseCode = slugify(trimmedName) || 'causa'
  const existing = await db
    .select({
      code: hourlyProductionDowntimeCause.code,
      sortOrder: hourlyProductionDowntimeCause.sortOrder,
    })
    .from(hourlyProductionDowntimeCause)
    .where(eq(hourlyProductionDowntimeCause.areaGroupKey, areaGroupKey))
  const existingCodes = new Set(existing.map((r) => r.code))
  let code = baseCode
  let n = 2
  while (existingCodes.has(code)) {
    code = `${baseCode}-${n}`
    n += 1
  }
  const nextOrder = existing.length > 0 ? Math.max(...existing.map((r) => r.sortOrder)) + 10 : 10

  const [created] = await db
    .insert(hourlyProductionDowntimeCause)
    .values({ areaGroupKey, name: trimmedName, code, sortOrder: nextOrder })
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
