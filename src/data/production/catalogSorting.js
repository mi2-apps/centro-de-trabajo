/* Catalogo del area Sorting (2026-09-08, a peticion explicita del usuario -- layout real
   dibujado a mano en un pizarron: RCY/FRM, una linea de 7 puestos dobles -- "van dos <-> asi,
   dos apuntan < y dos >", personas trabajando en pareja enfrentadas -- y por separado KITS,
   PNP, DMR/DML y DMA/DMT como 4 areas mas). Arranca vacio (SIN snapshot real de personal, a
   diferencia de FFT que partio de LAYOUT FFT.xlsx) -- el personal se va asignando desde la app
   conforme lo muevan aqui, nunca un baseline inventado.

   Mismo *shape* exacto que las entradas de WORK_CENTERS en catalog.js (ver ese archivo) para
   que TODO el codigo que ya consume WORK_CENTERS (Dashboard, Asistencia, Registro de personal,
   Centro de Trabajo) funcione igual sin cambios -- ver applyActiveAreaGroup() en catalog.js,
   que reasigna el binding vivo WORK_CENTERS a este array cuando el usuario activa Sorting.

   `idealHeadcount: null` en las areas simples (RCY/FRM/KITS/PNP/DMR-DML/DMA-DMT/Patines) es
   -- SORT_CONVEYOR SI tiene ideal real (2, mismo criterio que CONVEYOR_PRINCIPAL de FFT) --
   intencional (nunca inventar un ideal que el usuario no dio -- mismo criterio que INSUMOS/
   CALIDAD en catalog.js, "Sin plantilla definida"). SORT_LINEA1..8 (ids SORT_LINEA1..7 + el
   nuevo SORT_LINEA8, ver comentario en su propia definicion mas abajo) SI tienen ideal real: 7
   de las 8 son una V con 4 personas (2 por extremo); la que se muestra como "Línea de Sorting 8"
   (id SORT_LINEA7) tiene 5; la que se muestra como "Línea de Sorting 1" (id SORT_LINEA8, nueva
   2026-09-10) es horizontal, no una V, con 4 personas -- 8 lineas independientes, kind:'linea',
   SI usan LINE_FAMILY_AREA_IDS/LINE_FAMILY_WORK_CENTERS (a diferencia de la version anterior de
   un solo SORT_LINEA con 7 puestos adentro). SORT_GERENTE (Gerente de Sorting) es un area de apoyo,
   mismo criterio que GERENTE en catalog.js (FFT): idealHeadcount:1, isProduction:false. Las
   estaciones reales (capacity, nombre de cada puesto) se configuran despues en vivo desde
   "Configurar puestos" (LineDetailDrawer.jsx), mismo mecanismo ya usado por WC LINEA -- ver
   scripts/seed-sorting-work-areas-2026-09-08.mjs, scripts/seed-sorting-patines-gerente-
   2026-09-08.mjs y scripts/split-sort-linea-2026-09-08.mjs para el sembrado real en la BD.
   SORT_SUPERVISOR (2026-09-08, sexta ronda) reemplaza el marcador decorativo "Entrada" -- ahi
   es donde el supervisor tiene su computadora, mismo criterio que SUPERVISOR en catalog.js
   (FFT). SORT_PATINES (`equipment: true` en SortingFloorPlan.jsx) nunca tiene personal
   asignado -- son los patines/carritos fisicos del area, no un puesto de trabajo. */

export const SORTING_WORK_CENTERS = [
  {
    id: 'SORT_CONVEYOR',
    name: 'Conveyor de Sorting',
    kind: 'area',
    type: 'WORK_AREA',
    isProduction: true,
    dailyTarget: null,
    // 2026-09-08 (quinta ronda, a peticion explicita del usuario -- "no veo el conveyor aqui...
    // debe ser el conveyor del mismo grosor que el de FFT"): area real independiente, 2
    // posiciones reales -- mismo criterio que CONVEYOR_PRINCIPAL/"WC Conveyor General" en
    // catalog.js (FFT), confirmado explicitamente por el usuario via pregunta directa: debe ser
    // un area real con su propia gente, no solo decorativo. A diferencia de CONVEYOR_PRINCIPAL
    // (cuyos 2 puestos reales viven prestados dentro de Paletizado por historia acumulada, ver
    // AREA_STATION_SOURCE_OVERRIDE en catalog.js), SORT_CONVEYOR es independiente desde el
    // principio -- sin ese enredo historico que replicar. Ver scripts/seed-sorting-conveyor-
    // 2026-09-08.mjs para las 2 Workstation reales (capacity 1 c/u).
    idealHeadcount: 2,
  },
  // 2026-09-08 (septima ronda, a peticion explicita del usuario -- "ahi te falta poner que las
  // lineas sean por separado, son 7 lineas independientes, no solo una"): SORT_LINEA1..7
  // reemplazan la unica area "SORT_LINEA" con 7 puestos adentro -- ahora son 7 AREAS DE CATALOGO
  // reales y separadas, exactamente como LINEA1..10 de FFT (cada una con su propia asignacion,
  // su propio "Registrar personal", su propio detalle) en vez de un pool compartido de 28
  // lugares. Cada una es una V con 2 personas en un extremo y 2 en el otro = 4 (confirmado por
  // el usuario viendo el pizarron con mas detalle). kind:'linea' (a diferencia de antes) para
  // que participen del mismo mecanismo LINE_FAMILY_AREA_IDS/LINE_FAMILY_WORK_CENTERS que ya usan
  // Lineas/Asistencia/Registro de personal para WC LINEA de FFT -- ver
  // SORTING_LINE_FAMILY_AREA_IDS/SORTING_LINE_FAMILY_WORK_CENTERS mas abajo. Cada una tiene
  // exactamente 1 Workstation real capacity:4 en la BD (ver scripts/split-sort-linea-2026-09-08.mjs,
  // que reemplaza el sembrado anterior de 1 area con 7 puestos).
  //
  // 2026-09-10 (a peticion explicita del usuario, viendo el plano en vivo -- "agregas una nueva
  // linea la 1 que es en horizontal, la pones a lado derecho de la linea 8"): SORT_LINEA1..7 (ids
  // SIN cambiar para no perder su historial real de asignaciones/demoras ya capturado) se
  // renumeraron de 2 a 8 -- SORT_LINEA8 es la nueva "Linea 1", horizontal (distinta forma visual,
  // ver SortingFloorPlan.jsx), 4 personas igual que las demas (confirmado explicitamente por el
  // usuario, no una V como las otras 7). Va primero en este array para que
  // SORTING_LINE_FAMILY_WORK_CENTERS itere en orden de numero real (1,2,3...8), no de id.
  {
    id: 'SORT_LINEA8',
    name: 'Línea de Sorting 1',
    kind: 'linea',
    type: 'PRODUCTION_LINE',
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: 4,
  },
  {
    id: 'SORT_LINEA1',
    name: 'Línea de Sorting 2',
    kind: 'linea',
    type: 'PRODUCTION_LINE',
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: 4,
  },
  {
    id: 'SORT_LINEA2',
    name: 'Línea de Sorting 3',
    kind: 'linea',
    type: 'PRODUCTION_LINE',
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: 4,
  },
  {
    id: 'SORT_LINEA3',
    name: 'Línea de Sorting 4',
    kind: 'linea',
    type: 'PRODUCTION_LINE',
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: 4,
  },
  {
    id: 'SORT_LINEA4',
    name: 'Línea de Sorting 5',
    kind: 'linea',
    type: 'PRODUCTION_LINE',
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: 4,
  },
  {
    id: 'SORT_LINEA5',
    name: 'Línea de Sorting 6',
    kind: 'linea',
    type: 'PRODUCTION_LINE',
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: 4,
  },
  {
    id: 'SORT_LINEA6',
    name: 'Línea de Sorting 7',
    kind: 'linea',
    type: 'PRODUCTION_LINE',
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: 4,
  },
  {
    id: 'SORT_LINEA7',
    name: 'Línea de Sorting 8',
    kind: 'linea',
    type: 'PRODUCTION_LINE',
    isProduction: true,
    dailyTarget: null,
    // 2026-09-10 (a peticion explicita del usuario, viendo el plano en vivo -- "la numero 8 es de
    // 5 personas"): unica de las 8 lineas con capacidad real de 5 en vez de 4 -- no se inventa,
    // es lo que el usuario confirmo para esta linea especifica.
    idealHeadcount: 5,
  },
  {
    id: 'SORT_RCY',
    name: 'RCY',
    kind: 'area',
    type: 'WORK_AREA',
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: null,
  },
  {
    id: 'SORT_FRM',
    name: 'FRM',
    kind: 'area',
    type: 'WORK_AREA',
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: null,
  },
  {
    id: 'SORT_KITS',
    name: 'KITS',
    kind: 'area',
    type: 'WORK_AREA',
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: null,
  },
  {
    id: 'SORT_PNP',
    name: 'PNP',
    kind: 'area',
    type: 'WORK_AREA',
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: null,
  },
  {
    id: 'SORT_DMR_DML',
    name: 'DMR / DML',
    kind: 'area',
    type: 'WORK_AREA',
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: null,
  },
  {
    id: 'SORT_DMA_DMT',
    name: 'DMA / DMT',
    kind: 'area',
    type: 'WORK_AREA',
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: null,
  },
  {
    id: 'SORT_PATINES',
    name: 'Patines',
    kind: 'area',
    type: 'WORK_AREA',
    isProduction: true,
    dailyTarget: null,
    idealHeadcount: null,
  },
  {
    id: 'SORT_GERENTE',
    name: 'Gerente de Sorting',
    kind: 'area',
    type: 'SUPPORT_AREA',
    isProduction: false,
    dailyTarget: null,
    idealHeadcount: 1,
  },
  {
    id: 'SORT_SUPERVISOR',
    name: 'Supervisor',
    kind: 'area',
    type: 'SUPPORT_AREA',
    isProduction: false,
    dailyTarget: null,
    // 2026-09-08 (sexta ronda, a peticion explicita del usuario -- "donde dice entrada es un
    // lugar donde va el supervisor y tiene ahi una compu"): reemplaza el marcador decorativo
    // "Entrada" -- area real de apoyo, mismo criterio que SUPERVISOR en catalog.js (FFT).
    idealHeadcount: 1,
  },
]

export const SORTING_LINE_FAMILY_AREA_IDS = new Set(
  SORTING_WORK_CENTERS.filter((w) => w.kind === 'linea').map((w) => w.id),
)
export const SORTING_LINE_FAMILY_WORK_CENTERS = SORTING_WORK_CENTERS.filter(
  (w) => w.kind === 'linea',
)
