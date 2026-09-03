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
  }).connect()
}

export default requireModuleAccess(
  '/produccion-fft',
  async (req, res) => {
    if (!isBinManagerSqlConfigured()) return res.status(200).json({ configured: false })
    try {
      const pool = await getPool()
      const [sampleBins, countByStatus, sampleActive, contentForActive] = await Promise.all([
        pool.request().query(`
          SELECT * FROM BinManagerRO.BM.Bins WITH (NOLOCK) WHERE BinID IN (405576, 405670)
        `),
        pool.request().query(`
          SELECT WorkStationID, isActive, BinStatus, COUNT(*) AS Qty
          FROM BinManagerRO.BM.Bins WITH (NOLOCK)
          WHERE WorkStationID = 49 AND BinCode LIKE '%-%'
          GROUP BY WorkStationID, isActive, BinStatus
          ORDER BY Qty DESC
        `),
        pool.request().query(`
          SELECT TOP 10 BinID, BinCode, BinStatus, isActive, EnteredDate
          FROM BinManagerRO.BM.Bins WITH (NOLOCK)
          WHERE WorkStationID = 49 AND BinCode LIKE '%-%' AND isActive = 1
          ORDER BY EnteredDate DESC
        `),
        pool.request().query(`
          SELECT b.BinID, b.BinCode, COUNT(*) AS items
          FROM BinManagerRO.BM.Bins b WITH (NOLOCK)
          INNER JOIN BinManagerRO.BM.BinContent bc WITH (NOLOCK) ON bc.BinID = b.BinID
          WHERE b.WorkStationID = 49 AND b.BinCode LIKE '%-%' AND b.isActive = 1
          GROUP BY b.BinID, b.BinCode
        `),
      ])
      await pool.close()
      return res.status(200).json({
        sampleBins: sampleBins.recordset,
        countByStatus: countByStatus.recordset,
        sampleActive: sampleActive.recordset,
        activeBinCount: contentForActive.recordset.length,
        activeBinTotalItems: contentForActive.recordset.reduce((s, r) => s + r.items, 0),
      })
    } catch (err) {
      return res.status(200).json({ error: err.message })
    }
  },
)
