// Sync automatico de personal real (SmartControl) -> Employee (2026-09-03, a peticion explicita
// del usuario: "quiero que uses la db de personal en mi pagina para que cuando haya bajas se
// eliminen en automatico y cuando haya gente nueva se agreguen"). Reglas deliberadamente
// conservadoras, mismo criterio ya establecido en api/personnel/set-unassigned-reason.js ("nunca
// buscar por nombre cuando no hay numero real, evita reactivar/pisar un fantasma"):
//
// - ALTA automatica: SOLO gente de WorkCenterID=49 (FFT/Refurbish Monterrey2, "home" real en
//   SmartControl, confirmado en vivo 2026-09-03 -- WorkCenterID=102/Calidad no tiene a NADIE como
//   home, es solo donde se checan ocasionalmente los de FFT) que (a) tiene EmployeeNumber real
//   (folio) en ADM.UsersComplement -- nunca folio vacio/nulo -- y (b) tiene una inspeccion propia
//   real en los ultimos 30 dias -- confirmado con Roman que NO se quiere toda la plantilla base
//   (144 personas activas en SmartControl), solo quien de verdad sigue trabajando. areaZona se
//   guarda como 'PRODUCCION' (mismo valor real que ya usan Juan Godinez Bautista/Marco Andrade
//   Garcia, gente real de FFT sin linea numerada conocida) -- nunca se inventa a que linea
//   pertenece (mismo criterio ya documentado en src/data/production/personnelByArea.js, decision
//   2026-08-25 "no inventar a que linea pertenecen").
//
// - BAJA automatica: cualquier Employee activo con employeeNumber real que matchea un folio de
//   SmartControl (ADM.UsersComplement) cuya cuenta este IsActive=0 -- sin importar su area (el
//   folio es un identificador real de toda la empresa: verificado en vivo 2026-09-03 que gente de
//   Paletizado/Accesorios/Soporte tambien matchea folios reales de SmartControl). Usa EXACTAMENTE
//   el mismo mecanismo real de baja que ya existe (api/personnel/set-unassigned-reason.js):
//   unassignedReason='BAJA' + active=false. Si el folio de un Employee NO tiene ningun match en
//   SmartControl, NO se toca -- no es evidencia de baja, puede ser gente en areas que SmartControl
//   no rastrea (Cajas/Chofer/Capacitacion/Ingenieria, confirmado en vivo 2026-09-03: 17 folios
//   reales sin match ahi, ninguno tocado).
//
// - Gente SIN folio (bucket "Proyecto") queda FUERA de este sync automatico a proposito -- no hay
//   llave real para matchear/deduplicar sin adivinar, y ya hay variantes de nombre reales
//   confirmadas esta sesion (Yesica/Yessica, Evelyn/Evelin) que harian un match por nombre
//   peligroso. Se maneja a mano (ver scripts/backfill-calidad-personnel-2026-09-03.mjs para el
//   alta manual, una sola vez, de los que Roman ya confirmo).

import { eq, isNotNull } from 'drizzle-orm'
import sql from 'mssql'
import { db, employee as employeeTable } from './db/client.js'

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
    pool: { max: 3, min: 0, idleTimeoutMillis: 30000 },
  }
}

export function isPersonnelSyncConfigured() {
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

const FFT_WORKCENTER_ID = 49
const RECENT_ACTIVITY_DAYS = 30

function buildFullName(r) {
  return [r.Name, r.SecondName, r.LastName, r.SecondLastName]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join(' ')
}

// Mismo formato DD/MM/YYYY ya usado por el resto de las filas de Employee.fechaIngreso (columna
// texto libre, nunca fecha real -- se respeta el formato existente en vez de cambiarlo).
function formatFechaIngreso(hireDate) {
  if (!hireDate) return null
  const d = new Date(hireDate)
  if (Number.isNaN(d.getTime())) return null
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  return `${dd}/${mm}/${yyyy}`
}

async function getActiveFolioedFftCandidates(pool) {
  const result = await pool.request().query(`
    SELECT DISTINCT uc.EmployeeNumber, uc.HireDate, ul.Name, ul.SecondName, ul.LastName, ul.SecondLastName
    FROM ADM.UsersLogin ul
    INNER JOIN ADM.UsersComplement uc ON uc.UserId = ul.UserId
    WHERE ul.WorkCenterID = ${FFT_WORKCENTER_ID}
      AND ul.IsActive = 1
      AND uc.EmployeeNumber IS NOT NULL AND LTRIM(RTRIM(uc.EmployeeNumber)) <> ''
      AND ul.UserName IN (
        SELECT DISTINCT I.InspectionBy
        FROM oe.WorkPlanInspection I WITH (NOLOCK)
        WHERE I.WorkCenterID = ${FFT_WORKCENTER_ID}
          AND I.InspectionDate >= DATEADD(DAY, -${RECENT_ACTIVITY_DAYS}, GETDATE())
      )
  `)
  return result.recordset
}

async function getFolioActiveStatusMap(pool, employeeNumbers) {
  const map = new Map()
  if (!employeeNumbers.length) return map
  const request = pool.request()
  const placeholders = employeeNumbers.map((n, i) => {
    request.input(`n${i}`, sql.NVarChar, n)
    return `@n${i}`
  })
  const result = await request.query(`
    SELECT uc.EmployeeNumber, ul.IsActive
    FROM ADM.UsersComplement uc
    INNER JOIN ADM.UsersLogin ul ON ul.UserId = uc.UserId
    WHERE uc.EmployeeNumber IN (${placeholders.join(', ')})
  `)
  for (const r of result.recordset) map.set(String(r.EmployeeNumber).trim(), !!r.IsActive)
  return map
}

/**
 * Corre el sync real: agrega personal nuevo (folio real, WorkCenterID=49, actividad reciente) y
 * da de baja al que SmartControl ya marca IsActive=0 (folio real, cualquier area). Nunca toca
 * gente sin folio. Devuelve un resumen -- nunca lanza si SmartControl no esta configurado.
 */
export async function runPersonnelSync({ dryRun = false } = {}) {
  if (!isPersonnelSyncConfigured()) {
    return {
      skipped: true,
      reason: 'SmartControl SQL no configurado (faltan env vars).',
      added: [],
      bajas: [],
    }
  }
  const pool = await getPool()
  const now = new Date()

  const allEmployees = await db
    .select({
      id: employeeTable.id,
      employeeNumber: employeeTable.employeeNumber,
      fullName: employeeTable.fullName,
      active: employeeTable.active,
    })
    .from(employeeTable)
    .where(isNotNull(employeeTable.employeeNumber))
  const employeeByNumber = new Map(allEmployees.map((e) => [String(e.employeeNumber).trim(), e]))

  // 1) ALTA
  const candidates = await getActiveFolioedFftCandidates(pool)
  const added = []
  for (const c of candidates) {
    const number = String(c.EmployeeNumber).trim()
    if (employeeByNumber.has(number)) continue
    const fullName = buildFullName(c)
    if (!fullName) continue
    if (dryRun) {
      added.push({ employeeNumber: number, fullName })
      continue
    }
    const [inserted] = await db
      .insert(employeeTable)
      .values({
        employeeNumber: number,
        fullName,
        areaZona: 'PRODUCCION',
        fechaIngreso: formatFechaIngreso(c.HireDate),
        active: true,
        smartControlSyncedAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: employeeTable.employeeNumber })
      .returning()
    if (inserted) {
      added.push({ employeeNumber: number, fullName })
      employeeByNumber.set(number, inserted)
    }
  }

  // 2) BAJA
  const activeWithNumber = allEmployees.filter((e) => e.active && e.employeeNumber)
  const statusMap = await getFolioActiveStatusMap(
    pool,
    activeWithNumber.map((e) => String(e.employeeNumber).trim()),
  )
  const bajas = []
  for (const e of activeWithNumber) {
    const number = String(e.employeeNumber).trim()
    if (statusMap.get(number) === false) {
      if (!dryRun) {
        await db
          .update(employeeTable)
          .set({
            unassignedReason: 'BAJA',
            unassignedReasonSetAt: now,
            unassignedReasonSetByUserId: null,
            active: false,
            smartControlSyncedAt: now,
            updatedAt: now,
          })
          .where(eq(employeeTable.id, e.id))
      }
      bajas.push({ employeeNumber: number, fullName: e.fullName })
    }
  }

  return { skipped: false, ranAt: now.toISOString(), added, bajas }
}
