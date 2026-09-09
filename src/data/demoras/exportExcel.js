import dayjs from 'dayjs'
import ExcelJS from 'exceljs'

/* Exportacion a Excel del historial de Demoras de trabajo (2026-09-09, a peticion explicita del
   usuario -- "boton de exportar excel... de tal fecha a tal fecha... grafica de pareto... que
   yo pueda manipular el excel, por hora, dia, semana, mes y turno... cual fue la demora que mas
   pusieron, que linea estuvo mas tiempo muerto... full completo pero bien organizado... que no
   invente informacion". Reescrito el mismo dia porque la primera version (con `xlsx`, sin
   estilos ni grafica) le parecio "muy feo, muy basico, sin diseño, sin grafica" al probarlo).

   Cambio de libreria: `xlsx` (SheetJS edicion community) a `exceljs` -- exceljs SI escribe
   estilos reales al generar un archivo (fill/color de encabezados, bordes, negritas, zebra
   striping, freeze panes), cosa que la edicion gratuita de `xlsx` no soporta. Se investigo a
   fondo antes de prometer una grafica real: NINGUNA libreria de Excel sin costo (ni xlsx ni
   exceljs) escribe graficas nativas/editables (los "chart parts" del formato xlsx) -- la unica
   que sí lo hace (`xlsx-chart`) no puede combinarlas con hojas de datos normales en el mismo
   archivo y no esta mantenida (ultimo release hace 1 año). En vez de fingir una grafica nativa
   que no existe de verdad, se dibuja la grafica de Pareto real (con los mismos datos exactos de
   la hoja "Pareto por causa", canvas nativo del navegador, sin libreria nueva) y se INCRUSTA como
   imagen PNG en las hojas "Resumen" y "Pareto por causa" -- se ve la grafica al abrir el archivo,
   pero es una imagen (no un objeto de grafica que el usuario pueda reconfigurar arrastrando
   series); eso se documenta aqui, no se le oculta al usuario.

   Cada hoja de desglose (turno/dia/semana/mes/hora del dia) mas la hoja "Datos" (con
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

function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLOR_WHITE } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PRIMARY } }
    cell.border = THIN_BORDER
    cell.alignment = { vertical: 'middle' }
  })
  row.height = 20
}

function styleBannerCell(cell, text) {
  cell.value = text
  cell.font = { bold: true, size: 13, color: { argb: COLOR_WHITE } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PRIMARY } }
  cell.alignment = { vertical: 'middle' }
}

// Tabla generica con encabezado + zebra striping + bordes + freeze pane + autofilter -- usada
// por todas las hojas de desglose (turno/dia/semana/mes/hora/area) y por "Datos".
function buildTableSheet(workbook, sheetName, columns, rows) {
  const ws = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 16 }))
  styleHeaderRow(ws.getRow(1))
  rows.forEach((r, idx) => {
    const row = ws.addRow(r)
    row.eachCell((cell) => {
      cell.border = THIN_BORDER
      if (idx % 2 === 1)
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_BAND } }
    })
  })
  columns.forEach((c, colIdx) => {
    if (c.numFmt) ws.getColumn(colIdx + 1).numFmt = c.numFmt
  })
  if (rows.length > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
  }
  return ws
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
// agregacion real de todo el archivo, reutilizada por cada hoja de desglose.
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
  const width = 640
  const height = 340
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

  const chartBase64 =
    paretoRows.length > 0
      ? buildParetoChartImage(paretoRows, {
          title: t('export.sheetPareto'),
          minutesLabel: t('export.colMinutes'),
          pctLabel: t('export.colPctCumulative'),
        })
      : null
  const chartImageId = chartBase64
    ? workbook.addImage({ base64: chartBase64, extension: 'png' })
    : null

  // ---------------------------------------------------------------- Hoja "Resumen"
  const resumenWs = workbook.addWorksheet('Resumen', { views: [{ state: 'frozen', ySplit: 3 }] })
  resumenWs.columns = [{ width: 40 }, { width: 26 }, { width: 14 }, { width: 4 }]
  resumenWs.mergeCells('A1:C1')
  styleBannerCell(resumenWs.getCell('A1'), `${t('export.sheetSummary')} — ${rangeLabel}`)
  resumenWs.getRow(1).height = 24

  const kpiHeaderRow = resumenWs.getRow(3)
  kpiHeaderRow.getCell(1).value = rangeLabel
  kpiHeaderRow.getCell(2).value = t('export.colValue')
  styleHeaderRow(kpiHeaderRow)

  const kpiRows = [
    [t('export.kpiTotalRecords'), totalCount],
    [t('export.kpiTotalMinutes'), totalMinutes],
    [t('export.kpiReportableCount'), reportableCount],
    [t('export.kpiTopCauseMinutes'), topCauseByMinutes],
    [t('export.kpiTopCauseCount'), topCauseByCount],
    [t('export.kpiTopArea'), topAreaByMinutes],
  ]
  kpiRows.forEach(([label, value], idx) => {
    const row = resumenWs.getRow(4 + idx)
    row.getCell(1).value = label
    row.getCell(2).value = value
    row.getCell(2).font = { bold: true, color: { argb: COLOR_PRIMARY } }
    row.getCell(2).alignment = { horizontal: 'right' }
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      if (colNum > 2) return
      cell.border = THIN_BORDER
      if (idx % 2 === 1)
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_BAND } }
    })
  })

  const paretoPreviewTitleRow = resumenWs.getRow(11)
  paretoPreviewTitleRow.getCell(1).value = t('export.paretoPreviewTitle')
  paretoPreviewTitleRow.getCell(1).font = { bold: true }

  const miniHeaderRow = resumenWs.getRow(12)
  miniHeaderRow.getCell(1).value = t('colReason')
  miniHeaderRow.getCell(2).value = t('export.colMinutes')
  miniHeaderRow.getCell(3).value = t('export.colCount')
  styleHeaderRow(miniHeaderRow)

  causeSortedByMinutes.slice(0, 5).forEach(([name, v], idx) => {
    const row = resumenWs.getRow(13 + idx)
    row.getCell(1).value = name
    row.getCell(2).value = v.minutes
    row.getCell(3).value = v.count
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      if (colNum > 3) return
      cell.border = THIN_BORDER
      if (idx % 2 === 1)
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_BAND } }
    })
  })

  if (chartImageId !== null) {
    resumenWs.addImage(chartImageId, { tl: { col: 4, row: 0 }, ext: { width: 480, height: 255 } })
  }

  // ---------------------------------------------------------------- Hoja "Datos" (cruda)
  const sortedAsc = [...rows].sort((a, b) => a.date - b.date)
  const datosColumns = [
    { key: 'fecha', header: t('export.colDate'), width: 12 },
    { key: 'hora', header: t('colTime'), width: 8 },
    { key: 'turno', header: t('colShift'), width: 14 },
    { key: 'area', header: t('colArea'), width: 20 },
    { key: 'causa', header: t('colReason'), width: 34 },
    { key: 'minutos', header: t('export.colMinutes'), width: 10 },
    { key: 'reportable', header: t('export.colReportable'), width: 12 },
    { key: 'registradoPor', header: t('colCreatedBy'), width: 20 },
    { key: 'nota', header: t('export.colNotes'), width: 30 },
  ]
  const datosRows = sortedAsc.map((r) => ({
    fecha: dayjs(r.date).format('DD/MM/YYYY'),
    hora: dayjs(r.date).format('HH:mm'),
    turno: r.shiftLabel,
    area: r.areaName,
    causa: r.reasonName,
    minutos: r.durationMinutes,
    reportable: r.reportable ? t('export.yes') : t('export.no'),
    registradoPor: r.createdByName,
    nota: r.notes || '',
  }))
  const datosWs = buildTableSheet(workbook, t('export.sheetData'), datosColumns, datosRows)
  const reportableColIdx = datosColumns.findIndex((c) => c.key === 'reportable') + 1
  sortedAsc.forEach((r, idx) => {
    if (!r.reportable) return
    const cell = datosWs.getRow(idx + 2).getCell(reportableColIdx)
    cell.font = { bold: true, color: { argb: COLOR_WARN_TEXT } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_WARN_FILL } }
  })

  // ---------------------------------------------------------------- Hoja "Pareto por causa"
  const paretoWs = buildTableSheet(
    workbook,
    t('export.sheetPareto'),
    [
      { key: 'causa', header: t('colReason'), width: 34 },
      { key: 'minutos', header: t('export.colMinutes'), width: 12 },
      { key: 'cantidad', header: t('export.colCount'), width: 12 },
      { key: 'pctTotal', header: t('export.colPctTotal'), width: 12, numFmt: '0.0%' },
      { key: 'pctAcumulado', header: t('export.colPctCumulative'), width: 14, numFmt: '0.0%' },
    ],
    paretoRows,
  )
  if (chartImageId !== null) {
    paretoWs.addImage(chartImageId, { tl: { col: 6, row: 0 }, ext: { width: 640, height: 340 } })
  }

  // ---------------------------------------------------------------- Hoja "Por linea o area"
  const areaRows = areaSortedByMinutes.map(([name, v]) => ({
    area: name,
    minutos: v.minutes,
    cantidad: v.count,
  }))
  buildTableSheet(
    workbook,
    t('export.sheetArea'),
    [
      { key: 'area', header: t('colArea'), width: 28 },
      { key: 'minutos', header: t('export.colMinutes'), width: 12 },
      { key: 'cantidad', header: t('export.colCount'), width: 12 },
    ],
    areaRows,
  )

  // ---------------------------------------------------------------- Hoja "Por turno"
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
    .map(([name, v]) => ({ turno: name, minutos: v.minutes, cantidad: v.count }))
  buildTableSheet(
    workbook,
    t('export.sheetShift'),
    [
      { key: 'turno', header: t('colShift'), width: 18 },
      { key: 'minutos', header: t('export.colMinutes'), width: 12 },
      { key: 'cantidad', header: t('export.colCount'), width: 12 },
    ],
    shiftRows,
  )

  // ---------------------------------------------------------------- Hoja "Por dia"
  const byDay = groupBy(rows, (r) => dayjs(r.date).format('YYYY-MM-DD'))
  const dayRows = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, v]) => ({
      fecha: dayjs(key).format('DD/MM/YYYY'),
      minutos: v.minutes,
      cantidad: v.count,
    }))
  buildTableSheet(
    workbook,
    t('export.sheetDay'),
    [
      { key: 'fecha', header: t('export.colDate'), width: 14 },
      { key: 'minutos', header: t('export.colMinutes'), width: 12 },
      { key: 'cantidad', header: t('export.colCount'), width: 12 },
    ],
    dayRows,
  )

  // ---------------------------------------------------------------- Hoja "Por semana"
  const byWeek = groupBy(rows, (r) => mondayOf(dayjs(r.date)).format('YYYY-MM-DD'))
  const weekRows = [...byWeek.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([mondayISO, v]) => {
      const monday = dayjs(mondayISO)
      return {
        semana: t('export.weekLabel', {
          week: isoWeekNumber(monday),
          from: monday.format('DD/MM'),
          to: monday.add(6, 'day').format('DD/MM'),
        }),
        minutos: v.minutes,
        cantidad: v.count,
      }
    })
  buildTableSheet(
    workbook,
    t('export.sheetWeek'),
    [
      { key: 'semana', header: t('export.sheetWeek'), width: 26 },
      { key: 'minutos', header: t('export.colMinutes'), width: 12 },
      { key: 'cantidad', header: t('export.colCount'), width: 12 },
    ],
    weekRows,
  )

  // ---------------------------------------------------------------- Hoja "Por mes"
  const byMonth = groupBy(rows, (r) => dayjs(r.date).format('YYYY-MM'))
  const monthRows = [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, v]) => ({
      mes: dayjs(`${key}-01`).format('MMMM YYYY'),
      minutos: v.minutes,
      cantidad: v.count,
    }))
  buildTableSheet(
    workbook,
    t('export.sheetMonth'),
    [
      { key: 'mes', header: t('export.sheetMonth'), width: 20 },
      { key: 'minutos', header: t('export.colMinutes'), width: 12 },
      { key: 'cantidad', header: t('export.colCount'), width: 12 },
    ],
    monthRows,
  )

  // ---------------------------------------------------------------- Hoja "Por hora del dia"
  const byHour = groupBy(rows, (r) => dayjs(r.date).hour())
  const hourRows = Array.from({ length: 24 }, (_, h) => {
    const entry = byHour.get(h) || { minutes: 0, count: 0 }
    return {
      hora: t('export.hourLabel', { hour: String(h).padStart(2, '0') }),
      minutos: entry.minutes,
      cantidad: entry.count,
    }
  })
  buildTableSheet(
    workbook,
    t('export.sheetHour'),
    [
      { key: 'hora', header: t('export.sheetHour'), width: 14 },
      { key: 'minutos', header: t('export.colMinutes'), width: 12 },
      { key: 'cantidad', header: t('export.colCount'), width: 12 },
    ],
    hourRows,
  )

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
