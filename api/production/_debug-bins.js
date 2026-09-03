// Endpoint TEMPORAL de diagnostico (2026-09-02) -- introspeccion de columnas reales de
// BinManagerRO.BM.Bins/BM.BinContent para corregir getPalletsProgress (el conteo de "Progreso de
// pallets" salio inflado: 1670 pallets totales en vivo vs. ~84 reales que muestra la pagina externa
// -- WorkStationID en BM.Bins parece fijarse al CREAR el bin y nunca cambiar, asi que no distingue
// "actualmente en el area FFT" de historico/ya movido). Se elimina en cuanto se use.
import { requireModuleAccess } from '../../server-lib/auth.js'
import { isBinManagerSqlConfigured } from '../../server-lib/binmanager-sql.js'
import sql from 'mssql'

async function getPool() {
  const {
    SMARTCONTROL_SQLSERVER_HOST,
    SMARTCONTROL_SQLSERVER_PORT,
    SMARTCONTROL_SQLSERVER_USER,
    SMARTCONTROL_SQLSERVER_PASSWORD,
    SMARTCONTROL_SQLSERVER_DB,
  } = process.env
  return new sql.ConnectionPool({
    server: SMARTCONTROL_SQLSERVER_HOST,
    port: Number(SMARTCONTROL_SQLSERVER_PORT) || 1433,
    user: SMARTCONTROL_SQLSERVER_USER,
    password: SMARTCONTROL_SQLSERVER_PASSWORD,
    database: SMARTCONTROL_SQLSERVER_DB,
    options: { encrypt: true, trustServerCertificate: true },
    requestTimeout: 20000,
    connectionTimeout: 15000,
  }).connect()
}

export default requireModuleAccess(
  '/produccion-fft',
  async (req, res) => {
    if (!isBinManagerSqlConfigured()) return res.status(200).json({ configured: false })
    try {
      const pool = await getPool()
      const [countByStatus, sampleActive] = await Promise.all([
        pool.request().query(`
          SELECT isActive, BinStatus, COUNT(*) AS Qty
          FROM BinManagerRO.BM.Bins WITH (NOLOCK)
          WHERE WorkStationID = 49 AND BinCode LIKE '%-%'
          GROUP BY isActive, BinStatus
          ORDER BY Qty DESC
        `),
        pool.request().query(`
          SELECT TOP 10 BinID, BinCode, BinStatus, isActive, EnteredDate
          FROM BinManagerRO.BM.Bins WITH (NOLOCK)
          WHERE WorkStationID = 49 AND BinCode LIKE '%-%' AND isActive = 1
          ORDER BY EnteredDate DESC
        `),
      ])
      await pool.close()
      return res.status(200).json({
        countByStatus: countByStatus.recordset,
        sampleActive: sampleActive.recordset,
      })
    } catch (err) {
      return res.status(200).json({ error: err.message })
    }
  },
)
