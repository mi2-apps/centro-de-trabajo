import dayjs from 'dayjs'
import i18n from '../../i18n'
import {
  CURRENT_SHIFT,
  DEFAULT_LINE_ENTRY_TIME,
  operationalGroupMembers,
} from '../production/catalog'
import {
  startPersonnelSync,
  syncApproveMove,
  syncCheckIn,
  syncMove,
  syncRejectMove,
  syncRelease,
  syncRequestMove,
  syncRestoreBaseline,
  syncSetUnassignedReason,
  syncSuppressBaseline,
  syncSwapOrBump,
} from './apiSync'
import { EMPLOYEE_DIRECTORY, isEmployeeEligible } from './directory'
import { SEED_SKILLS } from './skills'
import {
  notify,
  readAbsentEmployeeIds,
  readAssignments,
  readAttendance,
  readBaselineSuppressed,
  readEmployeeStatusOverrides,
  readEmployees,
  readLateEmployeeIds,
  readMovements,
  readPendingMoves,
  readSkills,
  subscribe,
  writeAssignments,
  writeAttendance,
  writeBaselineSuppressed,
  writeEmployeeStatusOverrides,
  writeEmployees,
  writeMovements,
  writePendingMoves,
  writeSkills,
} from './store'
import { getWorkstation, getWorkstationsForLine } from './workstations'

/* ─────────────────────────────────────────────
   Modelo conceptual:

   Employee            -> SOLO la persona (id, employeeNumber, name, status, createdAt)
   DailyAssignment     -> UNA fila por (employeeId, date): su ubicacion vigente ese dia
   EmployeeMovement    -> historial append-only de entradas/movimientos (nunca se borra)

   Un empleado jamas tiene lineId/stationId fijos — eso vive
   unicamente en la asignacion del dia. Moverlo actualiza la
   fila de DailyAssignment de HOY y agrega una fila nueva en
   EmployeeMovement; nunca se sobreescribe ni se borra un
   movimiento anterior.
   ───────────────────────────────────────────── */

export const todayISO = () => dayjs().format('YYYY-MM-DD')
const nowTime = () => dayjs().format('HH:mm')
const nowISO = () => dayjs().toISOString()

let seq = 0
function makeId(prefix) {
  seq += 1
  return `${prefix}-${Date.now()}-${seq}`
}

/* subscribe()/notify() ahora viven en store.js (para que apiSync.js
   pueda notificar sin import circular); se re-exporta aqui porque
   toda la UI ya importa `subscribe` desde este archivo. El sondeo del
   backend real (dispositivos distintos, no solo pestañas) arranca una
   sola vez al cargar este modulo. */
export { subscribe }

startPersonnelSync()

/* ── Employee ── */

/* overrides (2026-09-02, "Personal sin asignar" con motivo): readEmployeeStatusOverrides()
   (store.js) trae, por id local, cualquier cambio REAL y VIVO hecho via
   /api/personnel/set-unassigned-reason -- BAJA (real, desactiva) o TURNO/FALTA (etiqueta,
   sigue activo). Se aplica ENCIMA del `status`/`eligible` que ya trae baked-in
   EMPLOYEE_DIRECTORY (directory.js, calculado una sola vez del snapshot ESTATICO
   realPersonnelSnapshot.js) -- asi una correccion real (marcar/quitar baja, poner un motivo)
   se refleja en todos los dispositivos sin necesitar un nuevo deploy de codigo cada vez, que
   es como funcionaba antes (ver el caso real de Jonhatan Alfredo Gomez Trujillo, corregido a
   mano el 2026-09-02 justo por esta limitacion). `eligible` se recalcula tambien: BAJA -> false
   (igual que ya hacia el snapshot estatico), cualquier otro override -> true (para que
   alguien recien reactivado/etiquetado sea buscable/asignable de inmediato, sin depender de
   `areaZona`, que puede seguir siendo null honestamente). */
export function getAllEmployees() {
  const dynamic = readEmployees()
  const knownNumbers = new Set(dynamic.map((e) => e.employeeNumber))
  // knownIds (2026-09-03, corrige bug real: alguien sin folio de EMPLOYEE_DIRECTORY -- "Jonathan"
  // en Calidad -- cuyo nombre real se completo despues via apiSync.js "promoviendolo" a fila
  // dinamica CON EL MISMO id que ya tenia en el snapshot estatico. Sin este chequeo por id, el
  // filtro de abajo (solo por employeeNumber) no reconocia que la fila estatica quedo obsoleta y
  // la dejaba pasar tambien -- 2 elementos distintos con el mismo id en la lista final.
  const knownIds = new Set(dynamic.map((e) => e.id))
  const base = [
    ...dynamic,
    ...EMPLOYEE_DIRECTORY.filter((e) => !knownIds.has(e.id) && !knownNumbers.has(e.employeeNumber)),
  ]
  const overrides = readEmployeeStatusOverrides()
  return base.map((e) => {
    const o = overrides[e.id]
    if (!o) return e
    return {
      ...e,
      status: o.active === false ? 'BAJA' : 'Activo',
      eligible: o.active !== false,
      unassignedReason: o.unassignedReason ?? null,
      unassignedReasonSetAt: o.unassignedReasonSetAt ?? null,
      // "Registrado por" en Bajas (2026-09-02, a peticion explicita del usuario) -- null para
      // cualquier baja historica del snapshot (nunca hubo un usuario real detras de esa alta),
      // real solo para quien se marco via el mecanismo en vivo -- ver roster.js/apiSync.js.
      registeredByName: o.registeredByName ?? null,
      registeredByRole: o.registeredByRole ?? null,
    }
  })
}

export function getEmployeeByNumber(employeeNumber) {
  const number = String(employeeNumber || '').trim()
  if (!number) return null
  const dynamic = readEmployees().find((e) => e.employeeNumber === number)
  if (dynamic) return dynamic
  return EMPLOYEE_DIRECTORY.find((e) => e.employeeNumber === number) || null
}

export function getEmployeeById(employeeId) {
  return getAllEmployees().find((e) => e.id === employeeId) || null
}

/* Unico selector centralizado de "personal que puede aparecer en
   busqueda/sugerencias/disponibles/registro" — todo lo demas
   (searchEmployees, getSuggestedCandidates, disponibles en el
   layout) filtra a traves de este, nunca con su propia regla ad
   hoc. getAllEmployees() sigue devolviendo TODOS (incluye bajas)
   porque el historial/auditoria/resolucion de asignaciones ya
   existentes debe seguir funcionando para cualquier persona,
   elegible o no. */
export function getAssignableEmployees() {
  return getAllEmployees().filter(isEmployeeEligible)
}

/* Personal marcado formalmente como BAJA (realPersonnelSnapshot.js,
   2026-08-24, a peticion explicita del usuario) -- lo opuesto de
   getAssignableEmployees(): nunca aparecen ahi, pero necesitan una
   pantalla propia de solo lectura (BajasTab.jsx) en vez de estar
   simplemente ausentes de todo. */
export function getBajaEmployees() {
  return getAllEmployees().filter((e) => e.status === 'BAJA')
}

/* Motivo real de "Personal sin asignar" (2026-09-02, a peticion explicita del usuario) --
   DELIBERADAMENTE async/esperado, no fire-and-forget como el resto de escrituras de este
   archivo (checkInEmployee/moveEmployee/etc. escriben local primero y sincronizan en segundo
   plano). Marcar BAJA desactiva de verdad a alguien -- justo el tipo de escritura donde el bug
   real del swap (2026-09-02) enseño que un optimismo silencioso puede mostrar un estado que el
   servidor nunca aplico. Aqui se espera la confirmacion real del servidor ANTES de tocar el
   store local; si falla, quien llama debe mostrar el error real (nunca queda un estado
   fantasma esperando 15s a que un poll lo corrija solo).
   reason: 'BAJA' | 'TURNO' | 'FALTA' | null (null limpia el motivo -- reactiva si la baja vino
   de este mismo mecanismo, ver set-unassigned-reason.js).
   Recibe la persona completa (no solo el id) -- 2026-09-02: syncSetUnassignedReason necesita
   employeeNumber/name como respaldo para el caso real de alguien que existe solo en el
   snapshot estatico y todavia no tiene fila activa en Employee (ver comentario ahi). */
export async function setEmployeeUnassignedReason(person, reason) {
  const employeeId = person.id
  const data = await syncSetUnassignedReason({
    employeeId,
    employeeNumber: person.employeeNumber,
    name: person.name,
    reason,
  })
  const overrides = readEmployeeStatusOverrides()
  overrides[employeeId] = {
    active: data.employee.active,
    unassignedReason: data.employee.unassignedReason,
    unassignedReasonSetAt: data.employee.unassignedReasonSetAt,
  }
  writeEmployeeStatusOverrides(overrides)
  notify()
  return { status: 'OK', employee: data.employee }
}

/* 'PROYECTO' (sin numero real todavia) y 'PENDIENTE' (placeholder de
   EMPLOYEE_DIRECTORY para quien BASE/SEM34 no le confirmo numero) son
   los dos unicos valores que MUCHAS personas distintas comparten a
   proposito — se identifican por nombre completo, no por numero. Para
   cualquier otro numero, dos empleados con el mismo valor serian el
   mismo empleado duplicado por error. */
const SHARED_PLACEHOLDER_NUMBERS = new Set(['PROYECTO', 'PENDIENTE'])

function isEmployeeNumberTaken(number, excludeEmployeeId = null) {
  if (SHARED_PLACEHOLDER_NUMBERS.has(number)) return false
  return getAllEmployees().some((e) => e.employeeNumber === number && e.id !== excludeEmployeeId)
}

export function createEmployee({ employeeNumber, name }) {
  const number = String(employeeNumber).trim()
  if (isEmployeeNumberTaken(number)) {
    throw new Error(i18n.t('repository:employeeNumberInUse', { number }))
  }
  const employees = readEmployees()
  const employee = {
    id: makeId('emp'),
    employeeNumber: number,
    name: name.trim(),
    status: 'Activo',
    createdAt: nowISO(),
  }
  employees.push(employee)
  writeEmployees(employees)
  notify()
  return employee
}

export function searchEmployees(query, limit = 20) {
  const q = String(query || '')
    .trim()
    .toLowerCase()
  if (!q) return []
  return getAssignableEmployees()
    .filter((e) => e.employeeNumber.includes(q) || e.name.toLowerCase().includes(q))
    .slice(0, limit)
}

/* ── Skills (EmployeeSkill) — de que esta capacitado, no de
   donde esta asignado hoy. ── */

export function getSkillsForEmployee(employeeId) {
  const dynamic = readSkills().filter((s) => s.employeeId === employeeId)
  const seenStations = new Set(dynamic.map((s) => s.stationName))
  const seeded = SEED_SKILLS.filter(
    (s) => s.employeeId === employeeId && !seenStations.has(s.stationName),
  )
  return [...dynamic, ...seeded].filter((s) => s.active !== false)
}

export function hasSkill(employeeId, stationName) {
  return getSkillsForEmployee(employeeId).some((s) => s.stationName === stationName)
}

export function addSkill({ employeeId, stationName, level = 'PUEDE_CUBRIR' }) {
  const skills = readSkills()
  const skill = {
    id: makeId('skl'),
    employeeId,
    stationName,
    level,
    active: true,
    createdAt: nowISO(),
  }
  skills.push(skill)
  writeSkills(skills)
  notify()
  return skill
}

/* ── Attendance (presencia) — separada de la asignacion de
   estacion. Un empleado puede estar presente hoy y todavia
   no tener puesto. ── */

export function getAttendanceForDate(date = todayISO()) {
  return readAttendance().filter((a) => a.date === date)
}

export function isPresentToday(employeeId, date = todayISO()) {
  return getAttendanceForDate(date).some((a) => a.employeeId === employeeId)
}

function ensureAttendance(employee, date, shift, checkedInAt = nowTime()) {
  const attendance = readAttendance()
  const existing = attendance.find((a) => a.employeeId === employee.id && a.date === date)
  if (existing) return existing
  const record = {
    id: makeId('att'),
    employeeId: employee.id,
    employeeNumber: employee.employeeNumber,
    date,
    shift,
    checkedInAt,
  }
  attendance.push(record)
  writeAttendance(attendance)
  return record
}

/**
 * Marca a un empleado presente HOY sin asignarle estacion
 * todavia (util para pase de lista rapido en la manana antes
 * de acomodar a cada quien). Idempotente: si ya esta
 * presente, no duplica.
 */
export function markPresentOnly({ employeeNumber, name, shift }) {
  const number = String(employeeNumber || '').trim()
  if (!number) return { status: 'ERROR', message: i18n.t('repository:enterEmployeeNumber') }

  let employee = getEmployeeByNumber(number)
  if (!employee) {
    if (!name || !name.trim()) return { status: 'NEEDS_NAME', employeeNumber: number }
    try {
      employee = createEmployee({ employeeNumber: number, name })
    } catch (e) {
      return { status: 'ERROR', message: e.message }
    }
  }

  const date = todayISO()
  const already = isPresentToday(employee.id, date)
  const attendance = ensureAttendance(employee, date, shift)
  notify()
  return { status: already ? 'ALREADY_PRESENT' : 'OK', employee, attendance }
}

/* ── Daily assignment (ubicacion vigente por dia) ── */

export function getCurrentAssignment(employeeId, date = todayISO()) {
  return readAssignments().find((a) => a.employeeId === employeeId && a.date === date) || null
}

export function getAssignmentsForDate(date = todayISO()) {
  return readAssignments().filter((a) => a.date === date)
}

export function getAssignmentsForArea(areaId, date = todayISO()) {
  return getAssignmentsForDate(date).filter((a) => a.areaId === areaId)
}

/* Ids de empleados con Attendance.status='AUSENTE' HOY (ver
   api/personnel/roster.js/absentEmployeeIds y apiSync.js/pollOnce) --
   hoy siempre vacio porque ningun flujo real escribe 'AUSENTE' todavia,
   pero es una consulta real, no un valor fijo (ver comentario del
   endpoint para el detalle). */
export function getAbsentEmployeeIds() {
  return readAbsentEmployeeIds()
}

/* Ids de empleados con Attendance.status='RETARDO' HOY (2026-09-03, "Estado general del dia" de
   Personal) -- mismo comentario que getAbsentEmployeeIds arriba, hoy siempre vacio. */
export function getLateEmployeeIds() {
  return readLateEmployeeIds()
}

export function getAssignmentHistory(employeeId) {
  return readAssignments()
    .filter((a) => a.employeeId === employeeId)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/* Roster de HOY, ya con el empleado resuelto — listo para
   tablas de "Personal de la linea" / "Personal de hoy". */
export function getTodayRoster(date = todayISO()) {
  const employeesById = new Map(getAllEmployees().map((e) => [e.id, e]))
  return getAssignmentsForDate(date)
    .map((a) => ({ ...a, employee: employeesById.get(a.employeeId) || null }))
    .sort((a, b) => (a.checkInAt > b.checkInAt ? -1 : 1))
}

export function getRosterForArea(areaId, date = todayISO()) {
  return getTodayRoster(date).filter((r) => r.areaId === areaId)
}

/* ── Contadores (personal REAL, no mock) ── */

export function getAreaCountsForDate(date = todayISO()) {
  const counts = {}
  getAssignmentsForDate(date).forEach((a) => {
    counts[a.areaId] = (counts[a.areaId] || 0) + 1
  })
  return counts
}

export function getAreaCountToday(areaId) {
  return getAreaCountsForDate()[areaId] || 0
}

/* Empleados unicos presentes hoy — union de asistencia (con o
   sin puesto) y asignaciones, para no perder a alguien que ya
   se registro presente pero todavia no tiene estacion. Un
   movimiento NUNCA cuenta como persona adicional (una sola
   fila de asignacion por empleado por dia, por construccion). */
export function getPersonnelPresentToday(date = todayISO()) {
  const ids = new Set()
  getAttendanceForDate(date).forEach((a) => ids.add(a.employeeId))
  getAssignmentsForDate(date).forEach((a) => ids.add(a.employeeId))
  return ids.size
}

export function getPersonnelCountForDate(date) {
  const ids = new Set()
  getAttendanceForDate(date).forEach((a) => ids.add(a.employeeId))
  getAssignmentsForDate(date).forEach((a) => ids.add(a.employeeId))
  return ids.size
}

/* Presentes hoy sin estacion asignada todavia — para la
   seccion "Personal sin asignacion hoy". */
export function getUnassignedPresentToday(date = todayISO()) {
  const assignedIds = new Set(getAssignmentsForDate(date).map((a) => a.employeeId))
  const employeesById = new Map(getAllEmployees().map((e) => [e.id, e]))
  return getAttendanceForDate(date)
    .filter((a) => !assignedIds.has(a.employeeId))
    .map((a) => ({ ...a, employee: employeesById.get(a.employeeId) || null }))
}

export function getLinesWithPersonnelToday() {
  return Object.keys(getAreaCountsForDate()).length
}

/* ── Capacidad / ocupacion por estacion (evita sobrecupo) ── */

export function getStationOccupancy(
  areaId,
  stationName,
  date = todayISO(),
  excludeEmployeeId = null,
) {
  const workstation = getWorkstation(areaId, stationName)
  const capacity = workstation ? workstation.capacity : 1
  const count = getAssignmentsForArea(areaId, date).filter(
    (a) => a.stationId === stationName && a.employeeId !== excludeEmployeeId,
  ).length
  return { count, capacity, isFull: count >= capacity }
}

export function getLineCapacitySummary(lineId, date = todayISO()) {
  const capacityTotal = getWorkstationsForLine(lineId).reduce((sum, w) => sum + w.capacity, 0)
  const occupied = getAssignmentsForArea(lineId, date).length
  return {
    capacityTotal,
    occupied,
    available: Math.max(0, capacityTotal - occupied),
    isFull: occupied >= capacityTotal,
  }
}

/* Estaciones de una linea ya combinadas con quien las ocupa
   hoy — listo para pintar la distribucion visual. */
export function getLineWorkstationsWithOccupancy(lineId, date = todayISO()) {
  const assignments = getAssignmentsForArea(lineId, date)
  const employeesById = new Map(getAllEmployees().map((e) => [e.id, e]))
  return getWorkstationsForLine(lineId)
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((w) => {
      const occupants = assignments
        .filter((a) => a.stationId === w.name)
        .map((a) => ({ ...a, employee: employeesById.get(a.employeeId) || null }))
      return {
        ...w,
        occupants,
        isFull: occupants.length >= w.capacity,
        isAvailable: occupants.length < w.capacity,
      }
    })
}

export function getLastAssignment(employeeId, excludeDate = todayISO()) {
  return (
    readAssignments()
      .filter((a) => a.employeeId === employeeId && a.date !== excludeDate)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0] || null
  )
}

/**
 * Candidatos compatibles con una estacion vacia, en orden
 * deterministico (sin IA): presente+sin asignacion primero,
 * presente+asignado en otra area despues, ausentes solo si se
 * piden explicitamente. Nunca inventa nombres: solo empleados
 * reales con la habilidad registrada.
 */
export function getSuggestedCandidates(
  lineId,
  stationName,
  { includeAbsent = false, limit = 20 } = {},
) {
  const date = todayISO()
  const presentIds = new Set()
  getAttendanceForDate(date).forEach((a) => presentIds.add(a.employeeId))
  getAssignmentsForDate(date).forEach((a) => presentIds.add(a.employeeId))
  const assignmentByEmployee = new Map(getAssignmentsForDate(date).map((a) => [a.employeeId, a]))

  const candidates = getAssignableEmployees()
    .filter((e) => hasSkill(e.id, stationName))
    .map((e) => {
      const present = presentIds.has(e.id)
      const assignment = assignmentByEmployee.get(e.id) || null
      const priority = present && !assignment ? 1 : present && assignment ? 2 : 3
      return { employee: e, present, assignment, priority }
    })
    .filter(
      (c) =>
        !(c.assignment && c.assignment.areaId === lineId && c.assignment.stationId === stationName),
    )
    .filter((c) => includeAbsent || c.priority <= 2)
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        a.employee.employeeNumber.localeCompare(b.employee.employeeNumber),
    )

  return candidates.slice(0, limit)
}

export function getAverageHeadcountForArea(areaId) {
  const assignments = readAssignments().filter((a) => a.areaId === areaId)
  if (!assignments.length) return 0
  const byDate = {}
  assignments.forEach((a) => {
    byDate[a.date] = (byDate[a.date] || 0) + 1
  })
  const days = Object.values(byDate)
  return Math.round((days.reduce((s, c) => s + c, 0) / days.length) * 10) / 10
}

/* ── Movements (historial append-only) ── */

export function getMovementsForEmployee(employeeId, date) {
  return readMovements()
    .filter((m) => m.employeeId === employeeId && (!date || m.date === date))
    .sort((a, b) => (a.movedAt < b.movedAt ? -1 : a.movedAt > b.movedAt ? 1 : 0))
}

export function getMovementsForDate(date = todayISO()) {
  return readMovements().filter((m) => m.date === date)
}

export function getMovesCountForDate(date = todayISO()) {
  return getMovementsForDate(date).filter((m) => m.type === 'MOVE').length
}

/* ── Acciones (unico lugar que escribe asignaciones/movimientos) ── */

/**
 * Registra a un empleado en un area/estacion HOY.
 * - Si el numero no existe: status NEEDS_NAME (crear con {employeeNumber, name} y reintentar).
 * - Si ya tiene una asignacion activa hoy: status CONFLICT (nunca se sobreescribe silenciosamente).
 * - Si todo esta bien: crea DailyAssignment + EmployeeMovement (type CHECK_IN) y devuelve OK.
 *
 * employeeId (opcional): cuando quien llama ya tiene resuelto un
 * empleado especifico (p. ej. de un resultado de busqueda), pasarlo
 * evita resolver por employeeNumber. Esto importa porque el
 * snapshot real de BASE trae decenas de personas con el mismo
 * employeeNumber literal 'PENDIENTE' (no tienen numero real
 * todavia) — buscar por numero en ese caso encontraria a la
 * PRIMERA persona con ese numero, no a la que el usuario eligio.
 */
export function checkInEmployee({ employeeId, employeeNumber, name, areaId, stationId, shift }) {
  const number = String(employeeNumber || '').trim()
  if (!employeeId && !number)
    return { status: 'ERROR', message: i18n.t('repository:enterEmployeeNumber') }
  if (!areaId) return { status: 'ERROR', message: i18n.t('repository:selectAreaLine') }
  if (!stationId) return { status: 'ERROR', message: i18n.t('repository:selectStation') }

  let employee = employeeId ? getEmployeeById(employeeId) : getEmployeeByNumber(number)
  // wasJustCreated: distingue "persona genuinamente nueva" (recien creada AQUI mismo) de
  // "persona ya conocida localmente" -- ver syncCheckIn mas abajo, es la bandera que evita
  // el bug real de duplicados (2026-08-27, ver apiSync.js).
  let wasJustCreated = false
  if (!employee) {
    if (employeeId) return { status: 'ERROR', message: i18n.t('repository:employeeNotFound') }
    if (!name || !name.trim()) {
      return { status: 'NEEDS_NAME', employeeNumber: number }
    }
    try {
      employee = createEmployee({ employeeNumber: number, name })
      wasJustCreated = true
    } catch (e) {
      return { status: 'ERROR', message: e.message }
    }
  }

  const date = todayISO()
  const assignments = readAssignments()
  const existing = assignments.find((a) => a.employeeId === employee.id && a.date === date)
  if (existing) {
    const attendance =
      readAttendance().find((a) => a.employeeId === employee.id && a.date === date) || null
    return { status: 'CONFLICT', employee, assignment: existing, attendance }
  }

  const occupancy = getStationOccupancy(areaId, stationId, date)
  if (occupancy.isFull) {
    return {
      status: 'STATION_FULL',
      message: i18n.t('repository:stationFull', {
        stationId,
        count: occupancy.count,
        capacity: occupancy.capacity,
      }),
      occupancy,
    }
  }

  const checkInAt = nowTime()
  const assignment = {
    id: makeId('asg'),
    employeeId: employee.id,
    employeeNumber: employee.employeeNumber,
    date,
    shift,
    areaId,
    stationId,
    checkInAt,
    status: 'PRESENTE',
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
  assignments.push(assignment)
  writeAssignments(assignments)
  ensureAttendance(employee, date, shift)
  unsuppressBaselinePlacement(employee.id)

  const movements = readMovements()
  movements.push({
    id: makeId('mov'),
    employeeId: employee.id,
    employeeNumber: employee.employeeNumber,
    date,
    fromAreaId: null,
    fromStationId: null,
    toAreaId: areaId,
    toStationId: stationId,
    movedAt: checkInAt,
    shift,
    movedBy: null,
    type: 'CHECK_IN',
  })
  writeMovements(movements)

  syncCheckIn({
    employeeId: employee.id,
    employeeNumber: employee.employeeNumber,
    name: employee.name,
    areaId,
    stationId,
    shift,
    isNewEmployee: wasJustCreated,
  })
  notify()
  return { status: 'OK', employee, assignment }
}

/**
 * Reconcilia las asignaciones REALES de una WC LINEA contra sus
 * estaciones reales -- 2026-08-27, a peticion explicita del usuario
 * ("reconcileLineAssignments"). Corrige DOS problemas distintos que
 * antes dejaban gente "flotando" sin estacion en la tabla:
 *
 * CASO A -- asignacion real de HOY en esta linea con `stationId`
 * invalido (nunca coincide con ninguna estacion real actual de la
 * linea) o duplicado (dos personas con el MISMO stationId valido --
 * nunca deberia pasar, pero se corrige si aparece). Causa real
 * encontrada en auditoria: asignaciones HISTORICAS (de antes del
 * rediseno de estaciones repetidas) con stationId de roles que ya NO
 * son validos para una linea (ej. "Empaque", "Calidad" -- existian en
 * el STATIONS generico viejo, nunca fueron parte de LINE_BASE_ROLES).
 * Se CORRIGE el stationId de la asignacion existente (nunca se crea
 * una duplicada) preservando su checkInAt/shift reales -- nunca se
 * inventa ni se sobrescribe una hora real ya guardada.
 *
 * CASO B -- gente que ya esta "efectivamente" en la linea (snapshot de
 * BASE o estado actual, via getPeopleByArea) pero todavia no tiene
 * NINGUNA asignacion real de hoy en ninguna area -- se le crea una
 * nueva asignacion (equivalente a un check-in), con `checkInAt`/`shift`
 * por defecto (07:00 Matutino) ya que no existe hora real que preservar.
 *
 * En ambos casos: orden determinístico (createdAt de la asignacion
 * existente para el caso A; el orden ya estable -- por nombre -- que
 * arma quien llama para el caso B), estaciones libres en el orden real
 * de la linea (Montaje/Montaje 2/Prueba electrica/... de
 * workstations.js), y NUNCA se inventa una estacion extra ni se toca a
 * alguien con una asignacion real ya valida. Si sobran personas y no
 * quedan estaciones libres (linea sobre plantilla), esas personas se
 * quedan sin tocar -- se reportan como excepcion por quien llama.
 * Empleados BAJA nunca se tocan (ni se corrigen ni se llenan).
 * Idempotente: correr esto de nuevo sobre un estado ya reconciliado no
 * cambia nada (0 fixedCount, 0 filledCount).
 *
 * CASO A tambien cubre migracion de grupo (2026-08-26, fusion Conveyor
 * Principal+Secundario en "WC Conveyor General"): `lineAssignmentsToday`
 * ahora se busca sobre TODOS los ids reales de operationalGroupMembers(areaId),
 * no solo el canonico -- necesario porque una asignacion real de ANTES de
 * fusionar un grupo (ej. alguien ya en CONVEYOR_SECUNDARIO cuando todavia
 * era area independiente) sigue teniendo `areaId` no-canonico; sin esto
 * quedaria invisible en el grid de estaciones del detalle fusionado
 * aunque siga contando en el total (getGroupAreaStaffing). Se corrige
 * tanto el `stationId` como el `areaId` (al canonico) en la misma pasada,
 * preservando checkInAt/shift reales. Para areas sin grupo el
 * comportamiento es identico al de antes (operationalGroupMembers
 * devuelve solo [areaId]).
 */
export function reconcileLineAssignments(
  areaId,
  snapshotEmployeeIds = [],
  { shift = CURRENT_SHIFT, checkInAt = DEFAULT_LINE_ENTRY_TIME } = {},
) {
  if (!areaId) return { fixedCount: 0, filledCount: 0 }

  const date = todayISO()
  const assignments = readAssignments()
  const movements = readMovements()
  const stationNamesForLine = new Set(getWorkstationsForLine(areaId).map((s) => s.name))
  const orderedStations = getWorkstationsForLine(areaId)
    .slice()
    .sort((a, b) => a.order - b.order)
  const groupMemberIds = new Set(operationalGroupMembers(areaId))
  const lineAssignmentsToday = assignments.filter(
    (a) => a.date === date && groupMemberIds.has(a.areaId),
  )

  // Quien conserva su estacion (valida y sin duplicar) vs quien necesita reasignacion (estacion
  // invalida, o duplicada -- solo la mas antigua por createdAt conserva el station valido).
  const stationClaimedBy = new Map()
  const needsReassignment = []
  lineAssignmentsToday
    .filter((a) => a.areaId === areaId && stationNamesForLine.has(a.stationId))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
    .forEach((a) => {
      if (stationClaimedBy.has(a.stationId)) needsReassignment.push(a)
      else stationClaimedBy.set(a.stationId, a)
    })
  lineAssignmentsToday
    .filter((a) => !(a.areaId === areaId && stationNamesForLine.has(a.stationId)))
    .forEach((a) => needsReassignment.push(a))
  needsReassignment.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))

  // 2026-08-27 ("estaciones configurables por ADMINISTRADOR" + puesto Team Leader por linea):
  // el puesto 'Team Leader' NUNCA debe salir de este auto-relleno (ni CASO A ni CASO B) -- este
  // mecanismo existe para gente que YA esta efectivamente en la linea/con un stationId invalido
  // heredado, nunca para decidir quien es lider. Sin esta exclusion, la primera persona sin
  // asignacion real que pasara por aqui quedaria en "Team Leader" solo por ser la primera
  // estacion libre en orden -- exactamente lo que la Decision D2 del plan prohibe ("nunca se
  // inventa ni se mueve automaticamente a nadie"). Team Leader solo se llena por una asignacion
  // deliberada (StationAssignDialog, drag&drop, o el drawer de configuracion de ADMINISTRADOR).
  const freeStations = orderedStations.filter(
    (s) => !stationClaimedBy.has(s.name) && s.role !== 'Team Leader',
  )
  let cursor = 0
  let fixedCount = 0
  let changed = false

  needsReassignment.forEach((existing) => {
    const employee = getEmployeeById(existing.employeeId)
    if (!employee || employee.status === 'BAJA') return // nunca se toca a una baja
    const station = freeStations[cursor]
    if (!station) return // no quedan estaciones libres -- se deja tal cual, se reporta como excepcion
    cursor += 1

    const idx = assignments.findIndex((a) => a.id === existing.id)
    assignments[idx] = { ...existing, areaId, stationId: station.name, updatedAt: nowISO() }
    movements.push({
      id: makeId('mov'),
      employeeId: existing.employeeId,
      employeeNumber: existing.employeeNumber,
      date,
      fromAreaId: existing.areaId,
      fromStationId: existing.stationId,
      toAreaId: areaId,
      toStationId: station.name,
      movedAt: existing.checkInAt,
      shift: existing.shift,
      movedBy: null,
      type: 'MOVE',
    })
    syncMove({
      employeeId: existing.employeeId,
      toAreaId: areaId,
      toStationId: station.name,
      shift: existing.shift,
    })
    fixedCount += 1
    changed = true
  })

  // Caso B -- gente efectivamente en la linea sin NINGUNA asignacion real hoy (en esta ni otra area).
  const alreadyAssignedTodayAnywhere = new Set(
    assignments.filter((a) => a.date === date).map((a) => a.employeeId),
  )
  let filledCount = 0

  snapshotEmployeeIds.forEach((employeeId) => {
    if (alreadyAssignedTodayAnywhere.has(employeeId)) return
    const station = freeStations[cursor]
    if (!station) return
    const employee = getEmployeeById(employeeId)
    if (!employee || employee.status === 'BAJA') return
    cursor += 1

    const assignment = {
      id: makeId('asg'),
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      date,
      shift,
      areaId,
      stationId: station.name,
      checkInAt,
      status: 'PRESENTE',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    }
    assignments.push(assignment)
    movements.push({
      id: makeId('mov'),
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      date,
      fromAreaId: null,
      fromStationId: null,
      toAreaId: areaId,
      toStationId: station.name,
      movedAt: checkInAt,
      shift,
      movedBy: null,
      type: 'CHECK_IN',
    })
    ensureAttendance(employee, date, shift, checkInAt)
    unsuppressBaselinePlacement(employee.id)
    syncCheckIn({
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      name: employee.name,
      areaId,
      stationId: station.name,
      shift,
    })
    filledCount += 1
    changed = true
  })

  if (changed) {
    writeAssignments(assignments)
    writeMovements(movements)
    notify()
  }
  return { fixedCount, filledCount }
}

/**
 * Mueve a un empleado YA asignado hoy a otra area/estacion.
 * Actualiza su DailyAssignment de hoy (una sola ubicacion
 * vigente a la vez) y agrega un EmployeeMovement (type MOVE)
 * sin tocar el movimiento anterior.
 */
export function moveEmployee({ employeeId, toAreaId, toStationId, shift }) {
  if (!toAreaId) return { status: 'ERROR', message: i18n.t('repository:selectDestinationAreaLine') }
  if (!toStationId)
    return { status: 'ERROR', message: i18n.t('repository:selectDestinationStation') }

  const date = todayISO()
  const assignments = readAssignments()
  const idx = assignments.findIndex((a) => a.employeeId === employeeId && a.date === date)
  if (idx === -1) {
    return { status: 'ERROR', message: i18n.t('repository:noActiveAssignmentToday') }
  }

  const current = assignments[idx]

  const occupancy = getStationOccupancy(toAreaId, toStationId, date, employeeId)
  if (occupancy.isFull) {
    return {
      status: 'STATION_FULL',
      message: i18n.t('repository:stationFull', {
        stationId: toStationId,
        count: occupancy.count,
        capacity: occupancy.capacity,
      }),
      occupancy,
    }
  }

  const movedAt = nowTime()

  const movements = readMovements()
  movements.push({
    id: makeId('mov'),
    employeeId,
    employeeNumber: current.employeeNumber,
    date,
    fromAreaId: current.areaId,
    fromStationId: current.stationId,
    toAreaId,
    toStationId,
    movedAt,
    shift: shift || current.shift,
    movedBy: null,
    type: 'MOVE',
  })
  writeMovements(movements)

  const updated = {
    ...current,
    areaId: toAreaId,
    stationId: toStationId,
    shift: shift || current.shift,
    updatedAt: nowISO(),
  }
  assignments[idx] = updated
  writeAssignments(assignments)
  unsuppressBaselinePlacement(employeeId)

  syncMove({ employeeId, toAreaId, toStationId, shift: updated.shift })
  notify()
  return { status: 'OK', assignment: updated, movedAt }
}

/**
 * Intercambia de puesto a dos empleados -- usado por el drop de
 * drag&drop cuando la estacion destino ya esta ocupada por OTRA
 * persona (2026-08-26, peticion explicita del usuario: "si deslizo a
 * tal persona al puesto de otra persona que se cambien y se guarden
 * de verdad").
 *
 * - Si `employeeIdA` YA tenia una asignacion real hoy (en cualquier
 *   area): intercambio real -- A toma el area/estacion de B y B toma
 *   la de A. Dos EmployeeMovement tipo MOVE, se actualizan las DOS
 *   filas de DailyAssignment existentes (nunca se duplica).
 * - Si `employeeIdA` NO tenia asignacion hoy (p. ej. viene de
 *   "Personal disponible"): no hay nada que darle a B a cambio, asi
 *   que B queda liberado (RELEASE, igual que releaseAssignment) y A
 *   ocupa su puesto (CHECK_IN). Nunca se bloquea silenciosamente.
 */
export function swapOrBumpStation({ employeeIdA, toAreaId, toStationId }) {
  const date = todayISO()
  const assignments = readAssignments()
  const idxB = assignments.findIndex(
    (a) => a.date === date && a.areaId === toAreaId && a.stationId === toStationId,
  )
  if (idxB === -1) return { status: 'ERROR', message: i18n.t('repository:stationNotOccupied') }
  const assignmentB = assignments[idxB]
  if (assignmentB.employeeId === employeeIdA)
    return { status: 'ERROR', message: i18n.t('repository:alreadyAtStation') }

  const movedAt = nowTime()
  const movements = readMovements()
  const idxA = assignments.findIndex((a) => a.employeeId === employeeIdA && a.date === date)

  if (idxA === -1) {
    const employeeA = getEmployeeById(employeeIdA)
    if (!employeeA) return { status: 'ERROR', message: i18n.t('repository:employeeNotFound') }

    movements.push({
      id: makeId('mov'),
      employeeId: assignmentB.employeeId,
      employeeNumber: assignmentB.employeeNumber,
      date,
      fromAreaId: assignmentB.areaId,
      fromStationId: assignmentB.stationId,
      toAreaId: null,
      toStationId: null,
      movedAt,
      shift: assignmentB.shift,
      movedBy: null,
      type: 'RELEASE',
    })
    const bumpedShift = assignmentB.shift
    assignments[idxB] = {
      ...assignmentB,
      employeeId: employeeA.id,
      employeeNumber: employeeA.employeeNumber,
      checkInAt: movedAt,
      updatedAt: nowISO(),
    }
    movements.push({
      id: makeId('mov'),
      employeeId: employeeA.id,
      employeeNumber: employeeA.employeeNumber,
      date,
      fromAreaId: null,
      fromStationId: null,
      toAreaId,
      toStationId,
      movedAt,
      shift: bumpedShift,
      movedBy: null,
      type: 'CHECK_IN',
    })
    writeAssignments(assignments)
    writeMovements(movements)
    ensureAttendance(employeeA, date, bumpedShift, movedAt)
    unsuppressBaselinePlacement(employeeA.id)
    // syncSwapOrBump (2026-09-02, corrige bug real -- ver comentario grande en apiSync.js):
    // NUNCA mandar esto como syncRelease + syncCheckIn separados -- son 2 requests HTTP
    // independientes sin orden garantizado, y placeEmployee (server-lib/personnel.js) puede
    // rechazar el checkin de A con STATION_FULL si su request le gana la carrera al release de
    // B. Un solo POST a /api/personnel/swap hace ambas cosas en una transaccion.
    syncSwapOrBump({
      employeeIdA: employeeA.id,
      employeeIdB: assignmentB.employeeId,
      toAreaId,
      toStationId,
      shift: bumpedShift,
    })
    notify()
    return { status: 'OK', bumpedEmployeeId: assignmentB.employeeId }
  }

  const assignmentA = assignments[idxA]
  const fromA = { areaId: assignmentA.areaId, stationId: assignmentA.stationId }
  assignments[idxA] = {
    ...assignmentA,
    areaId: assignmentB.areaId,
    stationId: assignmentB.stationId,
    updatedAt: nowISO(),
  }
  assignments[idxB] = {
    ...assignmentB,
    areaId: fromA.areaId,
    stationId: fromA.stationId,
    updatedAt: nowISO(),
  }
  movements.push({
    id: makeId('mov'),
    employeeId: assignmentA.employeeId,
    employeeNumber: assignmentA.employeeNumber,
    date,
    fromAreaId: fromA.areaId,
    fromStationId: fromA.stationId,
    toAreaId: assignmentB.areaId,
    toStationId: assignmentB.stationId,
    movedAt,
    shift: assignmentA.shift,
    movedBy: null,
    type: 'MOVE',
  })
  movements.push({
    id: makeId('mov'),
    employeeId: assignmentB.employeeId,
    employeeNumber: assignmentB.employeeNumber,
    date,
    fromAreaId: assignmentB.areaId,
    fromStationId: assignmentB.stationId,
    toAreaId: fromA.areaId,
    toStationId: fromA.stationId,
    movedAt,
    shift: assignmentB.shift,
    movedBy: null,
    type: 'MOVE',
  })
  writeAssignments(assignments)
  writeMovements(movements)
  unsuppressBaselinePlacement(assignmentA.employeeId)
  unsuppressBaselinePlacement(assignmentB.employeeId)
  // syncSwapOrBump (2026-09-02, corrige bug real -- ver comentario grande en apiSync.js): 2
  // syncMove independientes es EXACTAMENTE el bug reportado ("cambio posiciones y a los
  // segundos se revierten, en TODO EL LAYOUT") -- cada uno es su propia transaccion server-side
  // sin orden garantizado, asi que quien le gane la carrera al otro intenta entrar a una
  // estacion que el servidor todavia ve ocupada (STATION_FULL, silencioso). Un solo POST a
  // /api/personnel/swap hace el intercambio completo en una sola transaccion atomica.
  syncSwapOrBump({
    employeeIdA: assignmentA.employeeId,
    employeeIdB: assignmentB.employeeId,
    toAreaId: assignmentB.areaId,
    toStationId: assignmentB.stationId,
    shift: assignmentA.shift,
  })
  notify()
  return { status: 'OK', swappedEmployeeIds: [assignmentA.employeeId, assignmentB.employeeId] }
}

/**
 * Libera el puesto de un empleado sin quitarlo de "presente
 * hoy" (queda en Personal sin asignacion). Conserva el
 * historial: agrega un movimiento tipo RELEASE, no borra nada.
 *
 * fallbackFromAreaId: cubre a alguien que HOY todavia nadie ha
 * tocado (aparece en un area solo por su zona del snapshot de BASE,
 * nunca tuvo un DailyAssignment real) — no hay fila que borrar,
 * pero igual se registra el movimiento RELEASE (con el area de
 * origen que quien llama ya conoce, p. ej. desde getPeopleByArea)
 * para que quede "tocado" hoy y deje de contarse ahi. Si hay una
 * asignacion real activa, esta SIEMPRE tiene prioridad y el
 * fallback se ignora.
 */
export function releaseAssignment(employeeId, fallbackFromAreaId = null) {
  const date = todayISO()
  const employee = getEmployeeById(employeeId)
  const assignments = readAssignments()
  const idx = assignments.findIndex((a) => a.employeeId === employeeId && a.date === date)

  let fromAreaId = fallbackFromAreaId
  let fromStationId = null
  let shift = CURRENT_SHIFT

  if (idx !== -1) {
    const current = assignments[idx]
    fromAreaId = current.areaId
    fromStationId = current.stationId
    shift = current.shift
    assignments.splice(idx, 1)
    writeAssignments(assignments)
    if (employee) ensureAttendance(employee, date, current.shift)
  } else if (!fallbackFromAreaId) {
    return { status: 'ERROR', message: i18n.t('repository:noLocationAssignedToday') }
  }

  const movements = readMovements()
  movements.push({
    id: makeId('mov'),
    employeeId,
    employeeNumber: employee?.employeeNumber,
    date,
    fromAreaId,
    fromStationId,
    toAreaId: null,
    toStationId: null,
    movedAt: nowTime(),
    shift,
    movedBy: null,
    type: 'RELEASE',
  })
  writeMovements(movements)

  syncRelease({ employeeId })
  notify()
  return { status: 'OK' }
}

/* ── Supresion permanente de ubicacion historica (BASE) ──
   Distinto de releaseAssignment: eso libera "solo por hoy" (un
   movimiento fechado, que deja de contar al otro dia). Esto NO
   tiene fecha — el layout se ve vacio para esa persona hasta que
   alguien la asigne de verdad (checkInEmployee/moveEmployee la
   quitan de aqui automaticamente). Se agrego 2026-08-21 porque un
   reset "de hoy" se revertia solo al cambiar de dia y el usuario
   pidio explicitamente que se quedara en blanco para que los lideres
   fueran ubicando a cada quien. */
export function getBaselineSuppressed() {
  return new Set(readBaselineSuppressed())
}

export function suppressBaselinePlacement(employeeIds) {
  const current = new Set(readBaselineSuppressed())
  employeeIds.forEach((id) => current.add(id))
  writeBaselineSuppressed([...current])
  syncSuppressBaseline()
  notify()
}

/* Inverso exacto de suppressBaselinePlacement — usado por "Restaurar
   layout de las CT LINEA" (RestoreLayoutPanel.jsx). Vuelve a habilitar
   el fallback al snapshot historico (BASE) para estos ids, tanto local
   como en el servidor (syncRestoreBaseline — necesario para que el
   siguiente poll de apiSync.js no vuelva a marcar suppressed=true desde
   el lado del servidor, ver pollOnce()). */
export function restoreBaselinePlacement(employeeIds) {
  const current = new Set(readBaselineSuppressed())
  employeeIds.forEach((id) => current.delete(id))
  writeBaselineSuppressed([...current])
  syncRestoreBaseline()
  notify()
}

function unsuppressBaselinePlacement(employeeId) {
  const current = readBaselineSuppressed()
  if (!current.includes(employeeId)) return
  writeBaselineSuppressed(current.filter((id) => id !== employeeId))
}

/* ── Movimientos pendientes de aprobacion ──
   Un LIDER puede pedir mover a alguien de area, pero esa reubicacion
   NO se aplica de inmediato: queda aqui hasta que un SUPERVISOR o
   ADMINISTRADOR la aprueba o la rechaza (peticion explicita del
   usuario — un lider nunca reubica gente sin verificacion). Cuando
   quien pide el movimiento es SUPERVISOR/ADMINISTRADOR, se sigue
   usando moveEmployee directo (sin pasar por aqui). */

export function getPendingMoves() {
  return readPendingMoves()
}

/**
 * Crea la solicitud pendiente — NO mueve a nadie todavia. Valida lo
 * mismo que moveEmployee (area/estacion destino) para no guardar una
 * solicitud invalida que despues no se pueda aprobar.
 */
export function requestMove({
  employeeId,
  toAreaId,
  toStationId,
  shift,
  requestedByUserId,
  requestedByName,
}) {
  if (!toAreaId) return { status: 'ERROR', message: i18n.t('repository:selectDestinationAreaLine') }
  if (!toStationId)
    return { status: 'ERROR', message: i18n.t('repository:selectDestinationStation') }

  const date = todayISO()
  const employee = getEmployeeById(employeeId)
  if (!employee) return { status: 'ERROR', message: i18n.t('repository:employeeNotFound') }

  const current = readAssignments().find((a) => a.employeeId === employeeId && a.date === date)

  const pending = readPendingMoves()
  const request = {
    id: makeId('pmv'),
    employeeId,
    employeeNumber: employee.employeeNumber,
    employeeName: employee.name,
    date,
    fromAreaId: current?.areaId ?? null,
    fromStationId: current?.stationId ?? null,
    toAreaId,
    toStationId,
    shift: shift || current?.shift || CURRENT_SHIFT,
    requestedByUserId: requestedByUserId ?? null,
    requestedByName: requestedByName ?? null,
    requestedAt: nowISO(),
    status: 'PENDING',
  }
  pending.push(request)
  writePendingMoves(pending)

  syncRequestMove({
    localRequestId: request.id,
    employeeId,
    toAreaId,
    toStationId,
    shift: request.shift,
  })
  notify()
  return { status: 'PENDING', request }
}

/**
 * Aplica de verdad el movimiento (via moveEmployee) y retira la
 * solicitud de la cola. Si moveEmployee falla (ej. la estacion
 * destino ya se llenó mientras esperaba aprobación), la solicitud
 * se queda pendiente para que el supervisor decida de nuevo.
 */
export function approveMove(pendingMoveId, approvedByUserId) {
  const pending = readPendingMoves()
  const idx = pending.findIndex((p) => p.id === pendingMoveId)
  if (idx === -1) return { status: 'ERROR', message: i18n.t('repository:requestNoLongerExists') }

  const request = pending[idx]
  const result = moveEmployee({
    employeeId: request.employeeId,
    toAreaId: request.toAreaId,
    toStationId: request.toStationId,
    shift: request.shift,
  })
  if (result.status !== 'OK') return result

  pending.splice(idx, 1)
  writePendingMoves(pending)

  syncApproveMove({ localRequestId: pendingMoveId, employeeId: request.employeeId })
  notify()
  return { status: 'OK', assignment: result.assignment, approvedByUserId }
}

/** Rechaza la solicitud sin mover a nadie — se retira de la cola. */
export function rejectMove(pendingMoveId, rejectedByUserId, reason) {
  const pending = readPendingMoves()
  const idx = pending.findIndex((p) => p.id === pendingMoveId)
  if (idx === -1) return { status: 'ERROR', message: i18n.t('repository:requestNoLongerExists') }

  pending.splice(idx, 1)
  writePendingMoves(pending)

  syncRejectMove({ localRequestId: pendingMoveId, reason })
  notify()
  return { status: 'OK', rejectedByUserId, reason }
}
