import dayjs from 'dayjs'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  cardClass,
  cellTextClass,
  pageClass,
  pageSubtitleClass,
  pageTitleClass,
} from '@/lib/pageStyles'
import { cn } from '@/lib/utils'
import {
  computeCompliancePct,
  computeGap,
  getEntryStatus,
  STATUS_LABEL_KEY,
} from '../../data/horaPorHora/metrics.js'
import {
  LINE_FAMILY_AREA_IDS,
  OFFICIAL_SHIFTS,
  WORK_CENTERS,
  workCenterById,
} from '../../data/production/catalog'
import { EmptyState } from '../../ui'

/* Historico de turnos (2026-09-04, a peticion explicita del usuario -- "Fecha desde, Fecha
   hasta, Turno, Area/Linea... al hacer click en un registro historico: mostrar detalle hora por
   hora de ese turno"). SOLO LECTURA -- el detalle reutiliza el mismo formato de tabla que la
   pagina principal, pero sin boton de "Registrar" (edicion desde el historico esta fuera de
   alcance de esta entrega, ver App.jsx/entries API: editar un turno FINALIZADO ya requiere
   SUPERVISOR/ADMINISTRADOR desde la pantalla principal si el turno se reabre). */
export default function HourlyHistoryView({ onBack }) {
  const { t } = useTranslation('horaPorHora')
  const [dateFrom, setDateFrom] = useState(dayjs().subtract(7, 'day').format('YYYY-MM-DD'))
  const [dateTo, setDateTo] = useState(dayjs().format('YYYY-MM-DD'))
  const [shift, setShift] = useState('')
  const [groupKey, setGroupKey] = useState('')
  const [lineId, setLineId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [selectedLoading, setSelectedLoading] = useState(false)

  const AREA_GROUPS = [
    { key: '', labelKey: 'historyAllAreas' },
    { key: 'LINEAS', labelKey: 'areaGroupLines' },
    { key: 'INSUMOS', labelKey: 'areaGroupInsumos', areaId: 'INSUMOS' },
    { key: 'ACCESORIOS', labelKey: 'areaGroupAccesorios', areaId: 'ACCESORIOS' },
    { key: 'MIDEA', labelKey: 'areaGroupMidea', areaId: 'HIGH_VALUE' },
    { key: 'PALETIZADO', labelKey: 'areaGroupPaletizado', areaId: 'PALETIZADO' },
  ]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ dateFrom, dateTo })
      if (shift) params.set('shift', shift)
      if (areaId) params.set('areaId', areaId)
      const res = await fetch(`/api/hora-por-hora/sessions/history?${params}`, {
        credentials: 'include',
      })
      const data = await res.json().catch(() => null)
      setRows(data?.sessions || [])
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, shift, areaId])

  useEffect(() => {
    load()
  }, [load])

  function handleGroupChange(nextGroupKey) {
    setGroupKey(nextGroupKey)
    setLineId('')
    const group = AREA_GROUPS.find((g) => g.key === nextGroupKey)
    setAreaId(group?.areaId || '')
  }

  async function openDetail(row) {
    setSelectedLoading(true)
    try {
      const res = await fetch(`/api/hora-por-hora/sessions/${row.id}`, { credentials: 'include' })
      const data = await res.json().catch(() => null)
      setSelected(data)
    } finally {
      setSelectedLoading(false)
    }
  }

  if (selected) {
    return (
      <div className={pageClass}>
        <div className={cn(cardClass, 'mb-4')}>
          <div className="flex items-center gap-2 border-b border-border bg-black/[.015] px-5 py-3.5 dark:bg-white/[.02]">
            <Button variant="ghost" size="icon" onClick={() => setSelected(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              {/* .slice(0,10) toma solo la fecha de calendario del ISO string que manda el API
                  ("2026-09-04T00:00:00.000Z") -- pasarlo completo a dayjs() lo reinterpreta en
                  zona horaria local y puede mostrar el dia anterior (mismo bug que shiftBlocks.js). */}
              <p className={pageTitleClass}>
                {dayjs(String(selected.session.date).slice(0, 10)).format('DD MMM YYYY')} ·{' '}
                {t(`shift.${selected.session.shift}`)} ·{' '}
                {workCenterById(selected.session.areaId)?.name}
              </p>
              <p className={pageSubtitleClass}>{t('historyDetailSubtitle')}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <Th>{t('colHour')}</Th>
                  <Th>{t('colStandard')}</Th>
                  <Th>{t('colActual')}</Th>
                  <Th>{t('colGap')}</Th>
                  <Th>{t('colCompliance')}</Th>
                  <Th>{t('colLosses')}</Th>
                  <Th>{t('colStatus')}</Th>
                </tr>
              </thead>
              <tbody>
                {selected.entries.map((entry) => {
                  const status = getEntryStatus(entry, false)
                  const gap = computeGap(entry.standardQty, entry.actualQty)
                  const pct = computeCompliancePct(entry.standardQty, entry.actualQty)
                  return (
                    <tr key={entry.id} className="border-b border-border/60">
                      <Td className="font-semibold">
                        {entry.startTime} - {entry.endTime}
                      </Td>
                      <Td>{entry.standardQty}</Td>
                      <Td>{entry.actualQty ?? '—'}</Td>
                      <Td
                        className={
                          gap == null ? '' : gap >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                        }
                      >
                        {gap == null ? '—' : `${gap > 0 ? '+' : ''}${gap}`}
                      </Td>
                      <Td>{pct == null ? '—' : `${pct.toFixed(1)}%`}</Td>
                      <Td>{entry.incidents?.length || '—'}</Td>
                      <Td>{t(STATUS_LABEL_KEY[status])}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={pageClass}>
      <div className={cn(cardClass, 'mb-4')}>
        <div className="flex items-center gap-2 border-b border-border bg-black/[.015] px-5 py-3.5 dark:bg-white/[.02]">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className={pageTitleClass}>{t('historyTitle')}</p>
            <p className={pageSubtitleClass}>{t('historySubtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3 px-5 py-3.5">
          <div>
            <Label className="mb-1.5 block text-xs">{t('historyDateFrom')}</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">{t('historyDateTo')}</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">{t('fieldShift')}</Label>
            <Select value={shift} onValueChange={setShift}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t('historyAllShifts')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('historyAllShifts')}</SelectItem>
                {OFFICIAL_SHIFTS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {t(`shift.${s.id}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">{t('fieldArea')}</Label>
            <Select value={groupKey} onValueChange={handleGroupChange}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AREA_GROUPS.map((g) => (
                  <SelectItem key={g.key} value={g.key}>
                    {t(g.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {groupKey === 'LINEAS' && (
            <div>
              <Label className="mb-1.5 block text-xs">{t('fieldLine')}</Label>
              <Select
                value={lineId}
                onValueChange={(v) => {
                  setLineId(v)
                  setAreaId(v)
                }}
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder={t('fieldLinePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {WORK_CENTERS.filter((w) => LINE_FAMILY_AREA_IDS.has(w.id)).map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {workCenterById(w.id).name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className={cardClass}>
        {loading || selectedLoading ? (
          <div className="px-5 py-10">
            <EmptyState compact title={t('loading')} />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10">
            <EmptyState compact title={t('historyEmpty')} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <Th>{t('historyColDate')}</Th>
                  <Th>{t('fieldShift')}</Th>
                  <Th>{t('fieldArea')}</Th>
                  <Th>{t('summaryExpected')}</Th>
                  <Th>{t('summaryActual')}</Th>
                  <Th>{t('summaryGap')}</Th>
                  <Th>{t('summaryCompliance')}</Th>
                  <Th>{t('historyColLosses')}</Th>
                  <Th>{t('summaryTopCause')}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => openDetail(row)}
                    className="cursor-pointer border-b border-border/60 hover:bg-[rgba(59,130,246,.03)]"
                  >
                    <Td>{dayjs(String(row.date).slice(0, 10)).format('DD MMM YYYY')}</Td>
                    <Td>{t(`shift.${row.shift}`)}</Td>
                    <Td>{workCenterById(row.areaId)?.name || row.areaId}</Td>
                    <Td>{row.expected}</Td>
                    <Td>{row.actual}</Td>
                    <Td className={row.gap >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}>
                      {row.gap > 0 ? '+' : ''}
                      {row.gap}
                    </Td>
                    <Td>{row.compliancePct != null ? `${row.compliancePct.toFixed(1)}%` : '—'}</Td>
                    <Td>
                      {row.minutesLost > 0 ? `${row.minutesLost} min` : ''}
                      {row.minutesLost > 0 && row.piecesLost > 0 ? ' · ' : ''}
                      {row.piecesLost > 0 ? `${row.piecesLost} pzs` : ''}
                      {row.minutesLost === 0 && row.piecesLost === 0 ? '—' : ''}
                    </Td>
                    <Td>{row.topCause || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Th({ children }) {
  return (
    <th className="px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.03em] text-muted-foreground">
      {children}
    </th>
  )
}

function Td({ children, className }) {
  return <td className={cn('px-3.5 py-2.5', cellTextClass, className)}>{children}</td>
}
