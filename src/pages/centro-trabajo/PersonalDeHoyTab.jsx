import dayjs from 'dayjs'
import {
  ArrowLeftRight,
  Badge,
  Briefcase,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Contact,
  Download,
  Flag,
  History,
  LayoutGrid,
  Search,
  TriangleAlert,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Cell, Pie, PieChart, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  cardClass,
  cardHeaderClass,
  cardHeaderSubtitleClass,
  cardHeaderTitleClass,
  cellTextClass,
  cellTextSecondaryClass,
  emptyTextClass,
  metricChipClass,
  statusChipClass,
  tableHeaderRowClass,
  tableRowClass,
} from '@/lib/pageStyles'
import { cn, hexToRgba } from '@/lib/utils'
import { isEmployeeEligible } from '../../data/personnel/directory'
import {
  approvePendingMoveWithToast,
  rejectPendingMoveWithToast,
} from '../../data/personnel/moveApprovalActions'
import {
  getAbsentEmployeeIds,
  getAllEmployees,
  getCurrentAssignment,
  getLateEmployeeIds,
  getMovementsForEmployee,
  getMovesCountForDate,
  getPendingMoves,
  getUnassignedPresentToday,
  searchEmployees,
  todayISO,
} from '../../data/personnel/repository'
import { usePersonnelVersion } from '../../data/personnel/usePersonnelVersion'
import {
  DEFAULT_LINE_ENTRY_TIME,
  SHIFT_OPTIONS,
  WORK_CENTERS,
  workCenterById,
} from '../../data/production/catalog'
import { exportPersonalExcel } from '../../data/production/excelExport'
import {
  AUTO_ACTIVE_AREAS,
  getEffectiveAreaForEmployee,
  getEffectiveTodayRoster,
  getPeopleWithoutArea,
} from '../../data/production/personnelByArea'
import { getRoleLabels } from '../../layout/roleLabels'
import { useAuth } from '../../state/auth'
import { useRoleMode } from '../../state/roleMode'
import { EmptyState } from '../../ui'
// Reutiliza la card KPI compacta y horizontal ya aprobada para el Dashboard
// (2026-08-24) -- mismo lenguaje visual pedido para Personal en este rediseño
// (2026-08-25), en vez de duplicar el componente.
import DashboardKpiCard from '../dashboard/DashboardKpiCard'
import EmployeeHistoryDialog from './EmployeeHistoryDialog'
import RegisterPersonnelDialog from './RegisterPersonnelDialog'
import SelfAssignDialog from './SelfAssignDialog'

/* ─────────────────────────────────────────────
   Rediseño 2026-08-25 (a peticion explicita del usuario, mockup
   proporcionado) -- EXCLUSIVO de "Centro de Trabajo > Personal".
   Antes era una sola tabla larga (pase de lista) + directorio debajo,
   sin KPIs ni panel lateral. Ahora: 4 KPIs, una barra de
   busqueda+filtros+acciones, y el contenido principal en dos columnas
   (izquierda ~70%: Registro de hoy + Directorio completo; derecha
   ~30%: Resumen por area + Alertas/pendientes + Acciones rapidas).

   NINGUNA fuente de datos nueva -- todo sigue viniendo exactamente de
   personnelByArea.js/repository.js, igual que antes de este cambio:
   - "Registro de hoy" = getEffectiveTodayRoster() (snapshot + real,
     misma funcion que ya alimentaba el pase de lista).
   - "Con numero de empleado" / "Proyectos" = el mismo Directorio
     completo (getAllEmployees + isEmployeeEligible, ya excluye
     bajas) que ya existia debajo -- las 2 KPI de arriba SOLO
     resumen esos mismos numeros, nunca inventan una poblacion nueva.
   - "Movimientos hoy" = getMovesCountForDate (igual que antes).
   - "Resumen por area" agrupa el mismo roster por areaId (nuevo
     calculo, pero misma fuente).
   - "Alertas" reutiliza getUnassignedPresentToday() (antes se
     mostraba como una lista de chips siempre visible; ahora vive
     como una alerta clickeable que filtra la tabla por Estado --
     ver nota en el reporte al usuario, es una consolidacion de UX,
     no una perdida de funcionalidad) + el propio roster filtrado por
     estado SNAPSHOT/sin estacion.
   - "Acciones rapidas": Asignar a linea y Mover personal abren el
     MISMO RegisterPersonnelDialog de siempre (su propio flujo ya
     distingue "registrar" de "mover" segun si el empleado ya tiene
     asignacion hoy -- CONFLICT step de RegisterPersonnelForm.jsx);
     Ver bajas / Ver layout general solo cambian de pestaña
     (onGoToBajas/onGoToAreas, mismo patron que onGoToLineas en
     EstacionesTab.jsx).

   Fase 6c (Centro de Trabajo): portado de MUI a Tailwind. */

// 'PENDIENTE' (BASE/SEM34 no confirmo numero real) y 'PROYECTO' (se
// registro sin numero desde Registro de Personal) son los dos valores
// que NO cuentan como numero de empleado real -- todo lo demas si.
const NO_REAL_NUMBER = new Set(['PENDIENTE', 'PROYECTO'])
function hasRealNumber(employeeNumber) {
  return !NO_REAL_NUMBER.has(employeeNumber)
}

function areaLabel(id) {
  return workCenterById(id)?.name || id || '—'
}

// Iniciales para los avatares neutrales del Directorio rápido (2026-09-03) -- nunca fotos reales,
// solo las primeras 1-2 letras de nombre/apellido, igual que cualquier avatar placeholder.
function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

// Clasificacion real del movimiento para el badge del Directorio rápido/Movimientos del día
// (2026-09-03): EmployeeMovement solo distingue ASSIGNED/MOVED de verdad (ver
// api/personnel/movements-today.js) -- "Cambio de rol" no es un tercer tipo inventado, es un
// MOVED real donde el area de origen y destino coinciden (mismo campo fromAreaCode/toAreaCode ya
// real) y por lo tanto el cambio fue de estacion/rol dentro de la misma area, no de area.
function movementBadgeInfo(m, t) {
  if (m.action === 'ASSIGNED') {
    return {
      label: t('personalDeHoyTab.badgeAsignacion'),
      tone: 'ok',
      detail: t('personalDeHoyTab.movementAssignedTo', { to: m.toAreaName }),
    }
  }
  if (m.fromAreaCode === m.toAreaCode) {
    return {
      label: t('personalDeHoyTab.badgeCambioDeRol'),
      tone: 'info',
      detail: t('personalDeHoyTab.movementMovedTo', {
        from: m.fromStationName || m.fromAreaName,
        to: m.toStationName || m.toAreaName,
      }),
    }
  }
  return {
    label: t('personalDeHoyTab.badgeTraslado'),
    tone: 'warn',
    detail: t('personalDeHoyTab.movementMovedTo', { from: m.fromAreaName, to: m.toAreaName }),
  }
}

// Construido dentro de PersonalDeHoyTab (no a nivel de módulo) porque
// sus textos visibles requieren t(), que solo funciona dentro de un
// componente (mismo patrón que buildAreaSlots en EstacionesTab.jsx).
function buildEstadoOptions(t) {
  return [
    { value: 'TODOS', label: t('personalDeHoyTab.todosLabel') },
    { value: 'REGISTRADO', label: t('personalDeHoyTab.registradoHoyLabel') },
    { value: 'SNAPSHOT', label: t('personalDeHoyTab.porSnapshotLabel') },
    { value: 'SIN_ESTACION', label: t('personalDeHoyTab.sinEstacionLabel') },
    { value: 'SIN_ASIGNACION', label: t('personalDeHoyTab.sinAsignacionLabel') },
  ]
}

const ROSTER_PAGE_SIZE = 8
const AREA_SUMMARY_TOP_N = 5

// Orden de los grupos del Directorio (2026-09-03, a peticion explicita del usuario: "sepáralos
// por áreas para que me sea más rápido ver si están duplicados o no y encontrar a la gente más
// rápido") -- mismo orden fisico que WORK_CENTERS (catalog.js), para que coincida con el board de
// Área operando; "Sin área asignada" siempre al final, nunca mezclado alfabeticamente entre las
// áreas reales.
function groupDirectoryByArea(list, t) {
  const orderIndex = new Map(WORK_CENTERS.map((w, idx) => [w.id, idx]))
  const groups = new Map()
  for (const e of list) {
    const areaId = getEffectiveAreaForEmployee(e.id)
    const key = areaId || '__SIN_AREA__'
    if (!groups.has(key)) groups.set(key, { areaId, members: [] })
    groups.get(key).members.push(e)
  }
  return Array.from(groups.values())
    .map((g) => ({
      ...g,
      label: g.areaId ? areaLabel(g.areaId) : t('personalDeHoyTab.directoryNoAreaLabel'),
    }))
    .sort((a, b) => {
      const ia = a.areaId ? (orderIndex.get(a.areaId) ?? Number.MAX_SAFE_INTEGER) : Infinity
      const ib = b.areaId ? (orderIndex.get(b.areaId) ?? Number.MAX_SAFE_INTEGER) : Infinity
      if (ia !== ib) return ia - ib
      return a.label.localeCompare(b.label, 'es')
    })
}

export default function PersonalDeHoyTab({ onGoToAreas, onGoToSinAsignar }) {
  const { t } = useTranslation('centroTrabajo')
  const version = usePersonnelVersion()
  const { isSupervisor } = useRoleMode()
  // roleMode colapsa ADMINISTRADOR/SUPERVISOR/LIDER en un solo modo
  // "SUPERVISOR" (ver src/state/roleMode.jsx) — para el panel de
  // aprobacion necesitamos distinguir a un LIDER de verdad, asi que
  // usamos el rol real de la sesion, no roleMode.
  const { user } = useAuth()
  const canApproveMoves = user?.role === 'SUPERVISOR' || user?.role === 'ADMINISTRADOR'

  const [query, setQuery] = useState('')
  const [areaFilter, setAreaFilter] = useState('TODAS')
  const [shiftFilter, setShiftFilter] = useState('TODOS')
  const [estadoFilter, setEstadoFilter] = useState('TODOS')
  const [registerOpen, setRegisterOpen] = useState(false)
  const [selfAssignOpen, setSelfAssignOpen] = useState(false)
  const [historyEmployee, setHistoryEmployee] = useState(null)
  const [directoryTab, setDirectoryTab] = useState('CON_NUMERO')
  const [directoryQuery, setDirectoryQuery] = useState('')
  const [showAllRoster, setShowAllRoster] = useState(false)
  // Rediseño 2026-09-03 (a peticion explicita del usuario, mockup exacto proporcionado): las 3
  // tablas grandes (Registro de hoy completo / Directorio completo / Movimientos completos) ya
  // no viven abiertas por defecto en el dashboard -- se accede a traves de "Ver..." que abre
  // esta misma informacion (MISMOS componentes/datos de siempre, ver RegistroDeHoyCard/
  // DirectorioCard/MovimientosDelDiaCard mas abajo) dentro de un Dialog, nunca se pierde nada.
  const [fullRosterOpen, setFullRosterOpen] = useState(false)
  const [fullDirectoryOpen, setFullDirectoryOpen] = useState(false)
  const [fullMovementsOpen, setFullMovementsOpen] = useState(false)
  const [quickDirectoryTab, setQuickDirectoryTab] = useState('AREA')

  const estadoOptions = useMemo(() => buildEstadoOptions(t), [t])

  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza recalcular aunque no se lea en el callback (mismo patron en todo este folder)
  const pendingMoves = useMemo(
    () => (canApproveMoves ? getPendingMoves() : []),
    [version, canApproveMoves],
  )

  function handleApproveMove(id) {
    approvePendingMoveWithToast(id, user?.id)
  }

  function handleRejectMove(id) {
    rejectPendingMoveWithToast(id, user?.id)
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza recalcular aunque no se lea en el callback (mismo patron en todo este folder)
  const roster = useMemo(() => getEffectiveTodayRoster(), [version])
  const presentToday = roster.length
  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza recalcular aunque no se lea en el callback (mismo patron en todo este folder)
  const movesToday = useMemo(() => getMovesCountForDate(todayISO()), [version])
  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza recalcular aunque no se lea en el callback (mismo patron en todo este folder)
  const unassigned = useMemo(() => getUnassignedPresentToday(), [version])
  const rosterSinEstacion = useMemo(() => roster.filter((r) => !r.stationId), [roster])
  const rosterSnapshot = useMemo(() => roster.filter((r) => r.source === 'SNAPSHOT'), [roster])

  // Conteo para la alerta "Personal sin asignar" (2026-09-02) -- la lista completa con
  // acciones (Baja/Cambio de turno/Falta) vive en su propia pestaña ahora
  // (PersonalSinAsignarTab.jsx, a peticion explicita del usuario tras el primer intento
  // metido aqui mismo); aqui solo se necesita el numero para el chip de Alertas.
  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza recalcular aunque no se lea en el callback (mismo patron en todo este folder)
  const unassignedCount = useMemo(() => getPeopleWithoutArea().length, [version])

  // Directorio completo -- TODO el personal activo (elegible, sin
  // bajas), no solo quien tiene ubicacion hoy. Las 2 KPI de arriba
  // ("Con numero de empleado"/"Personal por proyecto") son
  // exactamente estos mismos dos conteos, para que nunca se
  // desincronicen con las tabs de abajo.
  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza recalcular aunque no se lea en el callback (mismo patron en todo este folder)
  const directoryAll = useMemo(() => getAllEmployees().filter(isEmployeeEligible), [version])
  const directoryWithNumber = useMemo(
    () =>
      directoryAll
        .filter((e) => hasRealNumber(e.employeeNumber))
        .sort((a, b) => a.employeeNumber.localeCompare(b.employeeNumber, 'es', { numeric: true })),
    [directoryAll],
  )
  const directoryProyectos = useMemo(
    () =>
      directoryAll
        .filter((e) => !hasRealNumber(e.employeeNumber))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [directoryAll],
  )
  // % "respecto al personal correspondiente" (misma poblacion en
  // numerador y denominador, a proposito -- ver nota en el reporte al
  // usuario sobre por que NO se usa "personal presente hoy" aqui).
  const pctConNumero =
    directoryAll.length > 0 ? (directoryWithNumber.length / directoryAll.length) * 100 : 0

  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza recalcular aunque no se lea en el callback (mismo patron en todo este folder)
  const searchResults = useMemo(() => searchEmployees(query), [query, version])
  const bestMatch = useMemo(() => {
    if (!query.trim()) return null
    const exact = searchResults.find((e) => e.employeeNumber === query.trim())
    return exact || searchResults[0] || null
  }, [query, searchResults])

  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza recalcular aunque no se lea en el callback (mismo patron en todo este folder)
  const bestMatchDetail = useMemo(() => {
    if (!bestMatch) return null
    const assignment = getCurrentAssignment(bestMatch.id)
    const movements = getMovementsForEmployee(bestMatch.id, todayISO())
    const lastMove = movements.filter((m) => m.type === 'MOVE').slice(-1)[0]
    return { employee: bestMatch, assignment, lastMove }
  }, [bestMatch, version])

  const rosterRows = useMemo(() => {
    if (estadoFilter === 'SIN_ASIGNACION') {
      return unassigned.map((u) => ({
        id: u.id,
        employeeId: u.employeeId,
        employeeNumber: u.employeeNumber,
        employee: u.employee,
        areaId: null,
        stationId: null,
        checkInAt: u.checkedInAt || null,
        shift: u.shift || null,
        source: 'SIN_ASIGNACION',
      }))
    }
    return roster.filter((r) => {
      if (estadoFilter === 'REGISTRADO' && r.source !== 'REGISTRO') return false
      if (estadoFilter === 'SNAPSHOT' && r.source !== 'SNAPSHOT') return false
      if (estadoFilter === 'SIN_ESTACION' && r.stationId) return false
      return true
    })
  }, [roster, unassigned, estadoFilter])

  const queryNorm = query.trim().toLowerCase()
  const filteredRoster = useMemo(
    () =>
      rosterRows.filter((r) => {
        if (areaFilter !== 'TODAS' && r.areaId !== areaFilter) return false
        if (shiftFilter !== 'TODOS' && r.shift !== shiftFilter) return false
        if (queryNorm) {
          const num = (r.employeeNumber || '').toLowerCase()
          const name = (r.employee?.name || '').toLowerCase()
          if (!num.includes(queryNorm) && !name.includes(queryNorm)) return false
        }
        return true
      }),
    [rosterRows, areaFilter, shiftFilter, queryNorm],
  )

  const visibleRoster = showAllRoster ? filteredRoster : filteredRoster.slice(0, ROSTER_PAGE_SIZE)

  const directoryQueryNorm = directoryQuery.trim().toLowerCase()
  const filterDirectory = (list) => {
    if (!directoryQueryNorm) return list
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(directoryQueryNorm) ||
        e.employeeNumber.toLowerCase().includes(directoryQueryNorm),
    )
  }
  const directoryList =
    directoryTab === 'CON_NUMERO'
      ? filterDirectory(directoryWithNumber)
      : filterDirectory(directoryProyectos)
  const directoryGroups = useMemo(() => groupDirectoryByArea(directoryList, t), [directoryList, t])

  // Resumen por area -- Top N por personal presente hoy (roster
  // completo, sin filtros de la barra, para que sea una foto general
  // estable igual que las alertas). Participacion = presentesArea /
  // totalPresente * 100, nunca hardcodeada.
  // "Estado general del día" (2026-09-03, a peticion explicita del usuario, mockup exacto) --
  // Presentes/Pendientes vienen del MISMO roster efectivo de siempre (r.source real,
  // 'REGISTRO'/'SNAPSHOT'), nunca una poblacion nueva. Faltas/Tardías usan Attendance.status=
  // 'AUSENTE'/'RETARDO' -- consultas REALES (getAbsentEmployeeIds/getLateEmployeeIds, mismo
  // patron ya establecido en el modulo Asistencia) que hoy siempre dan 0 porque ningun flujo del
  // sistema escribe esos estados todavia -- NUNCA se inventa un umbral de "llegada tardía" que no
  // existe en la configuración real.
  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza recalcular aunque no se lea en el callback (mismo patron en todo este folder)
  const absentCount = useMemo(() => getAbsentEmployeeIds().length, [version])
  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza recalcular aunque no se lea en el callback (mismo patron en todo este folder)
  const lateCount = useMemo(() => getLateEmployeeIds().length, [version])
  const presentesCount = useMemo(
    () => roster.filter((r) => r.source === 'REGISTRO').length,
    [roster],
  )
  const estadoGeneral = useMemo(() => {
    const total = presentesCount + lateCount + absentCount + rosterSnapshot.length
    return {
      total,
      presentes: presentesCount,
      tardias: lateCount,
      faltas: absentCount,
      pendientes: rosterSnapshot.length,
    }
  }, [presentesCount, lateCount, absentCount, rosterSnapshot])

  // "Directorio rápido de personal" (2026-09-03, mockup exacto) -- reemplaza visualmente la
  // tabla gigante de siempre; sigue viniendo del MISMO roster efectivo (getEffectiveTodayRoster),
  // nunca una poblacion nueva. Por área/Por proyecto agrupan por r.areaId (misma logica que
  // areaSummary ya usaba); Sin asignar reusa getUnassignedPresentToday() sin cambios.
  const quickDirectoryGroups = useMemo(() => {
    const base =
      quickDirectoryTab === 'PROYECTO'
        ? roster.filter((r) => !hasRealNumber(r.employeeNumber))
        : roster
    const counts = new Map()
    base.forEach((r) => {
      const key = r.areaId || '__SIN_AREA__'
      if (!counts.has(key)) counts.set(key, { areaId: r.areaId, members: [] })
      counts.get(key).members.push(r)
    })
    return Array.from(counts.values())
      .map((g) => ({
        ...g,
        label: g.areaId ? areaLabel(g.areaId) : t('personalDeHoyTab.directoryNoAreaLabel'),
      }))
      .sort((a, b) => b.members.length - a.members.length)
  }, [roster, quickDirectoryTab, t])
  const quickDirectoryUnassignedGroup = useMemo(
    () => ({
      areaId: null,
      label: t('personalDeHoyTab.sinAsignarGroupLabel'),
      members: unassigned,
    }),
    [unassigned, t],
  )

  function handleAlertClick(estado) {
    setEstadoFilter(estado)
    setShowAllRoster(true)
    setFullRosterOpen(true)
  }

  return (
    <div>
      {/* KPIs — exactamente 4 */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <DashboardKpiCard
          icon={<Users />}
          accent="#3B82F6"
          title={t('personalDeHoyTab.kpiPresentTitle')}
          subtitle={t('personalDeHoyTab.kpiPresentSubtitle')}
          value={presentToday}
        />
        <DashboardKpiCard
          icon={<Badge />}
          accent="#06B6D4"
          title={t('personalDeHoyTab.kpiWithNumberTitle')}
          subtitle={t('personalDeHoyTab.kpiWithNumberSubtitle')}
          value={directoryWithNumber.length}
          unit={t('personalDeHoyTab.kpiWithNumberUnit', { pct: pctConNumero.toFixed(1) })}
        />
        <DashboardKpiCard
          icon={<Briefcase />}
          accent="#A855F7"
          title={t('personalDeHoyTab.kpiProjectsTitle')}
          subtitle={t('personalDeHoyTab.kpiProjectsSubtitle')}
          value={directoryProyectos.length}
        />
        <DashboardKpiCard
          icon={<ArrowLeftRight />}
          accent="#F59E0B"
          title={t('personalDeHoyTab.kpiMovesTitle')}
          subtitle={t('personalDeHoyTab.kpiMovesSubtitle')}
          value={movesToday}
        />
      </div>

      {/* Movimientos pendientes de aprobacion — solo SUPERVISOR/ADMINISTRADOR
          (nunca LIDER: es justo lo que un lider pide y espera a que se
          verifique aqui, peticion explicita del usuario). Funcionalidad sin
          cambios, solo se conserva arriba del contenido de dos columnas. */}
      {canApproveMoves && pendingMoves.length > 0 && (
        <div className={cn(cardClass, 'mb-4')}>
          <div className={cardHeaderClass}>
            <div>
              <p className={cardHeaderTitleClass}>
                {t('personalDeHoyTab.pendingMovesTitle', { count: pendingMoves.length })}
              </p>
              <p className={cardHeaderSubtitleClass}>
                {t('personalDeHoyTab.pendingMovesSubtitle')}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 p-4">
            {pendingMoves.map((m) => (
              <div
                key={m.id}
                className="flex flex-col justify-between gap-3 rounded-lg border border-border p-2.5 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="text-[13.5px] font-bold">
                    {t('personalDeHoyTab.employeeHeader', {
                      employeeNumber: m.employeeNumber,
                      name: m.employeeName,
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('personalDeHoyTab.moveRequestSummary', {
                      from: areaLabel(m.fromAreaId),
                      to: areaLabel(m.toAreaId),
                      station: m.toStationId,
                      requestedBy: m.requestedByName || t('personalDeHoyTab.unknownLeaderFallback'),
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRejectMove(m.id)}
                    className="font-bold text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                    {t('personalDeHoyTab.rejectButton')}
                  </Button>
                  <Button size="sm" onClick={() => handleApproveMove(m.id)} className="font-bold">
                    <Check className="h-4 w-4" />
                    {t('personalDeHoyTab.approveButton')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rediseño 2026-09-03 (a peticion explicita del usuario, mockup exacto proporcionado):
          fila 1 de 3 columnas -- Estado general del día / Directorio rápido de personal /
          Alertas y pendientes. Fila 2 -- Movimientos del día (compacto) 70% + Acciones rápidas
          30%. Las 3 tablas grandes de siempre (Registro de hoy completo, Directorio completo,
          Movimientos completos) NO desaparecen -- viven exactamente igual (mismos componentes,
          mismos datos) dentro de un Dialog accesible desde "Ver..." en cada card nueva. */}
      <div className="mb-4 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <EstadoGeneralCard estado={estadoGeneral} />
        <QuickDirectoryCard
          tab={quickDirectoryTab}
          onTabChange={setQuickDirectoryTab}
          groups={
            quickDirectoryTab === 'SIN_ASIGNAR'
              ? [quickDirectoryUnassignedGroup]
              : quickDirectoryGroups
          }
          onVerTodas={() => setFullDirectoryOpen(true)}
          onRowClick={setHistoryEmployee}
        />
        <AlertsCard
          sinAsignar={unassignedCount}
          snapshot={rosterSnapshot.length}
          sinEstacion={rosterSinEstacion.length}
          movimientos={movesToday}
          onClickSinAsignar={onGoToSinAsignar}
          onClickSnapshot={() => handleAlertClick('SNAPSHOT')}
          onClickSinEstacion={() => handleAlertClick('SIN_ESTACION')}
          onClickMovimientos={() => handleAlertClick('REGISTRADO')}
          onVerTodas={() => setFullRosterOpen(true)}
        />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[7fr_3fr]">
        <MovementsCompactCard onVerTodos={() => setFullMovementsOpen(true)} />
        <QuickActionsGrid
          onAsignar={() => (isSupervisor ? setRegisterOpen(true) : setSelfAssignOpen(true))}
          onMover={() => (isSupervisor ? setRegisterOpen(true) : setSelfAssignOpen(true))}
          onVerSinAsignar={onGoToSinAsignar}
          onVerLayout={onGoToAreas}
        />
      </div>

      {/* Dialog "Registro completo de hoy" -- MISMO contenido de siempre (busqueda + filtros +
          detalle de empleado + tabla completa), solo que ya no vive abierto por defecto. */}
      <Dialog open={fullRosterOpen} onOpenChange={setFullRosterOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-[1100px] flex-col overflow-y-auto p-6">
          <DialogTitle className="sr-only">{t('personalDeHoyTab.registroDeHoyTitle')}</DialogTitle>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground opacity-50" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('personalDeHoyTab.searchPlaceholder')}
                className="h-9 pl-9"
              />
            </div>
            <div className="min-w-[150px]">
              <Select value={areaFilter} onValueChange={setAreaFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t('personalDeHoyTab.areaPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">{t('personalDeHoyTab.todasLabel')}</SelectItem>
                  {WORK_CENTERS.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[130px]">
              <Select value={shiftFilter} onValueChange={setShiftFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t('personalDeHoyTab.turnoLabel')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">{t('personalDeHoyTab.todosLabel')}</SelectItem>
                  {SHIFT_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t('personalDeHoyTab.estadoLabel')} />
                </SelectTrigger>
                <SelectContent>
                  {estadoOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1" />
            <Button
              variant="outline"
              onClick={() => exportPersonalExcel(todayISO())}
              className="shrink-0 rounded-[20px] font-bold"
            >
              <Download className="h-4 w-4" />
              {t('personalDeHoyTab.exportButton')}
            </Button>
          </div>

          {query.trim() && (
            <div className={cn(cardClass, 'mt-4 p-5')}>
              {bestMatchDetail ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <p className="text-lg font-extrabold">
                      {t('personalDeHoyTab.employeeHeader', {
                        employeeNumber: bestMatchDetail.employee.employeeNumber,
                        name: bestMatchDetail.employee.name,
                      })}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setHistoryEmployee(bestMatchDetail.employee)}
                      className="font-bold"
                    >
                      <History className="h-4 w-4" />
                      {t('personalDeHoyTab.viewHistoryButton')}
                    </Button>
                  </div>
                  {bestMatchDetail.assignment ? (
                    <div className="flex flex-wrap gap-6 gap-y-3">
                      <InfoField
                        label={t('personalDeHoyTab.estadoLabel')}
                        value={t('personalDeHoyTab.presenteValue')}
                      />
                      <InfoField
                        label={t('personalDeHoyTab.ubicacionActualLabel')}
                        value={areaLabel(bestMatchDetail.assignment.areaId)}
                      />
                      <InfoField
                        label={t('personalDeHoyTab.rolActualLabel')}
                        value={bestMatchDetail.assignment.stationId}
                      />
                      <InfoField
                        label={t('personalDeHoyTab.entradaLabel')}
                        value={bestMatchDetail.assignment.checkInAt}
                      />
                      {bestMatchDetail.lastMove && (
                        <InfoField
                          label={t('personalDeHoyTab.ultimoMovimientoLabel')}
                          value={t('personalDeHoyTab.lastMoveValue', {
                            from: areaLabel(bestMatchDetail.lastMove.fromAreaId),
                            to: areaLabel(bestMatchDetail.lastMove.toAreaId),
                            movedAt: bestMatchDetail.lastMove.movedAt,
                          })}
                        />
                      )}
                    </div>
                  ) : (
                    <p className={emptyTextClass}>{t('personalDeHoyTab.noRegistradoHoy')}</p>
                  )}
                </div>
              ) : (
                <p className={emptyTextClass}>
                  {t('personalDeHoyTab.noEmployeeFoundForQuery', { query })}
                </p>
              )}
            </div>
          )}

          <RegistroDeHoyCard
            rows={visibleRoster}
            total={filteredRoster.length}
            allCount={roster.length}
            showAll={showAllRoster}
            onToggleShowAll={() => setShowAllRoster((v) => !v)}
            onRowClick={setHistoryEmployee}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={fullDirectoryOpen} onOpenChange={setFullDirectoryOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-[1100px] flex-col overflow-y-auto p-6">
          <DialogTitle className="sr-only">{t('personalDeHoyTab.directorioTitle')}</DialogTitle>
          <DirectorioCard
            tab={directoryTab}
            onTabChange={setDirectoryTab}
            withNumberCount={directoryWithNumber.length}
            proyectosCount={directoryProyectos.length}
            query={directoryQuery}
            onQueryChange={setDirectoryQuery}
            groups={directoryGroups}
            total={directoryList.length}
            onRowClick={setHistoryEmployee}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={fullMovementsOpen} onOpenChange={setFullMovementsOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-[1100px] flex-col overflow-y-auto p-6">
          <DialogTitle className="sr-only">
            {t('personalDeHoyTab.movimientosDelDiaTitle')}
          </DialogTitle>
          <MovimientosDelDiaCard />
        </DialogContent>
      </Dialog>

      <RegisterPersonnelDialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onDone={() => {}}
      />
      <SelfAssignDialog
        open={selfAssignOpen}
        onClose={() => setSelfAssignOpen(false)}
        onDone={() => {}}
      />
      <EmployeeHistoryDialog
        employee={historyEmployee}
        open={Boolean(historyEmployee)}
        onClose={() => setHistoryEmployee(null)}
        onChanged={() => {}}
      />
    </div>
  )
}

function InfoField({ label, value }) {
  return (
    <div>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-bold">{value}</p>
    </div>
  )
}

/* Card "Registro de hoy" -- misma tabla/datos que antes (pase de
   lista), ahora en una card con titulo propio, contador arriba a la
   derecha, altura controlada (ROSTER_PAGE_SIZE filas por defecto) y
   "Ver todos los registros" para expandir -- nunca fuerza scroll de
   cientos de filas para llegar al siguiente bloque. */
function RegistroDeHoyCard({ rows, total, allCount, showAll, onToggleShowAll, onRowClick }) {
  const { t } = useTranslation('centroTrabajo')
  return (
    <div className={cn(cardClass, 'mb-4')}>
      <div className={cn(cardHeaderClass, 'justify-between')}>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-[18px] w-[18px] text-muted-foreground" />
          <div>
            <p className={cardHeaderTitleClass}>{t('personalDeHoyTab.registroDeHoyTitle')}</p>
            <p className={cardHeaderSubtitleClass}>{t('personalDeHoyTab.registroDeHoySubtitle')}</p>
          </div>
        </div>
        <span className={cn(metricChipClass('info'), 'shrink-0')}>
          {t('personalDeHoyTab.registeredTodayChip', { count: allCount })}
        </span>
      </div>
      <div className={cn('overflow-x-auto', showAll && 'max-h-[480px] overflow-y-auto')}>
        <Table>
          <TableHeader className={showAll ? 'sticky top-0 z-10 bg-card' : undefined}>
            <TableRow className={tableHeaderRowClass}>
              <TableHead>{t('personalDeHoyTab.colEmpleado')}</TableHead>
              <TableHead>{t('personalDeHoyTab.colNombre')}</TableHead>
              <TableHead>{t('personalDeHoyTab.colAreaActual')}</TableHead>
              <TableHead>{t('personalDeHoyTab.colRol')}</TableHead>
              <TableHead>{t('personalDeHoyTab.entradaLabel')}</TableHead>
              <TableHead>{t('personalDeHoyTab.turnoLabel')}</TableHead>
              <TableHead>{t('personalDeHoyTab.estadoLabel')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, idx) => {
              // Areas fijas de soporte (Capacitacion, Team Leader, Soporte,
              // Limpieza, Gerente, Supervisor -- NUNCA Calidad, a peticion
              // explicita del usuario 2026-08-24): se muestran ya activas a
              // las 7am aunque nadie las haya registrado hoy a mano. Es
              // puramente visual -- no crea ningun checkin/asignacion real.
              const showAsAutoActive =
                r.source === 'SNAPSHOT' && AUTO_ACTIVE_AREAS.includes(r.areaId)
              const displayCheckIn = showAsAutoActive ? '07:00' : r.checkInAt || '—'
              return (
                <TableRow
                  key={r.id}
                  className={cn(tableRowClass(idx), 'cursor-pointer')}
                  onClick={() => onRowClick(r.employee)}
                >
                  <TableCell className={cn(cellTextClass, 'font-mono font-semibold')}>
                    {r.employeeNumber}
                  </TableCell>
                  <TableCell className={cellTextClass}>{r.employee?.name || '—'}</TableCell>
                  <TableCell className={cellTextSecondaryClass}>
                    {areaLabel(r.areaId) || '—'}
                  </TableCell>
                  <TableCell className={cellTextSecondaryClass}>
                    {r.stationId || t('personalDeHoyTab.sinEstacionLabel')}
                  </TableCell>
                  <TableCell className={cellTextSecondaryClass}>{displayCheckIn}</TableCell>
                  <TableCell className={cellTextSecondaryClass}>{r.shift || '—'}</TableCell>
                  <TableCell>
                    {r.source === 'SIN_ASIGNACION' ? (
                      <span className={statusChipClass('CANCELADA')}>
                        {t('personalDeHoyTab.sinAsignacionLabel')}
                      </span>
                    ) : r.source === 'SNAPSHOT' && !showAsAutoActive ? (
                      <span className={statusChipClass('PENDIENTE')}>
                        {t('personalDeHoyTab.porSnapshotLabel')}
                      </span>
                    ) : (
                      <span className={statusChipClass('COMPLETADA')}>
                        {t('personalDeHoyTab.registradoHoyLabel')}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState
                    compact
                    title={t('personalDeHoyTab.emptyFilterTitle')}
                    description={t('personalDeHoyTab.emptyFilterDescription')}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {total > 0 && (
        <div className="border-t border-border p-3 text-right">
          <Button variant="ghost" size="sm" onClick={onToggleShowAll} className="font-bold">
            {showAll
              ? t('personalDeHoyTab.viewLessButton')
              : t('personalDeHoyTab.viewAllRegistrationsButton', { count: total })}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

/* Card "Movimientos del día" (2026-09-02, a peticion explicita del usuario: "pon fecha y hora
   y quien esta moviendo al personal" -- surgio de una duda real sobre por que los conteos de
   Personal/Areas de trabajo/Asistencia no coincidian exactamente entre si en el mismo instante,
   y quien estaba haciendo los movimientos). Dato 100% real, nunca inventado: EmployeeMovement.
   movedByUserId es una columna obligatoria en el servidor (confirmado en schema.js), pero el
   store LOCAL (repository.js) nunca la conoce -- checkInEmployee/moveEmployee ahi siempre
   guardan movedBy: null (mismo comentario documentado en area-history.js, el endpoint hermano
   de este que ya existia para el historial de UNA area). api/personnel/movements-today.js es el
   mismo patron pero para TODA la planta en la fecha de hoy, ordenado por hora mas reciente
   primero. Se re-consulta cada vez que cambia `version` (usePersonnelVersion), igual que el
   resto de este archivo, para reflejar un movimiento nuevo (propio o de otro dispositivo/
   usuario) sin recargar la pagina. */
function MovimientosDelDiaCard() {
  const { t } = useTranslation('centroTrabajo')
  const version = usePersonnelVersion()
  const [state, setState] = useState({ loading: true, error: null, items: [] })

  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza re-fetch aunque no se lea en el callback (mismo patron en todo este folder)
  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    fetch('/api/personnel/movements-today', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`movements-today -> ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (!cancelled) setState({ loading: false, error: null, items: data.movements })
      })
      .catch((e) => {
        if (!cancelled) setState({ loading: false, error: e.message, items: [] })
      })
    return () => {
      cancelled = true
    }
  }, [version])

  const roleLabels = getRoleLabels()

  return (
    <div className={cn(cardClass, 'mb-4')}>
      <div className={cn(cardHeaderClass, 'justify-between')}>
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-[18px] w-[18px] text-muted-foreground" />
          <div>
            <p className={cardHeaderTitleClass}>{t('personalDeHoyTab.movimientosDelDiaTitle')}</p>
            <p className={cardHeaderSubtitleClass}>
              {t('personalDeHoyTab.movimientosDelDiaSubtitle')}
            </p>
          </div>
        </div>
        {!state.loading && !state.error && (
          <span className={cn(metricChipClass('info'), 'shrink-0')}>
            {t('personalDeHoyTab.movimientosDelDiaChip', { count: state.items.length })}
          </span>
        )}
      </div>
      <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className={tableHeaderRowClass}>
              <TableHead>{t('personalDeHoyTab.colFechaHora')}</TableHead>
              <TableHead>{t('personalDeHoyTab.colEmpleado')}</TableHead>
              <TableHead>{t('personalDeHoyTab.colNombre')}</TableHead>
              <TableHead>{t('personalDeHoyTab.colMovimiento')}</TableHead>
              <TableHead>{t('personalDeHoyTab.colRegistradoPor')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.items.map((m, idx) => (
              <TableRow key={m.id} className={tableRowClass(idx)}>
                <TableCell className={cellTextSecondaryClass}>
                  {dayjs(m.movedAt).format('DD/MM/YYYY HH:mm')}
                </TableCell>
                <TableCell className={cn(cellTextClass, 'font-mono font-semibold')}>
                  {m.employeeNumber}
                </TableCell>
                <TableCell className={cellTextClass}>{m.employeeName}</TableCell>
                <TableCell className={cellTextSecondaryClass}>
                  {m.action === 'ASSIGNED'
                    ? t('personalDeHoyTab.movementAssignedTo', { to: m.toAreaName })
                    : t('personalDeHoyTab.movementMovedTo', {
                        from: m.fromAreaName,
                        to: m.toAreaName,
                      })}
                </TableCell>
                <TableCell className={cellTextSecondaryClass}>
                  {m.byName ? (
                    <div>
                      <p className="font-medium text-foreground">{m.byName}</p>
                      {m.byRole && (
                        <p className="text-xs text-muted-foreground">
                          {roleLabels[m.byRole] || m.byRole}
                        </p>
                      )}
                    </div>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!state.loading && !state.error && state.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    compact
                    title={t('personalDeHoyTab.movimientosEmptyTitle')}
                    description={t('personalDeHoyTab.movimientosEmptyDescription')}
                  />
                </TableCell>
              </TableRow>
            )}
            {state.error && (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    compact
                    title={t('personalDeHoyTab.movimientosErrorTitle')}
                    description={state.error}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/* Card "Directorio completo de personal" -- mismas 2 tabs/datos de siempre (Con número de
   empleado / Proyectos). Rediseño 2026-09-03 (a peticion explicita del usuario: "sepáralos por
   áreas para que me sea más rápido ver si están duplicados o no y encontrar a la gente más
   rápido") -- en vez de una tabla larga truncada a N filas, se agrupa por área (mismo orden que
   el board de Área operando, ver groupDirectoryByArea arriba) para que dos nombres parecidos en
   la MISMA área salten a la vista de inmediato. Se quita el corte de paginacion (los totales
   reales, ~80-140 personas, caben perfectamente en un scroll normal ya organizado por seccion). */
function DirectorioCard({
  tab,
  onTabChange,
  withNumberCount,
  proyectosCount,
  query,
  onQueryChange,
  groups,
  total,
  onRowClick,
}) {
  const { t } = useTranslation('centroTrabajo')
  return (
    <div className={cn(cardClass, 'mb-4')}>
      <div className={cardHeaderClass}>
        <Contact className="h-[18px] w-[18px] text-muted-foreground" />
        <div>
          <p className={cardHeaderTitleClass}>{t('personalDeHoyTab.directorioTitle')}</p>
          <p className={cardHeaderSubtitleClass}>{t('personalDeHoyTab.directorioSubtitle')}</p>
        </div>
      </div>
      <div className="px-5 pt-4">
        <Tabs value={tab} onValueChange={onTabChange}>
          <TabsList>
            <TabsTrigger value="CON_NUMERO">
              {t('personalDeHoyTab.withNumberTab', { count: withNumberCount })}
            </TabsTrigger>
            <TabsTrigger value="PROYECTOS">
              {t('personalDeHoyTab.projectsTab', { count: proyectosCount })}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="px-5 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground opacity-50" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t('personalDeHoyTab.directorySearchPlaceholder')}
            className="h-9 w-full pl-9"
          />
        </div>
      </div>
      <div className="mt-2 max-h-[640px] overflow-y-auto overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className={tableHeaderRowClass}>
              <TableHead>{t('personalDeHoyTab.colEmpleado')}</TableHead>
              <TableHead>{t('personalDeHoyTab.colNombre')}</TableHead>
              <TableHead>{t('personalDeHoyTab.colFechaIngreso')}</TableHead>
              {tab === 'PROYECTOS' && <TableHead>{t('personalDeHoyTab.colTipo')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => (
              <Fragment key={g.areaId || '__SIN_AREA__'}>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableCell colSpan={tab === 'PROYECTOS' ? 4 : 3} className="py-1.5">
                    <span className="text-[11.5px] font-extrabold uppercase tracking-[0.4px] text-muted-foreground">
                      {g.label}
                    </span>
                    <span className="ml-2 text-[11px] font-semibold text-muted-foreground/70">
                      {t('personalDeHoyTab.directoryGroupCount', { count: g.members.length })}
                    </span>
                  </TableCell>
                </TableRow>
                {g.members.map((e, idx) => (
                  <TableRow
                    key={e.id}
                    className={cn(tableRowClass(idx), 'cursor-pointer')}
                    onClick={() => onRowClick(e)}
                  >
                    <TableCell className={cn(cellTextClass, 'font-mono font-semibold')}>
                      {hasRealNumber(e.employeeNumber) ? e.employeeNumber : '—'}
                    </TableCell>
                    <TableCell className={cellTextClass}>{e.name}</TableCell>
                    <TableCell className={cellTextSecondaryClass}>
                      {e.fechaIngreso || '—'}
                    </TableCell>
                    {tab === 'PROYECTOS' && (
                      <TableCell>
                        <span className={statusChipClass('PENDIENTE')}>
                          {e.employeeNumber === 'PROYECTO'
                            ? t('personalDeHoyTab.registeredAsProject')
                            : t('personalDeHoyTab.sinNumeroConfirmado')}
                        </span>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </Fragment>
            ))}
            {total === 0 && (
              <TableRow>
                <TableCell colSpan={tab === 'PROYECTOS' ? 4 : 3}>
                  <EmptyState
                    compact
                    title={t('personalDeHoyTab.emptyDirectoryTitle')}
                    description={t('personalDeHoyTab.emptyDirectoryDescription')}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

const ESTADO_GENERAL_COLORS = {
  presentes: '#10B981',
  tardias: '#F59E0B',
  faltas: '#EF4444',
  pendientes: '#CBD5E1',
}

/* Columna 1/3 -- "Estado general del día" (2026-09-03, mockup exacto proporcionado por el
   usuario). Dona de recharts (mismo patron ya usado en CoverageDonutCard/AreaStatusDonutCard,
   dashboard/charts/) con 4 segmentos de color FIJO (nunca colorForIndex, aqui el color tiene
   significado semantico real: verde=presente, naranja=tardanza, rojo=falta, gris=pendiente).
   Tardías/Faltas usan Attendance.status='RETARDO'/'AUSENTE' -- consultas reales que hoy siempre
   dan 0 porque ningun flujo del sistema las escribe todavia (ver comentario grande en el
   componente padre) -- se muestran tal cual, nunca se inventa un numero distinto de 0. */
function EstadoGeneralCard({ estado }) {
  const { t } = useTranslation('centroTrabajo')
  const rows = [
    { key: 'presentes', label: t('personalDeHoyTab.presentesLabel'), value: estado.presentes },
    { key: 'tardias', label: t('personalDeHoyTab.tardiasLabel'), value: estado.tardias },
    { key: 'faltas', label: t('personalDeHoyTab.faltasLabel'), value: estado.faltas },
    { key: 'pendientes', label: t('personalDeHoyTab.pendientesLabel'), value: estado.pendientes },
  ]
  const chartData = rows
    .filter((r) => r.value > 0)
    .map((r) => ({ ...r, color: ESTADO_GENERAL_COLORS[r.key] }))
  const inicioJornada = dayjs(`2000-01-01T${DEFAULT_LINE_ENTRY_TIME}`).format('hh:mm A')

  return (
    <div className={cn(cardClass, 'flex flex-col')}>
      <div className={cardHeaderClass}>
        <div>
          <p className={cardHeaderTitleClass}>{t('personalDeHoyTab.estadoGeneralTitle')}</p>
          <p className={cardHeaderSubtitleClass}>{t('personalDeHoyTab.estadoGeneralSubtitle')}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex flex-1 flex-row items-center gap-3">
          <div className="relative h-[150px] w-[150px] shrink-0">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="label"
                    innerRadius="66%"
                    outerRadius="94%"
                    paddingAngle={1.5}
                    stroke="none"
                  >
                    {chartData.map((row) => (
                      <Cell key={row.key} fill={row.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value, name) => [value, name]}
                    contentStyle={{ borderRadius: 12, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full w-full place-items-center rounded-full border-[10px] border-black/[.04] dark:border-white/[.06]" />
            )}
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <p className="text-2xl font-extrabold leading-none">{estado.total}</p>
              <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
                {t('personalDeHoyTab.totalRegistradoLabel')}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            {rows.map((r) => {
              const pct = estado.total > 0 ? (r.value / estado.total) * 100 : 0
              return (
                <div key={r.key} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: ESTADO_GENERAL_COLORS[r.key] }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-muted-foreground">
                    {r.label}
                  </span>
                  <span className="shrink-0 text-sm font-extrabold">{r.value}</span>
                  <span className="w-11 shrink-0 text-right text-[10.5px] font-semibold text-muted-foreground">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex divide-x divide-border rounded-xl bg-black/[.02] dark:bg-white/[.03]">
          <div className="flex flex-1 items-center gap-2 px-3 py-2.5">
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-muted-foreground">
                {t('personalDeHoyTab.inicioJornadaLabel')}
              </p>
              <p className="text-[12.5px] font-bold">{inicioJornada}</p>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-2 px-3 py-2.5">
            <Flag className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-muted-foreground">
                {t('personalDeHoyTab.corteFaltasLabel')}
              </p>
              <p className="text-[12.5px] font-bold text-muted-foreground">
                {t('personalDeHoyTab.corteFaltasNoConfigurado')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* Columna 2/3 -- "Directorio rápido de personal" (2026-09-03, mockup exacto). Reemplaza
   visualmente la tabla gigante -- MISMOS datos del roster efectivo de siempre (nunca una
   poblacion nueva), agrupados por área con avatares neutrales (iniciales, nunca fotos). "Ver
   todas las áreas" abre el Directorio completo real (DirectorioCard, sin cambios) en un Dialog --
   ninguna funcionalidad se pierde, solo deja de ocupar toda la pantalla por defecto. */
function QuickDirectoryCard({ tab, onTabChange, groups, onVerTodas, onRowClick }) {
  const { t } = useTranslation('centroTrabajo')
  const visibleGroups = groups.slice(0, AREA_SUMMARY_TOP_N)
  const emptyKey =
    tab === 'PROYECTO'
      ? 'quickDirectoryEmptyProyecto'
      : tab === 'SIN_ASIGNAR'
        ? 'quickDirectoryEmptySinAsignar'
        : 'quickDirectoryEmptyArea'
  return (
    <div className={cn(cardClass, 'flex flex-col')}>
      <div className={cardHeaderClass}>
        <div>
          <p className={cardHeaderTitleClass}>{t('personalDeHoyTab.directorioRapidoTitle')}</p>
          <p className={cardHeaderSubtitleClass}>
            {t('personalDeHoyTab.directorioRapidoSubtitle')}
          </p>
        </div>
      </div>
      <div className="px-4 pt-3">
        <Tabs value={tab} onValueChange={onTabChange}>
          <TabsList>
            <TabsTrigger value="AREA">{t('personalDeHoyTab.tabPorArea')}</TabsTrigger>
            <TabsTrigger value="PROYECTO">{t('personalDeHoyTab.tabPorProyecto')}</TabsTrigger>
            <TabsTrigger value="SIN_ASIGNAR">{t('personalDeHoyTab.tabSinAsignar')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {visibleGroups.length === 0 || visibleGroups.every((g) => g.members.length === 0) ? (
          <p className={emptyTextClass}>{t(`personalDeHoyTab.${emptyKey}`)}</p>
        ) : (
          visibleGroups
            .filter((g) => g.members.length > 0)
            .map((g) => {
              const shown = g.members.slice(0, 5)
              const extra = g.members.length - shown.length
              return (
                <button
                  type="button"
                  key={g.areaId || '__SIN_AREA__'}
                  onClick={() => onRowClick(g.members[0]?.employee || null)}
                  className="flex items-center justify-between gap-3 rounded-xl p-2.5 text-left hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold">{g.label}</p>
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {t('personalDeHoyTab.personasCountLabel', { count: g.members.length })}
                    </p>
                    <div className="mt-1.5 flex items-center">
                      {shown.map((m, idx) => (
                        <span
                          key={m.id}
                          className="-ml-1.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-card bg-muted text-[9px] font-bold text-muted-foreground first:ml-0"
                          style={{ zIndex: shown.length - idx }}
                        >
                          {initials(m.employee?.name)}
                        </span>
                      ))}
                      {extra > 0 && (
                        <span className="-ml-1.5 text-[10.5px] font-bold text-muted-foreground">
                          +{extra}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xl font-extrabold leading-none">{g.members.length}</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                      {t('personalDeHoyTab.presentesColLabel')}
                    </p>
                  </div>
                </button>
              )
            })
        )}
      </div>
      <div className="border-t border-border p-3 text-right">
        <Button variant="ghost" size="sm" onClick={onVerTodas} className="font-bold">
          {t('personalDeHoyTab.verTodasAreasButton')}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/* Columna 3/3 -- "Alertas y pendientes" (2026-09-03, mockup exacto, restylo visual de la
   AlertasCard anterior -- MISMOS 4 conteos reales/handlers de siempre, nunca inventa un numero).
   "Ver todas las alertas" abre el Registro de hoy completo (mismo Dialog que cada fila ya abre
   individualmente, solo que sin preseleccionar un Estado). */
function AlertsCard({
  sinEstacion,
  snapshot,
  movimientos,
  sinAsignar,
  onClickSinEstacion,
  onClickSnapshot,
  onClickMovimientos,
  onClickSinAsignar,
  onVerTodas,
}) {
  const { t } = useTranslation('centroTrabajo')
  const rows = [
    {
      key: 'sinAsignar',
      icon: UserX,
      label: t('personalDeHoyTab.alertSinAsignarLabel'),
      value: sinAsignar,
      onClick: onClickSinAsignar,
      color: '#EF4444',
    },
    {
      key: 'snapshot',
      icon: CalendarDays,
      label: t('personalDeHoyTab.alertSnapshotLabel'),
      value: snapshot,
      onClick: onClickSnapshot,
      color: '#F59E0B',
    },
    {
      key: 'sinEstacion',
      icon: TriangleAlert,
      label: t('personalDeHoyTab.alertSinEstacionLabel'),
      value: sinEstacion,
      onClick: onClickSinEstacion,
      color: '#F59E0B',
    },
    {
      key: 'movimientos',
      icon: ArrowLeftRight,
      label: t('personalDeHoyTab.alertMovimientosLabel'),
      value: movimientos,
      onClick: onClickMovimientos,
      color: '#3B82F6',
    },
  ]
  return (
    <div className={cn(cardClass, 'flex flex-col')}>
      <div className={cardHeaderClass}>
        <div>
          <p className={cardHeaderTitleClass}>{t('personalDeHoyTab.alertasYPendientesTitle')}</p>
          <p className={cardHeaderSubtitleClass}>
            {t('personalDeHoyTab.alertasYPendientesSubtitle')}
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {rows.map((row) => (
          <button
            type="button"
            key={row.key}
            onClick={row.onClick}
            disabled={!row.onClick}
            className="flex items-center gap-2.5 rounded-xl p-2.5 text-left hover:bg-accent disabled:cursor-default disabled:opacity-60"
          >
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
              style={{ backgroundColor: hexToRgba(row.color, 0.14), color: row.color }}
            >
              <row.icon className="h-[16px] w-[16px]" />
            </span>
            <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-muted-foreground">
              {row.label}
            </span>
            <span className="shrink-0 text-base font-extrabold" style={{ color: row.color }}>
              {row.value}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
          </button>
        ))}
      </div>
      <div className="border-t border-border p-3 text-right">
        <Button variant="ghost" size="sm" onClick={onVerTodas} className="font-bold">
          {t('personalDeHoyTab.verTodasAlertasButton')}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/* Fila 2, columna ancha (~70%) -- "Movimientos del día" compacto (2026-09-03, mockup exacto):
   solo los ultimos 5, con badge de tipo (Asignación/Traslado/Cambio de rol -- ver
   movementBadgeInfo arriba, los 3 son reales/derivados, nunca inventados). "Ver todos (N)" abre
   la tabla completa (MovimientosDelDiaCard, sin cambios) en un Dialog. */
function MovementsCompactCard({ onVerTodos }) {
  const { t } = useTranslation('centroTrabajo')
  const version = usePersonnelVersion()
  const [state, setState] = useState({ loading: true, error: null, items: [] })

  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza re-fetch aunque no se lea en el callback (mismo patron en todo este folder)
  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    fetch('/api/personnel/movements-today?limit=5', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`movements-today -> ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (!cancelled) setState({ loading: false, error: null, items: data.movements })
      })
      .catch((e) => {
        if (!cancelled) setState({ loading: false, error: e.message, items: [] })
      })
    return () => {
      cancelled = true
    }
  }, [version])

  return (
    <div className={cn(cardClass, 'flex flex-col')}>
      <div className={cn(cardHeaderClass, 'justify-between')}>
        <div>
          <p className={cardHeaderTitleClass}>{t('personalDeHoyTab.movimientosDelDiaTitle')}</p>
          <p className={cardHeaderSubtitleClass}>
            {t('personalDeHoyTab.movimientosCompactSubtitle')}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onVerTodos} className="shrink-0 font-bold">
          {t('personalDeHoyTab.verTodosMovimientosButton', { count: state.items.length })}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className={tableHeaderRowClass}>
              <TableHead>{t('personalDeHoyTab.colHora')}</TableHead>
              <TableHead>{t('personalDeHoyTab.colEmpleado')}</TableHead>
              <TableHead>{t('personalDeHoyTab.colMovimiento')}</TableHead>
              <TableHead>{t('personalDeHoyTab.colDetalle')}</TableHead>
              <TableHead>{t('personalDeHoyTab.colRegistradoPor')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.items.map((m, idx) => {
              const badge = movementBadgeInfo(m, t)
              return (
                <TableRow key={m.id} className={tableRowClass(idx)}>
                  <TableCell className={cellTextSecondaryClass}>
                    {dayjs(m.movedAt).format('HH:mm')}
                  </TableCell>
                  <TableCell className={cellTextClass}>
                    <span className="font-mono font-semibold">{m.employeeNumber}</span>
                    <span className="block text-[11.5px] font-normal text-muted-foreground">
                      {m.employeeName}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={metricChipClass(badge.tone)}>{badge.label}</span>
                  </TableCell>
                  <TableCell className={cellTextSecondaryClass}>{badge.detail}</TableCell>
                  <TableCell className={cellTextSecondaryClass}>{m.byName || '—'}</TableCell>
                </TableRow>
              )
            })}
            {!state.loading && !state.error && state.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    compact
                    title={t('personalDeHoyTab.movimientosEmptyTitle')}
                    description={t('personalDeHoyTab.movimientosEmptyDescription')}
                  />
                </TableCell>
              </TableRow>
            )}
            {state.error && (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    compact
                    title={t('personalDeHoyTab.movimientosErrorTitle')}
                    description={state.error}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/* Fila 2, columna angosta (~30%) -- "Acciones rápidas" (2026-09-03, mockup exacto): grid 2x2,
   fondo de color extremadamente suave por accion (azul/verde/rojo/violeta, tal como pide el
   mockup). Asignar a línea / Mover personal reutilizan el mismo RegisterPersonnelDialog de
   siempre; "Ver sin asignar" (reemplaza a "Ver bajas" en esta grilla especifica, a peticion
   explicita del mockup) reutiliza onGoToSinAsignar ya existente; Ver layout general solo cambia
   de pestaña. Bajas sigue disponible desde su propia pestaña de Centro de Trabajo, no desaparece
   del sistema, solo de esta grilla puntual. */
function QuickActionsGrid({ onAsignar, onMover, onVerSinAsignar, onVerLayout }) {
  const { t } = useTranslation('centroTrabajo')
  const actions = [
    {
      label: t('personalDeHoyTab.asignarLineaAction'),
      desc: t('personalDeHoyTab.asignarLineaActionDesc'),
      icon: UserPlus,
      color: '#3B82F6',
      onClick: onAsignar,
    },
    {
      label: t('personalDeHoyTab.moverPersonalAction'),
      desc: t('personalDeHoyTab.moverPersonalActionDesc'),
      icon: ArrowLeftRight,
      color: '#10B981',
      onClick: onMover,
    },
    {
      label: t('personalDeHoyTab.verSinAsignarAction'),
      desc: t('personalDeHoyTab.verSinAsignarActionDesc'),
      icon: UserCheck,
      color: '#EF4444',
      onClick: onVerSinAsignar,
    },
    {
      label: t('personalDeHoyTab.verLayoutAction'),
      desc: t('personalDeHoyTab.verLayoutActionDesc'),
      icon: LayoutGrid,
      color: '#8B5CF6',
      onClick: onVerLayout,
    },
  ]
  return (
    <div className={cardClass}>
      <div className={cardHeaderClass}>
        <div>
          <p className={cardHeaderTitleClass}>{t('personalDeHoyTab.accionesRapidasTitle')}</p>
          <p className={cardHeaderSubtitleClass}>
            {t('personalDeHoyTab.accionesRapidasSubtitleNew')}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 p-3">
        {actions.map((a) => (
          <button
            type="button"
            key={a.label}
            onClick={a.onClick}
            disabled={!a.onClick}
            className="flex flex-col items-start gap-1.5 rounded-xl border border-border p-3 text-left transition-all duration-150 hover:-translate-y-px disabled:cursor-default"
            style={{ backgroundColor: hexToRgba(a.color, 0.05) }}
          >
            <span
              className="grid h-8 w-8 place-items-center rounded-full"
              style={{ backgroundColor: hexToRgba(a.color, 0.16), color: a.color }}
            >
              <a.icon className="h-[17px] w-[17px]" />
            </span>
            <p className="text-[12.5px] font-bold leading-[1.2]">{a.label}</p>
            <p className="text-[10.5px] font-medium leading-[1.2] text-muted-foreground">
              {a.desc}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
