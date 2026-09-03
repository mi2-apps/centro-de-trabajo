// Modulo "Producción FFT" (2026-09-02, espejo dentro de esta app de la pagina externa FFT
// Dashboard Production de BinManager, https://binmanager.mitechnologiesinc.com/ReportsBinManager/
// PreSort/FFTDashboardProduction). SOLO LECTURA.
//
// 2026-09-02 (rediseño completo, a peticion explicita del usuario, sobre la implementacion real ya
// en produccion -- "PIEZAS Y FUNCIONALIDAD = implementacion real, DISEÑO = mockup adjunto"): este
// endpoint gana filtros reales (rango de fechas / clasificacion / pulgadas / work center) que antes
// no existian (todo estaba fijo a "hoy" y WorkCenterID=49), mas la comparacion contra el periodo
// anterior equivalente para los 3 KPI que la tienen (piezas/usuarios/tags), mas el catalogo real
// para los dropdowns de filtro y la lista de work centers reales. Nunca se inventa un periodo
// anterior si el rango no permite calcularlo (dateFrom invalido) -- en ese caso los campos de
// comparacion salen null y el frontend debe mostrar un estado neutral, nunca un numero inventado.
//
// Historia real de las tarjetas (ver server-lib/binmanager-sql.js para el detalle de cada JOIN
// verificado): Clasificacion/Usuarios/Tendencia desde el primer Takt Time real; Proveedor/
// Categoria/Tamaño/Comparativa semanal agregados cuando el modulo resulto "muy reducido" frente a
// la pagina real; Piezas por Tag cerrando un pendiente de una investigacion mucho mas vieja sobre
// tags BULKY/SORP/PRIOR.J; Progreso de pallets agregado en este rediseño.
//
// Pendiente sin resolver (documentado, no bloqueante, investigado 3 veces): el total de "Piezas
// procesadas" de este modulo no cierra exacto contra el total que muestra la pagina real de
// BinManager (se probo: join a WorkPlan con fan-out descartado, ProductionRecords real de
// BinManagerRO en vez de WorkPlanInspection, y dedup por SerialNumber en vez de LPN -- ninguno
// cierra la diferencia de ~15-20%). El stored procedure real (OE.sp_GetTodaysProducedByWorkCenter)
// sigue sin permiso EXECUTE para esta cuenta -- unica via que queda para cerrar esto al 100%.
import { eq } from 'drizzle-orm'
import { requireModuleAccess } from '../../server-lib/auth.js'
import { matchAllBinManagerUsers } from '../../server-lib/binmanager-matching.js'
import {
  getDailyThroughput,
  getFilterOptions,
  getPalletsProgress,
  getProductionByCategoryToday,
  getProductionByClassificationToday,
  getProductionBySupplierToday,
  getProductionByUserToday,
  getSizeByClassificationToday,
  getTagBreakdownToday,
  getUsersLoginByUsername,
  getWorkCenters,
  isBinManagerSqlConfigured,
} from '../../server-lib/binmanager-sql.js'
import { db, employee as employeeTable } from '../../server-lib/db/client.js'
import { todayDateOnly } from '../../server-lib/personnel.js'

const THROUGHPUT_DAYS = 7
const WEEKLY_COMPARISON_DAYS = 14
const WEEKDAY_ORDER = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']

const EMPTY_RESPONSE = {
  configured: false,
  updatedAt: null,
  filters: { workCenters: [], classifications: [], sizes: [] },
  totalToday: 0,
  totalComparison: null,
  classifications: [],
  dailyThroughput: [],
  people: [],
  peopleComparison: null,
  suppliers: [],
  categories: [],
  sizeByClassification: { sizes: [], rows: [] },
  weeklyComparison: { currentWeekTotal: 0, previousWeekTotal: 0, days: [] },
  tags: [],
  tagsSumToday: 0,
  tagsComparison: null,
  pallets: { items: [], completedCount: 0, totalCount: 0 },
}

function parseDateParam(value, fallback) {
  if (!value) return fallback
  const d = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? fallback : d
}

function toDateOnly(d) {
  return d.toISOString().slice(0, 10)
}

// Rango anterior EQUIVALENTE (mismo numero de dias, inmediatamente antes de dateFrom) -- para
// "vs periodo anterior" de los KPI. Nunca se inventa si el rango no es calculable.
function previousRange(dateFrom, dateTo) {
  const days = Math.round((dateTo - dateFrom) / 86400000) + 1
  if (!Number.isFinite(days) || days <= 0) return null
  const prevTo = new Date(dateFrom)
  prevTo.setUTCDate(prevTo.getUTCDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setUTCDate(prevFrom.getUTCDate() - (days - 1))
  return { dateFrom: prevFrom, dateTo: prevTo }
}

function pctChange(current, previous) {
  if (previous === null || previous === undefined) return null
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

function buildSizeByClassification(sizeRows, classifications) {
  const sizesSet = new Set()
  for (const r of sizeRows) sizesSet.add(r.size ?? 'N/A')
  const sizes = [...sizesSet].sort((a, b) => {
    if (a === 'N/A') return 1
    if (b === 'N/A') return -1
    return a - b
  })
  const nameByCode = new Map(classifications.map((c) => [c.code, c.name]))
  const rowsByCode = new Map()
  for (const r of sizeRows) {
    const key = r.code
    if (!rowsByCode.has(key)) {
      rowsByCode.set(key, { code: key, name: nameByCode.get(key) || key, bySize: {}, total: 0 })
    }
    const row = rowsByCode.get(key)
    const sizeKey = r.size ?? 'N/A'
    row.bySize[sizeKey] = (row.bySize[sizeKey] || 0) + r.qty
    row.total += r.qty
  }
  const rows = [...rowsByCode.values()].sort((a, b) => b.total - a.total)
  return { sizes, rows }
}

// Semana actual (Lunes de esta semana -> hoy) vs semana anterior (mismos dias de la semana pasada)
// -- mismo concepto que "COMPARATIVA SEMANAL" de la pagina real, calculado aqui a partir de los
// mismos datos diarios ya reales de getDailyThroughput (nunca un stored procedure propio nuevo).
function buildWeeklyComparison(dailyRows) {
  const byDate = new Map(dailyRows.map((r) => [r.date, r.qty]))
  const today = new Date()
  const todayDow = (today.getDay() + 6) % 7 // 0=Lunes..6=Domingo
  const monday = new Date(today)
  monday.setDate(monday.getDate() - todayDow)

  const days = []
  let currentWeekTotal = 0
  let previousWeekTotal = 0
  for (let i = 0; i <= todayDow; i++) {
    const current = new Date(monday)
    current.setDate(current.getDate() + i)
    const previous = new Date(current)
    previous.setDate(previous.getDate() - 7)
    const currentKey = current.toISOString().slice(0, 10)
    const previousKey = previous.toISOString().slice(0, 10)
    const currentQty = byDate.get(currentKey) || 0
    const previousQty = byDate.get(previousKey) || 0
    currentWeekTotal += currentQty
    previousWeekTotal += previousQty
    days.push({
      label: WEEKDAY_ORDER[i],
      currentQty,
      previousQty,
      pctChange: previousQty > 0 ? ((currentQty - previousQty) / previousQty) * 100 : null,
    })
  }
  return { currentWeekTotal, previousWeekTotal, days }
}

async function resolvePeople(bmProduction, activeEmployees) {
  if (bmProduction.length === 0) return []
  const usersLogin = await getUsersLoginByUsername(bmProduction.map((p) => p.username))
  const usersLoginByUsername = new Map(usersLogin.map((u) => [u.username, u]))
  return bmProduction
    .map((production) => {
      const info = usersLoginByUsername.get(production.username)
      if (!info) {
        return {
          username: production.username,
          resolvedName: null,
          qty: production.qty,
          matchStatus: 'USERNAME_DESCONOCIDO',
          employeeNumber: null,
          fullName: null,
        }
      }
      const [match] = matchAllBinManagerUsers([info], activeEmployees)
      return {
        username: production.username,
        resolvedName: match.resolvedName,
        qty: production.qty,
        matchStatus: match.status,
        employeeNumber: match.status === 'OK' ? match.candidates[0].employeeNumber : null,
        fullName: match.status === 'OK' ? match.candidates[0].fullName : null,
      }
    })
    .sort((a, b) => b.qty - a.qty)
}

export default requireModuleAccess(
  '/produccion-fft',
  async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    if (!isBinManagerSqlConfigured()) {
      return res.status(200).json(EMPTY_RESPONSE)
    }

    const workCenterId = Number(req.query.workCenterId) || 49
    const classificationCode = req.query.classificationCode || undefined
    const size = req.query.size || undefined
    const today = todayDateOnly()
    const dateFrom = parseDateParam(req.query.dateFrom, today)
    const dateTo = parseDateParam(req.query.dateTo, today)
    const filters = { workCenterId, classificationCode, size }

    const throughputFrom = new Date(dateTo)
    throughputFrom.setDate(throughputFrom.getDate() - (THROUGHPUT_DAYS - 1))
    const weeklyFrom = new Date(dateTo)
    weeklyFrom.setDate(weeklyFrom.getDate() - (WEEKLY_COMPARISON_DAYS - 1))
    const prevRange = previousRange(dateFrom, dateTo)

    let classifications
    let dailyThroughput
    let weeklyDaily
    let bmProduction
    let activeEmployees
    let suppliers
    let categories
    let sizeRows
    let tags
    let pallets
    let workCenters
    let filterOptions
    let prevClassifications
    let prevPeople
    let prevTags
    try {
      ;[
        classifications,
        dailyThroughput,
        weeklyDaily,
        bmProduction,
        activeEmployees,
        suppliers,
        categories,
        sizeRows,
        tags,
        pallets,
        workCenters,
        filterOptions,
        prevClassifications,
        prevPeople,
        prevTags,
      ] = await Promise.all([
        getProductionByClassificationToday({ ...filters, dateFrom, dateTo }),
        getDailyThroughput({ ...filters, dateFrom: throughputFrom, dateTo }),
        getDailyThroughput({ ...filters, dateFrom: weeklyFrom, dateTo }),
        getProductionByUserToday({ ...filters, dateFrom, dateTo }),
        db
          .select({ employeeNumber: employeeTable.employeeNumber, fullName: employeeTable.fullName })
          .from(employeeTable)
          .where(eq(employeeTable.active, true)),
        getProductionBySupplierToday({ ...filters, dateFrom, dateTo }),
        getProductionByCategoryToday({ ...filters, dateFrom, dateTo }),
        getSizeByClassificationToday({ ...filters, dateFrom, dateTo }),
        getTagBreakdownToday({ ...filters, dateFrom, dateTo }),
        getPalletsProgress({ workCenterId }),
        getWorkCenters(),
        getFilterOptions(),
        prevRange ? getProductionByClassificationToday({ ...filters, ...prevRange }) : Promise.resolve(null),
        prevRange ? getProductionByUserToday({ ...filters, ...prevRange }) : Promise.resolve(null),
        prevRange ? getTagBreakdownToday({ ...filters, ...prevRange }) : Promise.resolve(null),
      ])
    } catch (err) {
      // Best-effort: si SmartControl no responde, el modulo debe seguir cargando (vacio) en vez de
      // un 500 crudo -- mismo criterio ya usado desde el primer Takt Time real.
      return res.status(200).json({ ...EMPTY_RESPONSE, configured: true, error: err.message })
    }

    const totalToday = classifications.reduce((sum, c) => sum + c.qty, 0)
    const people = await resolvePeople(bmProduction, activeEmployees)

    const prevTotal = prevClassifications
      ? prevClassifications.reduce((sum, c) => sum + c.qty, 0)
      : null
    const prevPeopleCount = prevPeople ? new Set(prevPeople.map((p) => p.username)).size : null

    // Piezas por tag (2026-09-02, a peticion explicita del usuario -- "cambiale nombre y la
    // cantidad en tiempo real": el KPI de arriba debe mostrar la SUMA real de piezas con tag, no
    // la cantidad de tipos de tag). Un SKU puede tener varios tags, asi que esta suma excede el
    // total fisico de piezas a proposito -- mismo numero que ya se mostraba como "Total de
    // piezas/tag" en la card de abajo, ahora tambien reflejado en el KPI.
    const tagsSumToday = tags.reduce((sum, t) => sum + t.qty, 0)
    const prevTagsSum = prevTags ? prevTags.reduce((sum, t) => sum + t.qty, 0) : null

    // "Completado" de pallets (2026-09-02, redefinido tras confusion real del usuario -- el KPI
    // usaba IsClosedPallet, que en este work center nunca esta en 1 (0/25 siempre, sin importar el
    // avance real) -- se redefine como pallets con TODAS sus piezas ya procesadas
    // (PalletQuantityProcess >= PalletQuantityExpected), que si se mueve con el avance real que
    // muestra la lista de abajo.
    const completedCount = pallets.filter((p) => p.expected > 0 && p.processed >= p.expected).length

    return res.status(200).json({
      configured: true,
      updatedAt: new Date().toISOString(),
      filters: {
        workCenters,
        classifications: filterOptions.classifications,
        sizes: filterOptions.sizes,
        selected: { workCenterId, dateFrom: toDateOnly(dateFrom), dateTo: toDateOnly(dateTo), classificationCode: classificationCode || null, size: size || null },
      },
      totalToday,
      totalComparison: { previous: prevTotal, pctChange: pctChange(totalToday, prevTotal) },
      classifications,
      dailyThroughput,
      people,
      peopleComparison: { previous: prevPeopleCount, pctChange: pctChange(people.length, prevPeopleCount) },
      suppliers,
      categories,
      sizeByClassification: buildSizeByClassification(sizeRows, classifications),
      weeklyComparison: buildWeeklyComparison(weeklyDaily),
      tags,
      tagsSumToday,
      tagsComparison: { previous: prevTagsSum, pctChange: pctChange(tagsSumToday, prevTagsSum) },
      pallets: { items: pallets, completedCount, totalCount: pallets.length },
    })
  },
)
