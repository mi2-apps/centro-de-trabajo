// Rastreador de SKUs (2026-09-02, a peticion explicita del usuario: "un rastreador de skus... ver
// en que pallet id se fue, si se fue en alguna orden... ver si hay duplicados"). SOLO LECTURA.
//
// Endpoint separado de fft-summary.js (no se agrega ahi) a proposito: esta consulta cruza muchas
// mas tablas (BinManagerRO.PRO.SKUData/SKUTags/Tags + BM.BinMovements) y devuelve ~1,400 filas --
// cargarla en cada render de la pagina principal la haria mas lenta sin necesidad. El frontend la
// pide solo cuando el usuario abre el rastreador (bajo demanda).
//
// 2026-09-02 (rediseño): acepta los mismos filtros reales que fft-summary.js (rango de fechas/
// clasificacion/pulgadas/work center) para que el rastreador respete el filtro global del modulo
// en vez de siempre mostrar "hoy" sin importar lo que el usuario haya elegido arriba.

import { requireModuleAccess } from '../../server-lib/auth.js'
import { getSkuTrackerToday, isBinManagerSqlConfigured } from '../../server-lib/binmanager-sql.js'
import { todayDateOnly } from '../../server-lib/personnel.js'

function parseDateParam(value, fallback) {
  if (!value) return fallback
  const d = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? fallback : d
}

export default requireModuleAccess(
  '/produccion-fft',
  async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    if (!isBinManagerSqlConfigured()) {
      return res.status(200).json({ configured: false, rows: [] })
    }

    const workCenterId = Number(req.query.workCenterId) || 49
    const classificationCode = req.query.classificationCode || undefined
    const size = req.query.size || undefined
    const today = todayDateOnly()
    const dateFrom = parseDateParam(req.query.dateFrom, today)
    const dateTo = parseDateParam(req.query.dateTo, today)

    let rows
    try {
      rows = await getSkuTrackerToday({ workCenterId, dateFrom, dateTo, classificationCode, size })
    } catch (err) {
      return res.status(200).json({ configured: true, error: err.message, rows: [] })
    }

    return res.status(200).json({ configured: true, rows })
  },
)
