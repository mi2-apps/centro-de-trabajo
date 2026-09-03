/* ─────────────────────────────────────────────
   Puente entre el store local (localStorage) y el backend real
   (/api/personnel/*, Fase 1 ya en produccion). Fase 2: checkin/move/
   release/etc. siguen escribiendo local PRIMERO (signatures sincronas
   sin cambios para toda la UI que ya los usa) y esta capa manda cada
   escritura al servidor en segundo plano (fire-and-forget); un sondeo
   periodico jala /api/personnel/roster y fusiona lo que cambio en
   OTRO dispositivo de vuelta al store local, disparando notify() para
   que la UI se refresque sola. Esto es lo que arregla el bug real
   reportado 2026-08-24 (una lider mueve a alguien y no se ve en otro
   dispositivo hasta recargar).

   Los ids de empleado son distintos en cada lado (local: ids del
   snapshot/EMPLOYEE_DIRECTORY o `emp-<ts>-<n>`; servidor: cuid de
   Prisma) — serverIdByLocalId hace la traduccion, reconstruida en
   cada poll igual que el seed (numero de empleado real cuando existe;
   nombre completo para PROYECTO/PENDIENTE, mismo criterio que
   SHARED_PLACEHOLDER_NUMBERS en repository.js). ── */
import dayjs from 'dayjs'
import { showToast } from '../../ui/toast'
import { workCenterById } from '../production/catalog'
import { EMPLOYEE_DIRECTORY } from './directory'
import {
  notify,
  readAbsentEmployeeIds,
  readAssignments,
  readBaselineSuppressed,
  readEmployeeStatusOverrides,
  readEmployees,
  readMovements,
  readPendingMoves,
  readServerIdByLocalId,
  writeAbsentEmployeeIds,
  writeAssignments,
  writeBaselineSuppressed,
  writeEmployeeStatusOverrides,
  writeEmployees,
  writeMovements,
  writePendingMoves,
  writeServerIdByLocalId,
} from './store'

/* Intervalo bajado de 7000 a 2000ms (2026-08-25, a peticion explicita del
   usuario: laptop <-> tablet deben verse actualizados "rapido, sin F5") --
   ademas ahora el sondeo se PAUSA mientras la pestaña esta oculta
   (document.visibilityState !== 'visible', ver startPersonnelSync) para no
   gastar red/bateria en una tablet bloqueada o en segundo plano, y se
   dispara un poll INMEDIATO (fuera del intervalo normal) al recuperar
   visibilidad/foco/conexion -- asi una tablet que estuvo dormida no se
   queda mostrando datos viejos hasta el siguiente tick de 2s. */
const POLL_MS = 2000
const RECENT_WRITE_GRACE_MS = 15000
const PLACEHOLDER_NUMBERS = new Set(['PROYECTO', 'PENDIENTE'])

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error((data && data.error) || `${path} -> ${res.status}`)
  return data
}

/* Persistido en localStorage (2026-09-03, ver comentario grande en store.js junto a
   readServerIdByLocalId/writeServerIdByLocalId) -- sobrevive recargas de pagina. Cualquier
   escritura pasa SIEMPRE por linkServerId() de aqui abajo, nunca `.set()` directo, para que
   quede persistido tambien. */
const serverIdByLocalId = new Map(Object.entries(readServerIdByLocalId()))
function linkServerId(localId, serverId) {
  serverIdByLocalId.set(localId, serverId)
  writeServerIdByLocalId(Object.fromEntries(serverIdByLocalId))
}
const serverPendingIdByLocalId = new Map()
/* Id real (cuid de Prisma User) del usuario logueado en ESTE dispositivo -- lo fija AppLayout.jsx
   via setCurrentUserId cuando cambia la sesion. Se usa solo para decidir a quien mostrarle el
   toast "tu solicitud fue aprobada/rechazada" en pollOnce() (requestedByUserId ya es ese mismo id
   real, tal como lo guarda request-move.js server-side -- no requiere traduccion). */
let currentUserId = null
export function setCurrentUserId(id) {
  currentUserId = id
}
/* Evita repetir el toast de resolucion en cada poll de 7s mientras la fila siga dentro de la
   ventana de 3 minutos que devuelve /api/personnel/roster (resolvedMoves). */
const notifiedResolutions = new Set()
/* Escrituras optimistas muy recientes de ESTE dispositivo — el poll
   las ignora un rato para no revertir el cambio local mientras el
   POST en segundo plano todavia no le llega al servidor (si no, un
   poll que cae justo en ese hueco podria "regresar" a alguien que la
   propia lider acaba de mover). */
const recentWrites = new Map()
export function markRecentWrite(employeeId) {
  recentWrites.set(employeeId, Date.now())
}
function isRecentlyWritten(employeeId) {
  const t = recentWrites.get(employeeId)
  return t != null && Date.now() - t < RECENT_WRITE_GRACE_MS
}

function isPlaceholderNumber(number) {
  return !number || PLACEHOLDER_NUMBERS.has(number)
}

/* ── Fire-and-forget hacia el servidor tras cada escritura local.
   Si falla, solo se registra en consola: el siguiente poll reconcilia
   el estado real (ver pollOnce). ── */

/* isNewEmployee (2026-08-27, corrige bug real de duplicados): SOLO checkInEmployee lo manda en
   true, y solo cuando la persona se acaba de crear AHI MISMO (createEmployee recien llamado) --
   es el UNICO caso legitimo donde no hay serverId todavia porque el empleado en verdad no existe
   en el servidor. Para cualquier otro caso (persona ya conocida localmente -- snapshot de BASE,
   directorio, o reconciliacion) sin serverId resuelto TODAVIA, antes se mandaba `name` igual y el
   backend creaba un EMPLEADO DUPLICADO (checkin.js: sin employeeId/employeeNumber, siempre da de
   alta uno nuevo por nombre) -- confirmado en produccion con "Cesar Hernandez Hernandez" y otros
   6 nombres que por coincidencia se repiten entre personas reales distintas (sin numero de
   empleado que los distinga, el mapeo local->servidor por nombre no puede diferenciarlos, ver
   buildLocalIndex/pollOnce mas abajo). Ahora, igual que ya hacian syncMove/syncRelease, si no hay
   serverId Y no es alguien genuinamente nuevo, se omite el POST -- el siguiente poll de
   pollOnce() resuelve el serverId real (por numero de empleado si lo tiene) sin arriesgarse a
   crear un fantasma. */
export function syncCheckIn({
  employeeId,
  employeeNumber,
  name,
  areaId,
  stationId,
  shift,
  isNewEmployee = false,
}) {
  markRecentWrite(employeeId)
  const serverId = serverIdByLocalId.get(employeeId)
  if (!serverId && !isNewEmployee) {
    console.warn(
      '[personnel-sync] checkin: sin serverId todavia y no es alta nueva, se omite (el siguiente poll lo resuelve)',
    )
    return
  }
  const placeholder = isPlaceholderNumber(employeeNumber)
  apiFetch('/api/personnel/checkin', {
    method: 'POST',
    body: JSON.stringify({
      employeeId: serverId || undefined,
      employeeNumber: serverId || placeholder ? undefined : employeeNumber,
      name: serverId ? undefined : name,
      workAreaId: areaId,
      stationName: stationId,
      shift,
    }),
  })
    .then((data) => {
      if (data?.employee?.id) linkServerId(employeeId, data.employee.id)
    })
    .catch((e) => console.error('[personnel-sync] checkin', e))
}

export function syncMove({ employeeId, toAreaId, toStationId, shift }) {
  markRecentWrite(employeeId)
  const serverId = serverIdByLocalId.get(employeeId)
  if (!serverId) {
    console.warn(
      '[personnel-sync] move: sin serverId todavia, se omite (el siguiente poll lo resuelve)',
    )
    return
  }
  apiFetch('/api/personnel/move', {
    method: 'POST',
    body: JSON.stringify({
      employeeId: serverId,
      workAreaId: toAreaId,
      stationName: toStationId,
      shift,
    }),
  }).catch((e) => console.error('[personnel-sync] move', e))
}

/* Intercambio/bump real (2026-09-02, corrige bug real reportado por el usuario -- "cambio
   posiciones y a los segundos se revierten, en TODO EL LAYOUT"): un swap real NUNCA debe
   mandarse como 2 llamadas independientes a syncMove -- confirmado en produccion (0 filas
   nuevas en EmployeeMovement/DailyAssignment tras un swap que la UI ya mostraba) que el
   servidor rechaza con STATION_FULL a quien sea que su request de /move llegue primero,
   porque en ese instante la estacion destino SIGUE mostrando ocupante (el otro request,
   independiente, puede no haber corrido todavia). Un solo POST a /api/personnel/swap
   (server-lib/personnel.js/swapOrBumpStation) resuelve el intercambio completo en UNA
   transaccion -- ver el comentario grande ahi para el detalle completo. */
export function syncSwapOrBump({ employeeIdA, employeeIdB, toAreaId, toStationId, shift }) {
  markRecentWrite(employeeIdA)
  markRecentWrite(employeeIdB)
  const serverId = serverIdByLocalId.get(employeeIdA)
  if (!serverId) {
    console.warn(
      '[personnel-sync] swap: sin serverId todavia, se omite (el siguiente poll lo resuelve)',
    )
    return
  }
  apiFetch('/api/personnel/swap', {
    method: 'POST',
    body: JSON.stringify({
      employeeId: serverId,
      workAreaId: toAreaId,
      stationName: toStationId,
      shift,
    }),
  }).catch((e) => console.error('[personnel-sync] swap', e))
}

/* Motivo de "Personal sin asignar" (2026-09-02, a peticion explicita del usuario) --
   DELIBERADAMENTE distinta al resto de sync* de aqui arriba: NUNCA fire-and-forget. Marcar BAJA
   es una accion real de negocio (desactiva de verdad al empleado) que merece confirmacion real
   antes de que la UI la de por hecha -- justo la leccion del bug real de swap (2026-09-02,
   commit de3f74e): un escritura optimista que el servidor rechaza en silencio deja a alguien
   viendo un estado que nunca paso. Por eso esta funcion es `async` y ES el resultado -- quien la
   llama (repository.js/setEmployeeUnassignedReason) espera la respuesta real antes de actualizar
   el store local, y puede mostrar un error real si falla (en vez de revertir solo 15s despues). */
// employeeNumber/name (2026-09-02, bug real: "Denilson"/"Mireya" -- gente que existe SOLO en
// el snapshot estatico, sin fila activa en Employee todavia, asi que serverIdByLocalId nunca
// tuvo su mapeo y esta funcion siempre tiraba el error de "no sincronizado", sin salida. Mismo
// patron que syncCheckIn: si no hay serverId cacheado, se manda numero/nombre para que el
// servidor resuelva o cree (set-unassigned-reason.js ya replica la logica de checkin.js) -- y
// el id real que responda se cachea aqui mismo para que el resto de esta sesion ya no vuelva a
// pasar por este camino para la misma persona.
export async function syncSetUnassignedReason({ employeeId, employeeNumber, name, reason }) {
  const serverId = serverIdByLocalId.get(employeeId)
  const placeholder = isPlaceholderNumber(employeeNumber)
  const data = await apiFetch('/api/personnel/set-unassigned-reason', {
    method: 'POST',
    body: JSON.stringify({
      employeeId: serverId || undefined,
      employeeNumber: serverId || placeholder ? undefined : employeeNumber,
      name: serverId ? undefined : name,
      reason: reason || null,
    }),
  })
  if (data?.employee?.id) linkServerId(employeeId, data.employee.id)
  markRecentWrite(employeeId)
  return data
}

export function syncRelease({ employeeId }) {
  markRecentWrite(employeeId)
  const serverId = serverIdByLocalId.get(employeeId)
  if (!serverId) {
    console.warn('[personnel-sync] release: sin serverId todavia, se omite')
    return
  }
  apiFetch('/api/personnel/release', {
    method: 'POST',
    body: JSON.stringify({ employeeId: serverId }),
  }).catch((e) => console.error('[personnel-sync] release', e))
}

export function syncSuppressBaseline() {
  apiFetch('/api/personnel/suppress-baseline', { method: 'POST' }).catch((e) =>
    console.error('[personnel-sync] suppress-baseline', e),
  )
}

export function syncRestoreBaseline() {
  apiFetch('/api/personnel/restore-baseline', { method: 'POST' }).catch((e) =>
    console.error('[personnel-sync] restore-baseline', e),
  )
}

export function syncRequestMove({ localRequestId, employeeId, toAreaId, toStationId, shift }) {
  const serverId = serverIdByLocalId.get(employeeId)
  if (!serverId) {
    console.warn('[personnel-sync] request-move: sin serverId todavia, se omite')
    return
  }
  apiFetch('/api/personnel/request-move', {
    method: 'POST',
    body: JSON.stringify({
      employeeId: serverId,
      workAreaId: toAreaId,
      stationName: toStationId,
      shift,
    }),
  })
    .then((data) => {
      if (data?.pendingMove?.id) serverPendingIdByLocalId.set(localRequestId, data.pendingMove.id)
    })
    .catch((e) => console.error('[personnel-sync] request-move', e))
}

export function syncApproveMove({ localRequestId, employeeId }) {
  if (employeeId) markRecentWrite(employeeId)
  const serverId = serverPendingIdByLocalId.get(localRequestId)
  if (!serverId) {
    console.warn('[personnel-sync] approve-move: solicitud no sincronizada todavia, se omite')
    return
  }
  apiFetch('/api/personnel/approve-move', {
    method: 'POST',
    body: JSON.stringify({ pendingMoveId: serverId }),
  }).catch((e) => console.error('[personnel-sync] approve-move', e))
}

export function syncRejectMove({ localRequestId, reason }) {
  const serverId = serverPendingIdByLocalId.get(localRequestId)
  if (!serverId) {
    console.warn('[personnel-sync] reject-move: solicitud no sincronizada todavia, se omite')
    return
  }
  apiFetch('/api/personnel/reject-move', {
    method: 'POST',
    body: JSON.stringify({ pendingMoveId: serverId, reason }),
  }).catch((e) => console.error('[personnel-sync] reject-move', e))
}

/* ── Sondeo: jala /api/personnel/roster y fusiona LIVE/NONE/
   baselineSuppressed al store local (SNAPSHOT no requiere fusion —
   ya es el comportamiento por defecto del calculo local). ── */

function buildLocalIndex() {
  const byNumber = new Map()
  const byName = new Map()
  const all = [...EMPLOYEE_DIRECTORY, ...readEmployees()]
  all.forEach((e) => {
    if (!isPlaceholderNumber(e.employeeNumber)) byNumber.set(e.employeeNumber, e.id)
    else byName.set(e.name, e.id)
  })
  return { byNumber, byName }
}

function resolveWorkAreaLabel(workstation) {
  if (!workstation) return { areaId: null, stationId: null }
  return { areaId: workstation.workArea.code, stationId: workstation.name }
}

async function pollOnce() {
  const {
    roster,
    absentEmployeeIds: serverAbsentIds = [],
    statusOverrides: serverStatusOverrides = [],
    pendingMoves = [],
    resolvedMoves = [],
  } = await apiFetch('/api/personnel/roster')
  const { byNumber, byName } = buildLocalIndex()
  const serverToLocalId = new Map()
  // Vinculo ya conocido de un poll anterior (persistido, sobrevive recargas) -- SIEMPRE tiene
  // prioridad sobre el match por nombre/numero. Corrige bug real 2026-09-03 ("Beckham"
  // duplicado): si el fullName de alguien sin folio cambia en el servidor, el match por nombre
  // ya no encuentra a la persona local existente y antes se creaba una identidad nueva
  // (fantasma) en vez de reconocer que ya se conocia via su employeeId real.
  const knownLocalIdByServerId = new Map()
  serverIdByLocalId.forEach((sId, lId) => {
    knownLocalIdByServerId.set(sId, lId)
  })

  const dynamicEmployees = readEmployees()
  const newDynamicEmployees = []
  const assignments = readAssignments()
  const movements = readMovements()
  const baselineSuppressed = new Set(readBaselineSuppressed())
  const today = dayjs().format('YYYY-MM-DD')
  const touchedIds = new Set(movements.filter((m) => m.date === today).map((m) => m.employeeId))
  let changed = false
  let dynamicEmployeesHealed = false

  roster.forEach((row) => {
    const placeholder = isPlaceholderNumber(row.employeeNumber)
    let localId =
      knownLocalIdByServerId.get(row.employeeId) ||
      (placeholder ? byName.get(row.fullName) : byNumber.get(row.employeeNumber))

    if (!localId) {
      // Empleado que no existe localmente todavia (dado de alta desde otro dispositivo).
      localId = row.employeeId
      newDynamicEmployees.push({
        id: localId,
        employeeNumber: row.employeeNumber || 'PROYECTO',
        name: row.fullName,
        status: 'Activo',
        createdAt: null,
      })
      if (placeholder) byName.set(row.fullName, localId)
      else byNumber.set(row.employeeNumber, localId)
    } else {
      // Self-heal: el nombre/numero real pudo haber cambiado en el servidor desde el ultimo
      // poll (ej. se completo un nombre corto). Si esta persona ya es una fila dinamica local,
      // se actualiza en el lugar. Si solo vivia en el snapshot estatico (EMPLOYEE_DIRECTORY,
      // congelado hasta el proximo build), se "promueve" a fila dinamica CON EL MISMO id --
      // getAllEmployees() (repository.js) ya dedupea tambien por id, no solo por employeeNumber,
      // asi que la fila estatica obsoleta queda automaticamente excluida (corrige bug real
      // 2026-09-03: "Jonathan"/"Gabriela"/"Patricia" en Calidad se completaron en la base pero
      // seguian mostrando el nombre corto porque antes esta rama no tocaba a nadie que solo
      // viviera en el snapshot estatico).
      const existingDynamic = dynamicEmployees.find((e) => e.id === localId)
      const freshNumber = row.employeeNumber || 'PROYECTO'
      if (existingDynamic) {
        if (
          existingDynamic.name !== row.fullName ||
          existingDynamic.employeeNumber !== freshNumber
        ) {
          existingDynamic.name = row.fullName
          existingDynamic.employeeNumber = freshNumber
          dynamicEmployeesHealed = true
          changed = true
        }
      } else {
        const staticEntry = EMPLOYEE_DIRECTORY.find((e) => e.id === localId)
        if (
          staticEntry &&
          (staticEntry.name !== row.fullName ||
            freshNumber !== (staticEntry.employeeNumber || 'PROYECTO'))
        ) {
          newDynamicEmployees.push({
            id: localId,
            employeeNumber: freshNumber,
            name: row.fullName,
            status: staticEntry.status || 'Activo',
            createdAt: null,
          })
          changed = true
        }
      }
    }
    linkServerId(localId, row.employeeId)
    serverToLocalId.set(row.employeeId, localId)

    if (row.baselineSuppressed && !baselineSuppressed.has(localId)) {
      baselineSuppressed.add(localId)
      changed = true
    }

    if (isRecentlyWritten(localId)) return // confiar en el optimista local un rato

    const existingIdx = assignments.findIndex((a) => a.employeeId === localId && a.date === today)

    if (row.placement.source === 'LIVE') {
      const p = row.placement
      const checkInAt = p.assignedAt ? dayjs(p.assignedAt).format('HH:mm') : dayjs().format('HH:mm')
      const prev = existingIdx !== -1 ? assignments[existingIdx] : null
      if (
        !prev ||
        prev.areaId !== p.workAreaCode ||
        prev.stationId !== p.stationName ||
        prev.shift !== p.shift
      ) {
        const next = {
          id: prev ? prev.id : `sync-${localId}-${today}`,
          employeeId: localId,
          employeeNumber: row.employeeNumber || 'PROYECTO',
          date: today,
          shift: p.shift,
          areaId: p.workAreaCode,
          stationId: p.stationName,
          checkInAt,
          status: 'PRESENTE',
          createdAt: prev ? prev.createdAt : p.assignedAt || dayjs().toISOString(),
          updatedAt: p.assignedAt || dayjs().toISOString(),
        }
        if (existingIdx !== -1) assignments[existingIdx] = next
        else assignments.push(next)
        changed = true
      }
      if (!touchedIds.has(localId)) {
        movements.push({
          id: `sync-mov-${localId}-${today}`,
          employeeId: localId,
          employeeNumber: row.employeeNumber || 'PROYECTO',
          date: today,
          fromAreaId: null,
          fromStationId: null,
          toAreaId: p.workAreaCode,
          toStationId: p.stationName,
          movedAt: checkInAt,
          shift: p.shift,
          movedBy: null,
          type: 'MOVE',
        })
        touchedIds.add(localId)
        changed = true
      }
    } else if (row.placement.source === 'NONE') {
      if (existingIdx !== -1) {
        assignments.splice(existingIdx, 1)
        changed = true
      }
      if (!touchedIds.has(localId)) {
        movements.push({
          id: `sync-mov-${localId}-${today}`,
          employeeId: localId,
          employeeNumber: row.employeeNumber || 'PROYECTO',
          date: today,
          fromAreaId: null,
          fromStationId: null,
          toAreaId: null,
          toStationId: null,
          movedAt: dayjs().format('HH:mm'),
          shift: null,
          movedBy: null,
          type: 'RELEASE',
        })
        touchedIds.add(localId)
        changed = true
      }
    }
  })

  if (newDynamicEmployees.length || dynamicEmployeesHealed) {
    writeEmployees([...dynamicEmployees, ...newDynamicEmployees])
    changed = true
  }

  // ── Solicitudes de movimiento (PendingMove) -- fusion cross-device del mismo tipo que el
  // roster de arriba: agrega al store local cualquier solicitud PENDING que el servidor ya
  // conoce y este dispositivo todavia no (creada por un LIDER en OTRO dispositivo), y resuelve
  // (quita de la cola + notifica) las que ya fueron aprobadas/rechazadas -- sin esto, una
  // solicitud creada en la tablet de un lider nunca le aparecia al supervisor en otra tablet sin
  // recargar (Cambio 4, 2026-08-25). ──
  const localIdByServerPendingId = new Map()
  serverPendingIdByLocalId.forEach((serverId, localId) =>
    localIdByServerPendingId.set(serverId, localId),
  )

  const pending = readPendingMoves()
  let pendingChanged = false

  pendingMoves.forEach((row) => {
    if (localIdByServerPendingId.has(row.id)) return // ya lo tenemos local (lo creamos aqui o un poll anterior ya lo agrego)
    const placeholder = isPlaceholderNumber(row.employee.employeeNumber)
    const employeeLocalId = placeholder
      ? byName.get(row.employee.fullName)
      : byNumber.get(row.employee.employeeNumber)
    if (!employeeLocalId) return // empleado que este dispositivo todavia no conoce; el siguiente poll lo resuelve

    const to = resolveWorkAreaLabel(row.toWorkstation)
    const from = resolveWorkAreaLabel(row.fromWorkstation)
    const localRequestId = `sync-pmv-${row.id}`
    pending.push({
      id: localRequestId,
      employeeId: employeeLocalId,
      employeeNumber: row.employee.employeeNumber || 'PROYECTO',
      employeeName: row.employee.fullName,
      date: today,
      fromAreaId: from.areaId,
      fromStationId: from.stationId,
      toAreaId: to.areaId,
      toStationId: to.stationId,
      shift: row.shift,
      requestedByUserId: row.requestedByUserId,
      requestedByName: row.requestedBy?.name || null,
      requestedAt: row.requestedAt,
      status: 'PENDING',
    })
    serverPendingIdByLocalId.set(localRequestId, row.id)
    localIdByServerPendingId.set(row.id, localRequestId)
    pendingChanged = true
  })

  resolvedMoves.forEach((row) => {
    const localRequestId = localIdByServerPendingId.get(row.id)
    if (localRequestId) {
      const idx = pending.findIndex((p) => p.id === localRequestId)
      if (idx !== -1) {
        pending.splice(idx, 1)
        pendingChanged = true
      }
    }
    // Avisar solo a quien la pidio, y solo una vez por solicitud resuelta (la ventana de
    // resolvedMoves dura 3 minutos -- sin este Set el toast se repetiria en cada poll de 7s).
    if (
      currentUserId &&
      row.requestedByUserId === currentUserId &&
      !notifiedResolutions.has(row.id)
    ) {
      notifiedResolutions.add(row.id)
      const toAreaId = row.toWorkstation ? resolveWorkAreaLabel(row.toWorkstation).areaId : null
      const toName = toAreaId ? workCenterById(toAreaId)?.name || toAreaId : null
      if (row.status === 'APPROVED') {
        showToast(
          `Movimiento aprobado${toName ? ` — ${row.employee.fullName} ahora en ${toName}` : ''}.`,
          'success',
        )
      } else if (row.status === 'REJECTED') {
        showToast(`Movimiento de ${row.employee.fullName} rechazado.`, 'error')
      }
    }
  })

  if (pendingChanged) writePendingMoves(pending)

  // Inasistencia (ids locales, ver comentario en store.js) -- traducidos via
  // serverToLocalId como el resto de este archivo; un id de servidor que
  // este poll todavia no resolvio a un id local (recien llegado, un tick
  // antes de que el roster.forEach de arriba lo registre) se descarta en
  // ESTE poll y se recupera solo en el siguiente, nunca se inventa un id.
  const absentIds = serverAbsentIds.map((id) => serverToLocalId.get(id)).filter(Boolean)
  const prevAbsentIds = readAbsentEmployeeIds()
  const absentChanged =
    absentIds.length !== prevAbsentIds.length || absentIds.some((id) => !prevAbsentIds.includes(id))
  if (absentChanged) {
    writeAbsentEmployeeIds(absentIds)
    changed = true
  }

  // "Personal sin asignar" con motivo (2026-09-02) -- statusOverrides SIEMPRE incluye gente
  // active:false (BAJA real), que por diseño NUNCA aparece en `roster` de arriba (esa query
  // filtra active:true a proposito -- ver roster.js) y por lo tanto nunca entra a
  // serverToLocalId via el forEach de roster. Por eso aqui se resuelve el id local primero por
  // row.id (serverId real de la fila, sin ambiguedad) contra serverIdByLocalId ya cacheado --
  // ese cache YA tiene la entrada de quien acabamos de marcar en ESTE mismo dispositivo,
  // porque syncSetUnassignedReason exige serverIdByLocalId resuelto antes de poder llamarse
  // (ver arriba). Bug real corregido 2026-09-02: antes se resolvia SOLO por employeeNumber
  // (byNumber) y se descartaba a proposito cualquier numero placeholder (PROYECTO/PENDIENTE)
  // para no arriesgar una colision de nombre -- pero eso hacia que marcar BAJA/TURNO/FALTA a
  // alguien SIN numero real (el caso mas comun en "Personal sin asignar": la mayoria ahi son
  // "PROYECTO") se revirtiera solo unos segundos despues, en el siguiente poll, porque ese
  // poll reconstruye nextStatusOverrides desde cero y REEMPLAZA el store local completo --
  // la fila de esa persona nunca calificaba para el mapa nuevo y su override recien guardado
  // se perdia. byNumber sigue de respaldo (para reconciliar en otro dispositivo/pestaña nueva
  // que aun no tiene el serverId cacheado) SOLO cuando el numero es real.
  const localIdByServerId = new Map()
  serverIdByLocalId.forEach((sId, localId) => {
    localIdByServerId.set(sId, localId)
  })
  const nextStatusOverrides = {}
  serverStatusOverrides.forEach((row) => {
    let localId = localIdByServerId.get(row.id)
    if (!localId && !isPlaceholderNumber(row.employeeNumber)) {
      localId = byNumber.get(row.employeeNumber)
    }
    if (!localId) return
    linkServerId(localId, row.id)
    nextStatusOverrides[localId] = {
      active: row.active,
      unassignedReason: row.unassignedReason,
      unassignedReasonSetAt: row.unassignedReasonSetAt,
      // "Registrado por" en Bajas (2026-09-02) -- ya resuelto server-side en roster.js, aqui
      // solo se transporta tal cual al store local.
      registeredByName: row.registeredByName ?? null,
      registeredByRole: row.registeredByRole ?? null,
    }
  })
  const prevStatusOverrides = readEmployeeStatusOverrides()
  if (JSON.stringify(nextStatusOverrides) !== JSON.stringify(prevStatusOverrides)) {
    writeEmployeeStatusOverrides(nextStatusOverrides)
    changed = true
  }

  if (changed || pendingChanged) {
    writeAssignments(assignments)
    writeMovements(movements)
    writeBaselineSuppressed([...baselineSuppressed])
    notify()
  }
}

let started = false
let polling = false
export function startPersonnelSync() {
  if (started || typeof window === 'undefined') return
  started = true

  const tick = () => {
    if (document.visibilityState !== 'visible' || polling) return
    polling = true
    pollOnce()
      .catch((e) => console.error('[personnel-sync] poll', e))
      .finally(() => {
        polling = false
      })
  }

  tick()
  setInterval(tick, POLL_MS)

  // Refetch inmediato (fuera del intervalo normal) al recuperar
  // visibilidad/foco/conexion -- cubre el caso real de una tablet que se
  // bloqueo o cambio de app y vuelve mostrando datos de hace rato.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick()
  })
  window.addEventListener('focus', tick)
  window.addEventListener('online', tick)
}
