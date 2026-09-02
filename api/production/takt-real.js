// Piezas REALES producidas hoy por linea (2026-09-02, a peticion explicita del usuario: "puedes
// poner las piezas que se estan produciendo por linea, ubica las personas y es lo que lleva la
// linea"). Complementa -- NUNCA reemplaza -- el Takt Time TEORICO que ya existe (meta fija /
// duracion de turno, ver src/data/production/catalog.js getTaktTime): este endpoint da el numero
// REAL, cruzando dos sistemas que no comparten identificador:
//
//   1) BinManager/SmartControl: quien inspecciono cuantas piezas hoy (por username propio de
//      BinManager, ej "yesica.luna") -- ver server-lib/binmanager-sql.js.
//   2) Esta app: quien esta asignado HOY a cada linea real (DailyAssignment ACTIVE -> Workstation
//      -> WorkArea).
//
// El puente entre los dos es por NOMBRE (server-lib/binmanager-matching.js) -- nunca se asume un
// match, cada usuario de BinManager sale como 'OK' (unico candidato claro, se usa) o
// AMBIGUO/REVISAR/SIN_MATCH (se reporta en `review`, el usuario los confirma a mano). Piezas de
// alguien SIN match u OK-pero-sin-linea-asignada-hoy simplemente no se suman a ninguna linea --
// nunca se le atribuyen a la linea equivocada por adivinar.
import { eq } from 'drizzle-orm'
import {
  getProductionByUserToday,
  getUsersLoginByUsername,
  isBinManagerSqlConfigured,
} from '../../server-lib/binmanager-sql.js'
import { matchAllBinManagerUsers } from '../../server-lib/binmanager-matching.js'
import { requireAuth } from '../../server-lib/auth.js'
import { db, employee as employeeTable } from '../../server-lib/db/client.js'
import { todayDateOnly } from '../../server-lib/personnel.js'

// Mismo listado real que LINE_FAMILY_AREA_IDS en src/data/production/catalog.js (LINEA1..10 +
// PROYECTO) -- duplicado a proposito: api/ nunca importa de src/ (frontend) en este repo. Si esa
// lista cambia alla, actualizar aqui tambien.
const LINE_AREA_CODES = new Set([
  'LINEA1',
  'LINEA2',
  'LINEA3',
  'LINEA4',
  'LINEA5',
  'LINEA6',
  'LINEA7',
  'LINEA8',
  'LINEA9',
  'LINEA10',
  'PROYECTO',
])

export default requireAuth(async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (!isBinManagerSqlConfigured()) {
    return res.status(200).json({ configured: false, byLine: {}, review: [] })
  }

  const workCenterId = Number(req.query.workCenterId) || 49
  const today = todayDateOnly()

  let activeAssignments
  let activeEmployees
  let bmProduction
  try {
    ;[activeAssignments, activeEmployees, bmProduction] = await Promise.all([
      db.query.dailyAssignment.findMany({
        where: (da, { eq: eqFn }) => eqFn(da.status, 'ACTIVE'),
        with: { workstation: { with: { workArea: true } }, employee: true },
      }),
      db
        .select({ employeeNumber: employeeTable.employeeNumber, fullName: employeeTable.fullName })
        .from(employeeTable)
        .where(eq(employeeTable.active, true)),
      getProductionByUserToday({ workCenterId, dateFrom: today, dateTo: today }),
    ])
  } catch (err) {
    // Best-effort: si SmartControl no responde (mantenimiento, credenciales rotadas, red), la
    // pantalla de la linea debe seguir mostrando el Takt Time teorico sin romperse -- nunca un 500
    // que tumbe el resto de la vista por una integracion opcional.
    return res.status(200).json({ configured: true, error: err.message, byLine: {}, review: [] })
  }

  if (bmProduction.length === 0) {
    return res.status(200).json({ configured: true, byLine: {}, review: [] })
  }

  const usersLogin = await getUsersLoginByUsername(bmProduction.map((p) => p.username))
  const usersLoginByUsername = new Map(usersLogin.map((u) => [u.username, u]))

  const lineByEmployeeNumber = new Map()
  for (const a of activeAssignments) {
    const code = a.workstation?.workArea?.code
    if (code && LINE_AREA_CODES.has(code) && a.employee?.employeeNumber) {
      lineByEmployeeNumber.set(a.employee.employeeNumber, code)
    }
  }

  const byLine = {}
  const review = []

  for (const production of bmProduction) {
    const info = usersLoginByUsername.get(production.username)
    if (!info) {
      review.push({
        username: production.username,
        resolvedName: null,
        qty: production.qty,
        status: 'USERNAME_DESCONOCIDO',
        candidates: [],
      })
      continue
    }
    const [match] = matchAllBinManagerUsers([info], activeEmployees)
    if (match.status !== 'OK') {
      review.push({ ...match, qty: production.qty })
      continue
    }
    const employeeNumber = match.candidates[0].employeeNumber
    const lineId = lineByEmployeeNumber.get(employeeNumber)
    if (!lineId) continue // persona real identificada, pero hoy no esta en una linea -- no aplica aqui
    if (!byLine[lineId]) byLine[lineId] = { realPieces: 0, people: [] }
    byLine[lineId].realPieces += production.qty
    byLine[lineId].people.push({
      employeeNumber,
      fullName: match.candidates[0].fullName,
      qty: production.qty,
    })
  }

  return res.status(200).json({ configured: true, byLine, review })
})
