// Modulo "Producción FFT" (2026-09-02, segunda parte del pedido de Takt Time real: "agrega otro
// modulo asi como dices con todo lo que tiene el link de la pagina" -- espejo, dentro de esta app,
// de la pagina externa FFT Dashboard Production de BinManager). SOLO LECTURA.
//
// Misma arquitectura y misma conexion que Takt Time real (server-lib/binmanager-sql.js): el MCP de
// BinManager solo esta disponible para una sesion interactiva de Claude, el servidor real de esta
// app no tiene forma de llamarlo, asi que esto usa SQL directo de solo lectura contra SmartControl
// (cuenta ro_smartcontrol) en vez de replicar el stored procedure real del dashboard externo
// (BM.sp_Report_FFT_Dashboard) -- ese SP vive en un schema (BM.*) al que esta cuenta no tiene
// acceso. Se probo replicar su consulta exacta contra las mismas tablas y el total NO cerro con el
// del dashboard externo (diferencia de ~15-18%, sin poder identificar el filtro exacto sin acceso
// EXECUTE al SP real) -- asi que en vez de eso se usa el MISMO join ya verificado y en produccion
// para Takt Time real (getProductionByUserToday), para que los numeros de este modulo sean
// SIEMPRE consistentes entre si y con los que ya ve Roman en Centro de Trabajo, aunque no sean
// identicos al dashboard externo de BinManager.
import {
  getDailyThroughput,
  getProductionByClassificationToday,
  getProductionByUserToday,
  getUsersLoginByUsername,
  isBinManagerSqlConfigured,
} from '../../server-lib/binmanager-sql.js'
import { matchAllBinManagerUsers } from '../../server-lib/binmanager-matching.js'
import { requireModuleAccess } from '../../server-lib/auth.js'
import { db, employee as employeeTable } from '../../server-lib/db/client.js'
import { eq } from 'drizzle-orm'
import { todayDateOnly } from '../../server-lib/personnel.js'

const THROUGHPUT_DAYS = 7

export default requireModuleAccess(
  '/produccion-fft',
  async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    if (!isBinManagerSqlConfigured()) {
      return res
        .status(200)
        .json({ configured: false, totalToday: 0, classifications: [], dailyThroughput: [], people: [] })
    }

    const workCenterId = Number(req.query.workCenterId) || 49
    const today = todayDateOnly()
    const throughputFrom = new Date(today)
    throughputFrom.setDate(throughputFrom.getDate() - (THROUGHPUT_DAYS - 1))

    let classifications
    let dailyThroughput
    let bmProduction
    let activeEmployees
    try {
      ;[classifications, dailyThroughput, bmProduction, activeEmployees] = await Promise.all([
        getProductionByClassificationToday({ workCenterId, dateFrom: today, dateTo: today }),
        getDailyThroughput({ workCenterId, dateFrom: throughputFrom, dateTo: today }),
        getProductionByUserToday({ workCenterId, dateFrom: today, dateTo: today }),
        db
          .select({ employeeNumber: employeeTable.employeeNumber, fullName: employeeTable.fullName })
          .from(employeeTable)
          .where(eq(employeeTable.active, true)),
      ])
    } catch (err) {
      // Best-effort, mismo criterio que takt-real.js: si SmartControl no responde, el modulo debe
      // seguir cargando (vacio) en vez de un 500 crudo.
      return res.status(200).json({
        configured: true,
        error: err.message,
        totalToday: 0,
        classifications: [],
        dailyThroughput: [],
        people: [],
      })
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

    return res.status(200).json({ configured: true, totalToday, classifications, dailyThroughput, people })
  },
)
