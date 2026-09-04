import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  alertToneClass,
  cardClass,
  cardHeaderClass,
  cardHeaderSubtitleClass,
  cardHeaderTitleClass,
  cellTextClass,
  cellTextSecondaryClass,
  metricChipClass,
  pageClass,
  pageSubtitleClass,
  pageTitleClass,
  tableHeaderRowClass,
  tableRowClass,
} from '@/lib/pageStyles'
import { cn } from '@/lib/utils'
import { workCenterById } from '../../data/production/catalog'
import FiveSResultDialog from '../../pages/auditoria/FiveSResultDialog'
import ProcesoResultDialog from '../../pages/auditoria/ProcesoResultDialog'
import { EmptyState } from '../../ui'

/* Modulo Evaluaciones -- historial real de Auditoria 5S (2026-09-03, a peticion explicita del
   usuario: "conviertelo en un sistema completo de evaluacion 5S" -- checklist real de 40
   criterios/5 categorias, puntaje 0-20 normalizado por S, ver FiveSAudit/FiveSAuditAnswer en
   server-lib/db/schema.js y src/data/audits5s/criteria.js. Reemplaza la version anterior (1 sola
   clasificacion por S, area-only) -- SOLO LECTURA, sigue sin formularios/edicion/borrado aqui,
   eso vive en Auditoria/FiveSDialog.

   Click en una fila -> GET /api/evaluaciones/:id (cabecera + respuestas por criterio TAL CUAL se
   guardaron) -> mismo FiveSResultDialog que se abre justo al terminar una auditoria nueva --
   "al entrar a una auditoria anterior DEBE reconstruir EXACTAMENTE su radar con los datos
   guardados, NO recalcular usando configuraciones nuevas" -- nunca se recalcula nada aqui.

   "Evolucion 5S" (2026-09-03, idea tomada de la presentacion 5S original, Ene..Dic): selector de
   Area (+ Puesto si esa area tiene auditorias con puesto) sobre los datos YA CARGADOS -- nunca
   mezcla areas/puestos distintos en la misma tendencia (a peticion explicita) -- consulta real
   /api/evaluaciones/evolution, nunca datos quemados.

   2026-09-03 (mismo dia, a peticion explicita del usuario): se agrega una segunda tabla, historial
   real de "Auditoria de Proceso" (ProcessAudit/ProcessAuditAnswer, ver
   src/data/auditsProceso/criteria.js) -- SOLO LECTURA igual que la de 5S, click en una fila -> GET
   /api/process-audits/:id -> ProcesoResultDialog. Sin "Evolucion" para este tipo todavia (no se
   pidio esta vez) -- solo tabla + reabrir resultado, para no perder el checklist lleno despues de
   cerrar la pantalla de resultado. */

const CATEGORIES = ['s1', 's2', 's3', 's4', 's5']
const MONTH_KEYS = [
  'monthJan',
  'monthFeb',
  'monthMar',
  'monthApr',
  'monthMay',
  'monthJun',
  'monthJul',
  'monthAug',
  'monthSep',
  'monthOct',
  'monthNov',
  'monthDec',
]

// Semaforo simple SOLO como ayuda visual (umbrales ya establecidos: verde >=80, ambar 50-79, rojo
// <50) -- ningun otro umbral de negocio se inventa.
function scoreTone(totalScore) {
  if (totalScore >= 80) return 'ok'
  if (totalScore >= 50) return 'warn'
  return 'bad'
}

export default function EvaluacionesPage() {
  const { t } = useTranslation('evaluaciones')
  const [evaluations, setEvaluations] = useState(null) // null = cargando todavia
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null) // {evaluation, previousEvaluation, answers}
  const [detailError, setDetailError] = useState('')
  const [evoAreaId, setEvoAreaId] = useState('')
  const [evoStationName, setEvoStationName] = useState('')
  const [evoMonths, setEvoMonths] = useState(null)
  const [evoError, setEvoError] = useState('')

  const [processAudits, setProcessAudits] = useState(null) // null = cargando todavia
  const [processError, setProcessError] = useState('')
  const [procesoDetail, setProcesoDetail] = useState(null) // {audit, previousAudit}
  const [procesoDetailError, setProcesoDetailError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/evaluaciones', { credentials: 'include' })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error((data && data.error) || t('loadErrorGeneric'))
        if (!cancelled) setEvaluations(data.evaluations || [])
      } catch (e) {
        if (!cancelled) setError(e.message || t('loadErrorGeneric'))
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/process-audits', { credentials: 'include' })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error((data && data.error) || t('loadErrorGeneric'))
        if (!cancelled) setProcessAudits(data.audits || [])
      } catch (e) {
        if (!cancelled) setProcessError(e.message || t('loadErrorGeneric'))
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [t])

  // Combinaciones reales area(+puesto) presentes en el historial -- para el selector de
  // Evolucion, nunca una lista inventada.
  const areaOptions = useMemo(() => {
    if (!evaluations) return []
    const ids = [...new Set(evaluations.map((e) => e.areaId))]
    return ids.map((id) => ({ id, name: workCenterById(id)?.name || id }))
  }, [evaluations])

  const stationOptionsForArea = useMemo(() => {
    if (!evaluations || !evoAreaId) return []
    return [
      ...new Set(
        evaluations
          .filter((e) => e.areaId === evoAreaId && e.stationName)
          .map((e) => e.stationName),
      ),
    ]
  }, [evaluations, evoAreaId])

  // Selecciona automaticamente la primera area real disponible (sin puesto, "toda el area") en
  // cuanto carga el historial -- nunca deja el selector vacio si hay datos reales que mostrar.
  useEffect(() => {
    if (areaOptions.length > 0 && !evoAreaId) setEvoAreaId(areaOptions[0].id)
  }, [areaOptions, evoAreaId])

  useEffect(() => {
    if (!evoAreaId) return
    let cancelled = false
    async function loadEvolution() {
      try {
        const params = new URLSearchParams({ areaId: evoAreaId })
        if (evoStationName) params.set('stationName', evoStationName)
        const res = await fetch(`/api/evaluaciones/evolution?${params.toString()}`, {
          credentials: 'include',
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error((data && data.error) || t('loadErrorGeneric'))
        if (!cancelled) setEvoMonths(data.months)
      } catch (e) {
        if (!cancelled) setEvoError(e.message || t('loadErrorGeneric'))
      }
    }
    loadEvolution()
    return () => {
      cancelled = true
    }
  }, [evoAreaId, evoStationName, t])

  async function openDetail(evaluation) {
    setDetailError('')
    try {
      const res = await fetch(`/api/evaluaciones/${evaluation.id}`, { credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error((data && data.error) || t('loadErrorGeneric'))

      let previousEvaluation = null
      if (evaluations) {
        const sameEntity = evaluations
          .filter((e) => e.areaId === evaluation.areaId && e.stationName === evaluation.stationName)
          .sort((a, b) => new Date(b.auditDate) - new Date(a.auditDate))
        const idx = sameEntity.findIndex((e) => e.id === evaluation.id)
        previousEvaluation = idx >= 0 ? sameEntity[idx + 1] || null : null
      }

      setDetail({
        evaluation: { ...data.evaluation, auditorName: evaluation.auditorName },
        previousEvaluation,
        answers: data.answers,
      })
    } catch (e) {
      setDetailError(e.message || t('loadErrorGeneric'))
    }
  }

  async function openProcesoDetail(audit) {
    setProcesoDetailError('')
    try {
      const res = await fetch(`/api/process-audits/${audit.id}`, { credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error((data && data.error) || t('loadErrorGeneric'))

      let previousAudit = null
      if (processAudits) {
        const sameEntity = processAudits
          .filter((a) => a.areaId === audit.areaId && a.stationName === audit.stationName)
          .sort((a, b) => new Date(b.auditDate) - new Date(a.auditDate))
        const idx = sameEntity.findIndex((a) => a.id === audit.id)
        previousAudit = idx >= 0 ? sameEntity[idx + 1] || null : null
      }

      setProcesoDetail({
        audit: { ...data.audit, auditorName: audit.auditorName },
        previousAudit,
      })
    } catch (e) {
      setProcesoDetailError(e.message || t('loadErrorGeneric'))
    }
  }

  return (
    <div className={pageClass}>
      <div className={cn(cardClass, 'mb-4')}>
        <div className="border-b border-border bg-black/[.015] px-5 py-3.5 dark:bg-white/[.02]">
          <p className={pageTitleClass}>{t('pageTitle')}</p>
          <p className={pageSubtitleClass}>{t('pageSubtitle')}</p>
        </div>
      </div>

      {error && <Alert className={cn(alertToneClass('error'), 'mb-4')}>{error}</Alert>}
      {detailError && <Alert className={cn(alertToneClass('error'), 'mb-4')}>{detailError}</Alert>}

      <div className={cn(cardClass, 'mb-4')}>
        <div className={cardHeaderClass}>
          <div className="min-w-0 flex-1">
            <p className={cardHeaderTitleClass}>{t('tableTitle')}</p>
            <p className={cardHeaderSubtitleClass}>{t('tableSubtitle')}</p>
          </div>
        </div>

        {evaluations === null && !error && (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {t('loadingMessage')}
          </p>
        )}

        {evaluations && evaluations.length === 0 && (
          <EmptyState title={t('emptyStateTitle')} description={t('emptyStateDescription')} />
        )}

        {evaluations && evaluations.length > 0 && (
          <div className="max-h-[75vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className={tableHeaderRowClass}>
                  <TableHead>{t('colDate')}</TableHead>
                  <TableHead>{t('colArea')}</TableHead>
                  <TableHead>{t('colStation')}</TableHead>
                  <TableHead>{t('colEmployee')}</TableHead>
                  <TableHead>{t('colAuditor')}</TableHead>
                  {CATEGORIES.map((s) => (
                    <TableHead key={s} className="text-center">
                      {s.toUpperCase()}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">{t('colScore')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluations.map((ev, idx) => (
                  <TableRow
                    key={ev.id}
                    className={cn(tableRowClass(idx), 'cursor-pointer')}
                    onClick={() => openDetail(ev)}
                  >
                    <TableCell className={cellTextSecondaryClass}>
                      {dayjs(ev.auditDate).format('DD/MM/YYYY')}
                    </TableCell>
                    <TableCell className={cn(cellTextClass, 'font-bold')}>
                      {workCenterById(ev.areaId)?.name || ev.areaId}
                    </TableCell>
                    <TableCell className={cellTextSecondaryClass}>
                      {ev.stationName || '—'}
                    </TableCell>
                    <TableCell className={cellTextSecondaryClass}>
                      {ev.employeeName ? `${ev.employeeNumber || '—'} · ${ev.employeeName}` : '—'}
                    </TableCell>
                    <TableCell className={cellTextSecondaryClass}>
                      {ev.auditorName || '—'}
                    </TableCell>
                    {CATEGORIES.map((s) => (
                      <TableCell key={s} className="text-center font-mono text-[12.5px] font-bold">
                        {ev[`${s}Score`]}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <span className={metricChipClass(scoreTone(ev.totalScore))}>
                        {ev.totalScore}/100
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {evaluations && evaluations.length > 0 && (
        <div className={cardClass}>
          <div className={cn(cardHeaderClass, 'flex-wrap gap-3')}>
            <div className="min-w-0 flex-1">
              <p className={cardHeaderTitleClass}>{t('evolutionTitle')}</p>
              <p className={cardHeaderSubtitleClass}>{t('evolutionSubtitle')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={evoAreaId}
                onValueChange={(v) => {
                  setEvoAreaId(v)
                  setEvoStationName('')
                }}
              >
                <SelectTrigger className="h-9 w-[200px]">
                  <SelectValue placeholder={t('evolutionAreaPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {areaOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {stationOptionsForArea.length > 0 && (
                <Select
                  value={evoStationName || '__ALL__'}
                  onValueChange={(v) => setEvoStationName(v === '__ALL__' ? '' : v)}
                >
                  <SelectTrigger className="h-9 w-[180px]">
                    <SelectValue placeholder={t('evolutionStationPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ALL__">{t('evolutionStationAllOption')}</SelectItem>
                    {stationOptionsForArea.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {evoError && <Alert className={cn(alertToneClass('error'), 'm-4')}>{evoError}</Alert>}

          {evoMonths && (
            <div className="overflow-x-auto p-4">
              <div className="grid min-w-[720px] grid-cols-12 gap-1.5">
                {evoMonths.map((score, idx) => (
                  <div
                    key={MONTH_KEYS[idx]}
                    className="flex flex-col items-center gap-1 rounded-xl border border-border p-2"
                  >
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">
                      {t(MONTH_KEYS[idx])}
                    </p>
                    <p
                      className={cn(
                        'text-[15px] font-extrabold',
                        score == null && 'text-muted-foreground/40',
                      )}
                    >
                      {score ?? '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className={cn(cardClass, 'mb-4')}>
        <div className={cardHeaderClass}>
          <div className="min-w-0 flex-1">
            <p className={cardHeaderTitleClass}>{t('procesoTableTitle')}</p>
            <p className={cardHeaderSubtitleClass}>{t('procesoTableSubtitle')}</p>
          </div>
        </div>

        {processError && (
          <Alert className={cn(alertToneClass('error'), 'm-4')}>{processError}</Alert>
        )}
        {procesoDetailError && (
          <Alert className={cn(alertToneClass('error'), 'm-4')}>{procesoDetailError}</Alert>
        )}

        {processAudits === null && !processError && (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {t('loadingMessage')}
          </p>
        )}

        {processAudits && processAudits.length === 0 && (
          <EmptyState
            title={t('procesoEmptyStateTitle')}
            description={t('procesoEmptyStateDescription')}
          />
        )}

        {processAudits && processAudits.length > 0 && (
          <div className="max-h-[75vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className={tableHeaderRowClass}>
                  <TableHead>{t('colDate')}</TableHead>
                  <TableHead>{t('colArea')}</TableHead>
                  <TableHead>{t('colStation')}</TableHead>
                  <TableHead>{t('colEmployee')}</TableHead>
                  <TableHead>{t('colAuditor')}</TableHead>
                  <TableHead className="text-right">{t('colScore')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processAudits.map((audit, idx) => (
                  <TableRow
                    key={audit.id}
                    className={cn(tableRowClass(idx), 'cursor-pointer')}
                    onClick={() => openProcesoDetail(audit)}
                  >
                    <TableCell className={cellTextSecondaryClass}>
                      {dayjs(audit.auditDate).format('DD/MM/YYYY')}
                    </TableCell>
                    <TableCell className={cn(cellTextClass, 'font-bold')}>
                      {workCenterById(audit.areaId)?.name || audit.areaId}
                    </TableCell>
                    <TableCell className={cellTextSecondaryClass}>
                      {audit.stationName || '—'}
                    </TableCell>
                    <TableCell className={cellTextSecondaryClass}>
                      {audit.employeeName
                        ? `${audit.employeeNumber || '—'} · ${audit.employeeName}`
                        : '—'}
                    </TableCell>
                    <TableCell className={cellTextSecondaryClass}>
                      {audit.auditorName || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={metricChipClass(scoreTone(audit.totalScore))}
                      >{`${audit.totalScore}%`}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {detail && (
        <FiveSResultDialog
          evaluation={detail.evaluation}
          previousEvaluation={detail.previousEvaluation}
          answers={detail.answers}
          onClose={() => setDetail(null)}
        />
      )}
      {procesoDetail && (
        <ProcesoResultDialog
          audit={procesoDetail.audit}
          previousAudit={procesoDetail.previousAudit}
          onClose={() => setProcesoDetail(null)}
        />
      )}
    </div>
  )
}
