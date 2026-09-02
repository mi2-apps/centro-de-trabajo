// Modulo "Producción FFT" (2026-09-02, espejo dentro de esta app de la pagina externa FFT
// Dashboard Production de BinManager, https://binmanager.mitechnologiesinc.com/ReportsBinManager/
// PreSort/FFTDashboardProduction). SOLO LECTURA.
//
// Historia real de esta version (a peticion explicita del usuario, viendo el modulo original en
// vivo vs la pagina real: "nada que ver con el modulo que te pedi"): la version anterior solo tenia
// clasificacion/tendencia/usuarios -- se investigo la pagina real interceptando sus llamadas de red
// reales (GetTodaysProducedByWorkCenter, GetContainerMovementSummary, GetProductionByWeek,
// GetTagProductionDynamic) y se confirmo que TODAS las tarjetas de la izquierda (clasificacion,
// proveedor, categoria, usuarios, tamaño x clasificacion) salen de UN SOLO stored procedure
// (OE.sp_GetTodaysProducedByWorkCenter) al que esta cuenta de solo lectura (ro_smartcontrol) NO
// tiene permiso EXECUTE -- se comparo en vivo el total real (1,107 en el momento de la prueba)
// contra una replica manual del SELECT (1,323 en el mismo momento, sin poder explicar la
// diferencia ni descartando fan-out de JOIN) -- Roman respondio "haz con lo que puedas": esta
// version reconstruye por SELECT directo, tabla por tabla, cada tarjeta que SI se pudo verificar
// con una proporcion/valor razonable contra la pagina real:
//   - Clasificacion/tendencia/usuarios: igual que la version anterior (server-lib/binmanager-sql.js).
//   - Proveedor: LPN -> PO.PurchasePalletDetails -> PO.PurchasePallets -> PO.Purchases ->
//     PO.Suppliers -- verificado (mismas 2 proveedores reales, "Mit"=10 exacto).
//   - Categoria: LPN -> OE.WorkPlan.WorkOrderDetailID -> OE.WorkOrderDetails.CategoryID ->
//     DA.Categories -- verificado (100% "Televisions", igual que la pagina real).
//   - Tamaño x Clasificacion: LPN -> OE.WorkPlan.SKU -> MM.SKUData.ScreenSize -- verificado
//     (mismas pulgadas para las mismas SKU de muestra).
//   - Comparativa semanal: agregado en este archivo a partir de getDailyThroughput (14 dias),
//     agrupado por dia de la semana, semana actual vs semana anterior -- mismo concepto que la
//     pagina real, sin stored procedure propio.
//   - Piezas por Tag: LPN -> OE.WorkPlan.SKU -> BinManagerRO.PRO.SKUTags -> BinManagerRO.PRO.Tags
//     -- este era el ultimo pendiente de una investigacion mucho mas vieja (2026-08-20/24, ver
//     memoria de la sesion) que ya habia identificado la tabla real pero no tenia acceso SQL a
//     BinManagerRO para consultarla. 2026-09-02: se confirmo que la cuenta ro_smartcontrol SI
//     puede leer BinManagerRO via query cross-database -- verificado en vivo contra la pagina
//     real (BULKY salio EXACTO: 143=143, el resto de tags en el mismo orden de magnitud).
// NO incluido (no se encontro un puente confiable via SELECT, se prefirio omitir a adivinar):
//   - "Progreso de pallets" (PO.PurchasePallets existe pero el estado Recibido/En proceso/
//     Terminado de la pagina real no calzo con ninguna combinacion obvia de sus columnas bit).
//
// Pendiente sin resolver (documentado, no bloqueante): el total de "Piezas procesadas" de esta
// pagina sigue sin cerrar exacto contra la pagina real (revisado 2 veces, la primera dio ~1323
// vs 1107 real, la segunda con MAS acceso -- incluida la tabla real OE.ProductionRecords que
// resuelve el problema de Tags de arriba -- dio 1362 vs 1173 real, descartando que el problema
// sea la tabla usada). El total real probablemente aplica un filtro adicional del stored
// procedure original (OE.sp_GetTodaysProducedByWorkCenter) que no es visible sin permiso EXECUTE
// sobre el -- unica via que queda para cerrar esto al 100%.
import { eq } from 'drizzle-orm'
import { requireModuleAccess } from '../../server-lib/auth.js'
import { matchAllBinManagerUsers } from '../../server-lib/binmanager-matching.js'
import {
  getDailyThroughput,
  getProductionByCategoryToday,
  getProductionByClassificationToday,
  getProductionBySupplierToday,
  getProductionByUserToday,
  getSizeByClassificationToday,
  getTagBreakdownToday,
  getUsersLoginByUsername,
  isBinManagerSqlConfigured,
} from '../../server-lib/binmanager-sql.js'
import { db, employee as employeeTable } from '../../server-lib/db/client.js'
import { todayDateOnly } from '../../server-lib/personnel.js'

const THROUGHPUT_DAYS = 7
const WEEKLY_COMPARISON_DAYS = 14
const WEEKDAY_ORDER = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']

const EMPTY_RESPONSE = {
  configured: false,
  totalToday: 0,
  classifications: [],
  dailyThroughput: [],
  people: [],
  suppliers: [],
  categories: [],
  sizeByClassification: { sizes: [], rows: [] },
  weeklyComparison: { currentWeekTotal: 0, previousWeekTotal: 0, days: [] },
  tags: [],
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

export default requireModuleAccess(
  '/produccion-fft',
  async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    if (!isBinManagerSqlConfigured()) {
      return res.status(200).json(EMPTY_RESPONSE)
    }

    const workCenterId = Number(req.query.workCenterId) || 49
    const today = todayDateOnly()
    const throughputFrom = new Date(today)
    throughputFrom.setDate(throughputFrom.getDate() - (THROUGHPUT_DAYS - 1))
    const weeklyFrom = new Date(today)
    weeklyFrom.setDate(weeklyFrom.getDate() - (WEEKLY_COMPARISON_DAYS - 1))

    let classifications
    let dailyThroughput
    let weeklyDaily
    let bmProduction
    let activeEmployees
    let suppliers
    let categories
    let sizeRows
    let tags
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
      ] = await Promise.all([
        getProductionByClassificationToday({ workCenterId, dateFrom: today, dateTo: today }),
        getDailyThroughput({ workCenterId, dateFrom: throughputFrom, dateTo: today }),
        getDailyThroughput({ workCenterId, dateFrom: weeklyFrom, dateTo: today }),
        getProductionByUserToday({ workCenterId, dateFrom: today, dateTo: today }),
        db
          .select({ employeeNumber: employeeTable.employeeNumber, fullName: employeeTable.fullName })
          .from(employeeTable)
          .where(eq(employeeTable.active, true)),
        getProductionBySupplierToday({ workCenterId, dateFrom: today, dateTo: today }),
        getProductionByCategoryToday({ workCenterId, dateFrom: today, dateTo: today }),
        getSizeByClassificationToday({ workCenterId, dateFrom: today, dateTo: today }),
        getTagBreakdownToday({ workCenterId, dateFrom: today, dateTo: today }),
      ])
    } catch (err) {
      // Best-effort: si SmartControl no responde, el modulo debe seguir cargando (vacio) en vez de
      // un 500 crudo -- mismo criterio ya usado en takt-real.js.
      return res.status(200).json({ ...EMPTY_RESPONSE, configured: true, error: err.message })
    }

    const totalToday = classifications.reduce((sum, c) => sum + c.qty, 0)

    let people = []
    if (bmProduction.length > 0) {
      const usersLogin = await getUsersLoginByUsername(bmProduction.map((p) => p.username))
      const usersLoginByUsername = new Map(usersLogin.map((u) => [u.username, u]))
      people = bmProduction
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

    return res.status(200).json({
      configured: true,
      totalToday,
      classifications,
      dailyThroughput,
      people,
      suppliers,
      categories,
      sizeByClassification: buildSizeByClassification(sizeRows, classifications),
      weeklyComparison: buildWeeklyComparison(weeklyDaily),
      tags,
    })
  },
)
