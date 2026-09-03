import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Recycle,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  pageClass,
  pageSubtitleClass,
  pageTitleClass,
} from '@/lib/pageStyles'
import { cn } from '@/lib/utils'
import {
  ANSWER_POINTS,
  criteriaForCategory,
  FIVE_S_CATEGORIES,
  FIVE_S_CRITERIA,
  FIVE_S_META,
} from '../../data/audits5s/criteria'
import { formatEmployeeNumber } from '../../data/personnel/employeeDisplay'
import { getCurrentAssignment, searchEmployees } from '../../data/personnel/repository'
import { getWorkstationsForLine } from '../../data/personnel/workstations'
import {
  CURRENT_SHIFT,
  LINE_FAMILY_AREA_IDS,
  SHIFT_OPTIONS,
  WORK_CENTERS,
  workCenterById,
} from '../../data/production/catalog'
import EmployeeAvatar from '../centro-trabajo/EmployeeAvatar'
import FiveSResultDialog from './FiveSResultDialog'

/* ─────────────────────────────────────────────
   Modulo Auditoria (2026-09-01, a peticion explicita del usuario) --
   antes era una pagina "Proximamente" (ComingSoonPage). Primera version:
   solo la interfaz/flujo visual, SIN persistir nada en base de datos
   todavia (confirmado explicitamente por el usuario via pregunta directa
   -- "interfaz primero, sin guardar datos", se agrega guardado real
   despues). 3 tarjetas de entrada, cada una con su dia programado real
   (martes=5S, miercoles=Auditoria, jueves=Seguridad, a peticion
   explicita). Solo "5S Proceso" tiene flujo detallado (el usuario
   describio S1..S5 explicitamente); "Auditoria" y "Seguridad" abren un
   dialogo "Proximamente" -- nunca se inventa contenido no descrito. */

const MODULES = [
  { key: 'AUDITORIA', Icon: ClipboardCheck, color: '#2563EB' },
  { key: 'PROCESO_5S', Icon: Recycle, color: '#10B981' },
  { key: 'SEGURIDAD', Icon: ShieldCheck, color: '#EF4444' },
]

const MODULE_I18N = {
  AUDITORIA: {
    titleKey: 'auditoriaCardTitle',
    descKey: 'auditoriaCardDescription',
    dayKey: 'auditoriaCardDay',
  },
  PROCESO_5S: {
    titleKey: 'process5sCardTitle',
    descKey: 'process5sCardDescription',
    dayKey: 'process5sCardDay',
  },
  SEGURIDAD: {
    titleKey: 'seguridadCardTitle',
    descKey: 'seguridadCardDescription',
    dayKey: 'seguridadCardDay',
  },
}

/* 2026-09-02 (a peticion explicita del usuario, "las auditorias son por
   areas de trabajo GLOBAL... lineas de produccion, insumos, accesorios,
   midea y paletizado"): antes el selector de "Centro de trabajo" listaba
   TODO WORK_CENTERS (cada linea individual LINEA1..10/PROYECTO, mas
   areas administrativas como Team Leader/Supervisor/Capacitacion) --
   ahora son exactamente estos 5 grupos, los mismos que se ven como cards
   en "Areas de trabajo". "Lineas de produccion" es especial: agrupa las
   11 lineas reales (LINE_FAMILY_AREA_IDS) y pide elegir CUAL linea en un
   segundo select antes de llegar a Puesto de trabajo -- las otras 4 ya
   son una sola area real, sin ese paso extra. */
const AUDIT_AREA_GROUPS = [
  { key: 'LINEAS', labelKey: 'auditAreaLines' },
  { key: 'INSUMOS', labelKey: 'auditAreaInsumos', areaId: 'INSUMOS' },
  { key: 'ACCESORIOS', labelKey: 'auditAreaAccesorios', areaId: 'ACCESORIOS' },
  { key: 'MIDEA', labelKey: 'auditAreaMidea', areaId: 'HIGH_VALUE' },
  { key: 'PALETIZADO', labelKey: 'auditAreaPaletizado', areaId: 'PALETIZADO' },
]

function groupKeyForAreaId(areaId) {
  if (LINE_FAMILY_AREA_IDS.has(areaId)) return 'LINEAS'
  return AUDIT_AREA_GROUPS.find((g) => g.areaId === areaId)?.key || null
}

export default function AuditoriaPage() {
  const { t } = useTranslation('auditoria')
  const [openModule, setOpenModule] = useState(null)
  // Resultado (2026-09-03, a peticion explicita del usuario -- "NO mostrar simplemente 'Auditoria
  // guardada correctamente', quiero que se abra inmediatamente una pantalla grande de
  // RESULTADO"): vive AQUI (no dentro de FiveSDialog) para que se muestre despues de que
  // FiveSDialog ya se cerro -- 2 dialogs abiertos a la vez se ve mal y complica el foco/escape.
  const [fiveSResult, setFiveSResult] = useState(null)

  function handleFiveSFinished(payload) {
    setOpenModule(null)
    setFiveSResult(payload)
  }

  return (
    <div className={pageClass}>
      <div className={cn(cardClass, 'mb-4')}>
        <div className="border-b border-border bg-black/[.015] px-5 py-3.5 dark:bg-white/[.02]">
          <p className={pageTitleClass}>{t('pageTitle')}</p>
          <p className={pageSubtitleClass}>{t('pageSubtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <AuditModuleCard key={m.key} module={m} onOpen={() => setOpenModule(m.key)} />
        ))}
      </div>

      {openModule === 'PROCESO_5S' && (
        <FiveSDialog onClose={() => setOpenModule(null)} onFinished={handleFiveSFinished} />
      )}
      {(openModule === 'AUDITORIA' || openModule === 'SEGURIDAD') && (
        <ComingSoonDialog
          title={t(MODULE_I18N[openModule].titleKey)}
          onClose={() => setOpenModule(null)}
        />
      )}

      {fiveSResult && (
        <FiveSResultDialog
          evaluation={fiveSResult.evaluation}
          previousEvaluation={fiveSResult.previousEvaluation}
          answers={fiveSResult.answers}
          onClose={() => setFiveSResult(null)}
        />
      )}
    </div>
  )
}

function AuditModuleCard({ module, onOpen }) {
  const { t } = useTranslation('auditoria')
  const { Icon, color } = module
  const { titleKey, descKey, dayKey } = MODULE_I18N[module.key]
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        cardClass,
        'flex cursor-pointer select-none flex-col gap-3 p-5 text-left transition-transform duration-150 hover:-translate-y-0.5',
      )}
    >
      <div
        className="grid h-11 w-11 place-items-center rounded-2xl"
        style={{ backgroundColor: `${color}1F` }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div>
        <p className="text-[16px] font-extrabold">{t(titleKey)}</p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">{t(descKey)}</p>
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[11.5px] font-bold text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        {t('scheduledDayLabel')}: {t(dayKey)}
      </div>
    </button>
  )
}

function ComingSoonDialog({ title, onClose }) {
  const { t } = useTranslation('auditoria')
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogClose asChild>
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </DialogClose>
        </DialogHeader>
        <div className="flex flex-col items-center gap-2 px-6 pb-6 text-center">
          <p className="text-[13.5px] font-bold text-muted-foreground">{t('comingSoonTitle')}</p>
          <p className="text-[12.5px] text-muted-foreground">{t('comingSoonDescription')}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* Flujo "5S Proceso" -- rediseño completo (2026-09-03, a peticion explicita del usuario:
   "conviertelo en un sistema completo de evaluacion 5S", metodologia de "Presentacion 5S's.ppt").
   La intro (buscar persona / elegir area y puesto / Comenzar auditoria) se CONSERVA tal cual --
   solo se le agregan 2 campos reales que el usuario confirmo reintroducir explicitamente (ver
   pregunta directa 2026-09-03, revierte la simplificacion "area-only" del 2026-09-02): Puesto
   real (Workstation.name del catalogo de esa area/linea, ver src/data/personnel/workstations.js
   -- opcional, solo aparece si la area tiene puestos reales) y Turno (SHIFT_OPTIONS). Elegir un
   empleado por busqueda AHORA SI lo guarda, y ademas autocompleta puesto/turno desde su
   asignacion real de hoy (getCurrentAssignment) -- "utiliza automaticamente la informacion
   disponible", nunca inventa un dato que no tiene.

   step=0..4 recorre S1..S5 en orden fijo, un criterio-por-card (ver
   src/data/audits5s/criteria.js, 8 criterios reales por S) -- nunca una tabla de 40 preguntas de
   golpe. "Siguiente" se deshabilita mientras falte responder algun criterio de la S actual
   (mensaje "Faltan N criterios por evaluar"); "Anterior" nunca pierde respuestas (viven en el
   estado del dialogo completo, no por paso). Al terminar S5: POST a /api/evaluaciones con las 40
   respuestas reales -- el servidor calcula TODO (puntaje 0-20 normalizado por S + total/100,
   nunca un numero que mande el cliente) -- luego se busca la auditoria anterior real de la misma
   area+puesto para la comparacion, y se entrega todo a onFinished() para que AuditoriaPage abra
   FiveSResultDialog. Si el POST falla se queda en el mismo paso con el error visible, nunca se
   cierra ni se resetea, para no perder el checklist ya lleno. */
function FiveSDialog({ onClose, onFinished }) {
  const { t } = useTranslation('auditoria')
  const [step, setStep] = useState(null)
  const [answers, setAnswers] = useState({})
  // selectedGroupKey/selectedLineId son SOLO de flujo de UI (ver
  // AUDIT_AREA_GROUPS arriba) -- selectedAreaId sigue siendo la unica
  // fuente real que se guarda.
  const [selectedGroupKey, setSelectedGroupKey] = useState('')
  const [selectedLineId, setSelectedLineId] = useState('')
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [selectedStationName, setSelectedStationName] = useState('')
  const [selectedShift, setSelectedShift] = useState(CURRENT_SHIFT)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  // Buscar por numero de empleado o nombre -- atajo real: resuelve area/puesto/turno/empleado de
  // un solo golpe (reutiliza searchEmployees + getCurrentAssignment, mismo buscador de nombre/
  // numero que ya usa EmployeeAssignSearchBar).
  const [personSearch, setPersonSearch] = useState('')
  const [personSearchError, setPersonSearchError] = useState('')

  const isIntro = step === null
  const stepIndex = typeof step === 'number' ? step : 0
  const stepKey = FIVE_S_CATEGORIES[stepIndex]
  const stepCriteria = criteriaForCategory(stepKey)
  const pendingCount = stepCriteria.filter((c) => !answers[c.id]?.answer).length

  const selectedArea = selectedAreaId ? workCenterById(selectedAreaId) : null
  const canStartAudit = Boolean(selectedArea)
  const stationOptions = selectedAreaId
    ? [...new Set(getWorkstationsForLine(selectedAreaId).map((w) => w.name))]
    : []

  function handleGroupChange(groupKey) {
    setSelectedGroupKey(groupKey)
    setSelectedLineId('')
    setSelectedStationName('')
    const group = AUDIT_AREA_GROUPS.find((g) => g.key === groupKey)
    setSelectedAreaId(group?.areaId || '') // vacio para 'LINEAS' -- falta elegir la linea real
  }

  function handleLineChange(lineId) {
    setSelectedLineId(lineId)
    setSelectedStationName('')
    setSelectedAreaId(lineId)
  }

  const personSearchResults = personSearch.trim() ? searchEmployees(personSearch, 8) : []

  function handlePickFromSearch(employee) {
    const assignment = getCurrentAssignment(employee.id)
    if (!assignment) {
      setPersonSearchError(t('personSearchNoAssignmentError', { name: employee.name }))
      return
    }
    setPersonSearchError('')
    const groupKey = groupKeyForAreaId(assignment.areaId)
    setSelectedGroupKey(groupKey || '')
    setSelectedLineId(groupKey === 'LINEAS' ? assignment.areaId : '')
    setPersonSearch('')
    setSelectedAreaId(assignment.areaId)
    setSelectedStationName(assignment.stationId || '')
    setSelectedShift(assignment.shift || CURRENT_SHIFT)
    setSelectedEmployee(employee)
  }

  function handleAnswerChange(criterionId, answer) {
    setAnswers((prev) => ({ ...prev, [criterionId]: { ...prev[criterionId], answer } }))
  }

  function handleObservationChange(criterionId, observation) {
    setAnswers((prev) => ({ ...prev, [criterionId]: { ...prev[criterionId], observation } }))
  }

  async function handleNext() {
    if (submitting) return
    if (pendingCount > 0) return
    if (stepIndex < FIVE_S_CATEGORIES.length - 1) {
      setStep(stepIndex + 1)
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      const answersPayload = FIVE_S_CRITERIA.map((c) => ({
        criterionId: c.id,
        answer: answers[c.id]?.answer,
        observation: answers[c.id]?.observation || undefined,
      }))
      const res = await fetch('/api/evaluaciones', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          areaId: selectedArea.id,
          stationName: selectedStationName || null,
          employeeId: selectedEmployee?.id || null,
          shift: selectedShift || null,
          answers: answersPayload,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || t('saveErrorGeneric'))

      // Auditoria anterior real de la MISMA area+puesto -- nunca mezcla entidades distintas
      // (ver comentario grande en api/evaluaciones/evolution.js). Comparacion opcional: si esta
      // consulta falla, el resultado se muestra igual, solo sin la fila de variacion.
      let previousEvaluation = null
      try {
        const histParams = new URLSearchParams({ areaId: selectedArea.id })
        if (selectedStationName) histParams.set('stationName', selectedStationName)
        const histRes = await fetch(`/api/evaluaciones?${histParams.toString()}`, {
          credentials: 'include',
        })
        const histData = await histRes.json().catch(() => null)
        const list = histData?.evaluations || []
        previousEvaluation = list.find((e) => e.id !== data.evaluation.id) || null
      } catch {
        previousEvaluation = null
      }

      const answersForResult = FIVE_S_CRITERIA.map((c) => {
        const a = answers[c.id]
        return {
          category: c.category,
          criterionId: c.id,
          answer: a.answer,
          score: ANSWER_POINTS[a.answer] * c.weight,
          observation: a.observation || null,
        }
      })
      onFinished({ evaluation: data.evaluation, previousEvaluation, answers: answersForResult })
      handleClose()
    } catch (e) {
      setSubmitError(e.message || t('saveErrorGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    setStep(null)
    setAnswers({})
    setSelectedGroupKey('')
    setSelectedLineId('')
    setSelectedAreaId('')
    setSelectedStationName('')
    setSelectedShift(CURRENT_SHIFT)
    setSelectedEmployee(null)
    setSubmitError('')
    setPersonSearch('')
    setPersonSearchError('')
    onClose()
  }

  const meta = FIVE_S_META[stepKey]

  return (
    <Dialog open onOpenChange={(next) => !next && handleClose()}>
      <DialogContent
        className={
          isIntro ? 'max-w-[560px]' : 'flex max-h-[88vh] max-w-[760px] flex-col overflow-y-auto'
        }
      >
        <DialogHeader>
          <DialogTitle>{isIntro ? t('start5sIntroTitle') : t('auditInProgressTitle')}</DialogTitle>
          <DialogClose asChild>
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </DialogClose>
        </DialogHeader>

        {isIntro && (
          <div className="flex flex-col gap-4 px-6 pb-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <Recycle className="h-10 w-10 text-[#10B981]" />
              <p className="text-[13.5px] font-bold text-muted-foreground">
                {t('start5sIntroDescription')}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fives-person-search">{t('personSearchLabel')}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-[16px] w-[16px] -translate-y-1/2 text-muted-foreground opacity-50" />
                <Input
                  id="fives-person-search"
                  value={personSearch}
                  onChange={(e) => {
                    setPersonSearch(e.target.value)
                    setPersonSearchError('')
                  }}
                  placeholder={t('personSearchPlaceholder')}
                  className="pl-9"
                />
                {personSearchResults.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-[240px] w-full overflow-y-auto rounded-[16px] border border-border bg-card shadow-lg">
                    {personSearchResults.map((employee) => (
                      <button
                        key={employee.id}
                        type="button"
                        onClick={() => handlePickFromSearch(employee)}
                        className="flex w-full items-center gap-3 border-b border-border p-2.5 text-left last:border-b-0 hover:bg-accent"
                      >
                        <EmployeeAvatar employee={employee} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-bold">{employee.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatEmployeeNumber(employee.employeeNumber)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {personSearchError && (
                <Alert className={cn(alertToneClass('warning'), 'mt-1')}>{personSearchError}</Alert>
              )}
              {selectedEmployee && (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-black/[.02] px-2.5 py-1.5 dark:bg-white/[.03]">
                  <EmployeeAvatar employee={selectedEmployee} size={24} />
                  <p className="min-w-0 flex-1 truncate text-[12px] font-bold">
                    {formatEmployeeNumber(selectedEmployee.employeeNumber)} ·{' '}
                    {selectedEmployee.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedEmployee(null)}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              {t('personSearchOrDivider')}
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fives-area">{t('workCenterLabel')}</Label>
              <Select value={selectedGroupKey} onValueChange={handleGroupChange}>
                <SelectTrigger id="fives-area">
                  <SelectValue placeholder={t('workCenterPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {AUDIT_AREA_GROUPS.map((g) => (
                    <SelectItem key={g.key} value={g.key}>
                      {t(g.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedGroupKey === 'LINEAS' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fives-line">{t('lineLabel')}</Label>
                <Select value={selectedLineId} onValueChange={handleLineChange}>
                  <SelectTrigger id="fives-line">
                    <SelectValue placeholder={t('linePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_CENTERS.filter((w) => LINE_FAMILY_AREA_IDS.has(w.id)).map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {workCenterById(w.id)?.name || w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {stationOptions.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fives-station">{t('stationLabel')}</Label>
                <Select
                  value={selectedStationName || '__NONE__'}
                  onValueChange={(v) => setSelectedStationName(v === '__NONE__' ? '' : v)}
                >
                  <SelectTrigger id="fives-station">
                    <SelectValue placeholder={t('stationPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">{t('stationNoneOption')}</SelectItem>
                    {stationOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fives-shift">{t('shiftLabel')}</Label>
              <Select value={selectedShift} onValueChange={setSelectedShift}>
                <SelectTrigger id="fives-shift">
                  <SelectValue placeholder={t('shiftPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {SHIFT_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={() => setStep(0)} disabled={!canStartAudit} className="font-bold">
              {t('startAuditButton')}
            </Button>
          </div>
        )}

        {!isIntro && (
          <div className="flex min-h-0 flex-1 flex-col px-6 pb-2">
            <FiveSProgressSteps currentIndex={stepIndex} />

            <div
              className="mb-4 mt-4 rounded-[20px] border px-6 py-5"
              style={{ borderColor: `${meta.color}33`, backgroundColor: `${meta.color}0d` }}
            >
              <p
                className="text-[11px] font-extrabold uppercase tracking-[0.6px]"
                style={{ color: meta.color }}
              >
                {stepKey.toUpperCase()}
              </p>
              <p className="text-[16px] font-extrabold">{t(meta.titleKey)}</p>
              <p className="mt-1 text-[13px] italic text-muted-foreground">
                "{t(meta.conceptKey)}"
              </p>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pb-2 pr-1">
              {stepCriteria.map((criterion) => (
                <CriterionCard
                  key={criterion.id}
                  criterion={criterion}
                  value={answers[criterion.id]}
                  onAnswer={(a) => handleAnswerChange(criterion.id, a)}
                  onObservation={(o) => handleObservationChange(criterion.id, o)}
                  t={t}
                />
              ))}
            </div>

            {pendingCount > 0 && (
              <Alert className={cn(alertToneClass('warning'), 'mt-3')}>
                {t('pendingCriteriaMessage', { count: pendingCount })}
              </Alert>
            )}
            {submitError && (
              <Alert className={cn(alertToneClass('error'), 'mt-3')}>{submitError}</Alert>
            )}

            <div className="flex justify-between gap-2 py-4">
              {stepIndex > 0 ? (
                <Button
                  variant="ghost"
                  onClick={() => setStep(stepIndex - 1)}
                  disabled={submitting}
                  className="font-bold"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('previousButton')}
                </Button>
              ) : (
                <div />
              )}
              <Button
                onClick={handleNext}
                disabled={submitting || pendingCount > 0}
                className="font-bold"
              >
                {stepIndex >= FIVE_S_CATEGORIES.length - 1
                  ? submitting
                    ? t('savingButton')
                    : t('finishButton')
                  : t('nextButton')}
                {stepIndex < FIVE_S_CATEGORIES.length - 1 && <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Progreso "1S ━━━ 2S ━━━ 3S ━━━ 4S ━━━ 5S" (2026-09-03, a peticion explicita del usuario) --
// completadas y la actual usan el color real de esa S (FIVE_S_META), las futuras quedan neutras.
function FiveSProgressSteps({ currentIndex }) {
  return (
    <div className="flex items-center">
      {FIVE_S_CATEGORIES.map((cat, idx) => {
        const meta = FIVE_S_META[cat]
        const active = idx <= currentIndex
        return (
          <div key={cat} className="flex flex-1 items-center last:flex-none">
            <div
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10.5px] font-extrabold text-white"
              style={{
                backgroundColor: active ? meta.color : 'hsl(var(--muted-foreground) / 0.3)',
              }}
            >
              {cat.toUpperCase()}
            </div>
            {idx < FIVE_S_CATEGORIES.length - 1 && (
              <div
                className="mx-1.5 h-[3px] flex-1 rounded-full"
                style={{
                  backgroundColor:
                    idx < currentIndex ? meta.color : 'hsl(var(--muted-foreground) / 0.2)',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// Card de un criterio individual -- 3 opciones (Cumple/Parcial/No cumple, mismo lenguaje visual
// de pildoras ya usado en el resto del proyecto) + observacion opcional (hallazgos, 2026-09-03 a
// peticion explicita del usuario: "durante la auditoria quiero poder registrar observaciones/
// hallazgos/comentarios cuando aplique" -- queda asociada a esta auditoria+S+criterio real via
// FiveSAuditAnswer.observation).
const ANSWER_TONE = {
  CUMPLE: { border: 'border-[#10B981]', bg: 'bg-[#10B981]/[0.12]', text: 'text-[#10B981]' },
  CUMPLE_PARCIAL: { border: 'border-[#F59E0B]', bg: 'bg-[#F59E0B]/[0.12]', text: 'text-[#F59E0B]' },
  NO_CUMPLE: { border: 'border-[#EF4444]', bg: 'bg-[#EF4444]/[0.12]', text: 'text-[#EF4444]' },
}
function CriterionCard({ criterion, value, onAnswer, onObservation, t }) {
  return (
    <div className="rounded-2xl border border-border p-3.5">
      <p className="text-[13px] font-bold">{t(criterion.titleKey)}</p>
      <p className="mt-0.5 text-[12px] text-muted-foreground">{t(criterion.questionKey)}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {['CUMPLE', 'CUMPLE_PARCIAL', 'NO_CUMPLE'].map((option) => {
          const tone = ANSWER_TONE[option]
          const selected = value?.answer === option
          return (
            <button
              key={option}
              type="button"
              onClick={() => onAnswer(option)}
              className={cn(
                'rounded-full border px-3 py-1 text-[11.5px] font-bold transition-colors duration-150',
                selected
                  ? cn(tone.border, tone.bg, tone.text)
                  : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              {t(`answer.${option}`)}
            </button>
          )
        })}
      </div>
      <Input
        value={value?.observation || ''}
        onChange={(e) => onObservation(e.target.value)}
        placeholder={t('observationPlaceholder')}
        className="mt-2 h-8 text-[12px]"
      />
    </div>
  )
}
