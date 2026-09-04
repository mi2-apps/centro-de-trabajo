import i18n from '../../i18n'
import {
  getAllEmployees,
  getAssignableEmployees,
  getAssignmentsForArea,
  getAssignmentsForDate,
  getBaselineSuppressed,
  getEmployeeById,
  getMovementsForDate,
  todayISO,
} from '../personnel/repository'
import { getWorkstationsForLine } from '../personnel/workstations'
import {
  AREA_STATION_SOURCE_OVERRIDE,
  canonicalOperationalAreaId,
  EXCLUDED_FROM_PLANT_TOTAL_AREA_IDS,
  hasLineStations,
  LINE_LIKE_AREA_IDS,
  operationalGroupMembers,
  WORK_CENTERS,
  workCenterById,
} from './catalog'
import { colorGroupForArea, FFT_LINE_IDS } from './layoutZones'
import { BASE_SNAPSHOT_DATE, REAL_PERSONNEL_SNAPSHOT } from './realPersonnelSnapshot'

export { BASE_SNAPSHOT_DATE }

/* Areas de soporte/administrativas "fijas" (2026-08-24, a peticion
   explicita del usuario): rotan mucho menos que una linea de
   produccion, asi que "Vaciar layout" (ClearLayoutPanel.jsx) nunca
   debe dejarlas en blanco. Accesorios y Paletizado se protegen igual
   pero NO entran en AUTO_ACTIVE_AREAS (el usuario pidio dejarlos tal
   cual estan hoy, sin forzar hora de entrada). Calidad se protege de
   igual forma pero tampoco entra en AUTO_ACTIVE_AREAS (el usuario
   pidio explicitamente que a Calidad no se le ponga hora de entrada
   fija) — ver uso de AUTO_ACTIVE_AREAS en PersonalDeHoyTab.jsx. */
// 2026-08-26 ("Reestructuracion operativa FFT"): SOPORTE se quita (archivada,
// `active:false` -- ya no aparece en "Personal de hoy" como area fija).
// ENTRENADOR se agrega (WC nuevo, mismo trato que las demas areas de apoyo).
export const FIXED_SUPPORT_AREAS = [
  'CALIDAD',
  'CAPACITACION',
  'TEAM_LEADER',
  'ENTRENADOR',
  'LIMPIEZA',
  'GERENTE',
  'SUPERVISOR',
]
export const AUTO_ACTIVE_AREAS = FIXED_SUPPORT_AREAS.filter((id) => id !== 'CALIDAD')

/* BUG REAL detectado en produccion 2026-08-24: esta lista antes se mantenia a mano (los 7 fijos +
   Accesorios + Paletizado) y se le olvido incluir CT Midea/High Value, CT Conveyor, CT Insumos y
   CT Suministro de material -- "Vaciar layout" tambien las habria vaciado si alguien quedaba ahi
   por snapshot. Ahora se DERIVA del catalogo: todo WORK_CENTER que no sea una linea numerada ni
   CT LINEA 0/Proyecto queda protegido automaticamente, sin mantenimiento manual, para que nunca
   se vuelva a quedar una area nueva sin proteger por accidente. */
export const PROTECTED_FROM_LAYOUT_CLEAR_AREAS = WORK_CENTERS.filter(
  (w) => w.kind !== 'linea' && w.id !== 'PROYECTO',
).map((w) => w.id)

/* Convierte la ZONA normalizada del snapshot ("LINEA 3") al id del
   catalogo ("LINEA3"). El resto de las zonas ya coinciden 1:1 con
   los ids de catalog.js (PALETIZADO, CAJAS, ACCESORIOS, etc).
   Logica centralizada aqui para que AreasLayoutView y el layout
   interactivo del Dashboard usen exactamente la misma agrupacion.

   Caso especial: "LINEA 0" es el texto crudo que trae BASE, pero NO
   corresponde a una linea FFT real — operativamente es "Linea de
   proyecto" (area independiente, catalog.js id PROYECTO). El dato
   crudo (rawZona) se conserva intacto en el snapshot para no perder
   historial; solo la clasificacion operativa cambia aqui.

   Caso especial: "DMT" tambien es zona cruda real de BASE, pero en
   el plano fisico del piso (confirmado 2026-08-19) DMT y High Value
   son el mismo bloque operativo ("CT MIDEA/HV") — catalog.js ya no
   tiene un area DMT separada, asi que quien traiga esa zona cruda
   se cuenta dentro de HIGH_VALUE. */
function mapAreaZonaToId(areaZona) {
  if (!areaZona) return null
  if (areaZona === 'LINEA 0') return 'PROYECTO'
  if (areaZona.startsWith('LINEA ')) return `LINEA${areaZona.split(' ')[1]}`
  if (areaZona === 'DMT') return 'HIGH_VALUE'
  // INGENIERIA/CAJAS (2026-08-25, a peticion explicita del usuario): esa
  // gente real se cuenta como SUPERVISOR/BOX_PREP respectivamente, no como
  // area propia -- CAJAS SI tiene su propio WORK_CENTER real (BOX_PREP, ver
  // catalog.js), INGENIERIA no. CHOFER/PRODUCCION NO tienen WORK_CENTER (a
  // peticion explicita del usuario, 2026-08-25: no inventar a que linea
  // pertenecen) -- se quedan devueltos tal cual abajo, y getPeopleWithoutArea
  // los recoge como "sin area asignada" porque no hay WORK_CENTER activo
  // con ese id (ver esa funcion mas abajo).
  if (areaZona === 'INGENIERIA') return 'SUPERVISOR'
  if (areaZona === 'CAJAS') return 'BOX_PREP'
  return areaZona
}

/* Snapshot PURO (nunca cambia en runtime) — solo para el/los lugar(es)
   que explicitamente quieren mostrar la referencia historica de BASE
   tal cual se importo, sin mezclar movimientos del dia. */
export function getSnapshotPeopleByArea() {
  const map = {}
  REAL_PERSONNEL_SNAPSHOT.forEach((p) => {
    const areaId = mapAreaZonaToId(p.areaZona)
    if (!areaId) return
    map[areaId] = map[areaId] || []
    map[areaId].push(p)
  })
  return map
}

/* Zona real de ORIGEN (2026-08-26, a peticion explicita del usuario: al
   mover a un lider real a WC Team Leader, "que me pongas en que lugar
   están" -- de donde viene realmente cada quien). Busca en el snapshot
   PURO (nunca cambia, ver arriba) cual era la zona real de esa persona
   segun LAYOUT FFT.xlsx -- solo devuelve un id si mapea a un WORK_CENTER
   real (nunca 'PRODUCCION'/'CHOFER', que no tienen area propia). null si
   la persona no viene del snapshot (fue creada/registrada despues) o si
   su zona cruda no mapea a ningun WORK_CENTER real. Generico -- no
   hardcodea ningun nombre de persona, sirve para cualquiera. */
export function getSnapshotHomeAreaId(employeeId) {
  const buckets = getSnapshotPeopleByArea()
  for (const [areaId, people] of Object.entries(buckets)) {
    if (workCenterById(areaId) && people.some((p) => p.id === employeeId)) return areaId
  }
  return null
}

/* Personal "efectivo" de HOY, por area — la fuente que alimenta
   TODO el REAL de Ideal/Real/Diferencia y el layout visual.

   Modelo: el snapshot de BASE es el punto de partida (para quien
   nadie ha tocado todavia desde la web hoy). En cuanto un empleado
   recibe un movimiento hoy (checkInEmployee/moveEmployee/
   releaseAssignment — repository.js, unica fuente que escribe
   asignaciones), su ubicacion pasa a depender EXCLUSIVAMENTE de esa
   asignacion diaria en vivo: nunca vuelve a su zona historica del
   Excel, y si fue liberado no cuenta en ninguna area (no se "cae"
   de regreso al snapshot). Esto es lo que permite que arrastrar a
   alguien cambie el REAL mostrado (15/20 -> 16/20) sin reescribir
   el snapshot ni crear una segunda fuente de verdad paralela — el
   snapshot nunca se modifica, y la asignacion diaria sigue viviendo
   unicamente en repository.js/store.js (ver nota de persistencia en
   ese archivo: hoy es localStorage, esta capa es agnostica a eso). */
export function getPeopleByArea() {
  const map = {}
  const touchedToday = new Set(getMovementsForDate().map((m) => m.employeeId))
  // Supresion permanente (sin fecha) de la ubicacion de BASE — distinta de
  // "tocado hoy": se agrego 2026-08-21 para que el layout se vea en blanco
  // hasta que alguien reciba una asignacion real, en vez de volver a
  // aparecer solo porque cambio el dia (ver store.js/repository.js).
  const baselineSuppressed = getBaselineSuppressed()

  REAL_PERSONNEL_SNAPSHOT.forEach((p) => {
    if (touchedToday.has(p.id) || baselineSuppressed.has(p.id)) return
    const areaId = mapAreaZonaToId(p.areaZona)
    // BUG REAL encontrado 2026-08-28 (a peticion explicita del usuario, al
    // preguntar que eran los 31 de "Personal sin area asignada"): antes
    // esto solo revisaba `!areaId` (null/vacio) -- una zona cruda real pero
    // SIN WORK_CENTER propio (PRODUCCION/CHOFER, ver mapAreaZonaToId arriba
    // y la nota de catalog.js: "no se les inventa una area") igual se
    // "colocaba" aqui bajo una clave fantasma que ningun WORK_CENTER real
    // usa jamas. Esa gente real y activa (21 personas, confirmado) quedaba
    // marcada como "ya ubicada" para getAvailablePersonnelToday/
    // getPeopleWithoutArea sin estar en ninguna area real -- invisibles
    // tanto en su area (no existe) como en disponibles (se creian ya
    // colocados). Ahora solo se bucketiza bajo un id que SI es un
    // WORK_CENTER real; sin area real conocida, cuentan como sin ubicacion
    // (igual que si areaZona fuera null), consistente con la regla ya
    // documentada de que CHOFER/PRODUCCION nunca tienen area propia. */
    if (!areaId || !workCenterById(areaId)) return
    // 2026-08-26 ("Reestructuracion operativa FFT"): un area `active:false`
    // SIN redireccion (canonico = ella misma -- hoy solo SOPORTE) ya no
    // "atrapa" a su gente historica del snapshot -- esas personas deben
    // caer en "Personal sin área asignada"/disponibles, no quedar
    // invisibles en un area archivada que ningun lado ya muestra (bug real
    // que se hubiera creado si no se agrega este guard: 2 personas reales
    // sin asignacion activa, ni visibles en ningun WC, ni contadas como
    // disponibles). Las areas fusionadas (BOX_PREP/SUMINISTRO_MATERIAL,
    // canonico=INSUMOS) SI se siguen bucketizando bajo su propio id real --
    // ahi las necesita getGroupPeople/getGroupAreaStaffing para sumar el
    // detalle fusionado de Insumos.
    const areaWc = workCenterById(areaId)
    if (areaWc.active === false && canonicalOperationalAreaId(areaId) === areaId) return
    map[areaId] = map[areaId] || []
    map[areaId].push(p)
  })

  getAssignmentsForDate().forEach((a) => {
    const employee = getEmployeeById(a.employeeId)
    if (!employee) return
    map[a.areaId] = map[a.areaId] || []
    if (!map[a.areaId].some((x) => x.id === employee.id)) {
      map[a.areaId].push({
        id: employee.id,
        name: employee.name,
        // photoUrl (2026-09-02): sin esto, cualquiera con una asignacion
        // REAL de hoy (el caso mas comun/visible, ej. Asistencia "Presente
        // hoy") perdia su foto real aunque `employee.photoUrl` si la
        // tuviera -- este objeto se construye aparte del snapshot de abajo
        // y por eso no la heredaba sola.
        photoUrl: employee.photoUrl || null,
        areaZona: null,
        rawZona: null,
        asistencia: null,
      })
    }
  })

  return map
}

/* IDs de personal ubicado HOY unicamente por el snapshot historico
   (BASE), sin incluir a quien ya tiene una asignacion/movimiento REAL
   de hoy (checkInEmployee/moveEmployee). Existe para "Vaciar layout"
   (ClearLayoutPanel.jsx): ese boton promete suprimir la ubicacion
   HISTORICA, no borrar una asignacion real que un lider/supervisor
   acaba de hacer de verdad — bug real encontrado 2026-08-21 (produccion:
   se uso el boton y se suprimieron tambien asignaciones reales de ese
   dia, no solo el snapshot). getPeopleByArea() ya excluye estos mismos
   ids del snapshot (touchedToday/baselineSuppressed) por las mismas
   razones; esta funcion aisla SOLO esa parte para poder suprimirla sin
   tocar lo que ya es una asignacion real de hoy. */
export function getBaselineOnlyPeopleIds() {
  const touchedToday = new Set(getMovementsForDate().map((m) => m.employeeId))
  const baselineSuppressed = getBaselineSuppressed()
  const protectedAreas = new Set(PROTECTED_FROM_LAYOUT_CLEAR_AREAS)
  const ids = []
  REAL_PERSONNEL_SNAPSHOT.forEach((p) => {
    if (touchedToday.has(p.id) || baselineSuppressed.has(p.id)) return
    const areaId = mapAreaZonaToId(p.areaZona)
    if (!areaId || protectedAreas.has(areaId)) return
    ids.push(p.id)
  })
  return ids
}

/* Inverso exacto de getBaselineOnlyPeopleIds — quien HOY esta suprimido
   (por "Vaciar layout") pero su zona historica de BASE es una CT LINEA (o
   "PRODUCCION" generico, mismo alcance que suppressBaselinePlacement/
   suppress-baseline.js). Para "Restaurar layout de las CT LINEA"
   (RestoreLayoutPanel.jsx): estos son exactamente a quienes hay que
   quitarles la supresion para que vuelvan a aparecer por snapshot. */
export function getSuppressedLinePeopleIds() {
  const baselineSuppressed = getBaselineSuppressed()
  const protectedAreas = new Set(PROTECTED_FROM_LAYOUT_CLEAR_AREAS)
  const ids = []
  REAL_PERSONNEL_SNAPSHOT.forEach((p) => {
    if (!baselineSuppressed.has(p.id)) return
    const areaId = mapAreaZonaToId(p.areaZona)
    if (!areaId || protectedAreas.has(areaId)) return
    ids.push(p.id)
  })
  return ids
}

/* Pase de lista "efectivo" de HOY — para la pestaña Personal del
   Centro de Trabajo. A peticion del usuario (2026-08-20), esta
   tabla ya NO exige que alguien registre manualmente a cada
   persona: parte de getPeopleByArea() (mismo calculo que ya usa el
   layout) y solo LLENA el hueco de quien todavia no tiene una fila
   de asignacion real hoy, sin pisarla si ya existe (checkInEmployee/
   moveEmployee siguen siendo la fuente de verdad en cuanto alguien
   se registra o se mueve de verdad).

   Para no inventar datos que no tenemos: una fila "por snapshot"
   nunca lleva hora de entrada ni turno (esos campos quedan null; la
   UI los muestra como "—", nunca una hora inventada), y en Linea 1..10
   (hasLineStations) tampoco lleva una estacion especifica (Montaje/
   Prueba electrica/etc. — BASE no dice quien hace que puesto) — solo
   en areas WORK_AREA/SUPPORT_AREA se usa el puesto generico real que
   workstations.js ya define para ese area (nunca uno de linea).

   Esta funcion NO se usa para exportar a Excel (excelExport.js sigue
   usando getTodayRoster() de repository.js, que refleja SOLO
   check-ins/movimientos reales — el pase de lista exportable debe
   seguir siendo evidencia real, no una fila sintetica). */
export function getEffectiveTodayRoster() {
  const employeesById = new Map(getAllEmployees().map((e) => [e.id, e]))

  const real = getAssignmentsForDate().map((a) => ({
    ...a,
    employee: employeesById.get(a.employeeId) || null,
    source: 'REGISTRO',
  }))
  const realIds = new Set(real.map((r) => r.employeeId))

  const byArea = getPeopleByArea()
  const synthetic = []
  Object.keys(byArea).forEach((areaId) => {
    byArea[areaId].forEach((p) => {
      if (realIds.has(p.id)) return
      const employee = employeesById.get(p.id) || null
      synthetic.push({
        id: `snapshot-${p.id}`,
        employeeId: p.id,
        employeeNumber: employee?.employeeNumber || i18n.t('dataLayer:personnelByArea.pending'),
        employee,
        areaId,
        // 2026-08-26: WC Midea/High Value (LINE_LIKE) tampoco lleva estacion
        // especifica desde snapshot -- igual que Linea 1..10, BASE no dice en
        // que "Puesto N" estaba cada quien.
        stationId:
          hasLineStations(areaId) || LINE_LIKE_AREA_IDS.has(areaId)
            ? null
            : workCenterById(areaId)?.name || areaId,
        checkInAt: null,
        shift: null,
        date: todayISO(),
        source: 'SNAPSHOT',
      })
    })
  })

  return [...real, ...synthetic].sort((a, b) =>
    (a.checkInAt || '') > (b.checkInAt || '') ? -1 : 1,
  )
}

/* 2026-08-28 ("CORRECCIÓN DE PUESTOS Y ESTACIONES OPERATIVAS", a peticion
   explicita del usuario): "PERSONAL SIN ESTACIÓN" -- gente que ya cuenta
   como asignada a esta WC (misma fuente que la tabla "Personal asignado
   hoy", getEffectiveTodayRoster) pero cuyo stationId real ya NO coincide
   con ninguna estacion activa actual (porque esa estacion se elimino/
   renombro por una correccion de configuracion, ej. "Montaje 2" o "Team
   Leader" dejaron de existir) -- o que nunca tuvo estacion (snapshot sin
   reconciliar). Es 100% DERIVADO: nunca escribe/mueve/borra ninguna
   asignacion real, EmployeeMovement o DailyAssignment -- solo compara el
   `stationId` que YA tiene guardado contra la lista de nombres de
   estacion REALES de hoy. El dia que alguien de esta lista se reasigne
   por el flujo normal (StationAssignDialog/mover), su stationId cambia y
   deja de aparecer aqui solo, sin ningun codigo especial. */
export function getPeopleWithoutStation(memberIds, workstations) {
  const stationNames = new Set((workstations || []).map((w) => w.name))
  return getEffectiveTodayRoster()
    .filter((r) => memberIds.includes(r.areaId))
    .filter((r) => !r.stationId || !stationNames.has(r.stationId))
}

/* "Personal sin area asignada" (Centro de Trabajo) y "Personal disponible"
   (WC LINEA/areas operativas) son -- 2026-08-28, BUG REAL encontrado y
   corregido a peticion explicita del usuario -- EXACTAMENTE el mismo
   conjunto: misma fuente (getAvailablePersonnelToday, mas abajo), activo +
   no baja + elegible + sin ubicacion real hoy en ninguna area. Antes esta
   funcion calculaba algo completamente distinto por su cuenta -- solo el
   snapshot HISTORICO de BASE (sin zona, o con una zona que no mapea a
   ningun WORK_CENTER real), sin mirar NUNCA las asignaciones reales de hoy
   ni el estado BAJA -- eso producia numeros desincronizados entre las dos
   vistas (31 vs 1, reportado por el usuario) porque eran dos preguntas de
   negocio distintas disfrazadas de la misma card. Ahora es un simple
   envoltorio: llama a getAvailablePersonnelToday() (unica fuente de
   verdad) y le pega encima `areaZona`/`rawZona`/`asistencia` del snapshot
   SOLO para el tag "Chofer"/"Producción" que ya mostraba
   UnassignedPersonnelCard.jsx -- eso nunca decide quien entra o no en la
   lista, solo como se etiqueta visualmente a quien ya calificó. */
export function getPeopleWithoutArea() {
  const snapshotById = new Map(REAL_PERSONNEL_SNAPSHOT.map((p) => [p.id, p]))
  return getAvailablePersonnelToday().map((e) => {
    const snap = snapshotById.get(e.id)
    return {
      ...e,
      areaZona: snap?.areaZona ?? null,
      rawZona: snap?.rawZona ?? null,
      asistencia: snap?.asistencia ?? null,
    }
  })
}

/* Donde aparece HOY una persona (efectivo: snapshot o vivo, lo
   mismo que ve el layout) — para mostrarlo en el buscador aunque
   nunca haya sido "tocada" via check-in/drag (p. ej. alguien del
   snapshot de Calidad que todavia nadie movio hoy). null si no
   aparece en ninguna area. */
export function getEffectiveAreaForEmployee(employeeId) {
  const byArea = getPeopleByArea()
  for (const areaId of Object.keys(byArea)) {
    if (byArea[areaId].some((p) => p.id === employeeId)) return areaId
  }
  return null
}

/* Personal disponible para asignar (fuente del drag & drop): toda
   persona ELEGIBLE (getAssignableEmployees — activa, no baja) que
   HOY no tiene ubicacion efectiva en ninguna area (nunca tuvo zona,
   o fue liberada hoy). Calculado, nunca listado a mano. Si el
   resultado es 0 es correcto: significa que todo el personal
   elegible ya esta ubicado en alguna area hoy. */
export function getAvailablePersonnelToday() {
  const placedIds = new Set(
    Object.values(getPeopleByArea())
      .flat()
      .map((p) => p.id),
  )
  return getAssignableEmployees().filter((e) => !placedIds.has(e.id))
}

/* Indicador honesto de "Area operando" del layout — true si hay al
   menos una persona real ubicada en alguna zona hoy (derivado del
   snapshot, no un booleano inventado). */
export function hasAnyPersonnelToday() {
  return Object.keys(getPeopleByArea()).length > 0
}

/* Conteo centralizado por area — una sola fuente para layout del
   Dashboard, Centro de Trabajo y "Resumen por area", asi si cambia
   la fuente (BASE -> asignacion real) solo cambia aqui. */
export function getAreaHeadcount(areaId) {
  return getPeopleByArea()[areaId]?.length || 0
}

/* Ideal (plantilla oficial, catalog.js) vs Real (SIEMPRE calculado
   aqui desde el personal real, nunca guardado a mano) — nunca se
   duplica manualmente el valor "real": si cambia la fuente de datos,
   este numero cambia solo. Si el area no tiene plantilla oficial
   definida (ideal null), no se inventa una — status queda
   'SIN_PLANTILLA' y la UI debe mostrar "Sin plantilla definida". */
export function getAreaStaffing(areaId) {
  const wc = workCenterById(areaId)
  const real = getAreaHeadcount(areaId)
  const ideal = wc?.idealHeadcount ?? null
  if (ideal == null) return { ideal: null, real, diff: null, status: 'SIN_PLANTILLA' }
  return { ideal, real, diff: real - ideal, status: real >= ideal ? 'COMPLETA' : 'FALTAN' }
}

/* Total general de plantilla — suma SOLO sobre areas con ideal
   oficial definido (asi el total coincide exactamente con la tabla
   IDEAL/REAL/DIFERENCIA proporcionada, sin mezclar areas sin
   plantilla como Calidad). */
export function getStaffingTotals() {
  // BUG REAL detectado en produccion 2026-08-24: realTotal solo sumaba areas CON idealHeadcount
  // definido, asi que Calidad/Insumos/Suministro de material (idealHeadcount null -- nunca tuvieron
  // meta numerica en el Excel origen) quedaban fuera del "personal presente hoy" del Dashboard aunque
  // tuvieran gente real. idealTotal SI debe restringirse a areas con meta (no tiene sentido sumar
  // null), pero realTotal debe contar a TODOS, tengan meta o no.
  //
  // 2026-08-26 ("Reestructuracion operativa FFT"): `eligible` excluye SOLO
  // areas `active:false` que ademas NO estan fusionadas en otra (su id
  // canonico es el mismo que el propio -- ej. SOPORTE, archivada de
  // verdad). BOX_PREP/SUMINISTRO_MATERIAL tambien son `active:false` pero
  // su id canonico es INSUMOS (fusionadas, no eliminadas) -- su personal
  // real sigue contando en el total, exactamente igual que antes de
  // archivarlas, solo que ahora conceptualmente pertenece a Insumos.
  //
  // 2026-09-04 (a peticion explicita del usuario, unifica el total general
  // en toda la app -- ver EXCLUDED_FROM_PLANT_TOTAL_AREA_IDS en catalog.js):
  // Calidad/Gerente FFT/Supervisor/Entrenador nunca cuentan aqui, mismo
  // criterio que "Resumen por area"/Asistencia/"Area operando".
  const eligible = WORK_CENTERS.filter(
    (w) =>
      (w.active !== false || canonicalOperationalAreaId(w.id) !== w.id) &&
      !EXCLUDED_FROM_PLANT_TOTAL_AREA_IDS.has(w.id),
  )
  const withIdeal = eligible.filter((w) => w.idealHeadcount != null)
  const idealTotal = withIdeal.reduce((sum, w) => sum + w.idealHeadcount, 0)
  const realTotal = eligible.reduce((sum, w) => sum + getAreaHeadcount(w.id), 0)
  return {
    idealTotal,
    realTotal,
    diff: realTotal - idealTotal,
    coveragePct: idealTotal > 0 ? Math.round((realTotal / idealTotal) * 1000) / 10 : null,
  }
}

/* Todas las personas de las 10 lineas de FFT juntas, con la linea
   de cada quien anotada (para el panel agregado de FFT). */
export function getFftPeopleWithLine() {
  const byArea = getPeopleByArea()
  return FFT_LINE_IDS.flatMap((lineId) => {
    const line = workCenterById(lineId)
    return (byArea[lineId] || []).map((p) => ({ ...p, lineId, lineName: line?.name || lineId }))
  })
}

/* Resumen por area para las cards de "Resumen por area" — FFT se
   trata como un solo bloque (suma de sus 10 lineas), el resto de
   las areas del catalogo van una por una. Ordenado por personal
   descendente; las areas en 0 se conservan (no se ocultan del
   todo) para que "ver todas" pueda mostrarlas. */
/* Clasificacion de 4 estados (2026-08-25, para OperationalAreaDetail.jsx
   -- ver catalog.js/usesOperationalDetail) -- misma regla que ya usaba
   OperatingFloorPlan.jsx (documentada ahi como "puramente de
   presentacion"), ahora centralizada aqui para no crear una tercera
   copia. OperatingFloorPlan.jsx NO se toco (fuera de alcance de este
   pedido, es parte del "layout general" que el usuario pidio no tocar)
   -- sigue con su propia copia identica, sin romper nada. */
/* Funcion (nunca objeto estatico): el label debe resolverse fresco en
   cada llamada via i18n.t(), nunca congelarse en el idioma que estaba
   activo cuando el modulo se importo -- ver HARD RULE de i18n en
   src/i18n.js. Todo consumidor debe llamar getAreaStatusMeta() de nuevo
   en vez de guardar el resultado como constante. */
export function getAreaStatusMeta() {
  return {
    COMPLETA: {
      key: 'COMPLETA',
      color: '#10B981',
      label: i18n.t('dataLayer:personnelByArea.complete'),
    },
    PARCIAL: {
      key: 'PARCIAL',
      color: '#3B82F6',
      label: i18n.t('dataLayer:personnelByArea.partial'),
    },
    FALTA: {
      key: 'FALTA',
      color: '#EF4444',
      label: i18n.t('dataLayer:personnelByArea.missingStaff'),
    },
    SIN_PERSONAL: {
      key: 'SIN_PERSONAL',
      color: '#94A3B8',
      label: i18n.t('dataLayer:personnelByArea.noStaff'),
    },
  }
}

export function classifyAreaStatus(real, ideal) {
  if (ideal == null) return null
  if (real <= 0) return 'SIN_PERSONAL'
  if (real >= ideal) return 'COMPLETA'
  if (real >= ideal - 1 || real / ideal >= 0.75) return 'PARCIAL'
  return 'FALTA'
}

/* Real/ideal/personal COMBINADOS de varias areas reales que comparten un
   mismo detalle visual (2026-08-25, ver catalog.js/AREA_DETAIL_GROUPS --
   hoy: CT Sellado dentro de CT Conveyor Principal, a peticion explicita
   del usuario). Mismo patron que ya usaba InsumosSuministroZone en
   OperatingFloorPlan.jsx, generalizado para reutilizarse tambien en
   OperationalAreaDetail.jsx. ideal se suma solo entre las areas que SI
   tienen plantilla oficial; si ninguna la tiene, ideal queda null (nunca
   se inventa una meta). */
export function getGroupAreaStaffing(memberIds) {
  let real = 0
  let idealSum = 0
  let hasIdeal = false
  memberIds.forEach((id) => {
    const s = getAreaStaffing(id)
    real += s.real
    if (s.ideal != null) {
      idealSum += s.ideal
      hasIdeal = true
    }
  })
  const ideal = hasIdeal ? idealSum : null
  if (ideal == null) return { ideal: null, real, diff: null, status: 'SIN_PLANTILLA' }
  return { ideal, real, diff: real - ideal, status: real >= ideal ? 'COMPLETA' : 'FALTAN' }
}

export function getGroupPeople(memberIds) {
  const byArea = getPeopleByArea()
  return memberIds.flatMap((id) => byArea[id] || [])
}

/* Codigo crudo de ACTIVIDAD (columna real de LAYOUT FFT.xlsx, hoja BASE)
   para un empleado especifico -- unica fuente real de "tipo de puesto"
   que existe hoy (SEED_SKILLS esta vacio, ver skills.js: "las
   habilidades reales se registran manualmente o vendran de la
   importacion... en Etapa 2", todavia no ocurrio). SIN interpretar
   significado (mismo criterio que el resto del snapshot): "L", "SA",
   "PC", etc. se muestran tal cual, nunca traducidos a un nombre de rol
   inventado. null para quien no viene de BASE (personal "sem34-N" o
   asignado/movido despues via la app, que no trae esta columna). */
export function getActividadForEmployee(employeeId) {
  return REAL_PERSONNEL_SNAPSHOT.find((p) => p.id === employeeId)?.actividad || null
}

/* 2026-08-26 ("Reestructuracion operativa FFT"): ahora es "group-aware" y
   respeta `active` -- una sola fila por grupo de detalle fusionado (ej.
   INSUMOS suma BOX_PREP+SUMINISTRO_MATERIAL+INSUMOS, misma fuente que
   OperationalAreaDetail.jsx/getGroupAreaStaffing, nunca dos numeros
   distintos para lo mismo), y las areas archivadas sin fusion (SOPORTE)
   ya no aparecen como fila propia. Los miembros NO canonicos de un grupo
   (SELLADO, BOX_PREP, SUMINISTRO_MATERIAL) se saltan -- su personal ya se
   sumo en la fila de su id canonico.

   2026-08-30 (a peticion explicita del usuario): PROYECTO (kind:'area',
   no 'linea') ahora forma parte de FFT_LINE_IDS (ver floorPlanZones.js/
   layoutZones.js) -- se excluye aqui del loop generico de areas via
   `!FFT_LINE_IDS.includes(w.id)` (no se hardcodea 'PROYECTO': cualquier
   area que en el futuro se agregue a FFT_LINE_IDS queda excluida igual,
   sin tocar esta funcion de nuevo) para que no aparezca como fila propia
   Y absorbida dentro de "FFT" al mismo tiempo. */
// Areas excluidas de "Resumen por area" -- originalmente solo CALIDAD/ENTRENADOR (2026-09-03,
// "te dije desde hace mucho que elimines WC CALIDAD y ENTRENADOR": ninguna de las 2 tiene
// headcount real propio en el modelo canonico por area, el personal de Calidad vive fisicamente
// en lineas/Paletizado y ENTRENADOR nunca ha tenido a nadie asignado -- ambas solo aparecian aqui
// como tarjeta fantasma en 0 con "Sin plantilla"). 2026-09-04: se unifica con
// EXCLUDED_FROM_PLANT_TOTAL_AREA_IDS (catalog.js, agrega GERENTE/SUPERVISOR) -- mismo criterio
// de "no cuenta en el total general" en toda la app, ver ese comentario para el detalle completo.

/* Cuenta real para areas cuyo personal NO vive bajo su propio areaId sino dentro de otra area,
   filtrado por rol (2026-09-03, corrige bug real: "WC CONVEYOR GENERAL hay dos personas no se
   por que dice 0"). Mismo mecanismo/fuente que ya usa ConveyorGeneralBar
   (OperatingFloorPlan.jsx) para PINTAR esos 2 puestos -- AREA_STATION_SOURCE_OVERRIDE
   (catalog.js): los 2 "Ayudante General de Conveyor" viven de verdad en WC Paletizado, esto solo
   los cuenta desde ahi en vez de buscarlos (en vano) bajo areaId=CONVEYOR_PRINCIPAL. */
function countByStationSourceOverride({ sourceAreaId, roles }) {
  const roleStationNames = new Set(
    getWorkstationsForLine(sourceAreaId)
      .filter((w) => roles.includes(w.role))
      .map((w) => w.name),
  )
  return getAssignmentsForArea(sourceAreaId).filter((a) => roleStationNames.has(a.stationId)).length
}

export function getAllAreaSummaries() {
  const byArea = getPeopleByArea()
  const fftCount = FFT_LINE_IDS.reduce((sum, id) => sum + (byArea[id]?.length || 0), 0)
  const fftIdeal = FFT_LINE_IDS.reduce(
    (sum, id) => sum + (workCenterById(id)?.idealHeadcount || 0),
    0,
  )
  const entries = [
    {
      id: 'FFT',
      name: 'FFT',
      count: fftCount,
      ideal: fftIdeal,
      group: colorGroupForArea('LINEA1'),
    },
    ...WORK_CENTERS.filter(
      (w) =>
        w.kind === 'area' &&
        w.active !== false &&
        !FFT_LINE_IDS.includes(w.id) &&
        canonicalOperationalAreaId(w.id) === w.id &&
        !EXCLUDED_FROM_PLANT_TOTAL_AREA_IDS.has(w.id),
    ).map((w) => {
      const override = AREA_STATION_SOURCE_OVERRIDE[w.id]
      const count = override
        ? countByStationSourceOverride(override)
        : operationalGroupMembers(w.id).reduce((sum, id) => sum + (byArea[id]?.length || 0), 0)
      return {
        id: w.id,
        name: w.name,
        count,
        ideal: w.idealHeadcount ?? null,
        group: colorGroupForArea(w.id),
      }
    }),
  ]
  return entries.sort((a, b) => b.count - a.count)
}
