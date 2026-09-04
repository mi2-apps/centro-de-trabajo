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
import { OFFICIAL_SHIFTS } from '../../data/production/catalog'
import { computeTotalLoss, LOSS_COLUMNS } from '../../data/shiftProduction/lossColumns.js'
import { computeCompliancePct, computeGap } from '../../data/shiftProduction/metrics.js'
import { EmptyState } from '../../ui'

/* Historico de turnos de Sorting -- SOLO LECTURA, reutiliza exactamente las mismas columnas
   fijas de perdida que la pagina principal (ver src/data/shiftProduction/lossColumns.js), sin
   inputs. Sin filtro de area/linea (2026-09-04, a peticion explicita del usuario -- "Sorting es
   un area", no hay nada que filtrar). */
export default function SortingHistoryView({ onBack }) {
  const { t } = useTranslation('sorting')
  const [dateFrom, setDateFrom] = useState(dayjs().subtract(7, 'day').format('YYYY-MM-DD'))
  const [dateTo, setDateTo] = useState(dayjs().format('YYYY-MM-DD'))
  const [shift, setShift] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [selectedLoading, setSelectedLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ dateFrom, dateTo })
      if (shift) params.set('shift', shift)
      const res = await fetch(`/api/sorting/sessions/history?${params}`, {
        credentials: 'include',
      })
      const data = await res.json().catch(() => null)
      setRows(data?.sessions || [])
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, shift])

  useEffect(() => {
    load()
  }, [load])

  async function openDetail(row) {
    setSelectedLoading(true)
    try {
      const res = await fetch(`/api/sorting/sessions/${row.id}`, { credentials: 'include' })
      const data = await res.json().catch(() => null)
      setSelected(data)
    } finally {
      setSelectedLoading(false)
    }
  }

  if (selected) {
    const unitLabel =
      selected.session.lossUnit === 'MINUTES' ? t('unitMinutesShort') : t('unitPiecesShort')
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
                {t(`shift.${selected.session.shift}`)}
              </p>
              <p className={pageSubtitleClass}>{t('historyDetailSubtitle')}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <Th>{t('colHour')}</Th>
                  <Th>{t('colStandard')}</Th>
                  <Th>{t('colActual')}</Th>
                  <Th>{t('colGap')}</Th>
                  <Th>{t('colCompliance')}</Th>
                  {LOSS_COLUMNS.map((c) => (
                    <Th key={c.key}>{t(c.labelKey)}</Th>
                  ))}
                  <Th>{t('colTotalLoss')}</Th>
                  <Th>{t('colObservations')}</Th>
                </tr>
              </thead>
              <tbody>
                {selected.entries.map((entry) => {
                  const gap = computeGap(entry.standardQty, entry.actualQty)
                  const pct = computeCompliancePct(entry.standardQty, entry.actualQty)
                  const totalLoss = computeTotalLoss(entry)
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
                      {LOSS_COLUMNS.map((c) => (
                        <Td key={c.key}>{entry[c.key] > 0 ? entry[c.key] : '—'}</Td>
                      ))}
                      <Td className="font-bold">
                        {totalLoss > 0 ? `${totalLoss} ${unitLabel}` : '—'}
                      </Td>
                      <Td className="max-w-[200px] truncate" title={entry.observations || ''}>
                        {entry.observations || '—'}
                      </Td>
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
                  <Th>{t('summaryExpected')}</Th>
                  <Th>{t('summaryActual')}</Th>
                  <Th>{t('summaryGap')}</Th>
                  <Th>{t('summaryCompliance')}</Th>
                  <Th>{t('historyColLosses')}</Th>
                  <Th>{t('summaryTopCause')}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const unitLabel =
                    row.lossUnit === 'MINUTES' ? t('unitMinutesShort') : t('unitPiecesShort')
                  return (
                    <tr
                      key={row.id}
                      onClick={() => openDetail(row)}
                      className="cursor-pointer border-b border-border/60 hover:bg-[rgba(59,130,246,.03)]"
                    >
                      <Td>{dayjs(String(row.date).slice(0, 10)).format('DD MMM YYYY')}</Td>
                      <Td>{t(`shift.${row.shift}`)}</Td>
                      <Td>{row.expected}</Td>
                      <Td>{row.actual}</Td>
                      <Td className={row.gap >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}>
                        {row.gap > 0 ? '+' : ''}
                        {row.gap}
                      </Td>
                      <Td>
                        {row.compliancePct != null ? `${row.compliancePct.toFixed(1)}%` : '—'}
                      </Td>
                      <Td>{row.totalLoss > 0 ? `${row.totalLoss} ${unitLabel}` : '—'}</Td>
                      <Td>{row.topCauseKey ? t(row.topCauseKey) : '—'}</Td>
                    </tr>
                  )
                })}
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
