/* ─────────────────────────────────────────────
   Catalogo central de Areas de Trabajo para el modulo
   Control de Produccion.

   La mayoria de estas areas vienen directamente de la hoja LAYOUT del
   archivo real LAYOUT FFT.xlsx (tabla resumen AREA/IDEAL/REAL,
   columnas AV:AY) — no son inventadas. BOX_PREP (ver nota mas abajo) viene
   de otra fuente real distinta: el campo `areaZona` a nivel empleado en
   realPersonnelSnapshot.js. `isProduction` distingue las lineas/areas que
   producen piezas de las areas de soporte, liderazgo y capacitacion que
   tambien aparecen ahi (el Excel mezcla ambos tipos en la misma tabla, sin
   marcarlos, asi que la clasificacion aqui es nuestra lectura de esa tabla).

   `dailyTarget` se deja en null a proposito: este Excel es de
   PERSONAL, no trae metas de produccion reales, y no vamos a
   inventar una meta. El dia que exista una fuente real de
   produccion, se llena desde ahi.

   CAJAS se quito de aqui el 2026-08-21 y quedo asi hasta el 2026-08-25,
   cuando el usuario aclaro que esa zona es realmente "Box Prep" -- ver
   WORK_CENTER 'BOX_PREP' mas abajo y mapAreaZonaToId (personnelByArea.js)
   para el mapeo real (y que "Box Prep" es la MISMA caja que ya existia
   junto a "PNP/POC/PEN" en el plano 2D -- no una segunda). INGENIERIA se
   cuenta como SUPERVISOR (sin WORK_CENTER propio). CHOFER/PRODUCCION
   (2026-08-25, correccion explicita del usuario: NO merecen su propia area
   -- son gente real de linea sin linea especifica conocida) NO tienen
   WORK_CENTER propio; se muestran en "Personal sin area asignada"
   (getPeopleWithoutArea, personnelByArea.js) con su zona cruda como
   etiqueta para poder identificarlos, en vez de un bloque nuevo. Ninguna de
   estas migraciones borro a nadie del snapshot real, solo cambio si
   aparecen agrupados en un bloque visual.
   ───────────────────────────────────────────── */

// i18n (2026-08-29, migracion de catalog.js) -- import directo de la
// instancia i18next (no el hook useTranslation, este archivo no es un
// componente React) para poder resolver texto visible EN EL MOMENTO en
// que se llama una funcion/getter, nunca al cargar este modulo. Ver la
// nota larga junto a WORK_CENTERS mas abajo: el array en si sigue siendo
// un literal estatico con su `name` ORIGINAL en español -- ese literal
// alimenta directamente logica real (workstations.js usa wc.name como
// stationId/role persistido, ver buildWorkstations) y NUNCA se traduce.
// Solo las funciones/getters que exponen texto para MOSTRAR (nunca para
// comparar/guardar) resuelven vía i18n.t() en el momento de la llamada.
import i18n from '../../i18n'

export const SHIFT_OPTIONS = ['Matutino', 'Vespertino', 'Nocturno']

export const CURRENT_SHIFT = 'Matutino'

/* Ventana horaria del turno Matutino, usada para la
   grafica de produccion por hora (cuando exista fuente real). */
export const SHIFT_HOURS = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00']

/* Los 3 turnos oficiales reales del sistema (2026-08-26, a peticion
   explicita del usuario), con su ventana horaria real -- DISTINTO de
   SHIFT_HOURS de arriba (esa es solo el eje de una grafica, nunca
   represento el horario real de un turno). Se usa hoy para mostrar
   "Turno actual" con su horario real en CT LINEA; no reemplaza
   SHIFT_OPTIONS (los 3 nombres que ya usan los selects de
   Registrar/Autoasignar/Mover -- Matutino/Vespertino/Nocturno,
   fuera de alcance de este cambio, no se tocan para no invalidar
   turnos ya guardados). */
// `label` se queda literal en español a proposito (2026-08-29, migracion
// i18n): dashboardMetrics.js/getShiftDistribution compara este `label`
// EXACTO contra el `shift` real persistido en DailyAssignment (viene del
// vocabulario legacy de SHIFT_OPTIONS) -- es una clave de datos, no solo
// texto visible, igual que WORK_CENTERS.name mas abajo. `labelKey` es el
// identificador nuevo para traducir SOLO lo que se muestra (ver
// getCurrentShift/getShiftSchedule), sin tocar el valor comparado.
export const OFFICIAL_SHIFTS = [
  { id: 'MATUTINO', label: 'Matutino', labelKey: 'shiftMatutino', start: '07:00', end: '17:10' },
  {
    id: 'TIEMPO_EXTRA',
    label: 'Tiempo extra',
    labelKey: 'shiftTiempoExtra',
    start: '17:11',
    end: '22:00',
  },
  { id: 'NOCHE', label: 'Noche', labelKey: 'shiftNoche', start: '22:01', end: '07:00' },
]

/* Logica central reutilizable de "que turno es ahora" (2026-08-26, a
   peticion explicita del usuario -- antes cada vista improvisaba su
   propio calculo, y OperationalAreaDetail.jsx llego a mostrar el
   horario mezclando por error SHIFT_HOURS, el eje de una grafica, como
   si fuera el horario real de un turno: "07:00 - 14:00" en vez de
   "07:00 AM - 05:10 PM"). Limites exactos sobre OFFICIAL_SHIFTS,
   verificados con casos explicitos (ver scripts/verify-line-logic.mjs):
     06:59->Noche  07:00->Matutino  17:10->Matutino  17:11->Tiempo extra
     22:00->Tiempo extra  22:01->Noche  23:59->Noche  00:00->Noche
   Noche cruza medianoche, por eso NUNCA se implementa como
   "hora >= 22:01 && hora <= 07:00" (eso nunca es true) -- aqui es
   simplemente "todo lo que no cae en Matutino ni Tiempo extra".
   Nunca toca Attendance/checkInAt reales: esto solo decide que turno
   MOSTRAR ahora mismo, igual que ya hacia CT LINEA a mano. */
function minutesOfDay(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// Resuelve el `label` visible de un turno EN EL MOMENTO en que se llama
// (nunca al cargar el modulo) -- devuelve una copia (spread) para no
// mutar la entrada original de OFFICIAL_SHIFTS, que se queda intacta
// para que la comparacion `s.label === shiftIdOrLabel` de abajo y el
// match contra `shift` real en dashboardMetrics.js sigan funcionando
// contra el literal en español de siempre.
function resolveShiftDisplay(shift) {
  if (!shift) return shift
  return { ...shift, label: shift.labelKey ? i18n.t(`catalog:${shift.labelKey}`) : shift.label }
}

export function getShiftSchedule(shiftIdOrLabel) {
  const found =
    OFFICIAL_SHIFTS.find((s) => s.id === shiftIdOrLabel || s.label === shiftIdOrLabel) || null
  return resolveShiftDisplay(found)
}

export function getCurrentShift(date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes()
  const [matutino, tiempoExtra, noche] = OFFICIAL_SHIFTS
  if (minutes >= minutesOfDay(matutino.start) && minutes <= minutesOfDay(matutino.end))
    return resolveShiftDisplay(matutino)
  if (minutes >= minutesOfDay(tiempoExtra.start) && minutes <= minutesOfDay(tiempoExtra.end))
    return resolveShiftDisplay(tiempoExtra)
  return resolveShiftDisplay(noche)
}

export function formatShiftSchedule(shift) {
  if (!shift) return ''
  const to12 = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`
  }
  return `${to12(shift.start)} – ${to12(shift.end)}`
}

/* Takt Time (2026-09-02, a peticion explicita del usuario; corregido el
   mismo dia con la formula real que el usuario mando -- antes usaba la
   duracion completa del turno segun OFFICIAL_SHIFTS, que no es el
   tiempo REAL disponible): tiempo neto disponible = 8 h 40 min por
   turno (520 min = 31,200 segundos), IGUAL para Matutino y Noche --
   no se deriva de start/end de OFFICIAL_SHIFTS (eso incluye tiempo que
   no es neto). Meta REAL de piezas por turno (1500 Matutino/dia, 500
   Noche) -- Tiempo extra no tiene meta propia definida por el usuario,
   se deja sin calculo en vez de inventar un numero.
   Takt Time = tiempo neto disponible / demanda del turno:
     Dia:   31,200 / 1,500 = 20.8 s/pieza
     Noche: 31,200 /   500 = 62.4 s/pieza
   (verificado contra los numeros exactos que dio el usuario). Es SOLO
   el calculo teorico: el usuario confirmo explicitamente (pregunta
   directa) que la captura real de piezas producidas por linea/turno se
   agrega despues, cuando definan de donde sale ese dato -- nunca se
   inventa ni se estima aqui.

   2026-09-02, segunda correccion (a peticion explicita del usuario,
   reportando que Takt Time "desaparecia" en Tiempo Extra -- 17:11 a
   22:00): Tiempo Extra se considera parte del turno de dia ("va junto
   con el turno de dia los 1500", confirmado explicitamente) -- comparte
   la MISMA meta de 1500 piezas que Matutino, y por lo tanto el mismo
   Takt Time (20.8 s/pieza). No es un turno con meta propia distinta,
   es una extension del de dia.

   2026-09-03, tercera correccion (a peticion explicita del usuario,
   reportando el numero real: "una linea no puede sacar las 1500, es
   imposible"): 1500/500 SIEMPRE fueron la meta de TODA LA PLANTA junta
   (todas las lineas FFT sumadas) para ese turno, nunca la meta de una
   sola linea -- pero se estaba aplicando el numero completo a CADA
   linea por separado, como si cada una tuviera que sacar las 1500 ella
   sola. `getTaktTime` ahora recibe `activeLineCount` (cuantas de las 11
   lineas -- LINEA1..10 + PROYECTO/"WC LINEA 0", ver LINE_FAMILY_AREA_IDS
   -- tienen al menos una persona real asignada hoy, calculado por el
   caller vía getAreaHeadcount) y reparte la meta de planta entre ellas
   en partes iguales: meta POR LINEA = meta de planta / lineas activas
   hoy. Se ajusta solo cada dia segun cuantas lineas esten realmente
   trabajando -- nunca un numero fijo por linea que alguien tendria que
   mantener a mano. Si activeLineCount no se pasa (o es 0), se usa la
   meta de planta completa sin repartir, para no dividir entre cero ni
   romper a quien todavia no pasa este dato. */
export const TAKT_TARGET_PCS_BY_SHIFT = {
  MATUTINO: 1500,
  TIEMPO_EXTRA: 1500,
  NOCHE: 500,
}
const TAKT_NET_SHIFT_SECONDS = 8 * 3600 + 40 * 60 // 8 h 40 min netos, mismo valor para ambos turnos

export function getTaktTime(shift, activeLineCount) {
  if (!shift) return null
  const plantTargetPcs = TAKT_TARGET_PCS_BY_SHIFT[shift.id]
  if (!plantTargetPcs) return null
  const targetPcs = activeLineCount > 0 ? plantTargetPcs / activeLineCount : plantTargetPcs
  return {
    targetPcs,
    plantTargetPcs,
    activeLineCount: activeLineCount > 0 ? activeLineCount : null,
    durationSeconds: TAKT_NET_SHIFT_SECONDS,
    secondsPerUnit: TAKT_NET_SHIFT_SECONDS / targetPcs,
  }
}

/* Fecha operativa -- el turno Noche cruza medianoche, asi que entre
   00:00 y 06:59 la jornada que sigue activa empezo AYER (22:01 del dia
   anterior). NOTA (2026-08-26): no existe hoy ningun concepto de
   "fecha operativa" en la capa de datos -- todo el sistema usa el dia
   calendario simple (repository.js/todayISO -> dayjs().format('YYYY-MM-DD'))
   sin ajuste por turno. Esta funcion se agrega como utilidad adicional
   a peticion explicita del usuario, pero NO se conecta a todayISO() ni
   a ninguna logica existente de particionado por dia -- hacerlo seria
   rediseñar como se agrupan las asignaciones por fecha, fuera de
   alcance de esta correccion (solo pedida para mostrar turno/horario). */
export function getOperationalDate(date = new Date()) {
  const shift = getCurrentShift(date)
  const d = new Date(date)
  if (shift.id === 'NOCHE' && d.getHours() < 12) {
    d.setDate(d.getDate() - 1)
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/* Entrada por defecto cuando se coloca automaticamente en una
   estacion a alguien que ya esta en una CT LINEA por snapshot/estado
   actual pero sin hora real de entrada (ver repository.js/
   autoFillLineStations) -- nunca una hora inventada distinta. */
export const DEFAULT_LINE_ENTRY_TIME = '07:00'

/* AREA_TYPES — distincion conceptual explicita, para que la UI
   nunca vuelva a asumir "si es un area, entonces tiene estaciones
   de linea":

   PRODUCTION_LINE  -> Linea 1..10. Unicas que usan el template de
                       estaciones/puestos (Montaje, Prueba electrica,
                       Etiquetado, etc. — data/personnel/workstations.js).
   WORK_AREA        -> areas productivas/operativas con su propia
                       forma de trabajar (Paletizado, Accesorios,
                       Cajas, Midea/High Value, Conveyor, Sellado,
                       Insumos, Suministro de material, Linea de
                       proyecto, Calidad). NUNCA reciben el template
                       de estaciones de linea.
   SUPPORT_AREA     -> grupos/funciones de personal, no producen en
                       estaciones (Capacitacion, Team Leader,
                       Soporte, Limpieza, Gerente, Supervisor).

   `idealHeadcount` = plantilla oficial (tabla IDEAL/REAL/DIFERENCIA
   proporcionada). null cuando el area no tiene plantilla oficial
   definida todavia (p. ej. CALIDAD no aparece en esa tabla) — NUNCA
   se inventa un ideal. El "REAL" NUNCA se guarda aqui: siempre se
   calcula desde el personal real (personnelByArea.getAreaHeadcount),
   para no duplicar una fuente de verdad. */
export const AREA_TYPES = {
  PRODUCTION_LINE: 'PRODUCTION_LINE',
  WORK_AREA: 'WORK_AREA',
  SUPPORT_AREA: 'SUPPORT_AREA',
}

/* Plantillas de puesto por rol (2026-08-26, "Reestructuracion operativa
   FFT + puestos + plantillas", a peticion explicita del usuario) --
   UNICA fuente de verdad para cuantos puestos de cada rol tiene un area,
   consumida por workstations.js (genera los slots individuales reales,
   "Surtidor de Accesorios 1".."7", nunca un solo slot "x7") Y por el
   idealHeadcount de WORK_CENTERS mas abajo (nunca dos numeros que se
   puedan desincronizar -- Parte 39 del pedido). Contenido tal como lo
   especifico el usuario, no inventado: NUNCA agregar un rol que no
   este aqui, NUNCA inventar cantidades. */
export const CUSTOM_STATION_PLANS = {
  ACCESORIOS: [
    { role: 'Team Leader', count: 1 },
    { role: 'Operador de Compatibilidad', count: 1 },
    { role: 'Surtidor de Accesorios', count: 7 },
    { role: 'Controles', count: 2 },
    { role: 'Armar Bases', count: 2 },
    { role: 'Ayudante General Almacenista', count: 2 },
    { role: 'Ayudante General Recolectar Accesorios', count: 1 },
    { role: 'Tornillería', count: 1 },
    { role: 'Cables', count: 1 },
  ],
  PALETIZADO: [
    // Orden 2026-08-28 (a peticion explicita del usuario, "los de calidad deben
    // ir primero"): Calidad ENCABEZA la distribucion de Paletizado (igual que en
    // cada CT LINEA, ver workstations.js), seguido del Team Leader (lider) --
    // nunca al reves en las areas donde existe Calidad. Las 2 Ayudante General
    // Escaneador van justo despues del lider ("alado del lider", peticion
    // explicita) porque asi las pidio el usuario agrupadas visualmente. El resto
    // de roles conserva su orden relativo de siempre.
    //
    // Calidad ahora son 3 puestos (antes 2, "Calidad 1"/"Calidad 2" para
    // Beckham/Patricia): el usuario confirmo que hay una 3a persona de Calidad
    // en Paletizado todavia sin registrar en el sistema -- el puesto "Calidad 3"
    // se agrega ya (disponible, sin ocupante) para que el usuario la registre
    // el la misma app cuando la tenga a la mano.
    { role: 'Calidad', count: 3 },
    { role: 'Team Leader', count: 1 },
    { role: 'Ayudante General Escaneador', count: 2 },
    { role: 'Operador de Flejadora', count: 1 },
    // 2026-08-28 ("ajustes controlados", a peticion explicita del usuario --
    // "WC Conveyor General SOLO TIENE 2 PERSONAS... pertenecen operativamente
    // a Paletizado"): antes habia 4 puestos de conveyor aqui mismo ("Conveyor"
    // x2 + "Ayudante General Conveyor" x2), ADEMAS de otra WORK_AREA
    // independiente "WC Conveyor General" (CONVEYOR_PRINCIPAL) con sus
    // propios 4 "Puesto N" -- hasta 4 personas reales distintas contadas
    // por separado. Se consolida en UN SOLO rol real de 2 posiciones,
    // "Ayudante General de Conveyor" (las que ya estaban con ese nombre casi
    // exacto se quedan -- Jose Sanchez sigue en la 1a, sin tocar su
    // asignacion). El rol "Conveyor" (2 posiciones, Roman/Jose Francisco
    // Franco Vara ocupandolas hoy) se elimina de aqui -- ver migracion real
    // en scripts/, quedan como "Personal sin estación" de Paletizado, nunca
    // borrados. CONVEYOR_PRINCIPAL como WORK_AREA independiente se archiva
    // (`active:false`, WORK_CENTERS mas abajo) y se fusiona en el grupo de
    // detalle de PALETIZADO (ver AREA_DETAIL_GROUPS) -- la card ancha "WC
    // Conveyor General" del plano fisico (OperatingFloorPlan.jsx) ahora lee
    // estas 2 posiciones directamente de aqui, nunca un conteo aparte.
    { role: 'Ayudante General de Conveyor', count: 2 },
    // 2026-09-01 (a peticion explicita del usuario): "seran 4 [puestos de
    // conveyor], dos en Conveyor General y dos en Paletizado" -- estos 2
    // puestos NUEVOS y vacios (confirmado explicitamente: sin relacion con
    // Roman/Jose Francisco Franco Vara, las 2 personas que quedaron sin
    // estacion en la consolidacion del 2026-08-28 de arriba) usan un
    // nombre de rol DISTINTO ("Ayudante General Conveyor General", sin
    // "de") para que AREA_STATION_SOURCE_OVERRIDE.CONVEYOR_PRINCIPAL
    // (filtra por role==='Ayudante General de Conveyor' exacto) nunca los
    // jale a la barra "WC CONVEYOR GENERAL" -- viven y se ven solo aqui,
    // dentro de Paletizado.
    { role: 'Ayudante General Conveyor General', count: 2 },
    // 7 (antes 4) -- 2026-08-27, a peticion explicita del usuario: Paletizado ya estaba a
    // plantilla completa (14/14) y necesitaba puesto real para Beckham y Patricia (reubicados
    // desde WC Calidad, +2). Al investigar se encontro ADEMAS a "Roman" (zona real PALETIZADO
    // desde el snapshot BASE, activo, jamas reconciliado a un puesto real porque el area ya
    // estaba llena) -- +1 mas para que tambien tenga puesto real, sin desplazar a nadie. Se
    // amplia el rol ya existente con mas representacion en el area en vez de inventar un rol
    // nuevo.
    { role: 'Ayudante General Paletizador', count: 7 },
    { role: 'Ayudante General Flejado', count: 2 },
  ],
  /* Insumos fusiona PNP/POC/PEN (decorativa, sin WORK_CENTER propio) +
     Box Prep + Suministro de material en un solo WC (ver
     AREA_DETAIL_GROUPS.INSUMOS mas abajo).

     2026-08-28 ("CORRECCIÓN DE PUESTOS Y ESTACIONES OPERATIVAS", a peticion
     explicita del usuario) -- dos correcciones sobre el plan anterior:
     - "Materia Prima / PNP" baja de 2 a 1 posicion (nunca hubo "PNP 1"/"PNP 2"
       como puestos separados de verdad, era un solo rol con count:2).
     - "Fusión / Burbuja / Bolsas" (antes un solo rol generico x2) se separa
       en 3 puestos reales individuales -- Dry Ice/Burbuja/Bolsas -- porque
       son 3 funciones distintas, no una sola repetida. "Dry Ice" es el
       nombre oficial pedido para lo que antes se mostraba como "Fusión"
       (hielo seco).
     Si alguien ya ocupaba la posicion 2 de Materia Prima/PNP o cualquier
     posicion de Fusión/Burbuja/Bolsas, su asignacion real NUNCA se toca --
     al ya no existir esa estacion en este plan, esa persona aparece sola en
     "Personal sin estación" (ver getPeopleWithoutStation,
     personnelByArea.js), nunca se borra ni se mueve.

     Investigado y confirmado con el usuario (2026-08-28): "Materialista"
     (3) y "Operador de Troqueladora" (1) NO se tocan -- no hay forma de
     determinar con certeza que sean las otras 2 funciones de un "Grupo A"
     de Ayudante General sin inventarlo, asi que se dejan exactamente como
     estaban hasta que el usuario confirme esa reclasificacion aparte.

     2026-08-28 ("ajustes controlados", segunda ronda, a peticion explicita
     del usuario): "Dry Ice" ya NO debe verse -- se renombra a "Protectores
     Espuma" (mismo puesto/posicion, cambio de nombre funcional puro; hoy
     sin ocupante real, cero riesgo de perder una asignacion). */
  INSUMOS: [
    { role: 'Team Leader', count: 1 },
    { role: 'Materialista', count: 3 },
    { role: 'Ayudante General — Materia Prima / PNP', count: 1 },
    { role: 'Operador de Troqueladora', count: 1 },
    { role: 'Ayudante General — Protectores Espuma', count: 1 },
    { role: 'Ayudante General — Burbuja', count: 1 },
    { role: 'Ayudante General — Bolsas', count: 1 },
  ],
}

function sumStationPlan(plan) {
  return plan.reduce((sum, r) => sum + r.count, 0)
}

/* Todos los nombres empiezan con "CT " (Centro de Trabajo), tal como
   en el plano fisico real del piso (pizarron, confirmado por el
   usuario 2026-08-19). Actualizacion 2026-08-24 (a peticion explicita
   del usuario): las lineas de produccion (y el CT 0/Proyecto, que se
   dibuja igual que una linea mas) ahora llevan la palabra "LINEA" —
   "CT LINEA 5", ya no "CT 5" — para distinguirlas del resto de areas
   (Calidad, Accesorios, Paletizado, etc.) que conservan su nombre tal
   cual. El `id` interno NO cambia (LINEA1, PROYECTO, etc.): eso
   evitaria tocar mapAreaZonaToId, hasLineStations, workstations.js y
   el snapshot de BASE sin necesidad — solo cambia el texto que se
   muestra. */
/* idealHeadcount de las 11 CT LINEA (LINEA1..10 + PROYECTO/LINEA0) incluye +1
   desde 2026-08-27 (a peticion explicita del usuario, "CAMBIO DEFINITIVO —
   PERSONAL + IDENTIDAD VISUAL"): cada linea gana un puesto real adicional de
   "Calidad" (ver ROLE_LABELS/buildWorkstations en workstations.js), fuera de
   los 5 roles base de siempre -- las posiciones Montaje/Prueba eléctrica/
   Limpieza/Etiquetado/Suministro de Accesorios y sus repeticiones NO
   cambian ni se reordenan (buildWorkstations resta 1 antes de calcular esas
   posiciones, ver la nota junto a LINE_FAMILY_AREA_IDS ahi). El numero base
   original de cada linea (antes de este cambio) queda documentado aqui: */
// 2026-08-28 ("ajustes controlados", a peticion explicita del usuario):
// Empaque se agrega como puesto REAL fijo adicional en cada CT LINEA
// (2 en LINEA0/1, 1 en LINEA2..10 -- ver EMPAQUE_COUNT_BY_LINE en
// workstations.js, misma logica de "resta antes del plan base" ya
// probada con Calidad). idealHeadcount sube ese numero en cada linea.
//
// 2026-08-28 (cuarta ronda, a peticion explicita del usuario -- "elimina
// Limpieza de TV 2 en LINEA1/6-10, y en LINEA0 elimina Montaje 3, Limpieza
// de TV 2 y Suministro de Accesorios [2]"): LINEA6-10 y PROYECTO quedaban
// con MAS de 1 posicion repetida (efecto colateral de la ronda anterior,
// que solo saco "Prueba eléctrica" del pool de repeticion sin bajar
// idealHeadcount). Se corrige bajando idealHeadcount para que el plan base
// (buildLineRolePlan, workstations.js) nunca vuelva a necesitar una 2a
// posicion repetida ahi:
// - LINEA6..10: 9 -> 8 (quedan identicas a LINEA2-5: plan base de 6
//   posiciones -- piso minimo real, ver nota de buildLineRolePlan -- solo
//   "Etiquetado" se repite una vez, "Limpieza de TV 2" desaparece).
// - PROYECTO/LINEA0: 13 -> 10 (plan base pasa de 10 a 7 posiciones: solo
//   "Montaje" y "Etiquetado" se repiten una vez cada uno -- "Montaje 3",
//   "Limpieza de TV 2" y "Suministro de Accesorios 2" desaparecen).
// - LINEA1: se quedo en 9 en esta ronda (a diferencia de las anteriores, su
//   plan base YA estaba en el piso minimo de 6 posiciones -- 5 roles + 1
//   repetido, inevitable por el piso "min 6 personas por linea" ya
//   confirmado -- asi que no tenia margen para bajar sin desincronizar
//   "Dotación ideal" contra la cantidad real de estaciones, el mismo bug
//   que este archivo evita en todas las demas lineas). Ademas, LINEA1
//   nunca tuvo "Limpieza de TV 2" -- su unica posicion repetida hoy es
//   "Suministro de Accesorios 2" (sin ocupante real, ver migracion
//   correspondiente) -- reportado explicitamente al usuario en vez de
//   adivinar un cambio.
//
// 2026-08-28 (quinta ronda, a peticion explicita del usuario -- "en WC
// LINEA 1 elimina Empaque 2"): LINEA1 SI baja ahora, 9 -> 8 -- no por el
// plan base (sigue igual, 1 posicion repetida por el piso minimo), sino
// porque EMPAQUE_COUNT_BY_LINE.LINEA1 baja de 2 a 1 (workstations.js),
// quedando igual que LINEA2..10 (1 solo Empaque).
// Nadie se pierde: quien ocupaba una de las posiciones eliminadas en
// LINEA6-10/PROYECTO aparece en "Personal sin estación"
// (getPeopleWithoutStation) sin que se toque su
// DailyAssignment/EmployeeMovement real.
//
// 2026-09-01 (a peticion explicita del usuario, "en WC LINEA 1 es de 10 y
// las mismas 10 puestos que tenemos [en WC LINEA 0]"): LINEA1 sube de 8 a
// 10 -- misma estructura exacta que PROYECTO/WC LINEA 0 (Montaje, Montaje
// 2, Prueba electrica, Limpieza de TV, Etiquetado, Suministro de
// Accesorios, Limpieza de caja, Empaque 1, Empaque 2, Calidad).
// EMPAQUE_COUNT_BY_LINE.LINEA1 sube de 1 a 2 y su repeatOrder cambia para
// que el unico puesto repetido del plan base sea "Montaje 2" (igual que
// PROYECTO), ver workstations.js.
export const WORK_CENTERS = [
  {
    id: 'LINEA1',
    name: 'WC LINEA 1',
    nameKey: 'wcLinea1',
    kind: 'linea',
    type: AREA_TYPES.PRODUCTION_LINE,
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: 10,
  }, // 1 Calidad + 6 plan base (5 roles + 1 repetido: Montaje 2) + 1 Limpieza de caja + 2 Empaque
  {
    id: 'LINEA2',
    name: 'WC LINEA 2',
    nameKey: 'wcLinea2',
    kind: 'linea',
    type: AREA_TYPES.PRODUCTION_LINE,
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: 8,
  }, // 6 + Calidad + 1 Empaque
  {
    id: 'LINEA3',
    name: 'WC LINEA 3',
    nameKey: 'wcLinea3',
    kind: 'linea',
    type: AREA_TYPES.PRODUCTION_LINE,
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: 8,
  }, // 6 + Calidad + 1 Empaque
  {
    id: 'LINEA4',
    name: 'WC LINEA 4',
    nameKey: 'wcLinea4',
    kind: 'linea',
    type: AREA_TYPES.PRODUCTION_LINE,
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: 8,
  }, // 6 + Calidad + 1 Empaque
  {
    id: 'LINEA5',
    name: 'WC LINEA 5',
    nameKey: 'wcLinea5',
    kind: 'linea',
    type: AREA_TYPES.PRODUCTION_LINE,
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: 8,
  }, // 6 + Calidad + 1 Empaque
  {
    id: 'LINEA6',
    name: 'WC LINEA 6',
    nameKey: 'wcLinea6',
    kind: 'linea',
    type: AREA_TYPES.PRODUCTION_LINE,
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: 8,
  }, // 6 + Calidad + 1 Empaque
  {
    id: 'LINEA7',
    name: 'WC LINEA 7',
    nameKey: 'wcLinea7',
    kind: 'linea',
    type: AREA_TYPES.PRODUCTION_LINE,
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: 8,
  }, // 6 + Calidad + 1 Empaque
  {
    id: 'LINEA8',
    name: 'WC LINEA 8',
    nameKey: 'wcLinea8',
    kind: 'linea',
    type: AREA_TYPES.PRODUCTION_LINE,
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: 8,
  }, // 6 + Calidad + 1 Empaque
  {
    id: 'LINEA9',
    name: 'WC LINEA 9',
    nameKey: 'wcLinea9',
    kind: 'linea',
    type: AREA_TYPES.PRODUCTION_LINE,
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: 8,
  }, // 6 + Calidad + 1 Empaque
  {
    id: 'LINEA10',
    name: 'WC LINEA 10',
    nameKey: 'wcLinea10',
    kind: 'linea',
    type: AREA_TYPES.PRODUCTION_LINE,
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: 8,
  }, // 6 + Calidad + 1 Empaque
  {
    id: 'PROYECTO',
    name: 'WC LINEA 0',
    nameKey: 'wcLinea0',
    kind: 'area',
    type: AREA_TYPES.WORK_AREA,
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: 10,
  }, // 7 + Calidad + 2 Empaque
  /* Paletizado/Accesorios (2026-08-26, a peticion explicita del usuario):
     idealHeadcount ya NO es un numero mantenido a mano -- se deriva de
     CUSTOM_STATION_PLANS de arriba (suma de puestos reales configurados),
     para que nunca existan dos numeros (Dashboard vs Detail) que se
     puedan desincronizar (Parte 39 del pedido, "una sola fuente"). */
  {
    id: 'PALETIZADO',
    name: 'WC Paletizado',
    nameKey: 'wcPaletizado',
    kind: 'area',
    type: AREA_TYPES.WORK_AREA,
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: sumStationPlan(CUSTOM_STATION_PLANS.PALETIZADO),
  },
  {
    id: 'ACCESORIOS',
    name: 'WC Accesorios',
    nameKey: 'wcAccesorios',
    kind: 'area',
    type: AREA_TYPES.WORK_AREA,
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: sumStationPlan(CUSTOM_STATION_PLANS.ACCESORIOS),
  },
  /* CONVEYOR se dividio en dos areas reales independientes (2026-08-25,
     a peticion explicita del usuario): el plano fisico (OperatingFloorPlan.jsx)
     dibuja "CONVEYOR PRINCIPAL"/"CONVEYOR SECUNDARIO" como dos barras
     separadas desde antes, pero solo existia UN area real 'CONVEYOR'
     en el catalogo -- no se podia asignar personal a cada una por
     separado. Ahora cada una es su propio WORK_CENTER (idealHeadcount
     1 cada una, igual que el 'CONVEYOR' original combinado en 1, pero
     ahora reflejando que son dos bandas fisicas reales). El id viejo
     'CONVEYOR' se quito del catalogo -- nadie tenia personal real ahi
     al momento del cambio (real=0), asi que no hubo que migrar ninguna
     asignacion existente. La zona fantasma "CT Conveyor" (singular) que
     seguia viviendo en layoutZones.js/WorkAreaMap.jsx apuntando al id viejo
     'CONVEYOR' se eliminó el 2026-08-25 (bug real reportado por el usuario:
     esa caja nunca podia recibir personal porque el area ya no existia) --
     ver layoutZones.js, PHYSICAL_ZONES ya no la incluye. */
  /* 2026-08-26: a peticion explicita del usuario, Principal y Secundario
     se FUSIONAN en un solo detalle "WC Conveyor General" (mismo patron ya
     probado con Sellado/Insumos, ver AREA_DETAIL_GROUPS mas abajo) -- el
     conveyor es fisicamente una sola estructura metalica continua para
     deslizar cajas, sin puestos fijos reales, asi que ya no tiene sentido
     tratarlos como dos plantillas independientes de 1 persona cada una.

     2026-08-28 ("Corregir diseño y estructura del Conveyor General"): el
     plano fisico dejo de dibujar dos barras separadas, paso a UNA sola
     "CONVEYOR GENERAL" ancha con 4 posiciones propias (idealHeadcount 4).

     2026-08-28 ("ajustes controlados", segunda ronda): "Conveyor General
     SOLO TIENE 2 PERSONAS... pertenecen operativamente a Paletizado".
     Investigado en vivo: existian 4 personas reales distintas ligadas a
     "conveyor" (1 en este WC independiente + 3 en
     CUSTOM_STATION_PLANS.PALETIZADO, que YA tenia sus propios puestos
     "Conveyor"/"Ayudante General Conveyor" desde antes) -- confirmado con
     el usuario: los 2 puestos reales y definitivos son "Ayudante General
     de Conveyor" DENTRO de Paletizado (ver CUSTOM_STATION_PLANS.PALETIZADO
     mas arriba). En esa ronda CONVEYOR_PRINCIPAL se archivo y se fusiono
     en el grupo de PALETIZADO (mismo canonico) -- efecto colateral NO
     deseado (reportado por el usuario, tercera ronda): el click en la
     card "CONVEYOR GENERAL" del plano fisico terminaba abriendo la
     pantalla COMPLETA de WC Paletizado (18 puestos), no una pantalla
     propia de Conveyor.

     2026-08-28 ("corrección navegación Conveyor General", tercera ronda,
     a peticion explicita del usuario -- CORRIGE el efecto colateral de
     arriba, NO la decision de fondo): CONVEYOR_PRINCIPAL vuelve a ser
     `active:true` y su PROPIO grupo canonico (ver AREA_DETAIL_GROUPS mas
     abajo, ya NO es miembro de PALETIZADO) -- asi tiene su propia parada
     de navegacion Anterior/Siguiente y su propia pantalla de detalle
     (AreaDetail.jsx sigue resolviendo LINE_LIKE igual que antes). PERO
     `idealHeadcount` se queda en `null` a proposito (nunca vuelve a sumar
     un numero aparte en getStaffingTotals/SHOWN_AREA_IDS -- ver
     personnelByArea.js/OperatingFloorPlan.jsx, evita el doble conteo que
     pidio evitar el usuario) y sus 2 puestos reales NO se generan aqui:
     siguen siendo, fisica y literalmente, los mismos 2 "Ayudante General
     de Conveyor" de CUSTOM_STATION_PLANS.PALETIZADO -- cero WorkArea
     nueva, cero DailyAssignment nuevo, "una sola fuente real de
     asignación" (peticion explicita). AREA_STATION_SOURCE_OVERRIDE (mas
     abajo) es lo que le dice a LineLikeAreaDetail.jsx que, al mostrar
     CONVEYOR_PRINCIPAL, lea (y escriba) esos 2 puestos DESDE Paletizado,
     filtrados por rol -- una VISTA, nunca una copia. WC Paletizado sigue
     mostrando esos mismos 2 puestos dentro de su propia distribucion
     completa exactamente igual que antes (sin cambio ahi). */
  {
    id: 'CONVEYOR_PRINCIPAL',
    name: 'WC Conveyor General',
    nameKey: 'wcConveyorGeneral',
    kind: 'area',
    type: AREA_TYPES.WORK_AREA,
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: null,
  },
  {
    id: 'CONVEYOR_SECUNDARIO',
    name: 'WC Conveyor Secundario',
    nameKey: 'wcConveyorSecundario',
    kind: 'area',
    type: AREA_TYPES.WORK_AREA,
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: null,
    active: false,
  },
  /* Midea/HV: en el plano fisico real (pizarron del piso, confirmado
     por el usuario 2026-08-19) son UN solo bloque "CT MIDEA/HV", no
     dos areas separadas. Se fusiona DMT dentro de HIGH_VALUE (ideal
     14+2=16, el total general de plantilla no cambia). Quien tenga
     zona "DMT" en el snapshot de BASE se sigue contando aqui (ver
     personnelByArea.mapAreaZonaToId). */
  {
    id: 'HIGH_VALUE',
    name: 'WC Midea / High Value',
    nameKey: 'wcMideaHighValue',
    kind: 'area',
    type: AREA_TYPES.WORK_AREA,
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: 16,
  },
  {
    id: 'CALIDAD',
    name: 'WC Calidad',
    nameKey: 'wcCalidad',
    kind: 'area',
    type: AREA_TYPES.WORK_AREA,
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: null,
  },
  {
    id: 'SELLADO',
    name: 'WC Sellado',
    nameKey: 'wcSellado',
    kind: 'area',
    type: AREA_TYPES.WORK_AREA,
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: null,
  },
  /* WC Insumos y Suministro de Material (2026-08-26, "Reestructuracion
     operativa FFT", a peticion explicita del usuario) -- fusion de PNP/POC/PEN
     (nunca tuvo WORK_CENTER propio, decoracion pura) + Box Prep + Insumos +
     Suministro de material en UN SOLO Work Center activo. idealHeadcount ya
     no es null: se deriva de CUSTOM_STATION_PLANS.INSUMOS (Team Leader,
     Materialista x3, Ayudante General Materia Prima x2, Operador de
     Troqueladora, Ayudante General Fusion/Burbuja/Bolsas x2 = 9), la primera
     plantilla oficial real de esta area. Este id (INSUMOS) es el CANONICO --
     ver AREA_DETAIL_GROUPS mas abajo: BOX_PREP y SUMINISTRO_MATERIAL siguen
     existiendo como entradas (nunca se borran, tienen WorkArea real en la
     DB con historial -- Parte 51 del pedido: "preferir isActive=false a
     DELETE") pero quedan `active:false` y su personal/plantilla se suma
     aqui via operationalGroupMembers, exactamente el mismo patron ya
     probado con SELLADO->CONVEYOR_PRINCIPAL. */
  {
    id: 'INSUMOS',
    name: 'WC Insumos y Suministro de Material',
    nameKey: 'wcInsumosSuministroMaterial',
    kind: 'area',
    type: AREA_TYPES.WORK_AREA,
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: sumStationPlan(CUSTOM_STATION_PLANS.INSUMOS),
  },
  {
    id: 'SUMINISTRO_MATERIAL',
    name: 'WC Suministro de material',
    nameKey: 'wcSuministroMaterial',
    kind: 'area',
    type: AREA_TYPES.WORK_AREA,
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: null,
    active: false,
  },
  /* BOX_PREP (2026-08-25): ver nota historica completa mas abajo en el
     comentario original -- 2026-08-26 se fusiono dentro de WC Insumos y
     Suministro de Material (ver AREA_DETAIL_GROUPS), `active:false` pero
     SIN borrar (tiene WorkArea real con historial en la DB). */
  {
    id: 'BOX_PREP',
    name: 'WC Box Prep',
    nameKey: 'wcBoxPrep',
    kind: 'area',
    type: AREA_TYPES.SUPPORT_AREA,
    isProduction: false,
    dailyTarget: null,
    idealHeadcount: null,
    active: false,
  },
  {
    id: 'CAPACITACION',
    name: 'WC Capacitación',
    nameKey: 'wcCapacitacion',
    kind: 'area',
    type: AREA_TYPES.SUPPORT_AREA,
    isProduction: false,
    dailyTarget: null,
    idealHeadcount: 2,
  },
  {
    id: 'TEAM_LEADER',
    name: 'WC Team Leader',
    nameKey: 'wcTeamLeader',
    kind: 'area',
    type: AREA_TYPES.SUPPORT_AREA,
    isProduction: false,
    dailyTarget: null,
    idealHeadcount: 2,
  },
  /* ENTRENADOR (2026-08-26, WC nuevo a peticion explicita del usuario) --
     personal de entrenamiento/capacitacion correspondiente. idealHeadcount
     null: el usuario no dio un numero de plantilla oficial para esta area
     (solo nombres de personas a resolver), nunca se inventa uno -- se
     muestra "Sin definir" en la UI (misma regla que Calidad/Sellado). */
  {
    id: 'ENTRENADOR',
    name: 'WC Entrenador',
    nameKey: 'wcEntrenador',
    kind: 'area',
    type: AREA_TYPES.SUPPORT_AREA,
    isProduction: false,
    dailyTarget: null,
    idealHeadcount: null,
  },
  /* SOPORTE (2026-08-26, a peticion explicita del usuario: "ELIMINAR WC
     SOPORTE" del esquema activo) -- `active:false`, NUNCA DELETE (tiene
     WorkArea real con historial/asignaciones en la DB -- Parte 21/51 del
     pedido: preservar DailyAssignment/EmployeeMovement/Attendance
     historicos, preferir archivar). Desaparece de layout/navegacion/
     Dashboard/conteos activos, pero el id sigue resolviendo (workCenterById)
     para cualquier referencia historica que lo necesite. */
  {
    id: 'SOPORTE',
    name: 'WC Soporte',
    nameKey: 'wcSoporte',
    kind: 'area',
    type: AREA_TYPES.SUPPORT_AREA,
    isProduction: false,
    dailyTarget: null,
    idealHeadcount: 3,
    active: false,
  },
  {
    id: 'LIMPIEZA',
    name: 'WC Limpieza',
    nameKey: 'wcLimpieza',
    kind: 'area',
    type: AREA_TYPES.SUPPORT_AREA,
    isProduction: false,
    dailyTarget: null,
    idealHeadcount: 2,
  },
  /* GERENTE (2026-08-26, a peticion explicita del usuario): solo cambia el
     `name` mostrado a "WC Gerente FFT" -- el id interno NO se toca (mismo
     criterio de siempre: renombrar visual nunca reescribe el id real).
     2026-08-28 (a peticion explicita del usuario): segundo rename visual,
     mismo criterio -- "WC Gerente FFT" -> "WC Coordinador de Almacén".
     2026-09-01 (a peticion explicita del usuario): tercer rename visual --
     "WC Coordinador de Almacén" -> "WC GERENTE DE FFT". El id interno
     GERENTE sigue igual en los 3 casos (historial/asignaciones intactos). */
  {
    id: 'GERENTE',
    name: 'WC GERENTE DE FFT',
    nameKey: 'wcCoordinadorAlmacen',
    kind: 'area',
    type: AREA_TYPES.SUPPORT_AREA,
    isProduction: false,
    dailyTarget: null,
    idealHeadcount: 1,
  },
  {
    id: 'SUPERVISOR',
    name: 'WC Supervisor',
    nameKey: 'wcSupervisor',
    kind: 'area',
    type: AREA_TYPES.SUPPORT_AREA,
    isProduction: false,
    dailyTarget: null,
    idealHeadcount: 1,
  },
]

/* `active` (2026-08-26, a peticion explicita del usuario -- "eliminar WC
   Soporte del esquema activo, preservando historial") -- un WORK_CENTER
   sin el campo `active` (la inmensa mayoria) se considera activo por
   omision; solo se marca `active:false` explicitamente en las entradas
   archivadas (hoy: SOPORTE, BOX_PREP, SUMINISTRO_MATERIAL). El id NUNCA
   se borra de WORK_CENTERS (workCenterById sigue resolviendolo para
   historial/auditoria) -- `active` solo controla si aparece en
   layout/navegacion/conteos/Dashboard. */
export function isWorkCenterActive(id) {
  return workCenterById(id)?.active !== false
}

export const LINES_ONLY = WORK_CENTERS.filter((w) => w.kind === 'linea')
export const PRODUCTION_CENTERS = WORK_CENTERS.filter((w) => w.isProduction && w.active !== false)
export const SUPPORT_CENTERS = WORK_CENTERS.filter((w) => !w.isProduction && w.active !== false)

/* Unica fuente de verdad de "esta area usa el template de
   estaciones de linea" — antes esto se asumia implicitamente para
   TODO WORK_CENTER (el bug conceptual reportado). */
export function hasLineStations(workCenterId) {
  return workCenterById(workCenterId)?.type === AREA_TYPES.PRODUCTION_LINE
}

/* Allowlist central de areas que usan el detalle operativo nuevo
   (OperationalAreaDetail.jsx, 2026-08-25, a peticion explicita del
   usuario) -- NUNCA se decide por nombre (`if (name === 'CT Accesorios')`),
   siempre por esta lista, calculada a partir de la clasificacion REAL
   que ya existe en WORK_CENTERS (type/kind), con tres excepciones
   explicitas documentadas por el propio usuario:

   - Se EXCLUYE 'PROYECTO' (CT LINEA 0) aunque su type sea WORK_AREA:
     el usuario listo explicitamente "CT LINEA 0" junto con LINEA1..10
     como fuera de alcance ("ya tienen un diseño especial diferente").
   - Se EXCLUYE 'BOX_PREP' pese a que antes tenia una excepcion explicita
     hacia OPERATIONAL: desde 2026-08-26 esta fusionada dentro de
     'INSUMOS' (ver AREA_DETAIL_GROUPS mas abajo) -- su membresia ya no
     hace falta aqui porque canonicalOperationalAreaId('BOX_PREP')
     resuelve a 'INSUMOS', que SI esta en esta lista. Ademas ahora es
     `active:false`.
   - Se EXCLUYE 'CALIDAD' aunque su type sea WORK_AREA (2026-08-26,
     REVERSION explicita del usuario sobre la decision anterior de este
     mismo archivo: "aunque el mockup use WC Calidad como referencia
     visual, la clasificacion real es SUPPORT -- forma parte de las 7
     cards inferiores que deben quedarse con su otra experiencia"). El
     `type`/`isProduction` de CALIDAD en WORK_CENTERS NO se toco (sigue
     reflejando su clasificacion real de produccion del Excel LAYOUT
     FFT.xlsx) -- esto es puramente una excepcion en QUE VISTA DE
     DETALLE usa. Ver SUPPORT_DETAIL_AREA_IDS mas abajo, donde CALIDAD
     se agrega de vuelta explicitamente.
   - Se EXCLUYE 'HIGH_VALUE' (2026-08-26, a peticion explicita del
     usuario: "WC Midea / High Value debe funcionar COMO UNA WC LINEA")
     -- deja de usar OperationalAreaDetail.jsx, pasa a la nueva variante
     LINE_LIKE (ver AREA_DETAIL_VARIANTS mas abajo), que reutiliza la
     experiencia de LineDetailDrawer.jsx sin ser clasificada como LINE
     real (no entra en LINE_FAMILY_AREA_IDS).

   El resto de type===WORK_AREA activo (Paletizado, Accesorios, Conveyor
   Principal/Secundario, Insumos y Suministro de Material) coincide 1:1
   con la lista que el usuario dio por nombre -- confirmado area por
   area, no asumido. Las SUPPORT_AREA restantes (Capacitacion, Team
   Leader, Entrenador, Soporte, Limpieza, Gerente FFT, Supervisor,
   Calidad) y todas las PRODUCTION_LINE quedan fuera, sin excepcion.
   Areas `active:false` (SOPORTE, BOX_PREP, SUMINISTRO_MATERIAL) tambien
   se filtran aqui -- SUMINISTRO_MATERIAL/BOX_PREP igual siguen
   accesibles vía su grupo canonico (INSUMOS).

   CT SELLADO (2026-08-25, correccion explicita del usuario): no tiene
   entrada propia -- "va en Conveyor Principal, ponlos ahi juntos". No
   aparece en ningun lado del plano/mapa (floorPlanZones.js/
   OperatingFloorPlan.jsx la excluyen explicitamente desde antes, a
   peticion tambien explicita del usuario), asi que su unica forma de
   detalle es fusionada dentro del detalle de CONVEYOR_PRINCIPAL -- ver
   AREA_DETAIL_GROUPS/canonicalOperationalAreaId mas abajo. */
// 2026-08-26 (segunda ronda, a peticion explicita del usuario: "copia el
// diseño de WC LINEA... quiero que pongas los puestos de trabajo" para
// las areas que ya tienen CUSTOM_STATION_PLANS) -- ACCESORIOS/PALETIZADO/
// INSUMOS se excluyen de OPERATIONAL igual que HIGH_VALUE: pasan a
// LINE_LIKE_AREA_IDS mas abajo, reutilizan LineDetailDrawer.jsx completo.
export const OPERATIONAL_DETAIL_AREA_IDS = new Set(
  WORK_CENTERS.filter(
    (w) =>
      w.type === AREA_TYPES.WORK_AREA &&
      w.active !== false &&
      ![
        'PROYECTO',
        'CALIDAD',
        'HIGH_VALUE',
        'BOX_PREP',
        'ACCESORIOS',
        'PALETIZADO',
        'INSUMOS',
        'CONVEYOR_PRINCIPAL',
      ].includes(w.id),
  ).map((w) => w.id),
)

/* Grupos de detalle fusionado: la clave es el id "canonico" (el que se
   muestra/al que se asignan movimientos nuevos), el arreglo son TODOS
   los WORK_CENTER reales cuyo personal/plantilla se suma en ese mismo
   detalle. INSUMOS (2026-08-26, "Reestructuracion operativa FFT",
   fusion PNP/POC/PEN + Box Prep + Insumos + Suministro de material en
   un solo WC -- ver Parte 4-6 del pedido) sigue exactamente el mismo
   patron ya probado con Sellado/Conveyor Principal: los ids fusionados
   (BOX_PREP, SUMINISTRO_MATERIAL) NUNCA se borran (tienen WorkArea real
   con historial), solo quedan `active:false` y su personal/plantilla se
   suma en el detalle de INSUMOS via operationalGroupMembers.

   2026-08-28 ("corrección navegación Conveyor General", tercera ronda, a
   peticion explicita del usuario -- REVIERTE el cambio anterior de esta
   misma tarea): CONVEYOR_PRINCIPAL vuelve a ser su PROPIO canonico
   (SELLADO/CONVEYOR_SECUNDARIO vuelven a fusionarse con el, no con
   PALETIZADO) para que tenga su propia parada de navegacion y su propia
   pantalla de detalle -- el usuario reporto que fusionarlo dentro de
   PALETIZADO hacia que el click en "CONVEYOR GENERAL" abriera por error
   la pantalla completa de Paletizado. Sus 2 puestos reales SIGUEN
   viviendo fisicamente en Paletizado (CUSTOM_STATION_PLANS.PALETIZADO,
   "Ayudante General de Conveyor") -- eso NO cambia, "una sola fuente real
   de asignación" sigue siendo Paletizado; ver AREA_STATION_SOURCE_OVERRIDE
   mas abajo, que es lo que le dice a LineLikeAreaDetail.jsx de donde leer
   esos 2 puestos cuando se muestra CONVEYOR_PRINCIPAL. */
export const AREA_DETAIL_GROUPS = {
  CONVEYOR_PRINCIPAL: ['CONVEYOR_PRINCIPAL', 'CONVEYOR_SECUNDARIO', 'SELLADO'],
  INSUMOS: ['INSUMOS', 'SUMINISTRO_MATERIAL', 'BOX_PREP'],
}

/* Id canonico de detalle para cualquier miembro de un grupo -- SELLADO
   siempre resuelve a CONVEYOR_PRINCIPAL, cualquier otro id se devuelve
   tal cual (no pertenece a ningun grupo). */
export function canonicalOperationalAreaId(workCenterId) {
  const entry = Object.entries(AREA_DETAIL_GROUPS).find(([, members]) =>
    members.includes(workCenterId),
  )
  return entry ? entry[0] : workCenterId
}

/* Todos los ids reales cuyo personal/plantilla debe sumarse para el
   detalle de `workCenterId` -- [workCenterId] solo si no pertenece a
   ningun grupo. */
export function operationalGroupMembers(workCenterId) {
  const canonical = canonicalOperationalAreaId(workCenterId)
  return AREA_DETAIL_GROUPS[canonical] || [canonical]
}

export function usesOperationalDetail(workCenterId) {
  return OPERATIONAL_DETAIL_AREA_IDS.has(canonicalOperationalAreaId(workCenterId))
}

/* "Vista filtrada sobre otra area real" (2026-08-28, "corrección
   navegación Conveyor General", a peticion explicita del usuario) --
   distinto de AREA_DETAIL_GROUPS (que SUMA la plantilla/personal de
   varias areas fusionadas en un area canonica comun). Aqui es lo
   contrario: `workCenterId` (ej. CONVEYOR_PRINCIPAL) sigue siendo su
   PROPIO canonico (su propia pantalla/parada de navegacion), pero sus
   puestos reales no viven en su propia WorkArea -- viven, literal y
   fisicamente, en `sourceAreaId`, filtrados por `roles`. LineLikeAreaDetail.jsx
   es el UNICO consumidor: cuando el area mostrada tiene una entrada aqui,
   lee (y escribe) los puestos reales usando `sourceAreaId` en vez de su
   propio id, filtra la lista a esos `roles`, y renumera el orden mostrado
   -- nunca crea una WorkArea/Workstation/DailyAssignment nueva. "Una sola
   fuente real de asignación" (peticion explicita del usuario): Paletizado
   sigue siendo la unica fuente para estos 2 puestos, Conveyor General es
   solo su propia VENTANA hacia ellos. */
export const AREA_STATION_SOURCE_OVERRIDE = {
  CONVEYOR_PRINCIPAL: { sourceAreaId: 'PALETIZADO', roles: ['Ayudante General de Conveyor'] },
}

/* Orden central de navegacion Anterior/Siguiente entre TODOS los Work
   Centers reales -- 2026-08-27, a peticion explicita del usuario. Unica
   fuente de verdad: las 3 familias de detalle (LineDetailDrawer/
   OperationalAreaDetail/SupportAreaDetail) consumen exclusivamente
   getWorkCenterNavContext() de abajo, nunca un if/else por componente.

   NO reordena WORK_CENTERS (ese array lo consumen otras vistas -- ej.
   "Resumen por area", EstacionesTab.jsx -- que dependen de su orden
   incidental actual; reordenarlo habria reorganizado esas vistas sin
   que el usuario lo pidiera, ver "NO reorganizar el mapa/layout
   general" en el pedido). Este es un array SEPARADO, de solo ids
   reales, exclusivo para navegacion -- una sola fuente de verdad para
   ESTE proposito, sin desincronizarse porque nunca se copian nombres/
   ids a mano en otro lado, solo se referencia WORK_CENTERS.

   SELLADO se excluye a proposito: no tiene detalle propio, cualquier
   click sobre ella resuelve a CONVEYOR_PRINCIPAL (AREA_DETAIL_GROUPS
   arriba) -- incluirla aqui crearia una parada duplicada/inalcanzable.
   CONVEYOR_SECUNDARIO se excluye por la misma razon -- ademas queda
   `active:false`, asi que el .filter final de abajo ya lo habria quitado
   igual (doble red de seguridad). CONVEYOR_PRINCIPAL (2026-08-28,
   "corrección navegación Conveyor General", tercera ronda) SI vuelve a
   estar aqui -- recupera su propia parada de navegacion Anterior/
   Siguiente (antes de HIGH_VALUE, misma posicion de siempre).
   "PNP / POC / PEN" tampoco tiene WORK_CENTER real (decoracion en
   floorPlanZones.js/REFERENCE_ONLY_ZONES) -- nunca se inventa un id
   para poder navegar a algo que no existe. "WC LINEA 11" no existe hoy
   en WORK_CENTERS (confirmado) -- si se agrega en el futuro con
   kind:'linea', LINES_ONLY la recoge sola (mismo patron que las demas
   lineas) y aparece aqui automaticamente, sin volver a tocar este
   archivo.

   2026-08-26 (Reestructuracion operativa FFT): BOX_PREP y
   SUMINISTRO_MATERIAL se quitan de aqui -- igual que SELLADO, ya no
   tienen detalle propio, resuelven a INSUMOS (AREA_DETAIL_GROUPS),
   incluirlos crearia paradas duplicadas. SOPORTE se quita -- archivada
   (`active:false`), ya no es una parada activa. ENTRENADOR se agrega --
   WC nuevo activo. El .filter final ahora es doble red de seguridad:
   nunca deberia quitar nada hoy salvo por accidente, pero TAMBIEN excluye
   defensivamente cualquier id que quede `active:false` en el futuro sin
   que alguien recuerde actualizar este array a mano. */
export const WORK_CENTER_NAVIGATION_ORDER = [
  'PROYECTO',
  ...LINES_ONLY.map((w) => w.id),
  'CONVEYOR_PRINCIPAL',
  'HIGH_VALUE',
  'PALETIZADO',
  'INSUMOS',
  'ACCESORIOS',
  'CALIDAD',
  'CAPACITACION',
  'TEAM_LEADER',
  'ENTRENADOR',
  'LIMPIEZA',
  'GERENTE',
  'SUPERVISOR',
].filter((id) => isWorkCenterActive(id) && WORK_CENTERS.some((w) => w.id === id))

/* previous/current/next dentro de WORK_CENTER_NAVIGATION_ORDER --
   navegacion LINEAL (nunca circular): en el primer elemento `previous`
   es null, en el ultimo `next` es null. `currentAreaId` se resuelve a
   su id canonico primero (ej. SELLADO -> CONVEYOR_PRINCIPAL) para que
   anterior/siguiente funcionen igual sin importar por cual id grupal
   se haya abierto el detalle. */
export function getWorkCenterNavContext(currentAreaId) {
  const canonicalId = currentAreaId ? canonicalOperationalAreaId(currentAreaId) : null
  const idx = canonicalId ? WORK_CENTER_NAVIGATION_ORDER.indexOf(canonicalId) : -1
  if (idx === -1) return { previous: null, current: null, next: null }
  return {
    previous: idx > 0 ? workCenterById(WORK_CENTER_NAVIGATION_ORDER[idx - 1]) : null,
    current: workCenterById(WORK_CENTER_NAVIGATION_ORDER[idx]),
    next:
      idx < WORK_CENTER_NAVIGATION_ORDER.length - 1
        ? workCenterById(WORK_CENTER_NAVIGATION_ORDER[idx + 1])
        : null,
  }
}

export function getPreviousWorkCenter(currentAreaId) {
  return getWorkCenterNavContext(currentAreaId).previous
}

export function getNextWorkCenter(currentAreaId) {
  return getWorkCenterNavContext(currentAreaId).next
}

/* ─────────────────────────────────────────────
   CUATRO familias de detalle de area (LINE_LIKE agregada 2026-08-26,
   "Reestructuracion operativa FFT", a peticion explicita del usuario)
   -- configuracion CENTRAL unica, para que ningun componente tenga que
   decidir "if (name === 'CT Capacitación')" por su cuenta:

   LINE         -> LINEA1..10 + PROYECTO (CT LINEA 0) -> LineDetailDrawer.jsx,
                   SIN CAMBIOS.
   LINE_LIKE    -> HIGH_VALUE (WC Midea / High Value) unicamente -- usa la
                   MISMA experiencia visual/funcional de LineDetailDrawer.jsx
                   (estaciones, vacantes, buscador, drag&drop, navegacion)
                   pero NUNCA se le llama "Línea" en la UI ni entra en
                   LINE_FAMILY_AREA_IDS/WORK_CENTERS.kind='linea' -- es una
                   categoria distinta a proposito (Parte 13-14/32 del
                   pedido: "ya no quiero esa logica generica [Operational],
                   pero su nombre sigue siendo WC Midea / High Value").
   OPERATIONAL  -> OPERATIONAL_DETAIL_AREA_IDS (resto de areas WORK_AREA
                   activas sin logica propia) -> OperationalAreaDetail.jsx.
   SUPPORT      -> el resto: Capacitacion, Team Leader, Entrenador, Soporte
                   (archivada pero sigue resolviendo aqui por si alguien
                   navega a su id historico), Limpieza, Gerente FFT,
                   Supervisor, Calidad -> SupportAreaDetail.jsx.

   Las cuatro listas se derivan de WORK_CENTERS sin overlap: cada
   WORK_CENTER real cae en exactamente una. NO se decide por nombre en
   ningun momento -- ver getAreaDetailVariant, unico punto de resolucion
   (AreaDetail.jsx lo consume, no reimplementa la logica). */
export const AREA_DETAIL_VARIANTS = {
  LINE: 'LINE',
  LINE_LIKE: 'LINE_LIKE',
  OPERATIONAL: 'OPERATIONAL',
  SUPPORT: 'SUPPORT',
}

export const LINE_FAMILY_AREA_IDS = new Set([...LINES_ONLY.map((w) => w.id), 'PROYECTO'])

/* WC Midea/High Value + Accesorios/Paletizado/Insumos (2026-08-26,
   segunda ronda -- a peticion explicita del usuario: "copia el diseño
   que tiene los WC LINEA 0 a la 10... quiero que pongas los puestos de
   trabajo... y la cantidad de personal que debe ocupar cada puesto").
   Estas 3 ya tenian CUSTOM_STATION_PLANS (plantilla real por puesto,
   ronda anterior) pero se mostraban con la lista plana de
   OperationalAreaDetail.jsx -- ahora reutilizan LineDetailDrawer.jsx
   completo (grid de estaciones, vacantes, candidatos sugeridos) igual
   que Midea, sin llamarse "línea" en la UI. Set separado (no un boolean
   suelto en WORK_CENTERS) para que agregar otra area LINE_LIKE en el
   futuro sea un solo id agregado aqui.

   CONVEYOR_PRINCIPAL (2026-08-28, "corrección navegación Conveyor
   General", tercera ronda) vuelve a estar aqui -- vuelve a ser su propio
   canonico (AREA_DETAIL_GROUPS), asi que necesita su propia entrada para
   que getAreaDetailVariant siga resolviendo LINE_LIKE (misma pantalla
   LineLikeAreaDetail.jsx de siempre, ahora mostrando una vista filtrada
   sobre Paletizado -- ver AREA_STATION_SOURCE_OVERRIDE). */
export const LINE_LIKE_AREA_IDS = new Set([
  'HIGH_VALUE',
  'ACCESORIOS',
  'PALETIZADO',
  'INSUMOS',
  'CONVEYOR_PRINCIPAL',
])

export const SUPPORT_DETAIL_AREA_IDS = new Set([
  ...WORK_CENTERS.filter(
    (w) =>
      w.type === AREA_TYPES.SUPPORT_AREA && !['BOX_PREP', 'SUMINISTRO_MATERIAL'].includes(w.id),
  ).map((w) => w.id),
  'CALIDAD',
])

/* Subconjunto de SUPPORT_DETAIL_AREA_IDS (2026-08-28, "REDISEÑO DE 6
   AREAS ESPECIALES", a peticion explicita del usuario) -- estas 6 usan
   SpecialAreaDetail.jsx (vista compacta sin Disponibles para asignar/
   Actividad reciente/dona, ver ese archivo). CALIDAD y SOPORTE (el
   resto de SUPPORT_DETAIL_AREA_IDS) NO estan aqui a proposito -- el
   usuario NO las incluyo en su pedido, siguen usando SupportAreaDetail.jsx
   exactamente igual que antes. Set separado (no se reutiliza
   SUPPORT_DETAIL_AREA_IDS) para que AreaDetail.jsx pueda distinguir sin
   tocar la lista existente. */
export const SPECIAL_AREA_IDS = new Set([
  'CAPACITACION',
  'TEAM_LEADER',
  'ENTRENADOR',
  'LIMPIEZA',
  'GERENTE',
  'SUPERVISOR',
])

/* Personal que NUNCA cuenta en el TOTAL GENERAL de la planta (Dashboard, tablero "Área
   operando") -- roles de apoyo/administrativos, no personal operativo de piso.
   2026-09-04, a peticion explicita del usuario: antes existian 3 listas de exclusion
   DISTINTAS y parciales (Centro de Trabajo "Resumen por area" excluia CALIDAD+ENTRENADOR;
   Asistencia "Personal por area" excluia CALIDAD+GERENTE+SUPERVISOR; Dashboard y "Área
   operando" no excluian nada) -- el mismo numero real de personas mostraba un total distinto
   segun la pantalla. El usuario eligio explicitamente (pregunta directa, "Excluir los 4 en
   todos lados") unificar en UN solo criterio: CALIDAD/GERENTE/SUPERVISOR/ENTRENADOR fuera del
   total general en TODAS las vistas -- unica fuente de verdad, nunca una lista local aparte
   por pantalla. */
export const EXCLUDED_FROM_PLANT_TOTAL_AREA_IDS = new Set([
  'CALIDAD',
  'GERENTE',
  'SUPERVISOR',
  'ENTRENADOR',
])

export function getAreaDetailVariant(workCenterId) {
  if (LINE_FAMILY_AREA_IDS.has(workCenterId)) return AREA_DETAIL_VARIANTS.LINE
  // Resuelto por id canonico (no el crudo) -- necesario desde que INSUMOS
  // (LINE_LIKE) fusiona miembros no-canonicos (BOX_PREP/SUMINISTRO_MATERIAL,
  // ver AREA_DETAIL_GROUPS): sin esto, abrir el detalle de un miembro
  // fusionado caia por error en el defensivo de abajo (LINE) en vez de
  // LINE_LIKE. Mismo patron ya usado por el chequeo de SUPPORT mas abajo.
  if (LINE_LIKE_AREA_IDS.has(canonicalOperationalAreaId(workCenterId)))
    return AREA_DETAIL_VARIANTS.LINE_LIKE
  if (usesOperationalDetail(workCenterId)) return AREA_DETAIL_VARIANTS.OPERATIONAL
  if (SUPPORT_DETAIL_AREA_IDS.has(canonicalOperationalAreaId(workCenterId)))
    return AREA_DETAIL_VARIANTS.SUPPORT
  // Defensivo: cualquier id futuro que no encaje en ninguna lista (no
  // deberia pasar hoy, las cuatro cubren el 100% de WORK_CENTERS) cae en
  // LINE -- LineDetailDrawer.jsx ya maneja correctamente cualquier area
  // sin estaciones de linea con su propia rama "vista simple", el mismo
  // comportamiento que existia antes de esta clasificacion.
  return AREA_DETAIL_VARIANTS.LINE
}

/* Descripcion editorial corta por area de apoyo (Parte 5 del pedido:
   revisado primero -- NO existe ningun campo de descripcion/categoria
   real en WorkArea/Employee/User, ver prisma/schema.prisma -- por eso
   esta configuracion central nueva, en un solo lugar, fácil de editar).
   Contenido tal como lo especifico el usuario, no inventado por Claude. */
// Getters (2026-08-29, migracion i18n) en vez de strings estaticos: los
// dos consumidores (SpecialAreaDetail.jsx/SupportAreaDetail.jsx) leen
// `SUPPORT_AREA_DESCRIPTIONS[area.id]` directamente (nunca via una
// funcion propia), asi que un string plano quedaria fijo en el idioma
// que estuviera cargado al importar este modulo -- un getter se
// re-evalua en CADA acceso, nunca se cachea, mismo efecto que llamar
// `t()` en el render sin tener que tocar esos dos archivos. A diferencia
// de WORK_CENTERS.name/OFFICIAL_SHIFTS.label, este texto NUNCA se
// compara ni se persiste (es puramente editorial), asi que no hay riesgo
// de que el idioma actual rompa una busqueda/igualdad en otro lado.
export const SUPPORT_AREA_DESCRIPTIONS = {
  get CAPACITACION() {
    return i18n.t('catalog:descCapacitacion')
  },
  get TEAM_LEADER() {
    return i18n.t('catalog:descTeamLeader')
  },
  get SOPORTE() {
    return i18n.t('catalog:descSoporte')
  },
  get LIMPIEZA() {
    return i18n.t('catalog:descLimpieza')
  },
  get GERENTE() {
    return i18n.t('catalog:descGerente')
  },
  get SUPERVISOR() {
    return i18n.t('catalog:descSupervisor')
  },
}

export const STATIONS = [
  'Montaje',
  'Prueba eléctrica',
  'Limpieza',
  'Etiquetado',
  'Suministro de Accesorios',
  'Empaque',
  'Calidad',
  'Supervisión',
  'Capacitación',
]

/* Estado operativo de un centro de trabajo — independiente
   del % de avance de produccion. SIN_DATOS es el estado por
   defecto mientras no exista una fuente real de produccion;
   nunca se asume "Operando" sin evidencia. */
// `label` es getter (2026-08-29, migracion i18n) por el mismo motivo que
// SUPPORT_AREA_DESCRIPTIONS: selectors.js hace `{ key,
// ...OPERATIONAL_STATUS[key] }` (spread, no una funcion de este
// archivo) -- el getter se evalua EN ESE MOMENTO (cada llamada a
// operationalStatusOf()), nunca se cachea en un string fijo. `dot`/
// `tone` se quedan como estaban (identificadores para color/estilo, no
// texto visible, nunca se traducen).
export const OPERATIONAL_STATUS = {
  OPERANDO: {
    get label() {
      return i18n.t('catalog:statusOperando')
    },
    dot: '#10B981',
    tone: 'ok',
  },
  ATENCION: {
    get label() {
      return i18n.t('catalog:statusAtencion')
    },
    dot: '#F59E0B',
    tone: 'warn',
  },
  MANTENIMIENTO: {
    get label() {
      return i18n.t('catalog:statusMantenimiento')
    },
    dot: '#3B82F6',
    tone: 'info',
  },
  DETENIDO: {
    get label() {
      return i18n.t('catalog:statusDetenido')
    },
    dot: '#EF4444',
    tone: 'bad',
  },
  SIN_DATOS: {
    get label() {
      return i18n.t('catalog:statusSinDatos')
    },
    dot: '#94A3B8',
    tone: 'default',
  },
}

// Resuelve `name` para MOSTRAR, fresco en cada llamada (2026-08-29,
// migracion i18n) -- WORK_CENTERS[i].name en si NUNCA se traduce (sigue
// siendo el literal español original): workstations.js lo usa
// directamente (`WORK_CENTERS.forEach(wc => ...)`, nunca via esta
// funcion) como stationId/role real para el puesto generico de areas sin
// CUSTOM_STATION_PLANS (ver buildWorkstations, rama `else` -- ese valor
// queda persistido en DailyAssignment.stationId), asi que cambiar el
// literal ahi rompería asignaciones/ocupacion ya guardadas. Esta funcion
// es la UNICA que traduce, devolviendo una copia (spread) con `name`
// resuelto vía i18n.t() en el momento de la llamada -- nunca cacheado --
// para que autocorrija en cuanto cargue la traduccion real, igual que
// cualquier `t()` de un componente. Todos los consumidores existentes
// (`workCenterById(id)?.name`) siguen funcionando igual, ahora con texto
// traducido en vez del literal crudo.
export function workCenterById(id) {
  const entry = WORK_CENTERS.find((w) => w.id === id)
  if (!entry) return entry
  return { ...entry, name: entry.nameKey ? i18n.t(`catalog:${entry.nameKey}`) : entry.name }
}

/* Indicadores del area FFT (2026-08-26, "Reestructuracion operativa FFT",
   a peticion explicita del usuario) -- orden oficial 1..4, NUNCA
   reordenar: Eficiencia, Demoras, Produccion, Cumplimiento de programas.
   `hasSource:false` en los 4 -- hoy NO existe ninguna fuente real de
   datos para ninguno (variables operativas de eficiencia, registro de
   demoras, produccion real, o plan/programa vs resultado): no se
   inventa ni un solo porcentaje. La UI (Dashboard) debe mostrar "Sin
   fuente de datos configurada" para cada uno mientras `hasSource` sea
   false -- este objeto es el unico lugar a cambiar (`hasSource:true` +
   agregar el selector real correspondiente) el dia que exista una
   fuente real, sin tocar el componente visual. */
// `label` es getter (2026-08-29, migracion i18n): FftIndicatorsCard.jsx
// hace `FFT_INDICATORS.map((i) => ...)` leyendo `i.label` directo del
// array (nunca via una funcion de este archivo) -- el getter se
// re-evalua en cada acceso/render, nunca queda fijo en el idioma que
// estuviera cargado al importar el modulo. `order`/`hasSource` no son
// texto visible, se quedan igual.
export const FFT_INDICATORS = [
  {
    id: 'EFICIENCIA',
    order: 1,
    get label() {
      return i18n.t('catalog:fftEficiencia')
    },
    hasSource: false,
  },
  {
    id: 'DEMORAS',
    order: 2,
    get label() {
      return i18n.t('catalog:fftDemoras')
    },
    hasSource: false,
  },
  {
    id: 'PRODUCCION',
    order: 3,
    get label() {
      return i18n.t('catalog:fftProduccion')
    },
    hasSource: false,
  },
  {
    id: 'CUMPLIMIENTO_PROGRAMAS',
    order: 4,
    get label() {
      return i18n.t('catalog:fftCumplimientoProgramas')
    },
    hasSource: false,
  },
]
