import dayjs from 'dayjs'
import ExcelJS from 'exceljs'

/* Exportacion a Excel del historial de Demoras de trabajo (2026-09-09, a peticion explicita del
   usuario -- "boton de exportar excel... de tal fecha a tal fecha... grafica de pareto... que
   yo pueda manipular el excel, por hora, dia, semana, mes y turno... cual fue la demora que mas
   pusieron, que linea estuvo mas tiempo muerto... full completo pero bien organizado... que no
   invente informacion". Reescrito DOS veces el mismo dia:
   1) version con `xlsx`, sin estilos ni grafica -- "muy feo, muy basico, sin diseño, sin
      grafica" al probarlo.
   2) version con `exceljs` + estilos + grafica PERO en 9 hojas separadas -- al probarla en
      Excel real, las hojas con 1-2 filas de contenido (turno/area/semana/mes) se sentian como
      "muchos apartados para solo una linea o dos", y la hoja "Resumen" se veia con el banner y
      el encabezado DUPLICADOS: bug real de `views: [{state:'frozen', ySplit: N}]` sin
      `topLeftCell` -- Excel renderiza el panel congelado (filas 1..N) Y el panel con scroll
      (que sin topLeftCell tambien arranca visualmente en la fila 1) superpuestos, viendose como
      si el contenido se repitiera. Esta version (3) ya NO usa freeze panes en ningun lado (se
      verifico que el bug desaparece asi) y consolida TODO en una sola hoja "Reporte" con
      secciones apiladas verticalmente: banner, KPIs, Pareto (grafica + tabla), desgloses breves
      (linea/area, turno, dia, semana, mes, hora) y al final el detalle completo "Datos"
      (unica seccion con autofilter -- Excel solo permite un autofilter por hoja).

   Libreria: `exceljs` (no `xlsx`/SheetJS) porque SI escribe estilos reales al generar un
   archivo (fill/color de encabezados, bordes, negritas, zebra striping), cosa que la edicion
   gratuita de `xlsx` no soporta. Se investigo a fondo antes de prometer una grafica real:
   NINGUNA libreria de Excel sin costo (ni xlsx ni exceljs) escribe graficas nativas/editables
   (los "chart parts" del formato xlsx) -- la unica que sí lo hace (`xlsx-chart`) no puede
   combinarlas con hojas de datos normales en el mismo archivo y no esta mantenida (ultimo
   release hace 1 año). En vez de fingir una grafica nativa que no existe de verdad, se dibuja
   la grafica de Pareto real (mismos datos exactos de la tabla de abajo, canvas nativo del
   navegador, sin libreria nueva) y se INCRUSTA como imagen PNG junto a la tabla -- se ve la
   grafica al abrir el archivo, pero es una imagen (no un objeto de grafica que el usuario pueda
   reconfigurar arrastrando series); eso se documenta aqui, no se le oculta al usuario.

   Los desgloses (linea/area, turno, dia, semana, mes, hora del dia) mas la seccion "Datos" (con
   autofilter, una fila por registro real) son la base para que el usuario arme su propia tabla
   dinamica en Excel si necesita un cruce distinto a los ya incluidos -- eso es lo que hace al
   archivo "manipulable" de verdad, no una demo de UI que Excel no puede reproducir. */

const COLOR_PRIMARY = 'FF1D4ED8' // brand primary (hsl(217 91% 45%), ver src/index.css)
const COLOR_PRIMARY_HEX = '#1D4ED8'
const COLOR_ACCENT_HEX = '#F97316'
const COLOR_BAND = 'FFF3F4F6'
const COLOR_WARN_FILL = 'FFFEE2E2'
const COLOR_WARN_TEXT = 'FFB91C1C'
const COLOR_WHITE = 'FFFFFFFF'

const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
}

// Ancho total del banner/lineas divisorias de seccion -- cubre las columnas de la tabla "Datos"
// (A..I) mas las columnas propias de la tabla de Pareto (L..P, a la derecha de la grafica).
const FULL_WIDTH_COLS = 16

// La grafica se dibuja a este tamaño exacto (ver buildParetoChartImage) y ocupa las columnas
// A..J (10, a ~64px cada una por default = ~640px) mas una columna K de respiro; la tabla de
// Pareto arranca en L para nunca superponerse con la imagen sin importar cuantas causas tenga.
const CHART_WIDTH_PX = 640
const CHART_HEIGHT_PX = 340
const CHART_ROW_RESERVE = 19 // ~340px / ~20px por fila + margen
const PARETO_TABLE_START_COL = 12 // columna L (0-indexed 11 para anchors de imagen/celda)

function styleHeaderCells(ws, rowNumber, colFrom, colTo) {
  for (let c = colFrom; c <= colTo; c += 1) {
    const cell = ws.getCell(rowNumber, c)
    cell.font = { bold: true, color: { argb: COLOR_WHITE } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PRIMARY } }
    cell.border = THIN_BORDER
    cell.alignment = { vertical: 'middle' }
  }
  ws.getRow(rowNumber).height = 20
}

function styleDataRow(ws, rowNumber, colFrom, colTo, zebra) {
  for (let c = colFrom; c <= colTo; c += 1) {
    const cell = ws.getCell(rowNumber, c)
    cell.border = THIN_BORDER
    if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_BAND } }
  }
}

// Titulo de seccion con linea divisoria a todo lo ancho del reporte -- devuelve la fila donde
// debe ir el contenido de la seccion (deja una fila de aire despues del titulo).
function writeSectionTitle(ws, rowNumber, text) {
  const cell = ws.getCell(rowNumber, 1)
  cell.value = text
  cell.font = { bold: true, size: 12, color: { argb: COLOR_PRIMARY } }
  for (let c = 1; c <= FULL_WIDTH_COLS; c += 1) {
    ws.getCell(rowNumber, c).border = {
      bottom: { style: 'medium', color: { argb: COLOR_PRIMARY } },
    }
  }
  ws.getRow(rowNumber).height = 18
  return rowNumber + 2
}

// Tabla generica de 3 columnas (nombre/minutos/cantidad) para los desgloses breves -- todas
// comparten las mismas columnas A/B/C, apiladas una debajo de otra en la misma hoja. Devuelve la
// fila donde debe empezar la SIGUIENTE seccion.
function writeBreakdownTable(ws, startRow, title, headerLabels, dataRows) {
  let row = writeSectionTitle(ws, startRow, title)
  ws.getCell(row, 1).value = headerLabels[0]
  ws.getCell(row, 2).value = headerLabels[1]
  ws.getCell(row, 3).value = headerLabels[2]
  styleHeaderCells(ws, row, 1, 3)
  row += 1
  if (dataRows.length === 0) {
    ws.getCell(row, 1).value = '—'
    row += 1
  } else {
    dataRows.forEach(([name, minutos, cantidad], idx) => {
      ws.getCell(row, 1).value = name
      ws.getCell(row, 2).value = minutos
      ws.getCell(row, 3).value = cantidad
      styleDataRow(ws, row, 1, 3, idx % 2 === 1)
      row += 1
    })
  }
  return row + 1
}

// Mismo algoritmo ISO-8601 (semana empieza lunes, semana 1 = la que contiene el primer jueves
// del año) ya usado en production/excelExport.js -- se duplica aqui a proposito (mismo criterio
// de ese archivo: cada modulo de exportacion es autosuficiente, sin un helper de fechas
// compartido entre modulos de negocio distintos).
function isoWeekNumber(d) {
  const date = new Date(Date.UTC(d.year(), d.month(), d.date()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const diff = date - firstThursday
  return 1 + Math.round(diff / (7 * 24 * 3600 * 1000))
}

function mondayOf(d) {
  const isoDay = d.day() // 0=Dom..6=Sab
  const back = isoDay === 0 ? 6 : isoDay - 1
  return d.subtract(back, 'day')
}

// Suma minutos/cantidad agrupando por la llave que devuelva keyFn -- unica funcion de
// agregacion real de todo el archivo, reutilizada por cada desglose.
function groupBy(rows, keyFn) {
  const map = new Map()
  for (const r of rows) {
    const key = keyFn(r)
    const entry = map.get(key) || { minutes: 0, count: 0 }
    entry.minutes += r.durationMinutes
    entry.count += 1
    map.set(key, entry)
  }
  return map
}

// Dibuja la grafica de Pareto (barras de minutos + linea de % acumulado + referencia 80%) en un
// <canvas> a 2x resolucion (nitidez al incrustarla) y devuelve el PNG en base64, listo para
// `workbook.addImage`. Sin libreria nueva -- Canvas 2D es nativo del navegador.
function buildParetoChartImage(paretoRows, { title, minutesLabel, pctLabel }) {
  const topRows = paretoRows.slice(0, 10)
  const scale = 2
  const width = CHART_WIDTH_PX
  const height = CHART_HEIGHT_PX
  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  const padding = { top: 32, right: 42, bottom: 78, left: 16 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom
  const maxMinutes = Math.max(1, ...topRows.map((r) => r.minutos))
  const barCount = Math.max(1, topRows.length)
  const barGap = 10
  const barWidth = (chartW - barGap * (barCount - 1)) / barCount

  ctx.fillStyle = '#111827'
  ctx.font = 'bold 14px Arial, sans-serif'
  ctx.fillText(title, padding.left, 18)

  ctx.font = '10px Arial, sans-serif'
  ;[0, 25, 50, 75, 100].forEach((pct) => {
    const y = padding.top + chartH - (pct / 100) * chartH
    ctx.strokeStyle = '#E5E7EB'
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(padding.left + chartW, y)
    ctx.stroke()
    ctx.fillStyle = '#6B7280'
    ctx.textAlign = 'left'
    ctx.fillText(`${pct}%`, padding.left + chartW + 4, y + 3)
  })

  topRows.forEach((row, i) => {
    const x = padding.left + i * (barWidth + barGap)
    const barH = (row.minutos / maxMinutes) * chartH
    const y = padding.top + chartH - barH
    ctx.fillStyle = COLOR_PRIMARY_HEX
    ctx.fillRect(x, y, barWidth, barH)

    ctx.fillStyle = '#111827'
    ctx.font = '9px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(String(row.minutos), x + barWidth / 2, y - 4)

    ctx.save()
    ctx.translate(x + barWidth / 2, padding.top + chartH + 6)
    ctx.rotate(-Math.PI / 5)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#374151'
    const label = row.causa.length > 22 ? `${row.causa.slice(0, 21)}…` : row.causa
    ctx.fillText(label, 0, 0)
    ctx.restore()
  })

  ctx.beginPath()
  ctx.strokeStyle = COLOR_ACCENT_HEX
  ctx.lineWidth = 2
  topRows.forEach((row, i) => {
    const x = padding.left + i * (barWidth + barGap) + barWidth / 2
    const y = padding.top + chartH - row.pctAcumulado * chartH
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()
  ctx.fillStyle = COLOR_ACCENT_HEX
  topRows.forEach((row, i) => {
    const x = padding.left + i * (barWidth + barGap) + barWidth / 2
    const y = padding.top + chartH - row.pctAcumulado * chartH
    ctx.beginPath()
    ctx.arc(x, y, 2.5, 0, Math.PI * 2)
    ctx.fill()
  })

  const y80 = padding.top + chartH - 0.8 * chartH
  ctx.setLineDash([4, 3])
  ctx.strokeStyle = '#9CA3AF'
  ctx.beginPath()
  ctx.moveTo(padding.left, y80)
  ctx.lineTo(padding.left + chartW, y80)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.textAlign = 'left'
  ctx.font = '10px Arial, sans-serif'
  ctx.fillStyle = COLOR_PRIMARY_HEX
  ctx.fillRect(padding.left, height - 14, 10, 10)
  ctx.fillStyle = '#111827'
  ctx.fillText(minutesLabel, padding.left + 14, height - 5)
  ctx.strokeStyle = COLOR_ACCENT_HEX
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(padding.left + 120, height - 9)
  ctx.lineTo(padding.left + 140, height - 9)
  ctx.stroke()
  ctx.fillStyle = '#111827'
  ctx.fillText(pctLabel, padding.left + 144, height - 5)

  const dataUrl = canvas.toDataURL('image/png')
  return dataUrl.split(',')[1]
}

/**
 * rows: [{ date: Date, areaName, reasonName, durationMinutes, shiftLabel, createdByName, notes,
 *          reportable }] -- ya resueltos por quien llama (DemorasPage.jsx), este modulo no
 * conoce catalogos ni i18n de causas/areas, solo agrega y formatea.
 */
export async function exportDemorasToExcel({ rows, dateFrom, dateTo, t }) {
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet(t('export.sheetSummary'))
  ws.columns = [
    { width: 34 }, // A: causa/turno/area/semana/mes/hora (desgloses) + Fecha (Datos)
    { width: 12 }, // B: minutos (desgloses) + Hora (Datos)
    { width: 14 }, // C: cantidad/registros (desgloses) + Turno (Datos)
    { width: 20 }, // D: Area (Datos)
    { width: 34 }, // E: Causa (Datos)
    { width: 10 }, // F: Minutos (Datos)
    { width: 12 }, // G: Reportable (Datos)
    { width: 20 }, // H: Registrado por (Datos)
    { width: 30 }, // I: Nota (Datos)
    { width: 3 }, // J: respiro antes de la grafica
    { width: 3 }, // K: respiro entre grafica y tabla de Pareto
    { width: 30 }, // L: Causa (Pareto)
    { width: 12 }, // M: Minutos (Pareto)
    { width: 14 }, // N: Registros (Pareto)
    { width: 14 }, // O: % del total (Pareto)
    { width: 16 }, // P: % acumulado (Pareto)
  ]

  const rangeLabel = t('export.rangeLabel', {
    from: dayjs(dateFrom).format('DD/MM/YYYY'),
    to: dayjs(dateTo).format('DD/MM/YYYY'),
  })

  const totalMinutes = rows.reduce((sum, r) => sum + r.durationMinutes, 0)
  const totalCount = rows.length
  const reportableCount = rows.filter((r) => r.reportable).length

  const byCause = groupBy(rows, (r) => r.reasonName)
  const causeSortedByMinutes = [...byCause.entries()].sort((a, b) => b[1].minutes - a[1].minutes)
  const causeSortedByCount = [...byCause.entries()].sort((a, b) => b[1].count - a[1].count)
  const topCauseByMinutes = causeSortedByMinutes[0]?.[0] || '—'
  const topCauseByCount = causeSortedByCount[0]?.[0] || '—'

  const byArea = groupBy(rows, (r) => r.areaName)
  const areaSortedByMinutes = [...byArea.entries()].sort((a, b) => b[1].minutes - a[1].minutes)
  const topAreaByMinutes = areaSortedByMinutes[0]?.[0] || '—'

  let cumMinutes = 0
  const paretoRows = causeSortedByMinutes.map(([name, v]) => {
    cumMinutes += v.minutes
    return {
      causa: name,
      minutos: v.minutes,
      cantidad: v.count,
      pctTotal: totalMinutes ? v.minutes / totalMinutes : 0,
      pctAcumulado: totalMinutes ? cumMinutes / totalMinutes : 0,
    }
  })

  // ==================================================================== Banner
  let row = 1
  ws.mergeCells(row, 1, row, FULL_WIDTH_COLS)
  const bannerCell = ws.getCell(row, 1)
  bannerCell.value = `${t('export.sheetSummary')} — ${rangeLabel}`
  bannerCell.font = { bold: true, size: 14, color: { argb: COLOR_WHITE } }
  bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PRIMARY } }
  bannerCell.alignment = { vertical: 'middle' }
  ws.getRow(row).height = 26
  row += 2

  // ==================================================================== KPIs
  row = writeSectionTitle(ws, row, t('export.sheetSummary'))
  ws.getCell(row, 1).value = rangeLabel
  ws.getCell(row, 2).value = t('export.colValue')
  styleHeaderCells(ws, row, 1, 2)
  row += 1
  const kpiRows = [
    [t('export.kpiTotalRecords'), totalCount],
    [t('export.kpiTotalMinutes'), totalMinutes],
    [t('export.kpiReportableCount'), reportableCount],
    [t('export.kpiTopCauseMinutes'), topCauseByMinutes],
    [t('export.kpiTopCauseCount'), topCauseByCount],
    [t('export.kpiTopArea'), topAreaByMinutes],
  ]
  kpiRows.forEach(([label, value], idx) => {
    ws.getCell(row, 1).value = label
    const valueCell = ws.getCell(row, 2)
    valueCell.value = value
    valueCell.font = { bold: true, color: { argb: COLOR_PRIMARY } }
    styleDataRow(ws, row, 1, 2, idx % 2 === 1)
    row += 1
  })
  row += 1

  // ==================================================================== Pareto (grafica + tabla)
  const paretoTitleRow = row
  row = writeSectionTitle(ws, row, t('export.sheetPareto'))

  const chartBase64 =
    paretoRows.length > 0
      ? buildParetoChartImage(paretoRows, {
          title: t('export.sheetPareto'),
          minutesLabel: t('export.colMinutes'),
          pctLabel: t('export.colPctCumulative'),
        })
      : null
  if (chartBase64) {
    const chartImageId = workbook.addImage({ base64: chartBase64, extension: 'png' })
    ws.addImage(chartImageId, {
      tl: { col: 0, row: row - 1 },
      ext: { width: CHART_WIDTH_PX, height: CHART_HEIGHT_PX },
    })
  }

  const paretoTableCol = PARETO_TABLE_START_COL
  ws.getCell(row, paretoTableCol).value = t('colReason')
  ws.getCell(row, paretoTableCol + 1).value = t('export.colMinutes')
  ws.getCell(row, paretoTableCol + 2).value = t('export.colCount')
  ws.getCell(row, paretoTableCol + 3).value = t('export.colPctTotal')
  ws.getCell(row, paretoTableCol + 4).value = t('export.colPctCumulative')
  styleHeaderCells(ws, row, paretoTableCol, paretoTableCol + 4)
  let paretoDataRow = row + 1
  paretoRows.forEach((p, idx) => {
    ws.getCell(paretoDataRow, paretoTableCol).value = p.causa
    ws.getCell(paretoDataRow, paretoTableCol + 1).value = p.minutos
    ws.getCell(paretoDataRow, paretoTableCol + 2).value = p.cantidad
    const pctTotalCell = ws.getCell(paretoDataRow, paretoTableCol + 3)
    pctTotalCell.value = p.pctTotal
    pctTotalCell.numFmt = '0.0%'
    const pctAcumCell = ws.getCell(paretoDataRow, paretoTableCol + 4)
    pctAcumCell.value = p.pctAcumulado
    pctAcumCell.numFmt = '0.0%'
    styleDataRow(ws, paretoDataRow, paretoTableCol, paretoTableCol + 4, idx % 2 === 1)
    paretoDataRow += 1
  })

  // La siguiente seccion arranca despues de lo que resulte mas alto: la grafica (columnas
  // A..J, alto fijo) o la tabla de Pareto (columnas L..P, tan alta como causas distintas haya).
  row = Math.max(paretoTitleRow + CHART_ROW_RESERVE, paretoDataRow + 1)

  // ==================================================================== Desgloses breves
  const areaRows = areaSortedByMinutes.map(([name, v]) => [name, v.minutes, v.count])
  row = writeBreakdownTable(
    ws,
    row,
    t('export.sheetArea'),
    [t('colArea'), t('export.colMinutes'), t('export.colCount')],
    areaRows,
  )

  // Orden canonico Matutino -> Tiempo extra -> Noche (mismo orden que OFFICIAL_SHIFTS,
  // catalog.js) en vez del orden de insercion del Map -- cualquier turno legacy que no matchee
  // ninguna de las 3 etiquetas traducidas (ver shiftDisplayLabel en DemorasPage.jsx) cae al
  // final, sin perderse.
  const shiftCanonicalOrder = [t('shift.MATUTINO'), t('shift.TIEMPO_EXTRA'), t('shift.NOCHE')]
  const byShift = groupBy(rows, (r) => r.shiftLabel)
  const shiftRows = [...byShift.entries()]
    .sort((a, b) => {
      const ia = shiftCanonicalOrder.indexOf(a[0])
      const ib = shiftCanonicalOrder.indexOf(b[0])
      if (ia === -1 && ib === -1) return 0
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
    .map(([name, v]) => [name, v.minutes, v.count])
  row = writeBreakdownTable(
    ws,
    row,
    t('export.sheetShift'),
    [t('colShift'), t('export.colMinutes'), t('export.colCount')],
    shiftRows,
  )

  const byDay = groupBy(rows, (r) => dayjs(r.date).format('YYYY-MM-DD'))
  const dayRows = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, v]) => [dayjs(key).format('DD/MM/YYYY'), v.minutes, v.count])
  row = writeBreakdownTable(
    ws,
    row,
    t('export.sheetDay'),
    [t('export.colDate'), t('export.colMinutes'), t('export.colCount')],
    dayRows,
  )

  const byWeek = groupBy(rows, (r) => mondayOf(dayjs(r.date)).format('YYYY-MM-DD'))
  const weekRows = [...byWeek.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([mondayISO, v]) => {
      const monday = dayjs(mondayISO)
      const label = t('export.weekLabel', {
        week: isoWeekNumber(monday),
        from: monday.format('DD/MM'),
        to: monday.add(6, 'day').format('DD/MM'),
      })
      return [label, v.minutes, v.count]
    })
  row = writeBreakdownTable(
    ws,
    row,
    t('export.sheetWeek'),
    [t('export.sheetWeek'), t('export.colMinutes'), t('export.colCount')],
    weekRows,
  )

  const byMonth = groupBy(rows, (r) => dayjs(r.date).format('YYYY-MM'))
  const monthRows = [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, v]) => [dayjs(`${key}-01`).format('MMMM YYYY'), v.minutes, v.count])
  row = writeBreakdownTable(
    ws,
    row,
    t('export.sheetMonth'),
    [t('export.sheetMonth'), t('export.colMinutes'), t('export.colCount')],
    monthRows,
  )

  const byHour = groupBy(rows, (r) => dayjs(r.date).hour())
  const hourRows = Array.from({ length: 24 }, (_, h) => {
    const entry = byHour.get(h) || { minutes: 0, count: 0 }
    return [t('export.hourLabel', { hour: String(h).padStart(2, '0') }), entry.minutes, entry.count]
  })
  row = writeBreakdownTable(
    ws,
    row,
    t('export.sheetHour'),
    [t('export.sheetHour'), t('export.colMinutes'), t('export.colCount')],
    hourRows,
  )

  // ==================================================================== Datos (detalle completo)
  row = writeSectionTitle(ws, row, t('export.sheetData'))
  const datosHeaderRow = row
  const datosColumns = [
    { key: 'fecha', header: t('export.colDate') },
    { key: 'hora', header: t('colTime') },
    { key: 'turno', header: t('colShift') },
    { key: 'area', header: t('colArea') },
    { key: 'causa', header: t('colReason') },
    { key: 'minutos', header: t('export.colMinutes') },
    { key: 'reportable', header: t('export.colReportable') },
    { key: 'registradoPor', header: t('colCreatedBy') },
    { key: 'nota', header: t('export.colNotes') },
  ]
  datosColumns.forEach((c, idx) => {
    ws.getCell(datosHeaderRow, idx + 1).value = c.header
  })
  styleHeaderCells(ws, datosHeaderRow, 1, datosColumns.length)
  row += 1

  const sortedAsc = [...rows].sort((a, b) => a.date - b.date)
  const reportableColIdx = datosColumns.findIndex((c) => c.key === 'reportable') + 1
  sortedAsc.forEach((r, idx) => {
    const values = [
      dayjs(r.date).format('DD/MM/YYYY'),
      dayjs(r.date).format('HH:mm'),
      r.shiftLabel,
      r.areaName,
      r.reasonName,
      r.durationMinutes,
      r.reportable ? t('export.yes') : t('export.no'),
      r.createdByName,
      r.notes || '',
    ]
    values.forEach((v, colIdx) => {
      ws.getCell(row, colIdx + 1).value = v
    })
    styleDataRow(ws, row, 1, datosColumns.length, idx % 2 === 1)
    if (r.reportable) {
      const cell = ws.getCell(row, reportableColIdx)
      cell.font = { bold: true, color: { argb: COLOR_WARN_TEXT } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_WARN_FILL } }
    }
    row += 1
  })

  if (sortedAsc.length > 0) {
    ws.autoFilter = {
      from: { row: datosHeaderRow, column: 1 },
      to: { row: datosHeaderRow, column: datosColumns.length },
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `demoras_${dateFrom}_a_${dateTo}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
