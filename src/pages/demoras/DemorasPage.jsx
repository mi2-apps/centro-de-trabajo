import dayjs from 'dayjs'
import { Download, Settings } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
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
  alertToneClass,
  cardClass,
  cardHeaderClass,
  cardHeaderTitleClass,
  cellTextClass,
  cellTextSecondaryClass,
  pageClass,
  pageSubtitleClass,
  pageTitleClass,
} from '@/lib/pageStyles'
import { cn } from '@/lib/utils'
import {
  DELAY_LOG_THRESHOLD_MINUTES,
  DOWNTIME_REASONS,
  requiresFormalLog,
} from '../../data/demoras/catalog'
import { exportDemorasToExcel } from '../../data/demoras/exportExcel'
import {
  getCurrentShift,
  LINE_FAMILY_WORK_CENTERS,
  OFFICIAL_SHIFTS,
  workCenterById,
} from '../../data/production/catalog'
import { useAuth } from '../../state/auth'
import { EmptyState } from '../../ui'
import DemorasCausesAdmin from './DemorasCausesAdmin'

/* Modulo Demoras de trabajo (2026-09-04, a peticion explicita del usuario): registro real de
   tiempo muerto por causa. Mismo patron de seleccion de area que Auditoria (AUDIT_AREA_GROUPS en
   AuditoriaPage.jsx) -- 5 grupos, "Lineas de produccion" pide una linea especifica, los otros 4
   ya son una sola area real. (2026-09-07: se quito el campo Estacion del formulario en las 5
   areas, a peticion explicita del usuario -- ya no se captura al registrar.)

   ALCANCE (confirmado explicitamente con el usuario tras encontrar que la clasificacion real de
   TVs vive en SmartControl/BinManager, sistema externo de solo lectura desde este repo): esta
   pantalla SOLO registra/lista demoras -- no existe un bloqueo tecnico de "no dejar clasificar la
   siguiente TV", eso queda como politica de proceso del supervisor. */
const AREA_GROUPS = [
  { key: 'LINEAS', labelKey: 'areaGroupLines' },
  { key: 'INSUMOS', labelKey: 'areaGroupInsumos', areaId: 'INSUMOS' },
  { key: 'ACCESORIOS', labelKey: 'areaGroupAccesorios', areaId: 'ACCESORIOS' },
  { key: 'MIDEA', labelKey: 'areaGroupMidea', areaId: 'HIGH_VALUE' },
  { key: 'PALETIZADO', labelKey: 'areaGroupPaletizado', areaId: 'PALETIZADO' },
]

// 2026-09-07 (a peticion explicita del usuario, "el de turnos se ponga en automatico con el
// registro de horarios que ya manejamos en automatico"): el turno ya NO se deja en el hardcode
// CURRENT_SHIFT='Matutino' de siempre -- se calcula con getCurrentShift/OFFICIAL_SHIFTS, la misma
// deteccion automatica por hora real que ya usan Hora por Hora y Sorting (Matutino 07:00-17:10,
// Tiempo extra 17:11-22:00, Noche 22:01-07:00). Se guarda como shift.id (MATUTINO/TIEMPO_EXTRA/
// NOCHE), no el literal en espanol -- ver shiftDisplayLabel() para mostrarlo traducido, con
// fallback al literal legacy (Matutino/Vespertino/Nocturno) de los registros ya guardados antes
// de este cambio, que no matchean ningun id de OFFICIAL_SHIFTS.
//
// 2026-09-08 (a peticion explicita del usuario -- "que si ponen una linea que ya se guarde en
// automatico todo el turno... ya solo llenaria los minutos y la causa"): `persisted` (Area/Linea
// ya elegidos, ver readPersistedLineSelection abajo) se usa para sembrar el formulario en vez de
// arrancar siempre vacio -- solo para esos 3 campos, reasonKey/durationMinutes/notes SIEMPRE
// arrancan vacios (cada demora real necesita su propia duracion y causa, eso nunca se recuerda).
function makeEmptyForm(persisted) {
  return {
    groupKey: persisted?.groupKey || '',
    lineId: persisted?.lineId || '',
    areaId: persisted?.areaId || '',
    reasonKey: '',
    durationMinutes: '',
    shift: getCurrentShift().id,
    notes: '',
  }
}

// Memoria de "Area/Linea" por usuario + turno (2026-09-08, a peticion explicita del usuario):
// nunca en el servidor -- es una comodidad de captura, no un dato de negocio (mismo criterio ya
// usado en este proyecto para tema/idioma en localStorage, ver App.jsx/i18n.js). Se guarda por
// userId (nunca se hereda la seleccion de otra persona en un dispositivo compartido) + shift.id
// (expira solo -- al cruzar a un turno nuevo, no hay seleccion guardada para ese turno todavia).
const LINE_MEMORY_PREFIX = 'demoras:lastLine'

function readPersistedLineSelection(userId, shiftId) {
  if (!userId || !shiftId) return null
  try {
    const raw = localStorage.getItem(`${LINE_MEMORY_PREFIX}:${userId}:${shiftId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writePersistedLineSelection(userId, shiftId, selection) {
  if (!userId || !shiftId) return
  try {
    localStorage.setItem(`${LINE_MEMORY_PREFIX}:${userId}:${shiftId}`, JSON.stringify(selection))
  } catch {}
}

function shiftDisplayLabel(t, raw) {
  if (!raw) return '—'
  const official = OFFICIAL_SHIFTS.find((s) => s.id === raw)
  return official ? t(`shift.${official.id}`) : raw
}

// Resuelve el label a mostrar para un reasonKey, sea una de las 15 causas estaticas (traducidas
// via reasons.KEY) o una causa dinamica agregada por un ADMINISTRADOR (2026-09-08) -- estas
// ultimas se guardan ya en texto real, nunca como clave de traduccion (ver DemorasCausesAdmin.jsx
// y api/demoras/reasons/*.js), asi que se muestran tal cual, igual en los 3 idiomas.
function reasonLabel(t, key, dynamicReasonsByCode) {
  if (DOWNTIME_REASONS.some((r) => r.key === key)) return t(`reasons.${key}`)
  return dynamicReasonsByCode.get(key)?.name || key
}

export default function DemorasPage() {
  const { t } = useTranslation('demoras')
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMINISTRADOR'
  // 2026-09-04 (a peticion explicita del usuario, viendo la pantalla en vivo -- "a los de rol de
  // lider solo les debe de salir ese cuadro y ya"): LIDER solo ve el formulario de registro, sin
  // el historial de "Registros recientes" -- ni siquiera se pide la lista al servidor para ese
  // rol. ADMINISTRADOR/SUPERVISOR sin cambios (ven ambos).
  const showHistory = user?.role !== 'LIDER'
  const [showCausesAdmin, setShowCausesAdmin] = useState(false)
  const [form, setForm] = useState(() =>
    makeEmptyForm(readPersistedLineSelection(user?.id, getCurrentShift().id)),
  )
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [records, setRecords] = useState([])
  const [loadingRecords, setLoadingRecords] = useState(true)
  const [dynamicReasons, setDynamicReasons] = useState([])

  // Filtro por fechas del historial (2026-09-09, a peticion explicita del usuario -- "que la
  // fecha este en automatico, osea como hoy que es 9 que nomas salga de este dia, ya si quiero
  // ver lo de ayer solo cambio de fecha"): por default solo HOY, en ambos campos -- un cambio
  // manual en Desde y/o Hasta es la unica forma de ver otro rango.
  const [dateFrom, setDateFrom] = useState(dayjs().format('YYYY-MM-DD'))
  const [dateTo, setDateTo] = useState(dayjs().format('YYYY-MM-DD'))

  const loadRecords = useCallback(async () => {
    setLoadingRecords(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const res = await fetch(`/api/demoras?${params}`, { credentials: 'include' })
      const data = await res.json().catch(() => null)
      setRecords(data?.records || [])
    } finally {
      setLoadingRecords(false)
    }
  }, [dateFrom, dateTo])

  // Agrupado por dia calendario (2026-09-09, a peticion explicita del usuario -- "organiza bien
  // el historial, estructuralo bien"): el servidor ya manda los registros ordenados desc por
  // createdAt (ver api/demoras/index.js), asi que agrupar aqui solo junta filas consecutivas del
  // mismo dia -- nunca reordena nada. Cada grupo guarda su fecha real (Date, no el string ya
  // formateado) para poder mostrar el encabezado con dayjs.
  const groupedRecords = useMemo(() => {
    const groups = []
    for (const record of records) {
      const day = dayjs(record.createdAt).format('YYYY-MM-DD')
      const last = groups[groups.length - 1]
      if (last && last.day === day) {
        last.records.push(record)
      } else {
        groups.push({ day, date: record.createdAt, records: [record] })
      }
    }
    return groups
  }, [records])

  // includeInactive=1 (2026-09-08): el Select de captura filtra .active localmente mas abajo,
  // pero el historial necesita poder resolver el nombre real de una causa YA desactivada (el
  // reasonKey de un registro viejo no desaparece solo porque el admin la desactivo despues).
  const loadDynamicReasons = useCallback(async () => {
    const res = await fetch('/api/demoras/reasons?includeInactive=1', { credentials: 'include' })
    const data = await res.json().catch(() => null)
    setDynamicReasons(data?.reasons || [])
  }, [])

  useEffect(() => {
    if (showHistory) loadRecords()
  }, [showHistory, loadRecords])

  useEffect(() => {
    loadDynamicReasons()
  }, [loadDynamicReasons])

  const dynamicReasonsByCode = new Map(dynamicReasons.map((r) => [r.code, r]))

  // Exportar a Excel (2026-09-09, a peticion explicita del usuario): usa exactamente el mismo
  // `records` ya cargado con el filtro Desde/Hasta vigente -- nunca vuelve a pedirle nada al
  // servidor con otro rango, asi que lo que se exporta es siempre lo mismo que se esta viendo en
  // pantalla. Aqui se resuelven nombres reales (causa/area/turno) antes de pasarlos al modulo de
  // export, que no conoce catalogos ni i18n -- ver exportExcel.js.
  function handleExportExcel() {
    const rows = records.map((r) => ({
      date: new Date(r.createdAt),
      areaName: workCenterById(r.areaId)?.name || r.areaId,
      reasonName: reasonLabel(t, r.reasonKey, dynamicReasonsByCode),
      durationMinutes: r.durationMinutes,
      shiftLabel: shiftDisplayLabel(t, r.shift),
      createdByName: r.createdByName || '—',
      notes: r.notes || '',
      reportable: requiresFormalLog(r.durationMinutes),
    }))
    exportDemorasToExcel({ rows, dateFrom, dateTo, t })
  }

  function handleGroupChange(groupKey) {
    const group = AREA_GROUPS.find((g) => g.key === groupKey)
    setForm((prev) => {
      const next = { ...prev, groupKey, lineId: '', areaId: group?.areaId || '' }
      writePersistedLineSelection(user?.id, next.shift, {
        groupKey: next.groupKey,
        lineId: next.lineId,
        areaId: next.areaId,
      })
      return next
    })
  }

  function handleLineChange(lineId) {
    setForm((prev) => {
      const next = { ...prev, lineId, areaId: lineId }
      writePersistedLineSelection(user?.id, next.shift, {
        groupKey: next.groupKey,
        lineId: next.lineId,
        areaId: next.areaId,
      })
      return next
    })
  }

  const canSubmit =
    Boolean(form.areaId) && Boolean(form.reasonKey) && Number(form.durationMinutes) > 0

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/demoras', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          areaId: form.areaId,
          reasonKey: form.reasonKey,
          durationMinutes: Number(form.durationMinutes),
          shift: form.shift || null,
          notes: form.notes || null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || t('saveErrorGeneric'))
      // 2026-09-08 (a peticion explicita del usuario): Area/Linea NUNCA se limpian aqui si el
      // turno sigue siendo el mismo -- solo se limpian causa/duracion/notas, para que la
      // siguiente demora del mismo turno solo pida esos 2 campos. Si el turno YA cambio (cruce
      // real de horario mientras se llenaba el formulario), se resiembra desde la memoria de ese
      // turno nuevo (normalmente vacia) en vez de arrastrar la linea del turno anterior.
      const currentShiftId = getCurrentShift().id
      if (currentShiftId === form.shift) {
        setForm((prev) => ({ ...prev, reasonKey: '', durationMinutes: '', notes: '' }))
      } else {
        setForm(makeEmptyForm(readPersistedLineSelection(user?.id, currentShiftId)))
      }
      await loadRecords()
    } catch (err) {
      setSubmitError(err.message || t('saveErrorGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  const durationValue = Number(form.durationMinutes)
  const showsRequiresLogHint = durationValue > 0

  if (showCausesAdmin) {
    return (
      <DemorasCausesAdmin
        onBack={() => {
          setShowCausesAdmin(false)
          loadDynamicReasons()
        }}
      />
    )
  }

  return (
    <div className={pageClass}>
      <div className={cn(cardClass, 'mb-4')}>
        <div className="flex items-start justify-between gap-3 border-b border-border bg-black/[.015] px-5 py-3.5 dark:bg-white/[.02]">
          <div>
            <p className={pageTitleClass}>{t('pageTitle')}</p>
            <p className={pageSubtitleClass}>{t('pageSubtitle')}</p>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowCausesAdmin(true)}>
              <Settings className="mr-1.5 h-4 w-4" />
              {t('causesAdminMenuItem')}
            </Button>
          )}
        </div>
      </div>

      <div
        className={cn(
          'grid grid-cols-1 gap-4',
          showHistory ? 'lg:grid-cols-[380px_1fr]' : 'max-w-[380px]',
        )}
      >
        <form onSubmit={handleSubmit} className={cn(cardClass, 'h-fit p-5')}>
          <p className={cn(cardHeaderTitleClass, 'mb-4')}>{t('formTitle')}</p>

          <div className="space-y-3.5">
            <div>
              <Label className="mb-1.5 block text-xs">{t('fieldArea')}</Label>
              <Select value={form.groupKey} onValueChange={handleGroupChange}>
                <SelectTrigger className="w-full">
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

            {form.groupKey === 'LINEAS' && (
              <div>
                <Label className="mb-1.5 block text-xs">{t('fieldLine')}</Label>
                <Select value={form.lineId} onValueChange={handleLineChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('fieldLinePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {LINE_FAMILY_WORK_CENTERS.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {workCenterById(w.id).name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="mb-1.5 block text-xs">{t('fieldReason')}</Label>
              <Select
                value={form.reasonKey}
                onValueChange={(v) => setForm((prev) => ({ ...prev, reasonKey: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('fieldReasonPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {DOWNTIME_REASONS.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {t(`reasons.${r.key}`)}
                      {r.tag ? ` (${t(`tag.${r.tag}`)})` : ''}
                    </SelectItem>
                  ))}
                  {dynamicReasons
                    .filter((r) => r.active)
                    .map((r) => (
                      <SelectItem key={r.code} value={r.code}>
                        {r.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block text-xs">{t('fieldDuration')}</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={form.durationMinutes}
                onChange={(e) => setForm((prev) => ({ ...prev, durationMinutes: e.target.value }))}
                placeholder={t('fieldDurationPlaceholder')}
              />
              {showsRequiresLogHint && (
                <p className={cn(cellTextSecondaryClass, 'mt-1')}>
                  {requiresFormalLog(durationValue)
                    ? t('durationRequiresLogHint', { minutes: DELAY_LOG_THRESHOLD_MINUTES })
                    : t('durationToleranceHint', { minutes: DELAY_LOG_THRESHOLD_MINUTES })}
                </p>
              )}
            </div>

            <div>
              <Label className="mb-1.5 block text-xs">{t('fieldShift')}</Label>
              <Select
                value={form.shift}
                onValueChange={(v) => setForm((prev) => ({ ...prev, shift: v }))}
              >
                <SelectTrigger className="w-full">
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
              <Label className="mb-1.5 block text-xs">{t('fieldNotes')}</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder={t('fieldNotesPlaceholder')}
              />
            </div>

            {submitError && (
              <Alert className={cn(alertToneClass('error'), 'text-sm')}>{submitError}</Alert>
            )}

            <Button type="submit" disabled={!canSubmit || submitting} className="w-full">
              {submitting ? t('submitting') : t('submit')}
            </Button>
          </div>
        </form>

        {showHistory && (
          <div className={cn(cardClass, 'p-0')}>
            <div className={cardHeaderClass}>
              <p className={cardHeaderTitleClass}>{t('historyTitle')}</p>
            </div>

            <div className="flex flex-wrap items-end gap-3 border-b border-border px-5 py-3.5">
              <div>
                <Label className="mb-1.5 block text-xs">{t('historyDateFrom')}</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">{t('historyDateTo')}</Label>
                <Input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="ml-auto"
                disabled={records.length === 0}
                onClick={handleExportExcel}
              >
                <Download className="mr-1.5 h-4 w-4" />
                {t('exportButton')}
              </Button>
            </div>

            {loadingRecords ? (
              <div className="px-5 py-8">
                <EmptyState compact title={t('loading')} />
              </div>
            ) : groupedRecords.length === 0 ? (
              <div className="px-5 py-8">
                <EmptyState compact title={t('historyEmpty')} />
              </div>
            ) : (
              <div className="max-h-[620px] overflow-auto">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-b border-border">
                      <Th>{t('colReason')}</Th>
                      <Th className="whitespace-nowrap">{t('colArea')}</Th>
                      <Th className="whitespace-nowrap">{t('colDuration')}</Th>
                      <Th className="whitespace-nowrap">{t('colShift')}</Th>
                      <Th>{t('colCreatedBy')}</Th>
                      <Th className="whitespace-nowrap">{t('colTime')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedRecords.map((group) => (
                      <Fragment key={group.day}>
                        <tr>
                          <td
                            colSpan={6}
                            className="border-b border-border bg-black/[.02] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.03em] text-muted-foreground dark:bg-white/[.03]"
                          >
                            {dayjs(group.date).format('DD MMM YYYY')}
                            {' · '}
                            {t('historyDayCount', { count: group.records.length })}
                          </td>
                        </tr>
                        {group.records.map((r) => (
                          <tr key={r.id} className="border-b border-border/60">
                            <Td className="max-w-[320px]">
                              <span className={cellTextClass}>
                                {reasonLabel(t, r.reasonKey, dynamicReasonsByCode)}
                              </span>
                              {requiresFormalLog(r.durationMinutes) && (
                                <span className="ml-1.5 inline-block rounded bg-red-500/[0.12] px-1.5 py-0.5 align-middle text-[10px] font-bold text-red-600">
                                  {t('badgeRequiresLog')}
                                </span>
                              )}
                            </Td>
                            <Td className="whitespace-nowrap">
                              {workCenterById(r.areaId)?.name || r.areaId}
                            </Td>
                            <Td className="whitespace-nowrap">
                              {t('minutesValue', { count: r.durationMinutes })}
                            </Td>
                            <Td className="whitespace-nowrap">{shiftDisplayLabel(t, r.shift)}</Td>
                            <Td>{r.createdByName || '—'}</Td>
                            <Td className="whitespace-nowrap">
                              {dayjs(r.createdAt).format('h:mm A')}
                            </Td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
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
