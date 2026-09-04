import dayjs from 'dayjs'
import { CheckCircle2, Download, History, MoreVertical } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { getCurrentShift, OFFICIAL_SHIFTS } from '../../data/production/catalog'
import { computeTotalLoss, LOSS_COLUMNS } from '../../data/shiftProduction/lossColumns'
import {
  computeCompliancePct,
  computeCumulativeTotals,
  computeGap,
  computeShiftSummary,
  getActiveEntryIndex,
  getEntryStatus,
  STATUS_LABEL_KEY,
} from '../../data/shiftProduction/metrics'
import { exportSortingToExcel } from '../../data/sorting/exportExcel'
import { useAuth } from '../../state/auth'
import { EmptyState } from '../../ui'
import { showToast } from '../../ui/toast'
import SortingAccumulatedChart from './SortingAccumulatedChart'
import SortingHistoryView from './SortingHistoryView'
import SortingParetoChart from './SortingParetoChart'

// Sorting (2026-09-04, a peticion explicita del usuario -- "el de sorting no debe tener area/
// linea ni lineas, Sorting es un area"): a diferencia de Hora por Hora (que aplica a cualquier
// area/linea del catalogo existente), Sorting ES una sola area fija -- no hay nada que
// seleccionar. areaId se manda fijo, nunca viene de un selector. No se agrega 'SORTING' a
// WORK_CENTERS (src/data/production/catalog.js) porque ese catalogo alimenta personal/headcount
// de todo el resto de la app -- agregar una fila ahi tendria efectos secundarios reales en
// Dashboard/Centro de Trabajo que nadie pidio; aqui solo es un identificador de sesion.
const SORTING_AREA_ID = 'SORTING'

const ADMIN_ROLES = new Set(['ADMINISTRADOR', 'SUPERVISOR'])
const DEFAULT_RATE = 65
const AUTOSAVE_DELAY_MS = 700

// Anchas fijas de las 5 columnas "congeladas" (Hora/Estandar/Real/Gap/Cumplimiento -- a peticion
// explicita del usuario: "en tablet puede existir scroll horizontal... mantener congeladas
// visualmente HORA/ESTANDAR/REAL/GAP/CUMPLIMIENTO para que las causas puedan desplazarse"). Los
// left acumulados se derivan de estos mismos anchos, nunca numeros sueltos por separado.
const STICKY_WIDTHS = [112, 64, 64, 64, 88]
const STICKY_LEFTS = STICKY_WIDTHS.reduce((acc, _w, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + STICKY_WIDTHS[i - 1])
  return acc
}, [])

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

function parseNonNegativeInt(raw) {
  if (raw === '' || raw == null) return 0
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

export default function SortingPage() {
  const { t } = useTranslation('sorting')
  const { user } = useAuth()
  const canEditFinalized = ADMIN_ROLES.has(user?.role)
  const defaults = useMemo(() => getDefaultDateAndShift(), [])

  const [date, setDate] = useState(defaults.date)
  const [shift, setShift] = useState(defaults.shiftId)
  const areaId = SORTING_AREA_ID

  const [session, setSession] = useState(null)
  const [entries, setEntries] = useState([])
  const [lastStandardRate, setLastStandardRate] = useState(null)
  const [rateInput, setRateInput] = useState(String(DEFAULT_RATE))
  const [lossUnitInput, setLossUnitInput] = useState('PIECES')
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const [showHistory, setShowHistory] = useState(false)
  const [finalizeConfirm, setFinalizeConfirm] = useState(false)
  const [finalizing, setFinalizing] = useState(false)

  // Autosave por campo, acumulado por hora (2026-09-04, a peticion explicita del usuario --
  // "no quiero que el usuario tenga que presionar guardar... auto-save controlado o guardado por
  // fila... evitar multiples requests innecesarios, aplicar debounce"). pendingRef nunca dispara
  // un render -- solo bookkeeping de que campos faltan por mandar y el timer de cada hora.
  const pendingRef = useRef({})
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error

  const shiftConfig = OFFICIAL_SHIFTS.find((s) => s.id === shift) || null

  const loadSession = useCallback(async () => {
    if (!date || !shift || !areaId) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ date, shift, areaId })
      const res = await fetch(`/api/sorting/sessions?${params}`, { credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || t('loadErrorGeneric'))
      setSession(data.session)
      setEntries(data.entries || [])
      setLastStandardRate(data.lastStandardRate ?? null)
      if (!data.session) {
        setRateInput(String(data.lastStandardRate ?? DEFAULT_RATE))
        setLossUnitInput(data.lastLossUnit ?? 'PIECES')
      }
    } catch (err) {
      setError(err.message || t('loadErrorGeneric'))
    } finally {
      setLoading(false)
    }
  }, [date, shift, t])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  // Limpia timers de autosave pendientes al desmontar -- nunca dejar un PATCH en vuelo despues de
  // salir del modulo.
  useEffect(() => {
    return () => {
      for (const pending of Object.values(pendingRef.current)) {
        if (pending.timer) clearTimeout(pending.timer)
      }
      pendingRef.current = {}
    }
  }, [])

  async function handleCreateSession() {
    const rate = Number(rateInput)
    if (!Number.isFinite(rate) || rate <= 0) return
    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/sorting/sessions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          shift,
          areaId,
          standardRate: Math.round(rate),
          lossUnit: lossUnitInput,
        }),
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
      const res = await fetch(`/api/sorting/sessions/${session.id}`, {
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
      const res = await fetch(`/api/sorting/sessions/${session.id}`, {
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
    exportSortingToExcel({ session, entries, t })
  }

  // flushEntry: manda al API SOLO los campos realmente modificados de esa hora, acumulados desde
  // el ultimo flush (nunca un campo por request -- "evitar multiples requests innecesarios").
  const flushEntry = useCallback(
    async (entryId) => {
      const pending = pendingRef.current[entryId]
      if (!pending || Object.keys(pending.fields).length === 0) return
      const fields = pending.fields
      pendingRef.current[entryId] = { fields: {}, timer: null }
      setSaveStatus('saving')
      try {
        const res = await fetch(`/api/sorting/entries/${entryId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fields),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || t('saveErrorGeneric'))
        setSession(data.session)
        setEntries(data.entries || [])
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 2000)
      } catch (err) {
        setSaveStatus('error')
        showToast(err.message || t('saveErrorGeneric'), 'error')
      }
    },
    [t],
  )

  function queueFieldChange(entryId, field, value) {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, [field]: value } : e)))
    const existing = pendingRef.current[entryId] || { fields: {}, timer: null }
    if (existing.timer) clearTimeout(existing.timer)
    existing.fields = { ...existing.fields, [field]: value }
    existing.timer = setTimeout(() => flushEntry(entryId), AUTOSAVE_DELAY_MS)
    pendingRef.current[entryId] = existing
  }

  function flushEntryNow(entryId) {
    const pending = pendingRef.current[entryId]
    if (pending?.timer) clearTimeout(pending.timer)
    flushEntry(entryId)
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
  const lossUnitLabel =
    session?.lossUnit === 'MINUTES' ? t('unitMinutesShort') : t('unitPiecesShort')

  // Navegacion tipo hoja de calculo (2026-09-04, a peticion explicita del usuario -- "Enter, Tab,
  // Shift+Tab, flechas... experiencia tipo hoja operativa"): Tab/Shift+Tab ya funcionan gratis
  // (orden natural del DOM, un <input> por celda editable en el mismo orden de lectura). Enter y
  // flechas arriba/abajo mueven el foco a la MISMA columna en la hora siguiente/anterior --
  // izquierda/derecha se dejan al comportamiento nativo del cursor de texto (no se intercepta,
  // para no romper edicion de Observaciones).
  function handleCellKeyDown(e, rowIndex, colKey) {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      document.getElementById(`sorting-cell-${rowIndex + 1}-${colKey}`)?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      document.getElementById(`sorting-cell-${rowIndex - 1}-${colKey}`)?.focus()
    }
  }

  if (showHistory) {
    return <SortingHistoryView onBack={() => setShowHistory(false)} />
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
          {session && (
            <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
              <span>
                <span className="font-bold text-foreground">{t('fieldRate')}:</span>{' '}
                {session.standardRate} {t('unitPiecesShort')}/h
              </span>
              <span>
                <span className="font-bold text-foreground">{t('fieldLossUnit')}:</span>{' '}
                {session.lossUnit === 'MINUTES' ? t('unitMinutes') : t('unitPieces')}
              </span>
              {session.updatedByName && (
                <span>
                  {t('lastUpdatedLabel')} {session.updatedByName} —{' '}
                  {dayjs(session.updatedAt).format('HH:mm')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {error && <Alert className={cn(alertToneClass('error'), 'mb-4')}>{error}</Alert>}

      {loading ? (
        <div className={cardClass}>
          <div className="px-5 py-10">
            <EmptyState compact title={t('loading')} />
          </div>
        </div>
      ) : !session ? (
        <div className={cardClass}>
          <div className="flex flex-col items-center gap-4 px-5 py-10 text-center">
            <p className="text-[15px] font-bold text-foreground">{t('noSessionTitle')}</p>
            <p className="max-w-md text-[13px] text-muted-foreground">
              {t('noSessionDescription')}
            </p>
            <div className="flex flex-wrap items-end justify-center gap-2">
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
              <div>
                <Label className="mb-1.5 block text-xs">{t('fieldLossUnit')}</Label>
                <div className="flex gap-1.5">
                  {['PIECES', 'MINUTES'].map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setLossUnitInput(u)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-[13px] font-semibold',
                        lossUnitInput === u
                          ? 'border-[#3B82F6] bg-[#3B82F6]/[0.1] text-[#3B82F6]'
                          : 'border-border text-muted-foreground',
                      )}
                    >
                      {u === 'PIECES' ? t('unitPieces') : t('unitMinutes')}
                    </button>
                  ))}
                </div>
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
                {hasAnyCapture ? cumulative.actual : '—'}
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
                {hasAnyCapture && cumulative.compliancePct != null
                  ? `${cumulative.compliancePct.toFixed(1)}%`
                  : '—'}
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
              <div className="flex items-center gap-3">
                <SaveStatusIndicator status={saveStatus} t={t} />
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
              <table className="w-full min-w-[1500px] border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <StickyTh index={0}>{t('colHour')}</StickyTh>
                    <StickyTh index={1}>{t('colStandard')}</StickyTh>
                    <StickyTh index={2}>{t('colActual')}</StickyTh>
                    <StickyTh index={3}>{t('colGap')}</StickyTh>
                    <StickyTh index={4}>{t('colCompliance')}</StickyTh>
                    {LOSS_COLUMNS.map((c) => (
                      <Th key={c.key} className="text-right">
                        {t(c.labelKey)}
                      </Th>
                    ))}
                    <Th className="text-right">{t('colTotalLoss')}</Th>
                    <Th>{t('colObservations')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, rowIndex) => {
                    const isActive = rowIndex === activeIndex
                    const status = getEntryStatus(entry, isActive)
                    const gap = computeGap(entry.standardQty, entry.actualQty)
                    const pct = computeCompliancePct(entry.standardQty, entry.actualQty)
                    const totalLoss = computeTotalLoss(entry)
                    const rowBg = isActive
                      ? 'bg-[#3B82F6]/[0.05] dark:bg-[#3B82F6]/[0.08]'
                      : undefined
                    return (
                      <tr key={entry.id} className={cn('border-b border-border/60', rowBg)}>
                        <StickyTd index={0} rowBg={rowBg} className="font-semibold">
                          <div className="flex items-center gap-1.5">
                            {entry.startTime} - {entry.endTime}
                            {isActive && (
                              <span className="rounded bg-[#3B82F6]/[0.12] px-1 py-0.5 text-[9.5px] font-bold uppercase text-[#3B82F6]">
                                {t('statusInProgress')}
                              </span>
                            )}
                          </div>
                        </StickyTd>
                        <StickyTd index={1} rowBg={rowBg}>
                          {entry.standardQty}
                        </StickyTd>
                        <StickyTd index={2} rowBg={rowBg} className="p-0">
                          <EditableCell
                            id={`sorting-cell-${rowIndex}-actualQty`}
                            value={entry.actualQty == null ? '' : String(entry.actualQty)}
                            placeholder={t('noCaptureShort')}
                            tone="blue"
                            disabled={isReadOnly}
                            onKeyDown={(e) => handleCellKeyDown(e, rowIndex, 'actualQty')}
                            onChange={(raw) => {
                              if (raw === '') return
                              queueFieldChange(entry.id, 'actualQty', parseNonNegativeInt(raw))
                            }}
                            onBlur={() => flushEntryNow(entry.id)}
                          />
                        </StickyTd>
                        <StickyTd
                          index={3}
                          rowBg={rowBg}
                          className={
                            gap == null ? '' : gap >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                          }
                          title={t(STATUS_LABEL_KEY[status])}
                        >
                          {gap == null ? '—' : `${gap > 0 ? '+' : ''}${gap}`}
                        </StickyTd>
                        <StickyTd index={4} rowBg={rowBg} title={t(STATUS_LABEL_KEY[status])}>
                          {pct == null ? '—' : `${pct.toFixed(1)}%`}
                        </StickyTd>
                        {LOSS_COLUMNS.map((c) => (
                          <Td key={c.key} className="p-0">
                            <EditableCell
                              id={`sorting-cell-${rowIndex}-${c.key}`}
                              value={String(entry[c.key] ?? 0)}
                              tone="amber"
                              disabled={isReadOnly}
                              onKeyDown={(e) => handleCellKeyDown(e, rowIndex, c.key)}
                              onChange={(raw) => {
                                if (raw === '') return
                                queueFieldChange(entry.id, c.key, parseNonNegativeInt(raw))
                              }}
                              onBlur={() => flushEntryNow(entry.id)}
                            />
                          </Td>
                        ))}
                        <Td className="text-right font-bold">{totalLoss > 0 ? totalLoss : '—'}</Td>
                        <Td className="min-w-[200px] p-0">
                          <EditableCell
                            id={`sorting-cell-${rowIndex}-observations`}
                            type="text"
                            value={entry.observations || ''}
                            placeholder={t('fieldObservationPlaceholder')}
                            tone="blue"
                            disabled={isReadOnly}
                            onKeyDown={(e) => handleCellKeyDown(e, rowIndex, 'observations')}
                            onChange={(raw) => queueFieldChange(entry.id, 'observations', raw)}
                            onBlur={() => flushEntryNow(entry.id)}
                          />
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-black/[.02] font-bold dark:bg-white/[.03]">
                    <StickyTd index={0} rowBg="bg-black/[.02] dark:bg-white/[.03]">
                      {t('totalShiftLabel')}
                    </StickyTd>
                    <StickyTd index={1} rowBg="bg-black/[.02] dark:bg-white/[.03]">
                      {summary.expected}
                    </StickyTd>
                    <StickyTd index={2} rowBg="bg-black/[.02] dark:bg-white/[.03]">
                      {hasAnyCapture ? summary.actual : '—'}
                    </StickyTd>
                    <StickyTd
                      index={3}
                      rowBg="bg-black/[.02] dark:bg-white/[.03]"
                      className={
                        !hasAnyCapture ? '' : summary.gap >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                      }
                    >
                      {hasAnyCapture ? `${summary.gap > 0 ? '+' : ''}${summary.gap}` : '—'}
                    </StickyTd>
                    <StickyTd index={4} rowBg="bg-black/[.02] dark:bg-white/[.03]">
                      {hasAnyCapture && summary.compliancePct != null
                        ? `${summary.compliancePct.toFixed(1)}%`
                        : '—'}
                    </StickyTd>
                    {summary.lossByColumn.map((c) => (
                      <Td key={c.labelKey} className="text-right">
                        {c.value}
                      </Td>
                    ))}
                    <Td className="text-right">{summary.totalLoss}</Td>
                    <Td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SortingAccumulatedChart entries={entries} activeIndex={activeIndex} />
            <SortingParetoChart entries={entries} lossUnit={session.lossUnit} />
          </div>

          <ShiftSummaryCard summary={summary} lossUnitLabel={lossUnitLabel} t={t} />
        </>
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

function Td({ children, className, title }) {
  return (
    <td className={cn('px-3.5 py-2.5', cellTextClass, className)} title={title}>
      {children}
    </td>
  )
}

function StickyTh({ index, children }) {
  return (
    <th
      className="sticky z-[2] bg-card px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.03em] text-muted-foreground"
      style={{ left: STICKY_LEFTS[index], width: STICKY_WIDTHS[index] }}
    >
      {children}
    </th>
  )
}

function StickyTd({ index, children, className, rowBg, title }) {
  return (
    <td
      className={cn('sticky z-[1] px-3.5 py-2.5', cellTextClass, rowBg || 'bg-card', className)}
      style={{ left: STICKY_LEFTS[index], width: STICKY_WIDTHS[index] }}
      title={title}
    >
      {children}
    </td>
  )
}

const TONE_CLASS = {
  blue: 'bg-[#3B82F6]/[0.06] dark:bg-[#3B82F6]/[0.10] focus-within:bg-[#3B82F6]/[0.12]',
  amber: 'bg-[#F59E0B]/[0.07] dark:bg-[#F59E0B]/[0.11] focus-within:bg-[#F59E0B]/[0.14]',
}

// Celda editable "tipo Excel" (2026-09-04, a peticion explicita del usuario -- "click en REAL,
// escribir, Enter, pasar a la siguiente hora... debe sentirse como Excel"): input sin bordes que
// llena la celda, fondo de color segun tipo de dato (azul=produccion/observacion, amarillo=
// perdida), onChange actualiza el estado local de inmediato (autosave real via
// queueFieldChange/flushEntry en el padre) -- onBlur fuerza el guardado sin esperar el debounce.
function EditableCell({
  id,
  value,
  onChange,
  onBlur,
  onKeyDown,
  tone,
  disabled,
  placeholder,
  type,
}) {
  const isNumeric = type !== 'text'
  return (
    <div className={cn('h-full w-full', TONE_CLASS[tone])}>
      <input
        id={id}
        type={isNumeric ? 'number' : 'text'}
        inputMode={isNumeric ? 'numeric' : undefined}
        min={isNumeric ? 0 : undefined}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className={cn(
          'w-full bg-transparent px-3 py-2 text-[13px] text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60',
          isNumeric ? 'text-right' : 'text-left',
        )}
      />
    </div>
  )
}

function SaveStatusIndicator({ status, t }) {
  if (status === 'idle') return null
  const label =
    status === 'saving' ? t('saving') : status === 'saved' ? t('saved') : t('saveErrorGeneric')
  const cls =
    status === 'error'
      ? 'text-[#EF4444]'
      : status === 'saved'
        ? 'text-[#10B981]'
        : 'text-muted-foreground'
  return <p className={cn('text-[11.5px] font-semibold', cls)}>{label}</p>
}

function ShiftSummaryCard({ summary, lossUnitLabel, t }) {
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
        <SummaryItem
          label={t('summaryTotalLoss')}
          value={summary.totalLoss > 0 ? `${summary.totalLoss} ${lossUnitLabel}` : '—'}
        />
        <SummaryItem
          label={t('summaryTopCause')}
          value={summary.topCauseKey ? t(summary.topCauseKey) : '—'}
        />
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
