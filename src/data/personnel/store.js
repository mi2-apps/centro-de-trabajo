/* ─────────────────────────────────────────────
   Capa de persistencia del modulo de Personal.

   Hoy vive en localStorage porque el proyecto no tiene
   backend propio; toda la lectura/escritura pasa POR AQUI
   para que el dia de manana sustituir esto por llamadas a
   una API real sea un cambio de un solo archivo (nadie mas
   importa localStorage directamente).
   ───────────────────────────────────────────── */

const KEYS = {
  employees: 'cp_employees_v1',
  assignments: 'cp_daily_assignments_v1',
  movements: 'cp_movements_v1',
  attendance: 'cp_attendance_v1',
  skills: 'cp_skills_v1',
  pendingMoves: 'cp_pending_moves_v1',
  baselineSuppressed: 'cp_baseline_suppressed_v1',
  absentEmployeeIds: 'cp_absent_employee_ids_v1',
  employeeStatusOverrides: 'cp_employee_status_overrides_v1',
  serverIdByLocalId: 'cp_server_id_by_local_id_v1',
}

function readList(key) {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeList(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* almacenamiento no disponible (modo privado, cuota llena, etc.) */
  }
}

// readObject/writeObject: mismo patron que readList/writeList pero para un objeto plano
// (mapa localId -> valor) en vez de un arreglo -- usado por employeeStatusOverrides, ver abajo.
function readObject(key) {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeObject(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* almacenamiento no disponible (modo privado, cuota llena, etc.) */
  }
}

export const readEmployees = () => readList(KEYS.employees)
export const writeEmployees = (rows) => writeList(KEYS.employees, rows)

export const readAssignments = () => readList(KEYS.assignments)
export const writeAssignments = (rows) => writeList(KEYS.assignments, rows)

export const readMovements = () => readList(KEYS.movements)
export const writeMovements = (rows) => writeList(KEYS.movements, rows)

/* Presencia (asistencia) — separada de la asignacion de
   estacion: alguien puede estar presente hoy sin todavia
   tener un puesto asignado. */
export const readAttendance = () => readList(KEYS.attendance)
export const writeAttendance = (rows) => writeList(KEYS.attendance, rows)

/* Habilidades del empleado (EmployeeSkill) — que puede hacer,
   no donde esta asignado hoy. */
export const readSkills = () => readList(KEYS.skills)
export const writeSkills = (rows) => writeList(KEYS.skills, rows)

/* Movimientos que un LIDER pide pero todavia no se aplican — quedan
   aqui hasta que un SUPERVISOR/ADMINISTRADOR los aprueba o rechaza
   (peticion explicita del usuario: un lider nunca reubica gente sin
   verificacion). Separado de `movements` (que es el historial de lo
   que YA ocurrio de verdad). */
export const readPendingMoves = () => readList(KEYS.pendingMoves)
export const writePendingMoves = (rows) => writeList(KEYS.pendingMoves, rows)

/* IDs de personal cuya ubicacion HISTORICA (snapshot BASE) se ignora
   a proposito, SIN fecha de vencimiento — a diferencia de un
   movimiento/liberacion normal (que solo aplica "por hoy" y al otro
   dia la persona vuelve a aparecer en su zona de BASE), esto se
   queda vacio indefinidamente hasta que alguien reciba una
   asignacion real de verdad (checkInEmployee/moveEmployee ya lo
   quita de esta lista, ver repository.js). Se agrego 2026-08-21
   porque el usuario pidio explicitamente que el layout se vea en
   blanco para que los lideres reubiquen a todos, y un reset "de solo
   hoy" se revertia solo al cambiar de dia. */
export const readBaselineSuppressed = () => readList(KEYS.baselineSuppressed)
export const writeBaselineSuppressed = (rows) => writeList(KEYS.baselineSuppressed, rows)

/* Ids de empleados con Attendance.status='AUSENTE' HOY, tal como los
   devuelve /api/personnel/roster (absentEmployeeIds) -- ver ese endpoint
   para el porque este query hoy siempre da vacio (ningun flujo escribe
   'AUSENTE' todavia). Se guarda aqui, sincronizado por apiSync.js igual
   que el resto del roster, para que el modulo Asistencia (card
   "Inasistencia") lo lea sin volver a pedirlo por su cuenta. */
export const readAbsentEmployeeIds = () => readList(KEYS.absentEmployeeIds)
export const writeAbsentEmployeeIds = (ids) => writeList(KEYS.absentEmployeeIds, ids)

/* "Personal sin asignar" con motivo (2026-09-02, a peticion explicita del usuario -- "poner si
   ya es baja o cambio de turno o si fue por falta"): mapa localId -> { active, unassignedReason,
   unassignedReasonSetAt }, sincronizado cross-device via apiSync.js/statusOverrides (roster.js).
   getAllEmployees() (repository.js) lo aplica encima del status/eligible baked-in de
   EMPLOYEE_DIRECTORY -- asi BAJA/reactivacion se reflejan en vivo sin necesitar un nuevo deploy
   de codigo cada vez (a diferencia del mecanismo anterior, 100% estatico en
   realPersonnelSnapshot.js). */
export const readEmployeeStatusOverrides = () => readObject(KEYS.employeeStatusOverrides)
export const writeEmployeeStatusOverrides = (overrides) =>
  writeObject(KEYS.employeeStatusOverrides, overrides)

/* Mapa localId -> employeeId real del servidor (2026-09-03, corrige bug real reportado por el
   usuario -- "Beckham" duplicado en el layout: uno con el nombre corto original y otro con el
   nombre completo tras enriquecerlo en la base). serverIdByLocalId ya existia en apiSync.js pero
   SOLO en memoria (se perdia en cada recarga de pagina) -- para gente sin numero de empleado,
   apiSync.js resolvia la identidad servidor->local por COINCIDENCIA EXACTA DE NOMBRE en cada
   sondeo; si el nombre real cambiaba en el servidor (o simplemente se recargaba la pestaña), esa
   coincidencia se rompia y el poll creaba una "persona nueva" duplicada en vez de reconocer que
   ya conocia a esta persona. Persistir el vinculo aqui hace que, una vez establecido una vez, un
   cambio de nombre posterior en el servidor YA NO cree una segunda identidad -- ver pollOnce en
   apiSync.js para donde se usa. */
export const readServerIdByLocalId = () => readObject(KEYS.serverIdByLocalId)
export const writeServerIdByLocalId = (map) => writeObject(KEYS.serverIdByLocalId, map)

/* ── Suscripcion simple para que la UI se refresque cuando cambian
   datos de personal — sea por una escritura local (checkInEmployee,
   etc.) o por la fusion periodica del backend real (ver apiSync.js,
   Fase 2 de la migracion). Vive aqui (no en repository.js) para que
   apiSync.js pueda llamar notify() sin crear un import circular con
   repository.js. ── */
const listeners = new Set()
export function notify() {
  listeners.forEach((fn) => fn())
}
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/* notify() de arriba solo cubre cambios hechos DESDE esta misma pestaña.
   El navegador SI dispara un evento 'storage' nativo en las OTRAS
   pestañas/ventanas del MISMO origen cuando localStorage cambia (nunca
   en la pestaña que escribio) — esto cubre "dos pestañas del mismo
   navegador"; dispositivos distintos se cubren aparte via apiSync.js
   (sondeo del backend real). Filtra por prefijo 'cp_' para no
   reaccionar a cambios de localStorage ajenos a este modulo. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('cp_')) notify()
  })
}
