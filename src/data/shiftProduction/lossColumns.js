// Columnas fijas de perdida de Hora por Hora (2026-09-04, a peticion explicita del usuario tras
// entregar el Excel real "Hora_por_Hora_FFT_7a5.xlsx" -- ya NO es un catalogo dinamico de
// causas con incidencias/modal, son EXACTAMENTE estas 11 columnas fijas, una por hora, en la
// hoja "Hora por Hora" del Excel real, mismo orden. Fuente unica reusada por el API (validacion,
// suma de TOTAL PERDIDAS) y el frontend (encabezados de tabla, Excel export, grafica de
// perdidas por causa) -- nunca duplicar esta lista en dos lugares.
export const LOSS_COLUMNS = [
  { key: 'materialVirginLoss', labelKey: 'colMaterialVirgin' },
  { key: 'materialWarehouseLoss', labelKey: 'colMaterialWarehouse' },
  { key: 'systemLoss', labelKey: 'colSystem' },
  { key: 'internetLoss', labelKey: 'colInternet' },
  { key: 'scannerLoss', labelKey: 'colScanner' },
  { key: 'printerLoss', labelKey: 'colPrinter' },
  { key: 'labelsLoss', labelKey: 'colLabels' },
  { key: 'lpnPalletLoss', labelKey: 'colLpnPallet' },
  { key: 'personnelLoss', labelKey: 'colPersonnel' },
  { key: 'qualityLoss', labelKey: 'colQuality' },
  { key: 'otherLoss', labelKey: 'colOther' },
]

export const LOSS_COLUMN_KEYS = LOSS_COLUMNS.map((c) => c.key)

// Number(...) siempre (2026-09-04) -- mientras el usuario edita una celda de perdida, el estado
// local optimista puede traer el string crudo del input ("5", incluso "") antes de que el
// autosave la confirme; sumar strings con + concatenaria en vez de sumar ("0"+"5"="05").
export function computeTotalLoss(entry) {
  return LOSS_COLUMNS.reduce((sum, c) => sum + (Number(entry[c.key]) || 0), 0)
}
