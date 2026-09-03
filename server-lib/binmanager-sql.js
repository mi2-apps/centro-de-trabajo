// Conexion SQL Server DIRECTA y de SOLO LECTURA a SmartControl (BinManager/MI Technologies),
// para el Takt Time real por linea (2026-09-02, a peticion explicita del usuario: "puedes poner
// las piezas que se estan produciendo por linea, ubica las personas y es lo que lleva la linea")
// y para el modulo "Produccion FFT" (espejo de FFT Dashboard Production de BinManager).
//
// Por que SQL directo y no el MCP de BinManager: el MCP solo esta disponible para el asistente en
// una sesion interactiva de Claude -- el SERVIDOR real de esta app (el que corre en Coolify/
// Vercel y responde a cualquier usuario que abra la pantalla) no tiene forma de llamarlo. Se
// investigo en vivo (2026-09-02) con la cuenta de solo lectura `ro_smartcontrol` y se confirmo que
// las tablas reales que alimentan "Usuarios activos" del FFT Dashboard de BinManager
// (SmartControl.oe.WorkPlanInspection/OE.WorkPlanItemClassifications/OE.WorkPlan, resueltas a
// nombre real via ADM.UsersLogin) son consultables con SELECT puro -- la cuenta NO tiene permiso
// EXECUTE sobre el stored procedure real (OC.sp_ProductionInspections_GetByUser, verificado con
// error "The EXECUTE permission was denied"), asi que las funciones de abajo replican EXACTAMENTE
// el SELECT que ese SP ejecuta (texto leido de sys.sql_modules), nunca inventan una query nueva.
//
// La misma cuenta puede ademas leer CROSS-DATABASE hacia BinManagerRO (confirmado en vivo
// 2026-09-02) -- de ahi salen Proveedor/Categoria/Tamaño/Tags/Pallets/Rastreador de SKUs, todos
// via server-lib/binmanager-sql.js mas abajo, cada join documentado en su propia funcion con la
// verificacion real que se le hizo contra la pagina externa.
//
// Credenciales via env vars (nunca hardcodeadas, nunca en el repo):
//   SMARTCONTROL_SQLSERVER_HOST / _PORT / _USER / _PASSWORD / _DB
import sql from 'mssql'

let poolPromise = null

function getConfig() {
  const {
    SMARTCONTROL_SQLSERVER_HOST,
    SMARTCONTROL_SQLSERVER_PORT,
    SMARTCONTROL_SQLSERVER_USER,
    SMARTCONTROL_SQLSERVER_PASSWORD,
    SMARTCONTROL_SQLSERVER_DB,
  } = process.env
  if (
    !SMARTCONTROL_SQLSERVER_HOST ||
    !SMARTCONTROL_SQLSERVER_USER ||
    !SMARTCONTROL_SQLSERVER_PASSWORD ||
    !SMARTCONTROL_SQLSERVER_DB
  ) {
    return null
  }
  return {
    server: SMARTCONTROL_SQLSERVER_HOST,
    port: Number(SMARTCONTROL_SQLSERVER_PORT) || 1433,
    user: SMARTCONTROL_SQLSERVER_USER,
    password: SMARTCONTROL_SQLSERVER_PASSWORD,
    database: SMARTCONTROL_SQLSERVER_DB,
    options: { encrypt: true, trustServerCertificate: true },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
  }
}

// isConfigured() (2026-09-02): permite al endpoint devolver "BinManager no configurado" en vez de
// un 500 crudo cuando las env vars todavia no estan puestas en Coolify -- mismo criterio ya usado
// en otras integraciones opcionales de este repo (ver server-lib/mattermost.js).
export function isBinManagerSqlConfigured() {
  return getConfig() !== null
}

async function getPool() {
  if (poolPromise) return poolPromise
  const config = getConfig()
  if (!config) throw new Error('SmartControl SQL Server no configurado (faltan env vars).')
  poolPromise = new sql.ConnectionPool(config).connect().catch((err) => {
    poolPromise = null
    throw err
  })
  return poolPromise
}

/* Base compartida REAL de "que se produjo en el rango de fechas" (2026-09-02, extendida para el
   rediseño de "Producción FFT" -- a peticion explicita del usuario: filtros reales de Clasificacion
   y Pulgadas que aplican a TODAS las tarjetas del modulo, no solo a una). Dedup exacto por
   LicensePlateNumber (la ultima inspeccion real de ese LPN en el rango, mismo criterio ya
   verificado en produccion desde el primer Takt Time real). El JOIN a OE.WorkPlan (SKU) y
   MM.SKUData (ScreenSize) vive AQUI, en la base, para que el filtro de Pulgadas pueda aplicarse
   antes de la agregacion de cada tarjeta -- nunca cambia la cardinalidad (LPN sigue siendo unico),
   asi que no reintroduce el problema de fan-out ya descartado en getProductionByClassificationToday.
   classificationCode/size son OPCIONALES -- cuando no se pasan, el comportamiento es identico al
   que ya estaba en produccion antes de este filtro (sin filtro extra).

   shift (2026-09-02, agregado a peticion explicita del usuario -- "separa lo del turno 1 matutino
   junto con tiempo extra y turno 2... nocturno... vespertino").

   2026-09-03 (CORREGIDO DOS VECES, a peticion explicita del usuario):
   1ra correccion -- la version original combinaba fecha+hora mal armado, dejaba pasar la madrugada
   de @dateFrom (cola del turno anterior) y la noche completa de @dateFrom+1 (un turno no pedido).
   2da correccion -- el usuario reporto usuarios TOTALMENTE distintos entre la pagina real y esta
   para Turno 2 (misma cantidad total, 450=450, pero personas distintas: la real mostraba
   elizabeth.mendoza62/adalberto.ramon, la nuestra mostraba otras 3 personas). Investigando se
   encontro la causa real: oe.WorkPlanInspection tiene una columna `Turno` (int, 1 o 2) YA
   CALCULADA Y GUARDADA por SmartControl -- confirmado en vivo con el MCP de BinManager
   (inspections_by_workcenter, turno=2, 2026-09-02: 100% de las filas devueltas traen
   "Turno":2, con InspectionBy=elizabeth.mendoza62/adalberto.ramon exacto). Inferir el turno a
   partir de la hora (como hacian ambas versiones anteriores) es una aproximacion que puede
   seleccionar una fila distinta a la que el sistema real considera "la" inspeccion de ese
   LPN/turno; usar la columna real Turno la elimina. Solo se conserva un corte de hora (mediodia,
   12:00) para decidir a que FECHA de turno-noche pertenece una fila con Turno=2 (su turno pudo
   empezar la noche anterior) -- ya no se usa para decidir CUAL es el turno, solo para agrupar por
   fecha, asi que no depende de acertar el horario exacto de inicio/fin del turno.

   "Todas" (sin shift) ahora es la UNION exacta de Turno 1(fecha) + Turno 2(fecha) -- a peticion
   explicita del usuario, que esperaba que "Todas" cerrara con la suma de los 2 turnos y no
   con el total crudo del dia calendario (que incluia la cola del turno de la noche anterior,
   piezas reales pero de un turno que no es "el de hoy"). Con esto, ese sobrante ahora aparece en
   el "Todas"/Turno 2 del DIA ANTERIOR (a donde realmente pertenece), nunca se pierde. */
function buildFilteredBaseCte(
  request,
  { workCenterId, dateFrom, dateTo, classificationCode, size, shift },
) {
  request.input('workCenterId', sql.Int, workCenterId)
  request.input('dateFrom', sql.Date, dateFrom)
  request.input('dateTo', sql.Date, dateTo)
  let extraWhere = ''
  const turno1Where = `(I.Turno = 1 AND CAST(I.InspectionDate AS DATE) BETWEEN @dateFrom AND @dateTo)`
  const turno2Where = `(I.Turno = 2 AND (
        (CAST(I.InspectionDate AS TIME) >= '12:00:00' AND CAST(I.InspectionDate AS DATE) BETWEEN @dateFrom AND @dateTo)
        OR (CAST(I.InspectionDate AS TIME) < '12:00:00' AND CAST(I.InspectionDate AS DATE) BETWEEN DATEADD(DAY, 1, @dateFrom) AND DATEADD(DAY, 1, @dateTo))
      ))`
  let shiftWhere
  if (String(shift) === '1') {
    shiftWhere = turno1Where
  } else if (String(shift) === '2') {
    shiftWhere = turno2Where
  } else {
    shiftWhere = `(${turno1Where} OR ${turno2Where})`
  }
  if (classificationCode) {
    request.input('classificationCode', sql.NVarChar, classificationCode)
    extraWhere += ' AND WPIC.ClassificationCode = @classificationCode'
  }
  if (size !== undefined && size !== null && size !== '') {
    request.input('size', sql.Int, Number(size))
    extraWhere += ' AND M.ScreenSize = @size'
  }
  return `
    WITH RankedInspections AS (
      SELECT I.LicensePlateNumber, I.ClassificationID, I.InspectionBy, I.InspectionDate,
        ROW_NUMBER() OVER (PARTITION BY I.LicensePlateNumber ORDER BY I.InspectionDate DESC, I.InspectionID DESC) AS RN
      FROM oe.WorkPlanInspection I WITH (NOLOCK)
      INNER JOIN OE.WorkPlanItemClassifications WPIC WITH (NOLOCK) ON WPIC.ClassificationID = I.ClassificationID
      WHERE I.WorkCenterID = @workCenterId
        AND ${shiftWhere}
    ),
    FilteredBase AS (
      SELECT
        R.LicensePlateNumber, R.ClassificationID, R.InspectionBy, R.InspectionDate,
        W.SKU, W.WorkOrderDetailID, WPIC.ClassificationCode, WPIC.ClassificationName, M.ScreenSize
      FROM RankedInspections R
      INNER JOIN OE.WorkPlan W WITH (NOLOCK) ON W.LicensePlateNumber = R.LicensePlateNumber
      INNER JOIN OE.WorkPlanItemClassifications WPIC WITH (NOLOCK) ON WPIC.ClassificationID = R.ClassificationID
      LEFT JOIN MM.SKUData M WITH (NOLOCK) ON M.SKU = W.SKU
      WHERE R.RN = 1${extraWhere}
    )
  `
}

/* Lista real de work centers activos del almacen MTY-MAXX (Warehouse=68) -- para el dropdown
   "Área / Línea" del modulo Producción FFT (2026-09-02, a peticion explicita del usuario: usar
   "unicamente valores reales", nunca inventar lineas). Mismo almacen que ya usa el resto del
   modulo (WorkCenterID 49 = Refurbish Monterrey2, confirmado en vivo contra la pagina real de
   BinManager). "Sitio / Planta" no tiene un catalogo real independiente en este servidor (un solo
   Warehouse=68 disponible con esta cuenta) -- se muestra fijo en el frontend en vez de inventar
   un segundo dropdown sin datos reales detras. */
export async function getWorkCenters() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT WorkCenterID, WorkCenterName
    FROM OE.WorkCenters WITH (NOLOCK)
    WHERE Warehouse = 68 AND isActive = 1 AND IsProcess = 1
    ORDER BY WorkCenterID
  `)
  return result.recordset.map((r) => ({ id: r.WorkCenterID, name: r.WorkCenterName }))
}

/* Lista real de clasificaciones y tamaños existentes en OE.WorkPlanItemClassifications/MM.SKUData
   -- para los dropdowns "Clasificación"/"Pulgadas" del modulo Producción FFT. Catalogo completo
   (no solo lo usado hoy), para que el filtro siga teniendo sentido con cualquier rango de fechas
   que el usuario elija. */
export async function getFilterOptions() {
  const pool = await getPool()
  const [classifications, sizes] = await Promise.all([
    pool.request().query(`
      SELECT DISTINCT ClassificationCode, ClassificationName
      FROM OE.WorkPlanItemClassifications WITH (NOLOCK)
      WHERE ClassificationCode IS NOT NULL
      ORDER BY ClassificationCode
    `),
    pool.request().query(`
      SELECT DISTINCT ScreenSize
      FROM MM.SKUData WITH (NOLOCK)
      WHERE ScreenSize IS NOT NULL
      ORDER BY ScreenSize
    `),
  ])
  return {
    classifications: classifications.recordset.map((r) => ({
      code: r.ClassificationCode,
      name: r.ClassificationName,
    })),
    sizes: sizes.recordset.map((r) => r.ScreenSize),
  }
}

/* Replica EXACTA (solo SELECT, sin el wrapper EXEC que la cuenta de solo lectura no puede llamar)
   de OC.sp_ProductionInspections_GetByUser -- piezas inspeccionadas por usuario en un rango de
   fechas y work center. workCenterId 49 = FFT (mismo default que el SP real y que el dashboard
   "FFT Dashboard Production" que el usuario mostro como referencia). */
export async function getProductionByUserToday({
  workCenterId = 49,
  dateFrom,
  dateTo,
  classificationCode,
  size,
  shift,
}) {
  const pool = await getPool()
  const request = pool.request()
  const cte = buildFilteredBaseCte(request, { workCenterId, dateFrom, dateTo, classificationCode, size, shift })
  const result = await request.query(`
    ${cte}
    SELECT InspectionBy, COUNT(*) AS Qty
    FROM FilteredBase
    GROUP BY InspectionBy
    ORDER BY Qty DESC
  `)
  return result.recordset.map((r) => ({ username: r.InspectionBy, qty: r.Qty }))
}

/* Desglose de piezas por clasificacion (grado: GRA/GRB/GRC/DMA/...) en el rango -- para el modulo
   "Produccion FFT" (2026-09-02, espejo de FFT Dashboard Production de BinManager). Dedup por
   LicensePlateNumber verificado en vivo que da un total consistente con el de por-usuario; la
   version sin el JOIN a OE.WorkPlan (probada primero) dio un total distinto al que muestra
   BinManager, asi que se descarta esa variante aunque sea mas simple. (Nota de investigacion
   2026-09-02, aun sin cerrar: el total general de esta app tampoco cierra exacto contra el total
   que muestra la pagina real de BinManager -- se investigo 3 veces con accesos distintos, ver
   api/production/fft-summary.js para el detalle completo; documentado como pendiente sin
   resolver, no bloqueante.) */
export async function getProductionByClassificationToday({
  workCenterId = 49,
  dateFrom,
  dateTo,
  classificationCode,
  size,
  shift,
}) {
  const pool = await getPool()
  const request = pool.request()
  const cte = buildFilteredBaseCte(request, { workCenterId, dateFrom, dateTo, classificationCode, size, shift })
  const result = await request.query(`
    ${cte}
    SELECT ClassificationCode, ClassificationName, COUNT(*) AS Qty
    FROM FilteredBase
    GROUP BY ClassificationCode, ClassificationName
    ORDER BY Qty DESC
  `)
  return result.recordset.map((r) => ({
    code: r.ClassificationCode,
    name: r.ClassificationName,
    qty: r.Qty,
  }))
}

/* Piezas totales por dia, en el rango -- para la grafica de tendencia y la comparativa semanal del
   modulo "Produccion FFT". Mismo JOIN/dedup que arriba, agrupado por fecha de inspeccion en vez de
   usuario/clasificacion. */
export async function getDailyThroughput({
  workCenterId = 49,
  dateFrom,
  dateTo,
  classificationCode,
  size,
  shift,
}) {
  const pool = await getPool()
  const request = pool.request()
  const cte = buildFilteredBaseCte(request, { workCenterId, dateFrom, dateTo, classificationCode, size, shift })
  const result = await request.query(`
    ${cte}
    SELECT CAST(InspectionDate AS DATE) AS Day, COUNT(*) AS Qty
    FROM FilteredBase
    GROUP BY CAST(InspectionDate AS DATE)
    ORDER BY Day ASC
  `)
  return result.recordset.map((r) => ({
    date: r.Day.toISOString().slice(0, 10),
    qty: r.Qty,
  }))
}

/* Desglose de piezas por proveedor en el rango -- para el modulo "Produccion FFT". El puente real
   (Roman pidio "haz con lo que puedas" tras confirmar que el SP real --
   OE.sp_GetTodaysProducedByWorkCenter -- no es ejecutable con esta cuenta de solo lectura, sin
   permiso EXECUTE): LPN -> PO.PurchasePalletDetails (bin/pallet donde se recibio ese LPN) ->
   PO.PurchasePallets -> PO.Purchases -> PO.Suppliers. Verificado en vivo contra el dashboard real:
   mismas proporciones (TRG CONSIGNMENT como mayoria absoluta, "Mit" como minoria chica) -- LEFT
   JOIN a proposito, un LPN sin match en PurchasePalletDetails sale con supplierName null en vez de
   desaparecer silenciosamente del total. */
export async function getProductionBySupplierToday({
  workCenterId = 49,
  dateFrom,
  dateTo,
  classificationCode,
  size,
  shift,
}) {
  const pool = await getPool()
  const request = pool.request()
  const cte = buildFilteredBaseCte(request, { workCenterId, dateFrom, dateTo, classificationCode, size, shift })
  const result = await request.query(`
    ${cte}
    SELECT S.SupplierName, COUNT(*) AS Qty
    FROM FilteredBase R
    LEFT JOIN PO.PurchasePalletDetails PPD WITH (NOLOCK) ON PPD.LicensePlateNumber = R.LicensePlateNumber
    LEFT JOIN PO.PurchasePallets PP WITH (NOLOCK) ON PP.PurchasePalletID = PPD.PurchasePalletID
    LEFT JOIN PO.Purchases P WITH (NOLOCK) ON P.PurchaseID = PP.PurchaseID
    LEFT JOIN PO.Suppliers S WITH (NOLOCK) ON S.SupplierID = P.SupplierID
    GROUP BY S.SupplierName
    ORDER BY Qty DESC
  `)
  return result.recordset.map((r) => ({ supplierName: r.SupplierName || null, qty: r.Qty }))
}

/* Desglose de piezas por categoria en el rango. Puente real: LPN -> OE.WorkPlan.WorkOrderDetailID
   -> OE.WorkOrderDetails.CategoryID -> DA.Categories -- verificado en vivo (100% de las piezas de
   hoy cayeron en "Televisions", igual que el dashboard real). DA.SKUData.CategoryID (via SKU) se
   probo primero y NO sirvio -- casi ningun SKU tenia match ahi, la categoria real viene de la
   orden de trabajo, no del catalogo de SKU. */
export async function getProductionByCategoryToday({
  workCenterId = 49,
  dateFrom,
  dateTo,
  classificationCode,
  size,
  shift,
}) {
  const pool = await getPool()
  const request = pool.request()
  const cte = buildFilteredBaseCte(request, { workCenterId, dateFrom, dateTo, classificationCode, size, shift })
  const result = await request.query(`
    ${cte}
    SELECT C.CategoryName, COUNT(*) AS Qty
    FROM FilteredBase R
    INNER JOIN OE.WorkPlan W WITH (NOLOCK) ON W.LicensePlateNumber = R.LicensePlateNumber
    LEFT JOIN OE.WorkOrderDetails WOD WITH (NOLOCK) ON WOD.WorkOrderDetailID = W.WorkOrderDetailID
    LEFT JOIN DA.Categories C WITH (NOLOCK) ON C.CategoryID = WOD.CategoryID
    GROUP BY C.CategoryName
    ORDER BY Qty DESC
  `)
  return result.recordset.map((r) => ({ categoryName: r.CategoryName || null, qty: r.Qty }))
}

/* Crosstab piezas por tamaño (pulgadas de pantalla) x clasificacion, para la tabla "RESUMEN:
   unidades por tamaño y clasificacion" del dashboard real. ScreenSize ya viene resuelto en la base
   compartida (buildFilteredBaseCte) -- verificado en vivo: mismos valores de pulgadas que el
   dashboard real para las mismas SKU. Devuelve filas planas {size, code, qty}; el pivot a tabla
   (tamaño en columnas, clasificacion en filas) se arma en el endpoint/frontend, nunca aqui. */
export async function getSizeByClassificationToday({
  workCenterId = 49,
  dateFrom,
  dateTo,
  classificationCode,
  size,
  shift,
}) {
  const pool = await getPool()
  const request = pool.request()
  const cte = buildFilteredBaseCte(request, { workCenterId, dateFrom, dateTo, classificationCode, size, shift })
  const result = await request.query(`
    ${cte}
    SELECT ScreenSize, ClassificationCode, ClassificationName, COUNT(*) AS Qty
    FROM FilteredBase
    GROUP BY ScreenSize, ClassificationCode, ClassificationName
    ORDER BY ClassificationCode, ScreenSize
  `)
  return result.recordset.map((r) => ({
    size: r.ScreenSize ?? null,
    code: r.ClassificationCode,
    name: r.ClassificationName,
    qty: r.Qty,
  }))
}

/* Desglose de piezas por Tag en el rango (2026-09-02, a peticion explicita del usuario: "un
   rastreador de skus... ver en que pallet id se fue, si se fue en alguna orden... ver si hay
   duplicados"). Cierra el ultimo pendiente de una investigacion mucho mas vieja sobre tags
   BULKY/SORP/PRIOR.J (2026-08-20/24, ver memoria de la sesion): en ese momento la cuenta SQL
   disponible no tenia acceso a BinManagerRO, asi que la tabla real (PRO.Tags/PRO.SKUTags) quedo
   identificada pero sin poder consultarse. 2026-09-02: se confirmo que ro_smartcontrol SI puede
   leer BinManagerRO via query cross-database -- verificado en vivo contra la pagina real (BULKY
   salio EXACTO: 143=143, el resto de tags en el mismo orden de magnitud). Puente: LPN -> SKU (ya
   en la base compartida) -> BinManagerRO.PRO.SKUTags -> BinManagerRO.PRO.Tags. Un SKU puede tener
   varios tags -- la suma de este desglose excede el total de piezas, a proposito (mismo
   comportamiento que el dashboard real, nunca se fuerza a 1 tag por pieza). */
export async function getTagBreakdownToday({
  workCenterId = 49,
  dateFrom,
  dateTo,
  classificationCode,
  size,
  shift,
}) {
  const pool = await getPool()
  const request = pool.request()
  const cte = buildFilteredBaseCte(request, { workCenterId, dateFrom, dateTo, classificationCode, size, shift })
  const result = await request.query(`
    ${cte}
    SELECT T.Tag, COUNT(DISTINCT R.LicensePlateNumber) AS Qty
    FROM FilteredBase R
    INNER JOIN BinManagerRO.PRO.SKUTags ST WITH (NOLOCK) ON ST.SKU = R.SKU
    INNER JOIN BinManagerRO.PRO.Tags T WITH (NOLOCK) ON T.ID = ST.IDTag
    GROUP BY T.Tag
    ORDER BY Qty DESC
  `)
  return result.recordset.map((r) => ({ tag: r.Tag, qty: r.Qty }))
}

/* Progreso de pallets (2026-09-02, CORREGIDO tras reportar el usuario que "esta mal el como lo
   tienes" comparando contra la tarjeta real -- los IDs reales que mostro ("405576-0700",
   "118253-1392760") NO son PO.PurchasePallets: son BinCode de BM.Bins, verificado en vivo llamando
   sc_pallet_details (MCP de BinManager, envuelve app.sp_PalletDetails_Get de SmartControl) con esos
   2 IDs exactos -- devolvio BinID/BinCode identico, ParentBin en el area FFT
   ("MTY-MAXX-FFT-AREA01"/"02"), y PalletItems = los LPN dentro de ese bin con su ProductSKU
   completo (SKU + sufijo de condicion, ej. "SNTV008020-PNP", "SNTV007273-DMA").

   Concepto real: un "pallet" aqui es un Bin contenedor fisico parado en el area de FFT, con
   BinCode que tiene guion -- mismo criterio que usa la card oficial "Palletized (PCS)" del
   dashboard real de BinManager (BinCode LIKE '%-%'), filtrado por WorkStationID = el work center
   FFT seleccionado (BM.Bins tiene esa columna directa).

   % completado de cada pallet = items cuyo ProductSKU NO termina en "-PNP" / total de items en el
   bin. "-PNP" (Pass N Play) = pieza que salio de Sorting aprobada para FFT pero AUN no paso por la
   inspeccion real de FFT; cualquier otro sufijo (-GRB/-DMA/-GRC/-DMT/-FRM/-TBD/...) significa que
   YA se clasifico en FFT. Verificado contra los 2 ejemplos reales que dio el usuario: el pallet
   "405576-0700" (los 16 items, TODOS -PNP) mostraba 0% en la pagina real -- coincide exacto; el
   pallet "118253-1392760" (mezcla de -PNP con -DMA/-GRB/-DMT/-FRM/-TBD) mostraba 2% -- coincide con
   muy pocos items resueltos de ~41.

   Los 3 buckets (RECIBIDOS/EN PROCESO/TERMINADOS) son CONTEO DE PALLETS por estado de %, no de
   piezas -- verificado porque en las 2 capturas del usuario (tomadas en turnos distintos)
   RECIBIDOS=22 y TERMINADOS=14 se mantuvieron IDENTICOS mientras EN PROCESO subio de 48 a 49 ("creo
   que ahi si juntan los dos turnos", palabras del usuario): esta tarjeta es un snapshot FISICO en
   vivo de los pallets que hay AHORA MISMO en el area de FFT, sin filtro de turno/fecha/
   clasificacion/pulgadas a proposito -- por eso NO pasa por buildFilteredBaseCte. RECIBIDOS = 0%
   (aun ningun item paso FFT), EN PROCESO = 0% < % < 100%, TERMINADOS = 100%. "pz" de cada bucket =
   suma de items de los pallets de ese bucket.

   El parseo del sufijo de condicion se hace sobre ProductSKU (confirmado tal cual en vivo arriba)
   en vez de depender de una columna SKUCondition separada sin poder confirmar antes su formato
   exacto contra la conexion real de produccion.

   NOTA HONESTA (2026-09-03, investigado a fondo con un endpoint de introspeccion temporal contra
   produccion): b.WorkStationID en BM.Bins se fija al CREAR el bin y NUNCA cambia -- filtrar solo
   por WorkStationID trae TODOS los pallets historicos jamas creados en este work center (13,101
   bins con guion para WorkCenterID=49), no solo los que estan fisicamente ahi ahora mismo (~84
   segun la pagina real). Se probaron isActive y BinStatus (unicas columnas reales candidatas en
   BM.Bins -- confirmado su esquema completo en vivo, no hay ParentBinID ni columna de fecha de
   "ultimo movimiento" en esta tabla) sin encontrar una combinacion que aterrice cerca de ~84: incluso
   `isActive=1` solo (el filtro mas defendible de los dos, columna real con nombre inequivoco) deja
   ~1476 bins, y los EnteredDate de los mas "recientes" con isActive=1 resultaron ser de mas de un
   dia atras -- esta columna tampoco refleja actividad reciente real. La fuente que si distingue
   "aqui ahora mismo" (ParentBin/ContainerMovements, visto en sc_pallet_details del MCP) vive en
   tablas que no se pudieron identificar con certeza dentro del tiempo disponible. Se deja
   `isActive = 1` como filtro (reduce el ruido de bins ya inactivos, aunque no cierra el numero
   exacto) en vez de mostrar los 13,101 historicos completos -- la identidad de cada pallet
   (BinCode) y su % de avance (por ProductSKU/-PNP) SI estan verificados exactos contra los
   ejemplos reales que dio el usuario; lo que sigue pendiente es acotar el TOTAL de pallets
   mostrados al conjunto realmente vigente ahora mismo. */
// Sufijos de condicion realmente vendibles (2026-09-03) -- lista EXACTA de
// "reglas_de_venta.vendibles_la_mayoria_del_tiempo" + "vendibles_pero_NO_en_linea" del catalogo
// operativo real de BinManager (NEW/GRA/GRB/GRC/ICB/ICC/ICD/ICX). Usado solo para el desglose
// visual ✓ (bueno) / ✗ (malo) de "Progreso de pallets" -- nunca para decidir "terminado" (eso
// sigue siendo -PNP vs cualquier condicion real, sin importar si es buena o mala).
const SELLABLE_CONDITION_SUFFIXES = new Set(['NEW', 'GRA', 'GRB', 'GRC', 'ICB', 'ICC', 'ICD', 'ICX'])

function classifyProductSku(productSku) {
  const suffix = String(productSku || '').toUpperCase().split('-').pop()
  if (suffix === 'PNP') return 'pending'
  return SELLABLE_CONDITION_SUFFIXES.has(suffix) ? 'good' : 'bad'
}

export async function getPalletsProgress({ workCenterId = 49 }) {
  const pool = await getPool()
  const request = pool.request().input('workCenterId', sql.Int, workCenterId)
  const result = await request.query(`
    SELECT b.BinID, b.BinCode, bc.ProductSKU
    FROM BinManagerRO.BM.Bins b WITH (NOLOCK)
    INNER JOIN BinManagerRO.BM.BinContent bc WITH (NOLOCK) ON bc.BinID = b.BinID
    WHERE b.WorkStationID = @workCenterId AND b.BinCode LIKE '%-%' AND b.isActive = 1
  `)
  const byBin = new Map()
  for (const r of result.recordset) {
    if (!byBin.has(r.BinID)) {
      byBin.set(r.BinID, { id: r.BinID, binCode: r.BinCode, total: 0, done: 0, good: 0, bad: 0 })
    }
    const bin = byBin.get(r.BinID)
    bin.total += 1
    const klass = classifyProductSku(r.ProductSKU)
    if (klass !== 'pending') bin.done += 1
    if (klass === 'good') bin.good += 1
    else if (klass === 'bad') bin.bad += 1
  }
  const items = [...byBin.values()]
    .map((bin) => ({ ...bin, pct: bin.total > 0 ? (bin.done / bin.total) * 100 : 0 }))
    .sort((a, b) => a.binCode.localeCompare(b.binCode))

  const emptyBucket = () => ({ pallets: 0, pz: 0 })
  const summary = { recibidos: emptyBucket(), enProceso: emptyBucket(), terminados: emptyBucket() }
  for (const it of items) {
    const bucket = it.pct === 0 ? summary.recibidos : it.pct >= 100 ? summary.terminados : summary.enProceso
    bucket.pallets += 1
    bucket.pz += it.total
  }
  return { items, summary }
}

/* Rastreador de SKUs (2026-09-02, a peticion explicita del usuario: "un rastreador de skus... ver
   en que pallet id se fue, si se fue en alguna orden... ver si hay duplicados"). Una fila real por
   LPN inspeccionado en el rango, con:
   - Brand/Model/Tamaño: BinManagerRO.PRO.SKUData (el catalogo maestro real -- se probo primero con
     DA.SKUData/MM.SKUData como en getProductionByCategoryToday/getSizeByClassificationToday, pero
     esa combinacion deja Brand/Model vacios para varios SKU reales; PRO.SKUData es la UNICA fuente
     que tiene los 3 campos juntos y coincide exacto con la pagina real -- ej. SNTV002680 = Hisense
     65R6E4, igual que el payload real interceptado de GetTodaysProducedByWorkCenter).
   - Pallet: mismo puente que getProductionBySupplierToday (LPN -> PurchasePalletDetails ->
     PurchasePallets.PalletNumber).
   - Tags: BinManagerRO.PRO.SKUTags/Tags -- STRING_AGG de todos los tags de ese SKU (un SKU puede
     tener varios, se muestran todos, nunca solo el primero).
   - ¿Ligado a orden?: BinManagerRO.BM.BinMovements.OrderNumber, buscado por LicensePlateNumber (NO
     por SerialNumber -- se verifico en vivo que BM.BinMovements.SerialNumber en realidad guarda el
     LicensePlateNumber en la mayoria de sus filas, no el numero de serie real del fabricante; usar
     el join correcto evito falsos positivos). Normal que salga null para piezas de HOY -- toma
     tiempo despues de inspeccionado antes de ligarse a una orden real, no es un bug.
   - Duplicado: mismo SerialNumber (numero de serie real, no LPN) apareciendo en mas de un LPN
     distinto en el rango -- señal real de reproceso/doble entrada, NULLIF vacio->NULL para no
     contar seriales vacios como "duplicados" entre si. */
export async function getSkuTrackerToday({
  workCenterId = 49,
  dateFrom,
  dateTo,
  classificationCode,
  size,
  shift,
}) {
  const pool = await getPool()
  const request = pool.request()
  const cte = buildFilteredBaseCte(request, { workCenterId, dateFrom, dateTo, classificationCode, size, shift })
  const result = await request.query(`
    ${cte},
    Base AS (
      SELECT
        b.LicensePlateNumber, b.SKU, b.ClassificationCode, b.ClassificationName, b.ScreenSize,
        b.WorkOrderDetailID,
        W.SerialNumber,
        PP.PalletNumber, PP.PurchaseID,
        COUNT(*) OVER (PARTITION BY NULLIF(W.SerialNumber, '')) AS SerialCount
      FROM FilteredBase b
      INNER JOIN OE.WorkPlan W WITH (NOLOCK) ON W.LicensePlateNumber = b.LicensePlateNumber
      LEFT JOIN PO.PurchasePalletDetails PPD WITH (NOLOCK) ON PPD.LicensePlateNumber = b.LicensePlateNumber
      LEFT JOIN PO.PurchasePallets PP WITH (NOLOCK) ON PP.PurchasePalletID = PPD.PurchasePalletID
    )
    SELECT
      b.LicensePlateNumber, b.SKU, b.SerialNumber, b.ClassificationCode, b.ClassificationName,
      b.PalletNumber, b.SerialCount, b.ScreenSize,
      sd.Brand, sd.Model,
      tg.Tags,
      om.OrderNumber,
      sup.SupplierName,
      cat.CategoryName
    FROM Base b
    LEFT JOIN BinManagerRO.PRO.SKUData sd WITH (NOLOCK) ON sd.SKU = b.SKU
    OUTER APPLY (
      SELECT STRING_AGG(t.Tag, ', ') AS Tags
      FROM BinManagerRO.PRO.SKUTags st WITH (NOLOCK)
      JOIN BinManagerRO.PRO.Tags t WITH (NOLOCK) ON t.ID = st.IDTag
      WHERE st.SKU = b.SKU
    ) tg
    OUTER APPLY (
      SELECT TOP 1 bm.OrderNumber FROM BinManagerRO.BM.BinMovements bm WITH (NOLOCK)
      WHERE bm.SerialNumber = b.LicensePlateNumber AND bm.OrderNumber IS NOT NULL
      ORDER BY bm.MovementDate DESC
    ) om
    LEFT JOIN PO.Purchases pur WITH (NOLOCK) ON pur.PurchaseID = b.PurchaseID
    LEFT JOIN PO.Suppliers sup WITH (NOLOCK) ON sup.SupplierID = pur.SupplierID
    LEFT JOIN OE.WorkOrderDetails wod WITH (NOLOCK) ON wod.WorkOrderDetailID = b.WorkOrderDetailID
    LEFT JOIN DA.Categories cat WITH (NOLOCK) ON cat.CategoryID = wod.CategoryID
    ORDER BY b.LicensePlateNumber
  `)
  // Proveedor/Categoria (2026-09-02, agregado tras verificar en produccion que "click proveedor/
  // categoria" abria el Rastreador de SKUs pero nunca encontraba nada -- estos 2 campos nunca se
  // habian incluido aqui, asi que la busqueda por texto no tenia contra que comparar). Mismo puente
  // ya verificado en getProductionBySupplierToday/getProductionByCategoryToday, repetido aqui
  // porque esta consulta arma su propia proyeccion de columnas fila-por-LPN.
  return result.recordset.map((r) => ({
    lpn: r.LicensePlateNumber,
    sku: r.SKU,
    serialNumber: r.SerialNumber || null,
    classificationCode: r.ClassificationCode,
    classificationName: r.ClassificationName,
    palletNumber: r.PalletNumber ?? null,
    brand: r.Brand || null,
    model: r.Model || null,
    size: r.ScreenSize ?? null,
    tags: r.Tags || null,
    orderNumber: r.OrderNumber || null,
    supplierName: r.SupplierName || null,
    categoryName: r.CategoryName || null,
    isDuplicateSerial: r.SerialCount > 1,
  }))
}

/* Resuelve usernames de BinManager (formato "nombre.apellidoNN", ej "yesica.luna") a los campos
   REALES de nombre por separado (Name/SecondName/LastName/SecondLastName) -- nunca se parsea el
   username como si fuera el nombre, siempre se lee de ADM.UsersLogin, la tabla real de la que sale
   el nombre mostrado en el dashboard de BinManager. */
export async function getUsersLoginByUsername(usernames) {
  if (!usernames.length) return []
  const pool = await getPool()
  const request = pool.request()
  const placeholders = usernames.map((u, i) => {
    request.input(`u${i}`, sql.NVarChar, u)
    return `@u${i}`
  })
  const result = await request.query(`
    SELECT UserName, Name, SecondName, LastName, SecondLastName, WorkCenterID
    FROM ADM.UsersLogin
    WHERE UserName IN (${placeholders.join(', ')})
  `)
  return result.recordset.map((r) => ({
    username: r.UserName,
    name: r.Name,
    secondName: r.SecondName,
    lastName: r.LastName,
    secondLastName: r.SecondLastName,
    workCenterId: r.WorkCenterID,
  }))
}
