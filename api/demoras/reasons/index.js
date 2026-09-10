// Catalogo dinamico de causas de demora (2026-09-08, a peticion explicita del usuario -- "solo yo
// pueda agregar mas demoras" para no depender de un cambio de codigo cada vez). Mismo criterio
// exacto que api/hora-por-hora/causes/index.js: GET lo consume tanto el selector de captura (solo
// activas) como la pantalla de administracion (todas, via ?includeInactive=1); POST (crear causa
// nueva) es exclusivo de ADMINISTRADOR. Las causas estaticas originales
// (src/data/demoras/catalog.js) viven aparte, sin fila aqui -- esta tabla es solo el complemento
// que un admin agregue despues.
//
// `areaGroup` (2026-09-10, ver migracion 0016): FFT y Sorting tienen su propio catalogo, nunca
// compartido -- mismo criterio de areas independientes de toda la app. GET filtra por
// ?areaGroup=FFT|SORTING (el cliente sabe cual esta activo via useAreaGroup()); si no se manda,
// default 'FFT' por compatibilidad con quien llame a este endpoint sin el parametro nuevo. POST
// exige areaGroup explicito en el body -- una causa nueva siempre se crea para el area que el
// admin tenia activa al momento, nunca se asume.
import { and, asc, eq } from 'drizzle-orm'
import { requireAuth } from '../../../server-lib/auth.js'
import { db, downtimeReason } from '../../../server-lib/db/client.js'
import { canUserAccessModule } from '../../../server-lib/permissionService.js'
import {
  FFT_DOWNTIME_REASON_KEYS,
  SORTING_DOWNTIME_REASON_KEYS,
} from '../../../src/data/demoras/catalog.js'

function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeAreaGroup(value) {
  return value === 'SORTING' ? 'SORTING' : 'FFT'
}

async function handleGet(req, res) {
  const areaGroup = normalizeAreaGroup(req.query?.areaGroup)
  const includeInactive = req.query?.includeInactive === '1'
  const conditions = [eq(downtimeReason.areaGroup, areaGroup)]
  if (!includeInactive) conditions.push(eq(downtimeReason.active, true))
  const rows = await db
    .select()
    .from(downtimeReason)
    .where(and(...conditions))
    .orderBy(asc(downtimeReason.sortOrder))
  return res.status(200).json({ reasons: rows })
}

async function handlePost(req, res) {
  if (req.user.role !== 'ADMINISTRADOR') {
    return res.status(403).json({ error: 'Solo un administrador puede agregar causas de demora.' })
  }
  const trimmedName = req.body?.name?.trim()
  if (!trimmedName) return res.status(400).json({ error: 'Falta el nombre de la causa.' })
  const areaGroup = normalizeAreaGroup(req.body?.areaGroup)

  const baseCode = slugify(trimmedName) || 'causa'
  const existing = await db
    .select({ code: downtimeReason.code, sortOrder: downtimeReason.sortOrder })
    .from(downtimeReason)
    .where(eq(downtimeReason.areaGroup, areaGroup))
  const existingCodes = new Set(existing.map((r) => r.code))
  const staticKeys =
    areaGroup === 'SORTING' ? SORTING_DOWNTIME_REASON_KEYS : FFT_DOWNTIME_REASON_KEYS
  let code = baseCode
  let n = 2
  while (existingCodes.has(code) || staticKeys.has(code)) {
    code = `${baseCode}-${n}`
    n += 1
  }
  const nextOrder = existing.length > 0 ? Math.max(...existing.map((r) => r.sortOrder)) + 10 : 10

  const [created] = await db
    .insert(downtimeReason)
    .values({ name: trimmedName, code, areaGroup, sortOrder: nextOrder })
    .returning()

  return res.status(201).json({ reason: created })
}

export default requireAuth(async (req, res) => {
  const allowed = await canUserAccessModule({
    userId: req.user.id,
    role: req.user.role,
    moduleKey: '/demoras',
  })
  if (!allowed) return res.status(403).json({ error: 'No autorizado para este modulo' })

  if (req.method === 'GET') return handleGet(req, res)
  if (req.method === 'POST') return handlePost(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
})
