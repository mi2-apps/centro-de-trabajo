// Exportacion a Excel de un turno de Hora por Hora (2026-09-04, a peticion explicita del usuario
// -- "quiero un Excel profesional, no un dump crudo de base de datos... Resumen / Hora por Hora /
// Incidencias / Pareto"). Misma libreria y mismo criterio ya establecido en
// src/pages/dashboard/DashboardExportButton.jsx: xlsx (SheetJS edicion community, instalada sin
// costo) soporta anchos de columna + autofilter al escribir un archivo, pero NO freeze panes ni
// negritas de encabezado -- se documenta aqui en vez de fingir que se aplicaron.
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { workCenterById } from '../production/catalog.js'
import {
  computeCompliancePct,
  computeGap,
  computeParetoData,
  computeShiftSummary,
} from './metrics.js'

function buildSheet(rows, columns) {
  const header = columns.map((c) => c.header)
  const body = rows.map((row) => columns.map((c) => row[c.key]))
  const ws = XLSX.utils.aoa_to_sheet([header, ...body])
  ws['!cols'] = columns.map((c) => ({ wch: c.width || 18 }))
  if (body.length > 0) {
    const lastCol = XLSX.utils.encode_col(columns.length - 1)
    ws['!autofilter'] = { ref: `A1:${lastCol}1` }
  }
  return ws
}

export function exportHourlyProductionToExcel({ session, entries, t }) {
  const summary = computeShiftSummary(entries)
  const areaName = workCenterById(session.areaId)?.name || session.areaId
  const shiftLabel = t(`shift.${session.shift}`)
  // .slice(0,10): session.date llega como ISO string ("...T00:00:00.000Z") -- pasarlo completo a
  // dayjs() lo reinterpreta en zona horaria local y puede mostrar el dia anterior.
  const dateStr = dayjs(String(session.date).slice(0, 10)).format('YYYY-MM-DD')

  const wb = XLSX.utils.book_new()

  const resumenWs = buildSheet(
    [
      { metrica: t('exportMetricDate'), valor: dateStr },
      { metrica: t('exportMetricShift'), valor: shiftLabel },
      { metrica: t('exportMetricArea'), valor: areaName },
      { metrica: t('summaryExpected'), valor: summary.expected },
      { metrica: t('summaryActual'), valor: summary.actual },
      { metrica: t('summaryGap'), valor: summary.gap },
      {
        metrica: t('summaryCompliance'),
        valor: summary.compliancePct != null ? `${summary.compliancePct.toFixed(1)}%` : '',
      },
      { metrica: t('summaryMinutesLost'), valor: summary.minutesLost },
      { metrica: t('summaryPiecesLost'), valor: summary.piecesLost },
      { metrica: t('summaryTopCause'), valor: summary.topCause || '' },
      {
        metrica: t('summaryCompliantHours'),
        valor: `${summary.compliantHours} / ${summary.totalHours}`,
      },
    ],
    [
      { key: 'metrica', header: t('exportColMetric'), width: 28 },
      { key: 'valor', header: t('exportColValue'), width: 22 },
    ],
  )
  XLSX.utils.book_append_sheet(wb, resumenWs, t('exportSheetSummary'))

  const hourlyWs = buildSheet(
    entries.map((e) => ({
      hora: `${e.startTime} - ${e.endTime}`,
      estandar: e.standardQty,
      real: e.actualQty ?? '',
      gap: computeGap(e.standardQty, e.actualQty) ?? '',
      cumplimiento:
        computeCompliancePct(e.standardQty, e.actualQty) != null
          ? `${computeCompliancePct(e.standardQty, e.actualQty).toFixed(1)}%`
          : '',
      perdidas: e.incidents?.length || 0,
    })),
    [
      { key: 'hora', header: t('colHour'), width: 16 },
      { key: 'estandar', header: t('colStandard'), width: 12 },
      { key: 'real', header: t('colActual'), width: 12 },
      { key: 'gap', header: t('colGap'), width: 10 },
      { key: 'cumplimiento', header: t('colCompliance'), width: 14 },
      { key: 'perdidas', header: t('colLosses'), width: 12 },
    ],
  )
  XLSX.utils.book_append_sheet(wb, hourlyWs, t('exportSheetHourly'))

  const incidentRows = entries.flatMap((e) =>
    (e.incidents || []).map((i) => ({
      hora: `${e.startTime} - ${e.endTime}`,
      causa: i.causeCode === 'otra' && i.customDescription ? i.customDescription : i.causeName,
      tipo: i.measurementType === 'MINUTES' ? t('unitMinutes') : t('unitPieces'),
      valor: i.value,
      observacion: i.notes || '',
    })),
  )
  const incidentsWs = buildSheet(incidentRows, [
    { key: 'hora', header: t('colHour'), width: 16 },
    { key: 'causa', header: t('fieldCauseLabel'), width: 26 },
    { key: 'tipo', header: t('fieldMeasurementTypeLabel'), width: 14 },
    { key: 'valor', header: t('fieldValueLabel'), width: 10 },
    { key: 'observacion', header: t('fieldObservationLabel'), width: 30 },
  ])
  XLSX.utils.book_append_sheet(wb, incidentsWs, t('exportSheetIncidents'))

  const paretoRows = computeParetoData(entries, 'MINUTES')
  const paretoPiecesRows = computeParetoData(entries, 'PIECES')
  const paretoWs = buildSheet(
    [
      ...paretoRows.map((p) => ({
        causa: p.cause,
        tipo: t('unitMinutes'),
        valor: p.value,
        porcentaje: `${p.pct.toFixed(1)}%`,
        acumulado: `${p.cumulativePct.toFixed(1)}%`,
      })),
      ...paretoPiecesRows.map((p) => ({
        causa: p.cause,
        tipo: t('unitPieces'),
        valor: p.value,
        porcentaje: `${p.pct.toFixed(1)}%`,
        acumulado: `${p.cumulativePct.toFixed(1)}%`,
      })),
    ],
    [
      { key: 'causa', header: t('fieldCauseLabel'), width: 26 },
      { key: 'tipo', header: t('fieldMeasurementTypeLabel'), width: 12 },
      { key: 'valor', header: t('paretoValueLabel'), width: 10 },
      { key: 'porcentaje', header: t('exportColPercent'), width: 12 },
      { key: 'acumulado', header: t('paretoCumulativeLabel'), width: 14 },
    ],
  )
  XLSX.utils.book_append_sheet(wb, paretoWs, t('exportSheetPareto'))

  XLSX.writeFile(wb, `hora-por-hora_${dateStr}_${session.shift}_${session.areaId}.xlsx`)
}
