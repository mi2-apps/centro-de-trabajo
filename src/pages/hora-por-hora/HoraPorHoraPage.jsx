import dayjs from 'dayjs'
import {
  CheckCircle2,
  ClipboardList,
  Download,
  History,
  MoreVertical,
  Settings,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  alertToneClass,
  cardClass,
  cardHeaderClass,
  cardHeaderTitleClass,
  cellTextClass,
  kpiCardClass,
  pageClass,
  pageSubtitleClass,
  pageTitleClass,
  progressBarClass,
} from '@/lib/pageStyles'
import { cn } from '@/lib/utils'
import { exportHourlyProductionToExcel } from '../../data/horaPorHora/exportExcel'
import {
  computeCompliancePct,
  computeCumulativeTotals,
  computeGap,
  computeShiftSummary,
  getActiveEntryIndex,
  getEntryStatus,
  STATUS_LABEL_KEY,
} from '../../data/horaPorHora/metrics'
import {
  getCurrentShift,
  LINE_FAMILY_AREA_IDS,
  OFFICIAL_SHIFTS,
  WORK_CENTERS,
  workCenterById,
} from '../../data/production/catalog'
import { useAuth } from '../../state/auth'
import { EmptyState } from '../../ui'
import { showToast } from '../../ui/toast'
import HourlyAccumulatedChart from './HourlyAccumulatedChart'
import HourlyCausesAdmin from './HourlyCausesAdmin'
import HourlyEntryModal from './HourlyEntryModal'
import HourlyHistoryView from './HourlyHistoryView'
import HourlyParetoChart from './HourlyParetoChart'

const AREA_GROUPS = [
  { key: 'LINEAS', labelKey: 'areaGroupLines' },
  { key: 'INSUMOS', labelKey: 'areaGroupInsumos', areaId: 'INSUMOS' },
  { key: 'ACCESORIOS', labelKey: 'areaGroupAccesorios', areaId: 'ACCESORIOS' },
  { key: 'MIDEA', labelKey: 'areaGroupMidea', areaId: 'HIGH_VALUE' },
  { key: 'PALETIZADO', labelKey: 'areaGroupPaletizado', areaId: 'PALETIZADO' },
]

const ADMIN_ROLES = new Set(['ADMINISTRADOR', 'SUPERVISOR'])

// Fecha por defecto real (2026-09-04, a peticion explicita del usuario -- "el sistema debe
// detectar automaticamente cual es la hora activa"): si el turno actual es NOCHE y ya pasamos
// medianoche (00:00-06:59), ese turno en realidad EMPEZO AYER -- la sesion se agrupa bajo la
// fecha de ayer, nunca hoy (mismo criterio que "la sesion vive en la fecha en que EMPIEZA el
// turno", ver server-lib/hourlyProduction.js).
function getDefaultDateAndShift() {
  const now = new Date()
  const shift = getCurrentShift(now)
  let date = now
  if (shift.id === 'NOCHE' && now.getHours() < 7) {
    date = new Date(now)
    date.setDate(date.getDate() - 1)
  }
  return { date: dayjs(date).format('YYYY-MM-DD'), shiftId: shift.id }
}

export default function HoraPorHoraPage() {
  const { t } = useTranslation('horaPorHora')
  const { user } = useAuth()
  const canEditFinalized = ADMIN_ROLES.has(user?.role)
  const defaults = useMemo(() => getDefaultDateAndShift(), [])

  const [date, setDate] = useState(defaults.date)
  const [shift, setShift] = useState(defaults.shiftId)
  const [groupKey, setGroupKey] = useState('LINEAS')
  const [lineId, setLineId] = useState('')
  const [areaId, setAreaId] = useState('')

  const [session, setSession] = useState(null)
  const [entries, setEntries] = useState([])
  const [lastStandardRate, setLastStandardRate] = useState(null)
  const [rateInput, setRateInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const [activeEntry, setActiveEntry] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [showCausesAdmin, setShowCausesAdmin] = useState(false)
  const [finalizeConfirm, setFinalizeConfirm] = useState(false)
  const [finalizing, setFinalizing] = useState(false)

  const shiftConfig = OFFICIAL_SHIFTS.find((s) => s.id === shift) || null

  const loadSession = useCallback(async () => {
    if (!date || !shift || !areaId) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ date, shift, areaId })
      const res = await fetch(`/api/hora-por-hora/sessions?${params}`, { credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || t('loadErrorGeneric'))
      setSession(data.session)
      setEntries(data.entries || [])
      setLastStandardRate(data.lastStandardRate ?? null)
      if (!data.session) setRateInput(data.lastStandardRate ? String(data.lastStandardRate) : '')
    } catch (err) {
      setError(err.message || t('loadErrorGeneric'))
    } finally {
      setLoading(false)
    }
  }, [date, shift, areaId, t])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  function handleGroupChange(nextGroupKey) {
    setGroupKey(nextGroupKey)
    setLineId('')
    const group = AREA_GROUPS.find((g) => g.key === nextGroupKey)
    setAreaId(group?.areaId || '')
  }

  function handleLineChange(nextLineId) {
    setLineId(nextLineId)
    setAreaId(nextLineId)
  }

  async function handleCreateSession() {
    const rate = Number(rateInput)
    if (!Number.isFinite(rate) || rate <= 0) return
    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/hora-por-hora/sessions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, shift, areaId, standardRate: Math.round(rate) }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || t('loadErrorGeneric'))
      setSession(data.session)
      setEntries(data.entries || [])
      showToast(t('toastSessionCreated'), 'success')
    } catch (err) {
      setError(err.message || t('loadErrorGeneric'))
    } finally {
      setCreating(false)
    }
  }

  async function handleFinalize() {
    if (!session) return
    setFinalizing(true)
    try {
      const res = await fetch(`/api/hora-por-hora/sessions/${session.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'FINALIZADO' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || t('loadErrorGeneric'))
      setSession(data.session)
      setEntries(data.entries || [])
      showToast(t('toastShiftFinalized'), 'success')
    } catch (err) {
      showToast(err.message || t('loadErrorGeneric'), 'error')
    } finally {
      setFinalizing(false)
      setFinalizeConfirm(false)
    }
  }

  async function handleReopen() {
    if (!session) return
    try {
      const res = await fetch(`/api/hora-por-hora/sessions/${session.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ABIERTO' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || t('loadErrorGeneric'))
      setSession(data.session)
      setEntries(data.entries || [])
      showToast(t('toastShiftReopened'), 'success')
    } catch (err) {
      showToast(err.message || t('loadErrorGeneric'), 'error')
    }
  }

  function handleExport() {
    if (!session) return
    exportHourlyProductionToExcel({ session, entries, t })
  }

  function handleEntrySaved(detail) {
    setSession(detail.session)
    setEntries(detail.entries || [])
    setActiveEntry(null)
  }

  const activeIndex = getActiveEntryIndex(session, shiftConfig, entries)
  const isReadOnly = session?.status === 'FINALIZADO' && !canEditFinalized
  const summary = useMemo(() => computeShiftSummary(entries), [entries])
  const cumulative = useMemo(
    () => computeCumulativeTotals(entries, activeIndex),
    [entries, activeIndex],
  )
  const hasAnyCapture = entries.some((e) => e.actualQty != null)
  const gapAccent = !hasAnyCapture ? 'slate' : cumulative.gap >= 0 ? 'green' : 'red'

  if (showHistory) {
    return <HourlyHistoryView onBack={() => setShowHistory(false)} />
  }

  if (showCausesAdmin) {
    return <HourlyCausesAdmin onBack={() => setShowCausesAdmin(false)} />
  }

  return (
    <div className={pageClass}>
      <div className={cn(cardClass, 'mb-4')}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-black/[.015] px-5 py-3.5 dark:bg-white/[.02]">
          <div>
            <p className={pageTitleClass}>{t('pageTitle')}</p>
            <p className={pageSubtitleClass}>{t('pageSubtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-bold uppercase tracking-[0.02em] text-muted-foreground">
              {dayjs(date).format('DD MMM YYYY').toUpperCase()}
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowHistory(true)}>
                  <History className="mr-2 h-4 w-4" />
                  {t('viewHistoryButton')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport} disabled={!session}>
                  <Download className="mr-2 h-4 w-4" />
                  {t('exportExcelButton')}
                </DropdownMenuItem>
                {user?.role === 'ADMINISTRADOR' && (
                  <DropdownMenuItem onClick={() => setShowCausesAdmin(true)}>
                    <Settings className="mr-2 h-4 w-4" />
                    {t('causesAdminMenuItem')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 px-5 py-3.5">
          <div>
            <Label className="mb-1.5 block text-xs">{t('fieldDate')}</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-[160px]"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">{t('fieldShift')}</Label>
            <Select value={shift} onValueChange={setShift}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
                <SelectValue placeholder={t('fieldAreaPlaceholder')} />
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
              <Select value={lineId} onValueChange={handleLineChange}>
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

      {error && <Alert className={cn(alertToneClass('error'), 'mb-4')}>{error}</Alert>}

      {!areaId ? (
        <div className={cardClass}>
          <div className="px-5 py-10">
            <EmptyState compact title={t('selectAreaPrompt')} />
          </div>
        </div>
      ) : loading ? (
        <div className={cardClass}>
          <div className="px-5 py-10">
            <EmptyState compact title={t('loading')} />
          </div>
        </div>
      ) : !session ? (
        <div className={cardClass}>
          <div className="flex flex-col items-center gap-4 px-5 py-10 text-center">
            <ClipboardList className="h-9 w-9 text-muted-foreground" />
            <p className="text-[15px] font-bold text-foreground">{t('noSessionTitle')}</p>
            <p className="max-w-md text-[13px] text-muted-foreground">
              {t('noSessionDescription')}
            </p>
            <div className="flex items-end gap-2">
              <div>
                <Label className="mb-1.5 block text-xs">{t('fieldRate')}</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  placeholder={t('fieldRatePlaceholder')}
                  className="w-[140px]"
                />
              </div>
              <Button
                onClick={handleCreateSession}
                disabled={creating || !Number(rateInput) || Number(rateInput) <= 0}
              >
                {creating ? t('generating') : t('generateHoursButton')}
              </Button>
            </div>
            {lastStandardRate != null && (
              <p className="text-[11.5px] text-muted-foreground">
                {t('lastRateHint', { rate: lastStandardRate })}
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={kpiCardClass('blue')}>
              <p className="mb-1.5 text-[13px] font-bold text-muted-foreground">
                {t('kpiExpectedTitle')}
              </p>
              <p className="text-[28px] font-extrabold leading-none text-[#3B82F6]">
                {cumulative.expected}
                <span className="ml-1 text-[13px] font-semibold text-muted-foreground">
                  {t('unitPieces')}
                </span>
              </p>
            </div>
            <div className={kpiCardClass('purple')}>
              <p className="mb-1.5 text-[13px] font-bold text-muted-foreground">
                {t('kpiActualTitle')}
              </p>
              <p className="text-[28px] font-extrabold leading-none text-[#A855F7]">
                {cumulative.actual}
                <span className="ml-1 text-[13px] font-semibold text-muted-foreground">
                  {t('unitPieces')}
                </span>
              </p>
            </div>
            <div className={kpiCardClass(gapAccent)}>
              <p className="mb-1.5 text-[13px] font-bold text-muted-foreground">
                {t('kpiGapTitle')}
              </p>
              <p
                className={cn(
                  'text-[28px] font-extrabold leading-none',
                  !hasAnyCapture
                    ? 'text-muted-foreground'
                    : cumulative.gap >= 0
                      ? 'text-[#10B981]'
                      : 'text-[#EF4444]',
                )}
              >
                {hasAnyCapture ? `${cumulative.gap > 0 ? '+' : ''}${cumulative.gap}` : '—'}
                <span className="ml-1 text-[13px] font-semibold text-muted-foreground">
                  {t('unitPieces')}
                </span>
              </p>
            </div>
            <div className={kpiCardClass('amber')}>
              <p className="mb-1.5 text-[13px] font-bold text-muted-foreground">
                {t('kpiComplianceTitle')}
              </p>
              <p className="text-[28px] font-extrabold leading-none text-[#F59E0B]">
                {cumulative.compliancePct != null ? `${cumulative.compliancePct.toFixed(1)}%` : '—'}
              </p>
              <div className={cn(progressBarClass, 'mt-2')}>
                <div
                  className="h-full rounded-full bg-[#F59E0B]"
                  style={{ width: `${Math.min(100, cumulative.compliancePct || 0)}%` }}
                />
              </div>
            </div>
          </div>

          <div className={cn(cardClass, 'mb-4')}>
            <div className={cardHeaderClass}>
              <div className="min-w-0 flex-1">
                <p className={cardHeaderTitleClass}>{t('tableTitle')}</p>
                <p className="text-[11.5px] text-muted-foreground">{t('tableSubtitle')}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-2 sm:flex">
                  <div className={cn(progressBarClass, 'w-[100px]')}>
                    <div
                      className="h-full rounded-full bg-[#3B82F6]"
                      style={{
                        width: `${(summary.capturedHours / (summary.totalHours || 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="whitespace-nowrap text-[11.5px] font-semibold text-muted-foreground">
                    {t('progressLabel', {
                      captured: summary.capturedHours,
                      total: summary.totalHours,
                    })}
                  </p>
                </div>
                {session.status === 'ABIERTO' ? (
                  <Button variant="outline" size="sm" onClick={() => setFinalizeConfirm(true)}>
                    {t('finalizeShiftButton')}
                  </Button>
                ) : canEditFinalized ? (
                  <Button variant="outline" size="sm" onClick={handleReopen}>
                    {t('reopenShiftButton')}
                  </Button>
                ) : null}
              </div>
            </div>

            {session.status === 'FINALIZADO' && (
              <div className="px-5 pt-3.5">
                <Alert className={alertToneClass('info')}>{t('shiftFinalizedNotice')}</Alert>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <Th>{t('colHour')}</Th>
                    <Th>{t('colStandard')}</Th>
                    <Th>{t('colActual')}</Th>
                    <Th>{t('colGap')}</Th>
                    <Th>{t('colCompliance')}</Th>
                    <Th>{t('colLosses')}</Th>
                    <Th>{t('colStatus')}</Th>
                    <Th className="text-right">{t('colActions')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => {
                    const isActive = idx === activeIndex
                    const status = getEntryStatus(entry, isActive)
                    const gap = computeGap(entry.standardQty, entry.actualQty)
                    const pct = computeCompliancePct(entry.standardQty, entry.actualQty)
                    const lossCount = entry.incidents?.length || 0
                    return (
                      <tr
                        key={entry.id}
                        className={cn(
                          'border-b border-border/60',
                          isActive && 'bg-[#3B82F6]/[0.05] dark:bg-[#3B82F6]/[0.08]',
                        )}
                      >
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
                        <Td>{lossCount > 0 ? lossCount : '—'}</Td>
                        <Td>
                          <StatusBadge status={status} t={t} />
                        </Td>
                        <Td className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setActiveEntry(entry)}>
                            {entry.actualQty == null ? t('registerButton') : t('editButton')}
                          </Button>
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <HourlyAccumulatedChart entries={entries} activeIndex={activeIndex} />
            <HourlyParetoChart entries={entries} />
          </div>

          <ShiftSummaryCard summary={summary} t={t} />
        </>
      )}

      {activeEntry && (
        <HourlyEntryModal
          entry={activeEntry}
          readOnly={isReadOnly}
          onClose={() => setActiveEntry(null)}
          onSaved={handleEntrySaved}
        />
      )}

      {finalizeConfirm && (
        <FinalizeConfirmDialog
          t={t}
          onCancel={() => setFinalizeConfirm(false)}
          onConfirm={handleFinalize}
          loading={finalizing}
        />
      )}
    </div>
  )
}

function Th({ children, className }) {
  return (
    <th
      className={cn(
        'px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.03em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </th>
  )
}

function Td({ children, className }) {
  return <td className={cn('px-3.5 py-2.5', cellTextClass, className)}>{children}</td>
}

const STATUS_BADGE_CLASS = {
  'SIN CAPTURA': 'bg-gray-500/[0.12] text-gray-600',
  'EN PROCESO': 'bg-blue-500/[0.12] text-blue-600',
  'BAJO OBJETIVO': 'bg-red-500/[0.12] text-red-600',
  CUMPLIDO: 'bg-emerald-500/[0.12] text-emerald-600',
  SUPERADO: 'bg-violet-500/[0.12] text-violet-600',
}

function StatusBadge({ status, t }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-bold',
        STATUS_BADGE_CLASS[status],
      )}
    >
      {t(STATUS_LABEL_KEY[status])}
    </span>
  )
}

function ShiftSummaryCard({ summary, t }) {
  return (
    <div className={cardClass}>
      <div className={cardHeaderClass}>
        <p className={cardHeaderTitleClass}>{t('summaryTitle')}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <SummaryItem
          label={t('summaryExpected')}
          value={`${summary.expected} ${t('unitPieces')}`}
        />
        <SummaryItem label={t('summaryActual')} value={`${summary.actual} ${t('unitPieces')}`} />
        <SummaryItem
          label={t('summaryGap')}
          value={`${summary.gap > 0 ? '+' : ''}${summary.gap} ${t('unitPieces')}`}
        />
        <SummaryItem
          label={t('summaryCompliance')}
          value={summary.compliancePct != null ? `${summary.compliancePct.toFixed(1)}%` : '—'}
        />
        <SummaryItem label={t('summaryMinutesLost')} value={`${summary.minutesLost} min`} />
        <SummaryItem
          label={t('summaryPiecesLost')}
          value={`${summary.piecesLost} ${t('unitPieces')}`}
        />
        <SummaryItem label={t('summaryTopCause')} value={summary.topCause || '—'} />
        <SummaryItem
          label={t('summaryCompliantHours')}
          value={`${summary.compliantHours} / ${summary.totalHours}`}
        />
      </div>
    </div>
  )
}

function SummaryItem({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.02em] text-muted-foreground">
        {label}
      </p>
      <p className="truncate text-[15px] font-bold text-foreground">{value}</p>
    </div>
  )
}

function FinalizeConfirmDialog({ t, onCancel, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/50 p-4">
      <div className={cn(cardClass, 'w-full max-w-[420px] p-5')}>
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
          <p className="text-[15px] font-bold text-foreground">{t('finalizeConfirmTitle')}</p>
        </div>
        <p className="mb-5 text-[13px] text-muted-foreground">{t('finalizeConfirmDescription')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {t('cancelButton')}
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? t('generating') : t('finalizeShiftButton')}
          </Button>
        </div>
      </div>
    </div>
  )
}
