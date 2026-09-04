import dayjs from 'dayjs'
import {
  ArrowLeft,
  GripVertical,
  Hand,
  Lightbulb,
  LineChart,
  Search,
  Star,
  Sun,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip } from 'recharts'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cardClass, metricChipClass, progressBarClass } from '@/lib/pageStyles'
import { cn, hexToRgba } from '@/lib/utils'
import { getCurrentAssignment, reconcileLineAssignments } from '../../data/personnel/repository'
import { usePersonnelVersion } from '../../data/personnel/usePersonnelVersion'
import { hasMultipleStations } from '../../data/personnel/workstations'
import {
  canonicalOperationalAreaId,
  formatShiftSchedule,
  getCurrentShift,
  operationalGroupMembers,
  workCenterById,
} from '../../data/production/catalog'
import {
  classifyAreaStatus,
  getActividadForEmployee,
  getAreaStatusMeta,
  getAvailablePersonnelToday,
  getGroupAreaStaffing,
  getGroupPeople,
} from '../../data/production/personnelByArea'
import { useDndAssign } from '../../state/dndAssign'
import { useRoleMode } from '../../state/roleMode'
import { EmptyState } from '../../ui'
import DraggablePersonChip from '../../ui/DraggablePersonChip'
import { useEmployeeDropTarget } from '../../ui/dnd'
import AssignedPersonChip from './AssignedPersonChip'
import EmployeeAvatar from './EmployeeAvatar'
import RegisterPersonnelDialog from './RegisterPersonnelDialog'
import SelfAssignDialog from './SelfAssignDialog'
import WorkCenterNavControls from './WorkCenterNavControls'

/* ─────────────────────────────────────────────
   Vista operativa de detalle para AREAS PRODUCTIVAS (2026-08-25,
   contrato visual exacto del mockup "CT Accesorios" aprobado por el
   usuario). Reemplaza la vista simple (personal asignado + soltar +
   disponibles) SOLO para las areas de catalog.js/usesOperationalDetail
   -- CT LINEA y las areas de apoyo/ingenieria (Capacitacion, Team
   Leader, Soporte, Limpieza, Gerente, Supervisor) siguen usando
   LineDetailDrawer.jsx tal cual, sin cambios (ver AreaDetail.jsx, el
   wrapper que decide cual de los dos se monta).

   Un solo componente reutilizable para TODAS las areas operativas
   (Accesorios, Paletizado, Midea/High Value, Box Prep, Insumos,
   Suministro de material, Conveyor Principal/Secundario, Calidad) --
   recibe unicamente `workCenterId` y calcula todo lo demas desde las
   mismas fuentes reales que ya usa el resto del sistema. Nunca una
   copia de real/ideal/faltante/cobertura: todo sale de
   getAreaStaffing/getPeopleByArea (personnelByArea.js), igual que el
   plano 2D y "Resumen por área".

   Fase 6c (Centro de Trabajo): portado de MUI a Tailwind. El "gauge"
   circular de cobertura (antes ps.gauge(pct,color), unico consumidor
   en todo el repo) se reescribe con 2 capas Tailwind + conic-gradient
   inline (pct/color son valores en tiempo de ejecucion): un aro base
   bg-muted, un conic-gradient superpuesto para el progreso, y un
   circulo interior bg-background para el "agujero" -- evita tener que
   replicar a mano el chequeo de modo claro/oscuro que hacia el original
   via theme.palette.mode, ya que bg-muted/bg-background resuelven solo
   por los tokens CSS compartidos. */

const PIE_PALETTE = ['#3B82F6', '#10B981', '#A855F7', '#F59E0B', '#06B6D4', '#EC4899', '#64748B']

function relativeTimeEs(iso, t) {
  const diffMin = Math.max(0, dayjs().diff(dayjs(iso), 'minute'))
  if (diffMin < 1) return t('operationalAreaDetail.relativeJustNow')
  if (diffMin < 60) return t('operationalAreaDetail.relativeMinutesAgo', { count: diffMin })
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return t('operationalAreaDetail.relativeHoursAgo', { count: diffH })
  const diffD = Math.floor(diffH / 24)
  return t('operationalAreaDetail.relativeDaysAgo', { count: diffD })
}

/* Fila de historial reutilizada tal cual entre la vista compacta (5
   eventos) y el dialogo "Ver todo" (los mismos datos ya obtenidos por
   el unico fetch de arriba -- limit=8 -- nunca una segunda consulta). */
function HistoryRow({ h }) {
  const { t } = useTranslation('centroTrabajo')
  return (
    <div className="flex items-start gap-2">
      <div
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full"
        style={{ backgroundColor: hexToRgba('#10B981', 0.14), color: '#10B981' }}
      >
        <UserPlus className="h-[13px] w-[13px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold leading-[1.3]">
          {t('operationalAreaDetail.historyEntryLabel', {
            employeeName: h.employeeName,
            action:
              h.action === 'MOVED'
                ? t('operationalAreaDetail.actionReassigned')
                : t('operationalAreaDetail.actionAssigned'),
          })}
        </p>
        <p className="text-[10.5px] text-muted-foreground">
          {h.byName ? t('operationalAreaDetail.byPrefix', { byName: h.byName }) : ''}
          {relativeTimeEs(h.movedAt, t)}
        </p>
      </div>
    </div>
  )
}

function MetricBlock({ label, children, borderLeft }) {
  return (
    <div
      className={cn(
        'min-w-[130px] flex-1 px-3 py-2 md:px-[18px]',
        borderLeft && 'border-t border-border md:border-l md:border-t-0',
      )}
    >
      <p className="mb-1 text-[10.5px] font-extrabold uppercase tracking-[0.5px] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  )
}

function DropZone({ areaId, label }) {
  const { t } = useTranslation('centroTrabajo')
  const { isOver, dropProps } = useEmployeeDropTarget(areaId)
  return (
    <div
      {...dropProps}
      className={cn(
        'flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 transition-all duration-150',
        isOver
          ? 'border-[#3B82F6] bg-[#3B82F6]/[0.08] dark:bg-[#3B82F6]/[0.16]'
          : 'border-[#3B82F6]/40 bg-[#3B82F6]/[0.02] dark:bg-[#3B82F6]/[0.04]',
      )}
    >
      <Hand className="h-[30px] w-[30px] text-[#3B82F6]" />
      <p className="text-center text-[13.5px] font-extrabold text-[#3B82F6]">
        {isOver
          ? t('operationalAreaDetail.dropHereLabel')
          : t('operationalAreaDetail.dragEmployeesHereLabel')}
      </p>
      <p className="text-center text-[11.5px] text-muted-foreground">
        {t('operationalAreaDetail.dropZoneHint', { label })}
      </p>
    </div>
  )
}

function AvailableCandidateRow({ person, areaId }) {
  const dnd = useDndAssign()
  return (
    <DraggablePersonChip employeeId={person.id} className="block">
      <button
        type="button"
        onClick={() => dnd.requestAssign(person.id, areaId)}
        className="flex w-full items-center gap-2 rounded-lg border border-border p-[7.2px] text-left hover:border-[#3B82F6] hover:bg-[#3B82F6]/5 dark:hover:bg-[#3B82F6]/10"
      >
        <EmployeeAvatar employee={person} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-bold">{person.name}</p>
          <p className="truncate text-[10.5px] text-muted-foreground">#{person.employeeNumber}</p>
        </div>
        <GripVertical className="h-[17px] w-[17px] shrink-0 text-muted-foreground/50" />
      </button>
    </DraggablePersonChip>
  )
}

/* Distribucion por tipo de puesto -- unica fuente REAL disponible hoy es
   `actividad` (columna cruda del Excel de origen, ver personnelByArea.js/
   getActividadForEmployee): SEED_SKILLS esta vacio (skills.js, "las
   habilidades reales... vendran de la importacion en Etapa 2", todavia
   no paso), asi que no existe ningun otro dato real de rol/puesto por
   empleado. Los codigos se muestran TAL CUAL (sin traducir a "Operador/
   Técnico/..." -- esa traduccion no esta documentada en ningun lado, un
   nombre inventado seria tan falso como los del mockup). Si menos de 2
   personas tienen actividad registrada, no hay nada que distribuir --
   se oculta la dona en vez de forzar un grafico vacio o absurdo (Parte
   "Variantes" del prompt: Conveyor con 1 persona no debe verse forzado). */
function RoleDistributionCard({ people }) {
  const { t } = useTranslation('centroTrabajo')
  const counts = new Map()
  let withData = 0
  people.forEach((p) => {
    const codigo = getActividadForEmployee(p.id)
    if (!codigo) return
    withData += 1
    counts.set(codigo, (counts.get(codigo) || 0) + 1)
  })

  if (withData < 2 || counts.size < 2) {
    return (
      <div className={cn(cardClass, 'p-4')}>
        <p className="mb-3 text-[14.5px] font-extrabold">
          {t('operationalAreaDetail.roleDistributionTitle')}
        </p>
        <EmptyState
          compact
          title={t('operationalAreaDetail.emptyRoleDataTitle')}
          description={t('operationalAreaDetail.emptyRoleDataDescription')}
        />
      </div>
    )
  }

  const data = [...counts.entries()].map(([codigo, value], i) => ({
    codigo,
    value,
    color: PIE_PALETTE[i % PIE_PALETTE.length],
  }))

  return (
    <div className={cn(cardClass, 'p-4')}>
      <p className="text-[14.5px] font-extrabold">
        {t('operationalAreaDetail.roleDistributionTitle')}
      </p>
      <p className="mb-2 text-[10.5px] text-muted-foreground">
        {t('operationalAreaDetail.roleDistributionSubtitle')}
      </p>
      <div className="flex min-h-[160px] gap-4">
        <div className="relative flex-[0_0_140px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="codigo"
                innerRadius="60%"
                outerRadius="92%"
                paddingAngle={1.5}
                stroke="none"
              >
                {data.map((row) => (
                  <Cell key={row.codigo} fill={row.color} />
                ))}
              </Pie>
              <RTooltip
                formatter={(v, n) => [t('operationalAreaDetail.personCountLabel', { count: v }), n]}
                contentStyle={{
                  borderRadius: 12,
                  fontSize: 12,
                  background: 'hsl(var(--popover))',
                  color: 'hsl(var(--popover-foreground))',
                  border: '1px solid hsl(var(--border))',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <p className="text-xl font-extrabold leading-none">{withData}</p>
            <p className="text-[9px] text-muted-foreground">
              {t('operationalAreaDetail.peopleUnitLabel')}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          {data.map((row) => (
            <div key={row.codigo} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <p className="flex-1 text-xs font-bold">{row.codigo}</p>
              <p className="text-[11.5px] text-muted-foreground">
                {row.value} ({((row.value / withData) * 100).toFixed(0)}%)
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* Clasificacion + recomendacion -- reglas matematicas simples sobre
   real/ideal, nunca texto de IA. */
function classifyForTip(real, ideal, t) {
  if (ideal == null)
    return {
      icon: '⭐',
      label: t('operationalAreaDetail.tipNoTemplateLabel'),
      tip: t('operationalAreaDetail.tipNoTemplate'),
    }
  if (real === 0)
    return {
      icon: '⚠️',
      label: t('operationalAreaDetail.tipNoStaffLabel'),
      tip: t('operationalAreaDetail.tipNoStaff'),
    }
  if (real > ideal)
    return {
      icon: '⭐',
      label: t('operationalAreaDetail.tipOverTemplateLabel'),
      tip: t('operationalAreaDetail.tipOverTemplate', { count: real - ideal }),
    }
  if (real === ideal)
    return {
      icon: '⭐',
      label: t('operationalAreaDetail.tipCompleteLabel'),
      tip: t('operationalAreaDetail.tipComplete'),
    }
  const pct = (real / ideal) * 100
  if (pct < 50)
    return {
      icon: '🔴',
      label: t('operationalAreaDetail.tipCriticalLabel'),
      tip: t('operationalAreaDetail.tipCritical', { count: ideal - real }),
    }
  if (pct < 90)
    return {
      icon: '⭐',
      label: t('operationalAreaDetail.tipDevelopingLabel'),
      tip: t('operationalAreaDetail.tipDeveloping', { count: ideal - real }),
    }
  return {
    icon: '⭐',
    label: t('operationalAreaDetail.tipNearCompleteLabel'),
    tip: t('operationalAreaDetail.tipNearComplete', { count: ideal - real }),
  }
}

export default function OperationalAreaDetail({
  workCenterId,
  open,
  onClose,
  previous,
  next,
  onNavigate,
}) {
  const { t } = useTranslation('centroTrabajo')
  const version = usePersonnelVersion()
  const { isSupervisor } = useRoleMode()
  const [registerOpen, setRegisterOpen] = useState(false)
  const [selfAssignOpen, setSelfAssignOpen] = useState(false)
  const availableRef = useRef(null)
  const [highlightAvailable, setHighlightAvailable] = useState(false)
  const [availableQuery, setAvailableQuery] = useState('')
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)

  const [history, setHistory] = useState({ loading: true, error: null, items: [] })

  /* Reinicio de estado transitorio al cambiar de Work Center (Anterior/
     Siguiente, 2026-08-27) -- el Dialog ya no se desmonta entre areas.
     `history` no hace falta reiniciarlo aqui: su propio useEffect de
     abajo ya depende de [workCenterId, ...] y lo vuelve a cargar solo. */
  // biome-ignore lint/correctness/useExhaustiveDependencies: ver comentario arriba
  useEffect(() => {
    setRegisterOpen(false)
    setSelfAssignOpen(false)
    setHighlightAvailable(false)
    setAvailableQuery('')
    setHistoryDialogOpen(false)
  }, [workCenterId])

  // Id canonico (2026-08-25, ver catalog.js/AREA_DETAIL_GROUPS): CT Sellado
  // no tiene detalle propio, "va junto con Conveyor Principal" a peticion
  // explicita del usuario -- si workCenterId es SELLADO, esto resuelve a
  // CONVEYOR_PRINCIPAL para titulo/asignaciones nuevas, y memberIds suma el
  // personal/plantilla de AMBAS areas reales en el mismo detalle. Para
  // cualquier area que no pertenezca a ningun grupo, canonicalId === workCenterId
  // y memberIds === [workCenterId] (sin cambio de comportamiento).
  const canonicalId = workCenterId ? canonicalOperationalAreaId(workCenterId) : null
  const memberIds = workCenterId ? operationalGroupMembers(workCenterId) : []

  const area = canonicalId ? workCenterById(canonicalId) : null
  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza recalcular aunque no se lea en el callback (mismo patron en todo este folder)
  const staffing = useMemo(
    () => (memberIds.length ? getGroupAreaStaffing(memberIds) : null),
    [workCenterId, version],
  )
  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza recalcular aunque no se lea en el callback (mismo patron en todo este folder)
  const people = useMemo(
    () => (memberIds.length ? getGroupPeople(memberIds) : []),
    [workCenterId, version],
  )
  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza recalcular aunque no se lea en el callback (mismo patron en todo este folder)
  const available = useMemo(() => getAvailablePersonnelToday(), [version])

  /* Reconciliacion de puestos reales al abrir el area (2026-08-26, a
     peticion explicita del usuario: "te pasé los puestos... ya tú el
     personal ponlos en los puestos" -- los puestos definidos en
     CUSTOM_STATION_PLANS existian en el sistema pero nadie quedaba
     realmente colocado en un puesto especifico, solo en la lista plana
     de "Personal asignado"). Mismo mecanismo ya usado por WC LINEA/Midea
     (reconcileLineAssignments, repository.js) -- idempotente, nunca
     inventa una estacion extra, nunca toca a una BAJA, preserva
     checkInAt/shift reales ya guardados. Solo corre para areas con mas
     de 1 estacion real (Accesorios/Paletizado/Insumos) -- las demas
     (Conveyors, etc.) siguen con su unico puesto generico, sin cambio.
     Para el grupo fusionado de Insumos, se reconcilian TODOS los
     miembros (incluye BOX_PREP/SUMINISTRO_MATERIAL) contra las 9
     estaciones reales de INSUMOS -- su gente pasa a tener una asignacion
     real en INSUMOS con puesto especifico, en vez de quedar "atrapada"
     en su bucket de snapshot original sin puesto. */
  // biome-ignore lint/correctness/useExhaustiveDependencies: memberIds se recalcula desde workCenterId en cada render, incluirlo forzaria un loop -- mismo patron en todo este folder
  useEffect(() => {
    if (!open || !canonicalId || !hasMultipleStations(canonicalId)) return
    const ids = memberIds
      .flatMap((id) => getGroupPeople([id]))
      .slice()
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .map((p) => p.id)
    reconcileLineAssignments(canonicalId, ids)
  }, [canonicalId, open])
  const filteredAvailable = useMemo(() => {
    const q = availableQuery.trim().toLowerCase()
    if (!q) return available
    return available.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        String(p.employeeNumber || '')
          .toLowerCase()
          .includes(q),
    )
  }, [available, availableQuery])

  // memberIds/version fuerzan refrescar el historial al cambiar de area o
  // tras una asignacion/movimiento, aunque no se lean todos dentro del
  // callback -- mismo patron ya usado en otros archivos de este folder.
  // biome-ignore lint/correctness/useExhaustiveDependencies: ver comentario arriba
  useEffect(() => {
    if (!open || !memberIds.length) return
    let cancelled = false
    setHistory((s) => ({ ...s, loading: true, error: null }))
    Promise.all(
      memberIds.map((id) =>
        fetch(`/api/personnel/area-history?areaId=${encodeURIComponent(id)}&limit=8`, {
          credentials: 'include',
        })
          .then((r) => {
            if (!r.ok) throw new Error(`area-history -> ${r.status}`)
            return r.json()
          })
          .then((data) => data.history),
      ),
    )
      .then((lists) => {
        if (cancelled) return
        const merged = lists
          .flat()
          .sort((a, b) => (a.movedAt < b.movedAt ? 1 : -1))
          .slice(0, 8)
        setHistory({ loading: false, error: null, items: merged })
      })
      .catch((e) => {
        if (!cancelled) setHistory({ loading: false, error: e.message, items: [] })
      })
    return () => {
      cancelled = true
    }
  }, [workCenterId, open, version])

  if (!area || !staffing) return null

  const status = classifyAreaStatus(staffing.real, staffing.ideal)
  const statusMeta = status ? getAreaStatusMeta()[status] : null
  const headerLabel = statusMeta
    ? statusMeta.label
    : people.length > 0
      ? t('operationalAreaDetail.headerLabelHasStaff')
      : t('operationalAreaDetail.headerLabelNoStaffToday')
  const coveragePct =
    staffing.ideal != null && staffing.ideal > 0
      ? Math.round((staffing.real / staffing.ideal) * 1000) / 10
      : null
  const coverageBarPct = coveragePct != null ? Math.min(100, coveragePct) : 0
  const missing = staffing.ideal != null ? Math.max(0, staffing.ideal - staffing.real) : 0
  const tip = classifyForTip(staffing.real, staffing.ideal, t)
  const currentShift = getCurrentShift()
  const shiftRange = formatShiftSchedule(currentShift)
  const headerColor = statusMeta?.color || '#10B981'
  const gaugeColor =
    coveragePct >= 100
      ? '#10B981'
      : coveragePct >= 90
        ? '#3B82F6'
        : coveragePct >= 50
          ? '#F59E0B'
          : '#EF4444'

  function scrollToAvailable() {
    availableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightAvailable(true)
    setTimeout(() => setHighlightAvailable(false), 1600)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="inset-0 left-0 top-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none bg-background">
        <DialogTitle className="sr-only">
          {t('operationalAreaDetail.dialogTitle', {
            areaName: area?.name || t('operationalAreaDetail.areaFallback'),
          })}
        </DialogTitle>
        {/* Header */}
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-3 py-3 md:px-6">
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[19px] font-extrabold tracking-[-0.4px]">{area.name}</p>
              <span
                className="inline-flex h-6 items-center rounded-full border px-2 text-xs font-bold"
                style={{
                  backgroundColor: hexToRgba(headerColor, 0.14),
                  color: headerColor,
                  borderColor: hexToRgba(headerColor, 0.35),
                }}
              >
                {headerLabel}
              </span>
            </div>
            <p className="text-[11.5px] text-muted-foreground">
              {t('operationalAreaDetail.areaSubtitle')}
            </p>
          </div>
          <div className="flex-1" />
          {onNavigate && (
            <WorkCenterNavControls previous={previous} next={next} onNavigate={onNavigate} />
          )}
          <Button
            onClick={() => (isSupervisor ? setRegisterOpen(true) : setSelfAssignOpen(true))}
            className="rounded-[20px] font-bold"
          >
            <UserPlus className="h-4 w-4" />
            {isSupervisor
              ? t('operationalAreaDetail.registerPersonnelButton')
              : t('operationalAreaDetail.selfAssignButton')}
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div key={workCenterId} className="min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
          {/* Estado del area */}
          <p className="mb-2.5 text-[15px] font-extrabold">
            {t('operationalAreaDetail.areaStateTitle')}
          </p>
          <div className="mb-5 overflow-hidden rounded-2xl border border-border">
            <div className="flex flex-col md:flex-row">
              <div className="flex flex-[1_1_180px] items-center gap-2.5 px-3 py-2.5 md:px-[18px]">
                <div
                  className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full"
                  style={{ backgroundColor: hexToRgba('#3B82F6', 0.12), color: '#3B82F6' }}
                >
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[22px] font-extrabold leading-none">
                    {staffing.ideal != null
                      ? `${staffing.real} / ${staffing.ideal}`
                      : staffing.real}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t('operationalAreaDetail.peopleAssignedLabel')}
                  </p>
                  {missing > 0 && (
                    <p className="text-[11px] font-bold text-[#EF4444]">
                      {t('operationalAreaDetail.missingCount', { count: missing })}
                    </p>
                  )}
                </div>
              </div>

              <MetricBlock label={t('operationalAreaDetail.coverageLabel')} borderLeft>
                <p
                  className={cn(
                    'leading-[1.2] font-extrabold',
                    coveragePct != null ? 'text-[21px]' : 'text-sm',
                    coveragePct != null && coveragePct >= 100
                      ? 'text-[#10B981]'
                      : coveragePct != null
                        ? 'text-[#3B82F6]'
                        : 'text-muted-foreground',
                  )}
                >
                  {coveragePct != null
                    ? `${coveragePct}%`
                    : t('operationalAreaDetail.noCoverageGoal')}
                </p>
                {coveragePct != null && (
                  <>
                    <div className={cn(progressBarClass, 'my-1')}>
                      <div
                        className="h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(.4,0,.2,1)]"
                        style={{
                          width: `${coverageBarPct}%`,
                          backgroundColor: coveragePct >= 100 ? '#10B981' : '#3B82F6',
                        }}
                      />
                    </div>
                    <p className="text-[10.5px] text-muted-foreground">
                      {t('operationalAreaDetail.coverageOfLabel', {
                        real: staffing.real,
                        ideal: staffing.ideal,
                      })}
                    </p>
                  </>
                )}
              </MetricBlock>

              <MetricBlock label={t('operationalAreaDetail.idealTemplateLabel')} borderLeft>
                <p
                  className={cn(
                    'leading-[1.2] font-extrabold',
                    staffing.ideal != null ? 'text-[21px]' : 'text-sm',
                    staffing.ideal != null ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {staffing.ideal != null
                    ? staffing.ideal
                    : t('operationalAreaDetail.undefinedLabel')}
                </p>
                {staffing.ideal != null && (
                  <p className="text-[10.5px] text-muted-foreground">
                    {t('operationalAreaDetail.peopleUnitLabel')}
                  </p>
                )}
              </MetricBlock>

              <MetricBlock label={t('operationalAreaDetail.missingLabel')} borderLeft>
                <p
                  className={cn(
                    'leading-[1.2] font-extrabold',
                    staffing.ideal != null ? 'text-[21px]' : 'text-sm',
                    staffing.ideal == null
                      ? 'text-muted-foreground'
                      : missing > 0
                        ? 'text-[#EF4444]'
                        : 'text-foreground',
                  )}
                >
                  {staffing.ideal != null ? missing : t('operationalAreaDetail.notCalculableLabel')}
                </p>
                {staffing.ideal != null && (
                  <p className="text-[10.5px] text-muted-foreground">
                    {t('operationalAreaDetail.peopleUnitLabel')}
                  </p>
                )}
              </MetricBlock>

              <MetricBlock label={t('operationalAreaDetail.areaStateTitle')} borderLeft>
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: statusMeta?.color || '#94A3B8' }}
                  />
                  <p className="text-[15px] font-extrabold">{headerLabel}</p>
                </div>
                <p className="text-[10.5px] text-muted-foreground">
                  {status === 'COMPLETA' || status === null
                    ? t('operationalAreaDetail.upToDateLabel')
                    : t('operationalAreaDetail.requiresAttentionLabel')}
                </p>
              </MetricBlock>

              <MetricBlock label={t('operationalAreaDetail.currentShiftLabel')} borderLeft>
                <div className="flex items-center gap-1.5">
                  <Sun className="h-4 w-4 text-[#F59E0B]" />
                  <p className="text-[15px] font-extrabold">{currentShift.label}</p>
                </div>
                <p className="text-[10.5px] text-muted-foreground">{shiftRange}</p>
              </MetricBlock>
            </div>
          </div>

          {/* Personal asignado + Distribucion por tipo de puesto */}
          <div className="mb-5 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            <div className={cn(cardClass, 'p-4 lg:col-span-2')}>
              <p className="mb-3 text-[14.5px] font-extrabold">
                {t('operationalAreaDetail.assignedPersonnelTitle', { count: people.length })}
              </p>
              {people.length === 0 ? (
                <EmptyState
                  compact
                  title={t('operationalAreaDetail.emptyAssignedTitle')}
                  description={t('operationalAreaDetail.emptyAssignedDescription')}
                />
              ) : (
                <div className="grid max-h-[420px] grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2 md:grid-cols-3">
                  {people.map((p) => (
                    <AssignedPersonChip
                      key={p.id}
                      employeeId={p.id}
                      name={p.name}
                      subtitle={getCurrentAssignment(p.id)?.stationId}
                    />
                  ))}
                </div>
              )}
            </div>
            <RoleDistributionCard people={people} />
          </div>

          {/* Gestion de personal -- las tres columnas (Disponibles / Drop
              zone / Resumen+Historial) viven dentro de una sola seccion
              envolvente (titulo propio + fondo compartido). items-start en
              el grid: sin eso, Disponibles (sin limite propio de altura
              antes de su max-h local) forzaria a las otras dos columnas a
              estirarse igual de altas. */}
          <p className="mb-2.5 text-[15px] font-extrabold">
            {t('operationalAreaDetail.personnelManagementTitle')}
          </p>
          <div className="mb-5 rounded-2xl border border-border bg-black/[.012] p-3 dark:bg-white/[.02] md:p-4">
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
              <div
                ref={availableRef}
                className={cn(
                  'rounded-2xl border bg-card p-4 transition-colors duration-300',
                  highlightAvailable
                    ? 'border-[#3B82F6] shadow-[0_0_0_3px_rgba(59,130,246,0.15)] dark:shadow-[0_0_0_3px_rgba(59,130,246,0.25)]'
                    : 'border-border',
                )}
              >
                <p className="mb-2 text-[14.5px] font-extrabold">
                  {t('operationalAreaDetail.availableToAssignTitle', { count: available.length })}
                  {availableQuery.trim() && (
                    <span className="ml-1.5 text-[11.5px] font-bold text-muted-foreground">
                      {t('operationalAreaDetail.resultsCount', { count: filteredAvailable.length })}
                    </span>
                  )}
                </p>
                {available.length === 0 ? (
                  <EmptyState
                    compact
                    title={t('operationalAreaDetail.emptyAvailableTitle')}
                    description={t('operationalAreaDetail.emptyAvailableDescription')}
                  />
                ) : (
                  <>
                    <div className="relative mb-2">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-muted-foreground opacity-50" />
                      <Input
                        value={availableQuery}
                        onChange={(e) => setAvailableQuery(e.target.value)}
                        placeholder={t('operationalAreaDetail.searchPlaceholder')}
                        className="h-9 rounded-lg pl-9 text-[12.5px]"
                      />
                    </div>
                    {filteredAvailable.length === 0 ? (
                      <EmptyState
                        compact
                        title={t('operationalAreaDetail.emptyNoMatchTitle')}
                        description={t('operationalAreaDetail.emptyNoMatchDescription')}
                      />
                    ) : (
                      <div className="flex max-h-[300px] flex-col gap-2 overflow-y-auto pr-1 md:max-h-[340px]">
                        {filteredAvailable.map((p) => (
                          <AvailableCandidateRow key={p.id} person={p} areaId={canonicalId} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <DropZone areaId={canonicalId} label={area.name} />

              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="mb-3 text-[14.5px] font-extrabold">
                    {t('operationalAreaDetail.quickSummaryTitle')}
                  </p>
                  <div className="flex flex-col gap-2">
                    {[
                      [t('operationalAreaDetail.totalInAreaLabel'), staffing.real],
                      [
                        t('operationalAreaDetail.idealTemplateLabel'),
                        staffing.ideal != null
                          ? staffing.ideal
                          : t('operationalAreaDetail.undefinedLabel'),
                      ],
                      [
                        t('operationalAreaDetail.missingLabel'),
                        staffing.ideal != null
                          ? missing
                          : t('operationalAreaDetail.notCalculableLabel'),
                      ],
                      [
                        t('operationalAreaDetail.coverageShortLabel'),
                        coveragePct != null
                          ? `${coveragePct}%`
                          : t('operationalAreaDetail.noCoverageGoal'),
                      ],
                      [t('operationalAreaDetail.availableLabel'), available.length],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <p className="text-[12.5px] text-muted-foreground">{label}</p>
                        <p className="text-[12.5px] font-extrabold">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[14.5px] font-extrabold">
                      {t('operationalAreaDetail.recentHistoryTitle')}
                    </p>
                    {history.items.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setHistoryDialogOpen(true)}
                        className="text-[11.5px] font-bold text-[#3B82F6]"
                      >
                        {t('operationalAreaDetail.viewAllButton')}
                      </button>
                    )}
                  </div>
                  {history.loading ? (
                    <p className="text-xs text-muted-foreground">
                      {t('operationalAreaDetail.loadingLabel')}
                    </p>
                  ) : history.error ? (
                    <p className="text-xs text-muted-foreground">
                      {t('operationalAreaDetail.historyLoadErrorMessage')}
                    </p>
                  ) : history.items.length === 0 ? (
                    <EmptyState
                      compact
                      title={t('operationalAreaDetail.emptyHistoryTitle')}
                      description={t('operationalAreaDetail.emptyHistoryDescription')}
                    />
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {history.items.slice(0, 5).map((h) => (
                        <HistoryRow key={h.id} h={h} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-5 border-t border-border" />

          {/* Analisis del area */}
          <p className="mb-3 text-[15px] font-extrabold">
            {t('operationalAreaDetail.areaAnalysisTitle')}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={cn(cardClass, 'p-4 text-center')}>
              <p className="mb-3 text-left text-[13.5px] font-extrabold">
                {t('operationalAreaDetail.coverageVsIdealTitle')}
              </p>
              {coveragePct != null ? (
                <>
                  <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-full bg-muted">
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `conic-gradient(${gaugeColor} ${coverageBarPct * 3.6}deg, transparent 0deg)`,
                      }}
                    />
                    <div className="absolute inset-[6px] rounded-full bg-background" />
                    <p className="relative z-10 text-[17px] font-extrabold">{coveragePct}%</p>
                  </div>
                  <p className="mt-2 text-[11.5px] text-muted-foreground">
                    {t('operationalAreaDetail.coverageLabel')}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t('operationalAreaDetail.coverageOfPeopleLabel', {
                      real: staffing.real,
                      ideal: staffing.ideal,
                    })}
                  </p>
                </>
              ) : (
                <EmptyState
                  compact
                  title={t('operationalAreaDetail.noIdealTemplateTitle')}
                  description={t('operationalAreaDetail.noIdealTemplateDescription')}
                />
              )}
            </div>

            <div className={cn(cardClass, 'p-4')}>
              <div className="mb-3 flex items-center gap-1.5">
                <LineChart className="h-4 w-4 text-muted-foreground" />
                <p className="text-[13.5px] font-extrabold">
                  {t('operationalAreaDetail.coverageTrendTitle')}
                </p>
              </div>
              {/* Investigado (2026-08-25): el headcount real de cada dia pasado
                  viene mayormente de un snapshot SIN fecha (REAL_PERSONNEL_SNAPSHOT),
                  no de un registro historico por dia -- DailyAssignment solo tiene
                  filas para quien fue tocado de verdad ese dia (un puñado de
                  personas, no el total real). Reconstruir "cobertura de hace 3
                  dias" con esos datos daria un numero falso. Mismo hallazgo ya
                  documentado en el rediseño del Dashboard (useDashboardMetrics.js). */}
              <EmptyState
                compact
                title={t('operationalAreaDetail.emptyTrendTitle')}
                description={t('operationalAreaDetail.emptyTrendDescription')}
              />
            </div>

            <div className={cn(cardClass, 'p-4')}>
              <p className="mb-3 text-[13.5px] font-extrabold">
                {t('operationalAreaDetail.areaClassificationTitle')}
              </p>
              <div className="flex items-start gap-2">
                <Star className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#F59E0B]" />
                <div>
                  <p className="text-[13px] font-extrabold">{tip.label}</p>
                  <p className="mt-1 text-[11.5px] text-muted-foreground">{tip.tip}</p>
                </div>
              </div>
            </div>

            <div className={cn(cardClass, 'flex flex-col p-4')}>
              <div className="mb-2 flex items-center gap-1.5">
                <UserCog className="h-[17px] w-[17px] text-[#3B82F6]" />
                <p className="text-[13.5px] font-extrabold">
                  {t('operationalAreaDetail.autoRecommendationTitle')}
                </p>
              </div>
              {missing > 0 && (
                <span className={cn(metricChipClass('warn'), 'mb-2 self-start')}>
                  {missing >= 5
                    ? t('operationalAreaDetail.priorityHigh')
                    : missing >= 2
                      ? t('operationalAreaDetail.priorityMedium')
                      : t('operationalAreaDetail.priorityLow')}
                </span>
              )}
              <p className="mb-3 flex-1 text-xs text-muted-foreground">
                {missing > 0
                  ? t('operationalAreaDetail.recommendationMissing', { count: missing })
                  : staffing.ideal != null
                    ? t('operationalAreaDetail.recommendationComplete')
                    : t('operationalAreaDetail.tipNoTemplate')}
              </p>
              {missing > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={scrollToAvailable}
                  className="self-start font-bold"
                >
                  <Lightbulb className="h-4 w-4" />
                  {t('operationalAreaDetail.viewAvailableCandidatesButton')}
                </Button>
              )}
            </div>
          </div>
        </div>

        <RegisterPersonnelDialog
          open={registerOpen}
          onClose={() => setRegisterOpen(false)}
          fixedAreaId={canonicalId}
          onDone={() => {}}
        />
        <SelfAssignDialog
          open={selfAssignOpen}
          onClose={() => setSelfAssignOpen(false)}
          fixedAreaId={canonicalId}
          onDone={() => {}}
        />

        {/* "Ver todo" del historial -- reutiliza los mismos `history.items`
            ya obtenidos (fetch limit=8), nunca una segunda consulta: la
            vista compacta de arriba solo corta a 5. */}
        <Dialog
          open={historyDialogOpen}
          onOpenChange={(next) => !next && setHistoryDialogOpen(false)}
        >
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle className="text-base">
                {t('operationalAreaDetail.historyDialogTitle', { areaName: area.name })}
              </DialogTitle>
              <DialogClose asChild>
                <button
                  type="button"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </DialogClose>
            </DialogHeader>
            <div className="flex flex-col gap-3 px-6 pb-5">
              {history.items.map((h) => (
                <HistoryRow key={h.id} h={h} />
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
