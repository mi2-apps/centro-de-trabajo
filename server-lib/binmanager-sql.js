// Conexion SQL Server DIRECTA y de SOLO LECTURA a SmartControl (BinManager/MI Technologies),
// para el Takt Time real por linea (2026-09-02, a peticion explicita del usuario: "puedes poner
// las piezas que se estan produciendo por linea, ubica las personas y es lo que lleva la linea").
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

/* Replica EXACTA (solo SELECT, sin el wrapper EXEC que la cuenta de solo lectura no puede llamar)
   de OC.sp_ProductionInspections_GetByUser -- piezas inspeccionadas por usuario en un rango de
   fechas y work center. workCenterId 49 = FFT (mismo default que el SP real y que el dashboard
   "FFT Dashboard Production" que el usuario mostro como referencia). */
export async function getProductionByUserToday({ workCenterId = 49, dateFrom, dateTo }) {
  const pool = await getPool()
  const request = pool
    .request()
    .input('workCenterId', sql.Int, workCenterId)
    .input('dateFrom', sql.Date, dateFrom)
    .input('dateTo', sql.Date, dateTo)
  const result = await request.query(`
    WITH RankedInspections AS (
      SELECT I.LicensePlateNumber, I.InspectionBy,
        ROW_NUMBER() OVER (PARTITION BY I.LicensePlateNumber ORDER BY I.InspectionDate DESC, I.InspectionID DESC) AS RN
      FROM oe.WorkPlanInspection I WITH (NOLOCK)
      INNER JOIN OE.WorkPlanItemClassifications WPIC WITH (NOLOCK) ON WPIC.ClassificationID = I.ClassificationID
      WHERE I.WorkCenterID = @workCenterId
        AND CAST(I.InspectionDate AS DATE) >= @dateFrom
        AND CAST(I.InspectionDate AS DATE) <= @dateTo
    )
    SELECT R.InspectionBy, COUNT(*) AS Qty
    FROM RankedInspections R
    INNER JOIN OE.WorkPlan W WITH (NOLOCK) ON W.LicensePlateNumber = R.LicensePlateNumber
    WHERE R.RN = 1
    GROUP BY R.InspectionBy
    ORDER BY Qty DESC
  `)
  return result.recordset.map((r) => ({ username: r.InspectionBy, qty: r.Qty }))
}

/* Desglose de piezas por clasificacion (grado: GRA/GRB/GRC/DMA/...) hoy en el work center -- para
   el modulo "Produccion FFT" (2026-09-02, espejo de FFT Dashboard Production de BinManager).
   Mismo JOIN exacto que getProductionByUserToday arriba (deduplicado por LicensePlateNumber +
   INNER JOIN OE.WorkPlan) -- verificado en vivo que da un total consistente con el de por-usuario;
   la version sin el JOIN a OE.WorkPlan (probada primero) dio un total distinto al que muestra
   BinManager, asi que se descarta esa variante aunque sea mas simple. */
export async function getProductionByClassificationToday({ workCenterId = 49, dateFrom, dateTo }) {
  const pool = await getPool()
  const request = pool
    .request()
    .input('workCenterId', sql.Int, workCenterId)
    .input('dateFrom', sql.Date, dateFrom)
    .input('dateTo', sql.Date, dateTo)
  const result = await request.query(`
    WITH RankedInspections AS (
      SELECT I.LicensePlateNumber, I.ClassificationID,
        ROW_NUMBER() OVER (PARTITION BY I.LicensePlateNumber ORDER BY I.InspectionDate DESC, I.InspectionID DESC) AS RN
      FROM oe.WorkPlanInspection I WITH (NOLOCK)
      INNER JOIN OE.WorkPlanItemClassifications WPIC WITH (NOLOCK) ON WPIC.ClassificationID = I.ClassificationID
      WHERE I.WorkCenterID = @workCenterId
        AND CAST(I.InspectionDate AS DATE) >= @dateFrom
        AND CAST(I.InspectionDate AS DATE) <= @dateTo
    )
    SELECT WPIC.ClassificationCode, WPIC.ClassificationName, COUNT(*) AS Qty
    FROM RankedInspections R
    INNER JOIN OE.WorkPlan W WITH (NOLOCK) ON W.LicensePlateNumber = R.LicensePlateNumber
    INNER JOIN OE.WorkPlanItemClassifications WPIC WITH (NOLOCK) ON WPIC.ClassificationID = R.ClassificationID
    WHERE R.RN = 1
    GROUP BY WPIC.ClassificationCode, WPIC.ClassificationName
    ORDER BY Qty DESC
  `)
  return result.recordset.map((r) => ({
    code: r.ClassificationCode,
    name: r.ClassificationName,
    qty: r.Qty,
  }))
}

/* Piezas totales por dia, ultimos N dias -- para la grafica de tendencia del modulo "Produccion
   FFT". Mismo JOIN/dedup que arriba, agrupado por fecha de inspeccion en vez de usuario/clasificacion. */
export async function getDailyThroughput({ workCenterId = 49, dateFrom, dateTo }) {
  const pool = await getPool()
  const request = pool
    .request()
    .input('workCenterId', sql.Int, workCenterId)
    .input('dateFrom', sql.Date, dateFrom)
    .input('dateTo', sql.Date, dateTo)
  const result = await request.query(`
    WITH RankedInspections AS (
      SELECT I.LicensePlateNumber, I.InspectionDate,
        ROW_NUMBER() OVER (PARTITION BY I.LicensePlateNumber ORDER BY I.InspectionDate DESC, I.InspectionID DESC) AS RN
      FROM oe.WorkPlanInspection I WITH (NOLOCK)
      INNER JOIN OE.WorkPlanItemClassifications WPIC WITH (NOLOCK) ON WPIC.ClassificationID = I.ClassificationID
      WHERE I.WorkCenterID = @workCenterId
        AND CAST(I.InspectionDate AS DATE) >= @dateFrom
        AND CAST(I.InspectionDate AS DATE) <= @dateTo
    )
    SELECT CAST(R.InspectionDate AS DATE) AS Day, COUNT(*) AS Qty
    FROM RankedInspections R
    INNER JOIN OE.WorkPlan W WITH (NOLOCK) ON W.LicensePlateNumber = R.LicensePlateNumber
    WHERE R.RN = 1
    GROUP BY CAST(R.InspectionDate AS DATE)
    ORDER BY Day ASC
  `)
  return result.recordset.map((r) => ({
    date: r.Day.toISOString().slice(0, 10),
    qty: r.Qty,
  }))
}

/* Desglose de piezas por proveedor hoy -- para el modulo "Produccion FFT". El puente real (Roman
   pidio "haz con lo que puedas" tras confirmar que el SP real -- OE.sp_GetTodaysProducedByWorkCenter
   -- no es ejecutable con esta cuenta de solo lectura, sin permiso EXECUTE): LPN -> PO.PurchasePalletDetails
   (bin/pallet donde se recibio ese LPN) -> PO.PurchasePallets -> PO.Purchases -> PO.Suppliers. Verificado
   en vivo contra el dashboard real: mismas proporciones (TRG CONSIGNMENT como mayoria absoluta, "Mit"
   como minoria chica) -- LEFT JOIN a proposito, un LPN sin match en PurchasePalletDetails sale con
   supplierName null en vez de desaparecer silenciosamente del total. */
export async function getProductionBySupplierToday({ workCenterId = 49, dateFrom, dateTo }) {
  const pool = await getPool()
  const request = pool
    .request()
    .input('workCenterId', sql.Int, workCenterId)
    .input('dateFrom', sql.Date, dateFrom)
    .input('dateTo', sql.Date, dateTo)
  const result = await request.query(`
    WITH RankedInspections AS (
      SELECT I.LicensePlateNumber,
        ROW_NUMBER() OVER (PARTITION BY I.LicensePlateNumber ORDER BY I.InspectionDate DESC, I.InspectionID DESC) AS RN
      FROM oe.WorkPlanInspection I WITH (NOLOCK)
      INNER JOIN OE.WorkPlanItemClassifications WPIC WITH (NOLOCK) ON WPIC.ClassificationID = I.ClassificationID
      WHERE I.WorkCenterID = @workCenterId
        AND CAST(I.InspectionDate AS DATE) >= @dateFrom
        AND CAST(I.InspectionDate AS DATE) <= @dateTo
    )
    SELECT S.SupplierName, COUNT(*) AS Qty
    FROM RankedInspections R
    LEFT JOIN PO.PurchasePalletDetails PPD WITH (NOLOCK) ON PPD.LicensePlateNumber = R.LicensePlateNumber
    LEFT JOIN PO.PurchasePallets PP WITH (NOLOCK) ON PP.PurchasePalletID = PPD.PurchasePalletID
    LEFT JOIN PO.Purchases P WITH (NOLOCK) ON P.PurchaseID = PP.PurchaseID
    LEFT JOIN PO.Suppliers S WITH (NOLOCK) ON S.SupplierID = P.SupplierID
    WHERE R.RN = 1
    GROUP BY S.SupplierName
    ORDER BY Qty DESC
  `)
  return result.recordset.map((r) => ({ supplierName: r.SupplierName || null, qty: r.Qty }))
}

/* Desglose de piezas por categoria hoy. Puente real: LPN -> OE.WorkPlan.WorkOrderDetailID ->
   OE.WorkOrderDetails.CategoryID -> DA.Categories -- verificado en vivo (100% de las piezas de hoy
   cayeron en "Televisions", igual que el dashboard real). DA.SKUData.CategoryID (via SKU) se probo
   primero y NO sirvio -- casi ningun SKU tenia match ahi, la categoria real viene de la orden de
   trabajo, no del catalogo de SKU. */
export async function getProductionByCategoryToday({ workCenterId = 49, dateFrom, dateTo }) {
  const pool = await getPool()
  const request = pool
    .request()
    .input('workCenterId', sql.Int, workCenterId)
    .input('dateFrom', sql.Date, dateFrom)
    .input('dateTo', sql.Date, dateTo)
  const result = await request.query(`
    WITH RankedInspections AS (
      SELECT I.LicensePlateNumber,
        ROW_NUMBER() OVER (PARTITION BY I.LicensePlateNumber ORDER BY I.InspectionDate DESC, I.InspectionID DESC) AS RN
      FROM oe.WorkPlanInspection I WITH (NOLOCK)
      INNER JOIN OE.WorkPlanItemClassifications WPIC WITH (NOLOCK) ON WPIC.ClassificationID = I.ClassificationID
      WHERE I.WorkCenterID = @workCenterId
        AND CAST(I.InspectionDate AS DATE) >= @dateFrom
        AND CAST(I.InspectionDate AS DATE) <= @dateTo
    )
    SELECT C.CategoryName, COUNT(*) AS Qty
    FROM RankedInspections R
    INNER JOIN OE.WorkPlan W WITH (NOLOCK) ON W.LicensePlateNumber = R.LicensePlateNumber
    LEFT JOIN OE.WorkOrderDetails WOD WITH (NOLOCK) ON WOD.WorkOrderDetailID = W.WorkOrderDetailID
    LEFT JOIN DA.Categories C WITH (NOLOCK) ON C.CategoryID = WOD.CategoryID
    WHERE R.RN = 1
    GROUP BY C.CategoryName
    ORDER BY Qty DESC
  `)
  return result.recordset.map((r) => ({ categoryName: r.CategoryName || null, qty: r.Qty }))
}

/* Crosstab piezas por tamaño (pulgadas de pantalla) x clasificacion, para la tabla "RESUMEN:
   unidades por tamaño y clasificacion" del dashboard real. Puente: LPN -> OE.WorkPlan.SKU ->
   MM.SKUData.ScreenSize (verificado en vivo: mismos valores de pulgadas -- 65,50,... -- que el
   dashboard real para las mismas SKU). Devuelve filas planas {size, code, qty}; el pivot a tabla
   (tamaño en columnas, clasificacion en filas) se arma en el endpoint/frontend, nunca aqui. */
export async function getSizeByClassificationToday({ workCenterId = 49, dateFrom, dateTo }) {
  const pool = await getPool()
  const request = pool
    .request()
    .input('workCenterId', sql.Int, workCenterId)
    .input('dateFrom', sql.Date, dateFrom)
    .input('dateTo', sql.Date, dateTo)
  const result = await request.query(`
    WITH RankedInspections AS (
      SELECT I.LicensePlateNumber, I.ClassificationID,
        ROW_NUMBER() OVER (PARTITION BY I.LicensePlateNumber ORDER BY I.InspectionDate DESC, I.InspectionID DESC) AS RN
      FROM oe.WorkPlanInspection I WITH (NOLOCK)
      INNER JOIN OE.WorkPlanItemClassifications WPIC WITH (NOLOCK) ON WPIC.ClassificationID = I.ClassificationID
      WHERE I.WorkCenterID = @workCenterId
        AND CAST(I.InspectionDate AS DATE) >= @dateFrom
        AND CAST(I.InspectionDate AS DATE) <= @dateTo
    )
    SELECT M.ScreenSize, WPIC.ClassificationCode, COUNT(*) AS Qty
    FROM RankedInspections R
    INNER JOIN OE.WorkPlan W WITH (NOLOCK) ON W.LicensePlateNumber = R.LicensePlateNumber
    INNER JOIN OE.WorkPlanItemClassifications WPIC WITH (NOLOCK) ON WPIC.ClassificationID = R.ClassificationID
    LEFT JOIN MM.SKUData M WITH (NOLOCK) ON M.SKU = W.SKU
    WHERE R.RN = 1
    GROUP BY M.ScreenSize, WPIC.ClassificationCode
    ORDER BY WPIC.ClassificationCode, M.ScreenSize
  `)
  return result.recordset.map((r) => ({
    size: r.ScreenSize ?? null,
    code: r.ClassificationCode,
    qty: r.Qty,
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
