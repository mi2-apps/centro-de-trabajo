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
   que ya estaba en produccion antes de este filtro (sin filtro extra). */
function buildFilteredBaseCte(request, { workCenterId, dateFrom, dateTo, classificationCode, size }) {
  request.input('workCenterId', sql.Int, workCenterId)
  request.input('dateFrom', sql.Date, dateFrom)
  request.input('dateTo', sql.Date, dateTo)
  let extraWhere = ''
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
        AND CAST(I.InspectionDate AS DATE) >= @dateFrom
        AND CAST(I.InspectionDate AS DATE) <= @dateTo
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
}) {
  const pool = await getPool()
  const request = pool.request()
  const cte = buildFilteredBaseCte(request, { workCenterId, dateFrom, dateTo, classificationCode, size })
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
}) {
  const pool = await getPool()
  const request = pool.request()
  const cte = buildFilteredBaseCte(request, { workCenterId, dateFrom, dateTo, classificationCode, size })
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
}) {
  const pool = await getPool()
  const request = pool.request()
  const cte = buildFilteredBaseCte(request, { workCenterId, dateFrom, dateTo, classificationCode, size })
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
}) {
  const pool = await getPool()
  const request = pool.request()
  const cte = buildFilteredBaseCte(request, { workCenterId, dateFrom, dateTo, classificationCode, size })
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
}) {
  const pool = await getPool()
  const request = pool.request()
  const cte = buildFilteredBaseCte(request, { workCenterId, dateFrom, dateTo, classificationCode, size })
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
}) {
  const pool = await getPool()
  const request = pool.request()
  const cte = buildFilteredBaseCte(request, { workCenterId, dateFrom, dateTo, classificationCode, size })
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
}) {
  const pool = await getPool()
  const request = pool.request()
  const cte = buildFilteredBaseCte(request, { workCenterId, dateFrom, dateTo, classificationCode, size })
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

/* Progreso de pallets (2026-09-02, a peticion explicita del usuario -- KPI y tarjeta del rediseño
   de Producción FFT). Fuente real: PO.PurchasePallets, filtrada por WorkCenterID -- es una cola de
   pallets abiertos/recientes de este work center (la tabla no tiene columna de fecha propia por
   pallet, asi que NO se filtra por rango de fechas -- son los pallets vigentes ahora mismo, mismo
   criterio que "Progreso de pallets" del dashboard real, que tampoco reacciona a los filtros de
   fecha en la pagina externa). "Terminado" = IsClosedPallet=1 (unico estado inequivoco de los
   campos reales); el % de cada pallet es PalletQuantityProcess/PalletQuantityExpected -- ambos
   campos reales de la tabla, nunca una meta inventada. NOTA HONESTA: los campos PalletReceived/
   PalletInspected/PalletProcess (bits) no tienen una interpretacion 100% verificada como
   "Recibidos/En proceso" (pendiente de confirmar con mas tiempo online); se muestran las
   cantidades REALES (Expected/Received/Process) sin forzar una etiqueta de estado que no se pueda
   respaldar. */
export async function getPalletsProgress({ workCenterId = 49 }) {
  const pool = await getPool()
  const request = pool.request().input('workCenterId', sql.Int, workCenterId)
  const result = await request.query(`
    SELECT
      PurchasePalletID, PalletNumber, PalletQuantityExpected, PalletQuantityReceived,
      PalletQuantityInspection, PalletQuantityProcess, IsClosedPallet
    FROM PO.PurchasePallets WITH (NOLOCK)
    WHERE WorkCenterID = @workCenterId AND PalletNumber <> 1
    ORDER BY PalletNumber DESC
  `)
  // NOTA HONESTA (2026-09-02, investigado a fondo tras confusion real del usuario viendo produccion):
  // PalletNumber = 1 NO es un pallet de linea real -- es un valor default/legado que comparten
  // decenas de registros distintos de intake masivo (PalletQuantityExpected en cientos/miles,
  // PalletQuantityProcess siempre 0 -- material recibido en bulto que todavia no se reparte a
  // pallets de trabajo individuales). Mezclarlos con los pallets reales de linea (numerados
  // 151-158, con avance real pieza por pieza) es lo que hacia esta tarjeta ilegible ("veo 158 a 152
  // y despues puros 1 con unidades muy altas"). Se excluyen aqui a proposito -- "Progreso de
  // pallets" ahora muestra solo pallets de trabajo reales, nunca intake sin procesar disfrazado de
  // pallet individual.
  return result.recordset.map((r) => ({
    id: r.PurchasePalletID,
    palletNumber: r.PalletNumber,
    expected: r.PalletQuantityExpected ?? 0,
    received: r.PalletQuantityReceived ?? 0,
    inspected: r.PalletQuantityInspection ?? 0,
    processed: r.PalletQuantityProcess ?? 0,
    isClosed: !!r.IsClosedPallet,
  }))
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
}) {
  const pool = await getPool()
  const request = pool.request()
  const cte = buildFilteredBaseCte(request, { workCenterId, dateFrom, dateTo, classificationCode, size })
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
