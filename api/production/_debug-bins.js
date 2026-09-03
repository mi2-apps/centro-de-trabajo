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
      const [binsCols, contentCols, sampleBins, countByWorkStation] = await Promise.all([
        pool.request().query(`
          SELECT COLUMN_NAME, DATA_TYPE FROM BinManagerRO.INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = 'BM' AND TABLE_NAME = 'Bins' ORDER BY ORDINAL_POSITION
        `),
        pool.request().query(`
          SELECT COLUMN_NAME, DATA_TYPE FROM BinManagerRO.INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = 'BM' AND TABLE_NAME = 'BinContent' ORDER BY ORDINAL_POSITION
        `),
        pool.request().query(`
          SELECT * FROM BinManagerRO.BM.Bins WITH (NOLOCK) WHERE BinID IN (405576, 405670)
        `),
        pool.request().query(`
          SELECT WorkStationID, COUNT(*) AS Qty FROM BinManagerRO.BM.Bins WITH (NOLOCK)
          WHERE BinCode LIKE '%-%' GROUP BY WorkStationID ORDER BY Qty DESC
        `),
      ])
      await pool.close()
      return res.status(200).json({
        binsColumns: binsCols.recordset,
        contentColumns: contentCols.recordset,
        sampleBins: sampleBins.recordset,
        countByWorkStation: countByWorkStation.recordset,
      })
    } catch (err) {
      return res.status(200).json({ error: err.message })
    }
  },
)
