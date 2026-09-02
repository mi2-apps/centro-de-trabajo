// Rastreador de SKUs (2026-09-02, a peticion explicita del usuario: "un rastreador de skus... ver
// en que pallet id se fue, si se fue en alguna orden... ver si hay duplicados"). SOLO LECTURA.
//
// Endpoint separado de fft-summary.js (no se agrega ahi) a proposito: esta consulta cruza
// muchas mas tablas (BinManagerRO.PRO.SKUData/SKUTags/Tags + BM.BinMovements) y devuelve ~1,400
// filas -- cargarla en cada render de la pagina principal la haria mas lenta sin necesidad. El
// frontend la pide solo cuando el usuario abre el rastreador (bajo demanda).

import { requireModuleAccess } from '../../server-lib/auth.js'
import { getSkuTrackerToday, isBinManagerSqlConfigured } from '../../server-lib/binmanager-sql.js'
import { todayDateOnly } from '../../server-lib/personnel.js'

export default requireModuleAccess(
  '/produccion-fft',
  async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    if (!isBinManagerSqlConfigured()) {
      return res.status(200).json({ configured: false, rows: [] })
    }

    const workCenterId = Number(req.query.workCenterId) || 49
    const today = todayDateOnly()

    let rows
    try {
      rows = await getSkuTrackerToday({ workCenterId, dateFrom: today, dateTo: today })
    } catch (err) {
      return res.status(200).json({ configured: true, error: err.message, rows: [] })
    }

    return res.status(200).json({ configured: true, rows })
  },
)
