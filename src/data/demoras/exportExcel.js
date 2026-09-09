import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

/* Exportacion a Excel del historial de Demoras de trabajo (2026-09-09, a peticion explicita del
   usuario -- "boton de exportar excel... de tal fecha a tal fecha... grafica de pareto... que
   yo pueda manipular el excel, por hora, dia, semana, mes y turno... cual fue la demora que mas
   pusieron, que linea estuvo mas tiempo muerto... full completo pero bien organizado... que no
   invente informacion").

   Misma libreria y mismo criterio ya establecido en DashboardExportButton.jsx/horaPorHora/
   exportExcel.js: xlsx (SheetJS edicion community, instalada sin costo) escribe anchos de
   columna + autofilter + formato numerico (`col.numFmt`) reales, pero NO soporta graficas
   nativas al escribir un archivo (ni freeze panes/negritas) -- investigado a fondo antes de
   prometer una grafica: ni xlsx ni exceljs (sin dependencia nueva) la soportan; la unica
   libreria que sí escribe graficas nativas (`xlsx-chart`) no puede combinarlas con hojas de
   datos normales en el mismo archivo, y no esta mantenida (ultimo release hace 1 año). En vez de
   fingir una grafica que no existe de verdad, la hoja "Pareto por causa" trae exactamente los
   datos de un Pareto (minutos, cantidad, % del total, % acumulado, ya ordenados de mayor a
   menor) listos para que Excel genere la grafica real en 2 clics (seleccionar la tabla ->
   Insertar -> Grafico recomendado) -- se explica esto mismo al usuario, no se le oculta.

   Cada hoja de desglose (turno/dia/semana/mes/hora del dia) mas la hoja "Datos" (con
   autofilter, una fila por registro real) son la base para que el usuario arme su propia tabla
   dinamica en Excel si necesita un cruce distinto a los ya incluidos -- eso es lo que hace al
   archivo "manipulable" de verdad, no una demo de UI que Excel no puede reproducir. */

function buildSheet(rows, columns) {
  const header = columns.map((c) => c.header)
  const body = rows.map((row) => columns.map((col) => row[col.key]))
  const ws = XLSX.utils.aoa_to_sheet([header, ...body], { cellDates: true })
  ws['!cols'] = columns.map((c) => ({ wch: c.width || 16 }))
  if (body.length > 0) {
    const lastCol = XLSX.utils.encode_col(columns.length - 1)
    ws['!autofilter'] = { ref: `A1:${lastCol}1` }
  }
  const lastRow = body.length
  columns.forEach((col, colIdx) => {
    if (!col.numFmt) return
    for (let r = 1; r <= lastRow; r += 1) {
      const addr = XLSX.utils.encode_cell({ r, c: colIdx })
      if (ws[addr]) ws[addr].z = col.numFmt
    }
  })
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

/**
 * rows: [{ date: Date, areaName, reasonName, durationMinutes, shiftLabel, createdByName, notes,
 *          reportable }] -- ya resueltos por quien llama (DemorasPage.jsx), este modulo no
 * conoce catalogos ni i18n de causas/areas, solo agrega y formatea.
 */
export function exportDemorasToExcel({ rows, dateFrom, dateTo, t }) {
  const wb = XLSX.utils.book_new()
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

  // ---------------------------------------------------------------- Hoja "Resumen"
  const resumenRows = [
    { metrica: t('export.kpiTotalRecords'), valor: totalCount },
    { metrica: t('export.kpiTotalMinutes'), valor: totalMinutes },
    { metrica: t('export.kpiReportableCount'), valor: reportableCount },
    { metrica: t('export.kpiTopCauseMinutes'), valor: topCauseByMinutes },
    { metrica: t('export.kpiTopCauseCount'), valor: topCauseByCount },
    { metrica: t('export.kpiTopArea'), valor: topAreaByMinutes },
  ]
  const resumenWs = buildSheet(resumenRows, [
    { key: 'metrica', header: rangeLabel, width: 40 },
    { key: 'valor', header: t('export.colValue'), width: 26 },
  ])
  XLSX.utils.sheet_add_aoa(resumenWs, [[], [t('export.paretoPreviewTitle')]], { origin: -1 })
  XLSX.utils.sheet_add_aoa(resumenWs, [[t('colReason'), t('export.colMinutes'), t('export.colCount')]], {
    origin: -1,
  })
  XLSX.utils.sheet_add_aoa(
    resumenWs,
    causeSortedByMinutes.slice(0, 5).map(([name, v]) => [name, v.minutes, v.count]),
    { origin: -1 },
  )
  XLSX.utils.book_append_sheet(wb, resumenWs, t('export.sheetSummary'))

  // ---------------------------------------------------------------- Hoja "Datos" (cruda)
  const sortedAsc = [...rows].sort((a, b) => a.date - b.date)
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
  const datosWs = buildSheet(datosRows, [
    { key: 'fecha', header: t('export.colDate'), width: 12 },
    { key: 'hora', header: t('colTime'), width: 8 },
    { key: 'turno', header: t('colShift'), width: 14 },
    { key: 'area', header: t('colArea'), width: 20 },
    { key: 'causa', header: t('colReason'), width: 34 },
    { key: 'minutos', header: t('export.colMinutes'), width: 10 },
    { key: 'reportable', header: t('export.colReportable'), width: 12 },
    { key: 'registradoPor', header: t('colCreatedBy'), width: 20 },
    { key: 'nota', header: t('export.colNotes'), width: 30 },
  ])
  XLSX.utils.book_append_sheet(wb, datosWs, t('export.sheetData'))

  // ---------------------------------------------------------------- Hoja "Pareto por causa"
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
  const paretoWs = buildSheet(paretoRows, [
    { key: 'causa', header: t('colReason'), width: 34 },
    { key: 'minutos', header: t('export.colMinutes'), width: 12 },
    { key: 'cantidad', header: t('export.colCount'), width: 12 },
    { key: 'pctTotal', header: t('export.colPctTotal'), width: 12, numFmt: '0.0%' },
    { key: 'pctAcumulado', header: t('export.colPctCumulative'), width: 14, numFmt: '0.0%' },
  ])
  XLSX.utils.book_append_sheet(wb, paretoWs, t('export.sheetPareto'))

  // ---------------------------------------------------------------- Hoja "Por linea o area"
  const areaRows = areaSortedByMinutes.map(([name, v]) => ({
    area: name,
    minutos: v.minutes,
    cantidad: v.count,
  }))
  const areaWs = buildSheet(areaRows, [
    { key: 'area', header: t('colArea'), width: 28 },
    { key: 'minutos', header: t('export.colMinutes'), width: 12 },
    { key: 'cantidad', header: t('export.colCount'), width: 12 },
  ])
  XLSX.utils.book_append_sheet(wb, areaWs, t('export.sheetArea'))

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
    .map(([name, v]) => ({
      turno: name,
      minutos: v.minutes,
      cantidad: v.count,
    }))
  const shiftWs = buildSheet(shiftRows, [
    { key: 'turno', header: t('colShift'), width: 18 },
    { key: 'minutos', header: t('export.colMinutes'), width: 12 },
    { key: 'cantidad', header: t('export.colCount'), width: 12 },
  ])
  XLSX.utils.book_append_sheet(wb, shiftWs, t('export.sheetShift'))

  // ---------------------------------------------------------------- Hoja "Por dia"
  const byDay = groupBy(rows, (r) => dayjs(r.date).format('YYYY-MM-DD'))
  const dayRows = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, v]) => ({
      fecha: dayjs(key).format('DD/MM/YYYY'),
      minutos: v.minutes,
      cantidad: v.count,
    }))
  const dayWs = buildSheet(dayRows, [
    { key: 'fecha', header: t('export.colDate'), width: 14 },
    { key: 'minutos', header: t('export.colMinutes'), width: 12 },
    { key: 'cantidad', header: t('export.colCount'), width: 12 },
  ])
  XLSX.utils.book_append_sheet(wb, dayWs, t('export.sheetDay'))

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
  const weekWs = buildSheet(weekRows, [
    { key: 'semana', header: t('export.sheetWeek'), width: 26 },
    { key: 'minutos', header: t('export.colMinutes'), width: 12 },
    { key: 'cantidad', header: t('export.colCount'), width: 12 },
  ])
  XLSX.utils.book_append_sheet(wb, weekWs, t('export.sheetWeek'))

  // ---------------------------------------------------------------- Hoja "Por mes"
  const byMonth = groupBy(rows, (r) => dayjs(r.date).format('YYYY-MM'))
  const monthRows = [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, v]) => ({
      mes: dayjs(`${key}-01`).format('MMMM YYYY'),
      minutos: v.minutes,
      cantidad: v.count,
    }))
  const monthWs = buildSheet(monthRows, [
    { key: 'mes', header: t('export.sheetMonth'), width: 20 },
    { key: 'minutos', header: t('export.colMinutes'), width: 12 },
    { key: 'cantidad', header: t('export.colCount'), width: 12 },
  ])
  XLSX.utils.book_append_sheet(wb, monthWs, t('export.sheetMonth'))

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
  const hourWs = buildSheet(hourRows, [
    { key: 'hora', header: t('export.sheetHour'), width: 14 },
    { key: 'minutos', header: t('export.colMinutes'), width: 12 },
    { key: 'cantidad', header: t('export.colCount'), width: 12 },
  ])
  XLSX.utils.book_append_sheet(wb, hourWs, t('export.sheetHour'))

  XLSX.writeFile(wb, `demoras_${dateFrom}_a_${dateTo}.xlsx`)
}
