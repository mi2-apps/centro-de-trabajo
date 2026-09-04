// Exportacion a Excel de un turno de Sorting -- mismo formato exacto que Hora por Hora
// (src/data/horaPorHora/exportExcel.js), tablas/modulo separados a peticion explicita del
// usuario. Los textos vienen del namespace i18n 'sorting' (pasado por quien llama), nunca de
// 'horaPorHora'.
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { computeTotalLoss, LOSS_COLUMNS } from '../shiftProduction/lossColumns.js'
import {
  computeAccumulatedSeries,
  computeCompliancePct,
  computeGap,
  computeParetoData,
  computeShiftSummary,
} from '../shiftProduction/metrics.js'

const U = undefined

export function exportSortingToExcel({ session, entries, t }) {
  const summary = computeShiftSummary(entries)
  const shiftLabel = t(`shift.${session.shift}`)
  // .slice(0,10): session.date llega como ISO string ("...T00:00:00.000Z") -- pasarlo completo a
  // dayjs() lo reinterpreta en zona horaria local y puede mostrar el dia anterior.
  const dateStr = dayjs(String(session.date).slice(0, 10)).format('DD/MM/YYYY')
  const fileDateStr = dayjs(String(session.date).slice(0, 10)).format('YYYY-MM-DD')
  const unit = session.lossUnit === 'MINUTES' ? t('unitMinutes') : t('unitPieces')
  const unitShort = session.lossUnit === 'MINUTES' ? t('unitMinutesShort') : t('unitPiecesShort')

  const wb = XLSX.utils.book_new()

  // ---------------------------------------------------------------- Hoja "Sorting"
  const lossHeaders = LOSS_COLUMNS.map((c) => t(c.labelKey))
  const hourlyRows = [
    [t('exportTitle')],
    [t('exportSubtitle')],
    [],
    [
      t('exportMetricDate'),
      dateStr,
      t('exportMetricShift'),
      shiftLabel,
      t('fieldRate'),
      `${session.standardRate} ${unitShort}/h`,
      t('fieldLossUnit'),
      unit,
    ],
    [],
    [
      `${t('kpiExpectedTitle')}\n${summary.expected} ${t('unitPieces')}`,
      U,
      U,
      U,
      `${t('kpiActualTitle')}\n${summary.actual} ${t('unitPieces')}`,
      U,
      U,
      U,
      `${t('kpiGapTitle')}\n${summary.gap > 0 ? '+' : ''}${summary.gap}`,
      U,
      U,
      U,
      `${t('kpiComplianceTitle')}\n${summary.compliancePct != null ? `${summary.compliancePct.toFixed(1)}%` : '—'}`,
    ],
    [],
  ]
  const headerRowIndex = hourlyRows.length
  hourlyRows.push([
    t('colHour'),
    t('colStandard'),
    t('colActual'),
    t('colGap'),
    t('colCompliance'),
    ...lossHeaders,
    t('colTotalLoss'),
    t('colObservations'),
  ])
  for (const e of entries) {
    const gap = computeGap(e.standardQty, e.actualQty)
    const pct = computeCompliancePct(e.standardQty, e.actualQty)
    hourlyRows.push([
      `${e.startTime} - ${e.endTime}`,
      e.standardQty,
      e.actualQty ?? '',
      gap ?? '',
      pct != null ? `${pct.toFixed(1)}%` : '',
      ...LOSS_COLUMNS.map((c) => e[c.key] || 0),
      computeTotalLoss(e),
      e.observations || '',
    ])
  }
  hourlyRows.push([
    t('totalShiftLabel'),
    summary.expected,
    summary.actual,
    summary.gap,
    summary.compliancePct != null ? `${summary.compliancePct.toFixed(1)}%` : '',
    ...summary.lossByColumn.map((c) => c.value),
    summary.totalLoss,
    '',
  ])
  hourlyRows.push([])
  hourlyRows.push([t('exportCaptureNote')])

  const hourlyWs = XLSX.utils.aoa_to_sheet(hourlyRows)
  hourlyWs['!cols'] = [
    { wch: 16 },
    { wch: 10 },
    { wch: 10 },
    { wch: 8 },
    { wch: 12 },
    ...LOSS_COLUMNS.map(() => ({ wch: 12 })),
    { wch: 14 },
    { wch: 30 },
  ]
  const lastCol = XLSX.utils.encode_col(4 + LOSS_COLUMNS.length + 2)
  hourlyWs['!autofilter'] = { ref: `A${headerRowIndex + 1}:${lastCol}${headerRowIndex + 1}` }
  XLSX.utils.book_append_sheet(wb, hourlyWs, t('exportSheetHourly'))

  // ---------------------------------------------------------------- Hoja "Resumen"
  const accumulated = computeAccumulatedSeries(entries, entries.length - 1)
  const resumenRows = [
    [t('exportSummaryTitle')],
    [`${t('exportMetricDate')}: ${dateStr}   |   ${t('exportMetricShift')}: ${shiftLabel}`],
    [],
    [
      `${t('summaryExpected')}\n${summary.expected} ${t('unitPieces')}`,
      U,
      U,
      `${t('summaryActual')}\n${summary.actual} ${t('unitPieces')}`,
      U,
      U,
      `${t('summaryGap')}\n${summary.gap > 0 ? '+' : ''}${summary.gap}`,
      U,
      U,
      `${t('summaryCompliance')}\n${summary.compliancePct != null ? `${summary.compliancePct.toFixed(1)}%` : '—'}`,
    ],
    [],
    [],
    [t('colHour'), t('chartExpectedLabel'), t('chartActualLabel')],
  ]
  for (const point of accumulated) {
    resumenRows.push([point.hour, point.expected, point.actual])
  }
  resumenRows.push([])
  resumenRows.push([t('fieldCauseLabel'), t('colTotalLoss'), U, t('exportLossSummaryTitle')])

  const paretoRows = computeParetoData(entries)
  const causeTotals = LOSS_COLUMNS.map((c) => ({
    label: t(c.labelKey),
    value: paretoRows.find((p) => p.labelKey === c.labelKey)?.value || 0,
  }))
  const summaryBlock = [
    [t('summaryTotalLoss'), summary.totalLoss],
    [t('fieldLossUnit'), unit],
    [t('summaryTopCause'), summary.topCauseKey ? t(summary.topCauseKey) : '—'],
  ]
  causeTotals.forEach((row, idx) => {
    const extra = summaryBlock[idx]
    resumenRows.push(
      extra ? [row.label, row.value, U, extra[0], U, extra[1]] : [row.label, row.value],
    )
  })

  const resumenWs = XLSX.utils.aoa_to_sheet(resumenRows)
  resumenWs['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 4 }, { wch: 20 }, { wch: 4 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, resumenWs, t('exportSheetSummary'))

  XLSX.writeFile(wb, `sorting_${fileDateStr}_${session.shift}_${session.areaId}.xlsx`)
}
