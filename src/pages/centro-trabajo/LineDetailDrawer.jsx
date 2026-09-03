import dayjs from 'dayjs'
import {
  ArrowLeft,
  ArrowLeftRight,
  Hand,
  History,
  Moon,
  Settings,
  Sun,
  UserPlus,
  UserSearch,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
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
  kpiCardClass,
  progressBarClass,
  sectionTitleClass,
  statusChipClass,
  tableHeaderRowClass,
  tableRowClass,
} from '@/lib/pageStyles'
import { cn, hexToRgba } from '@/lib/utils'
import { formatEmployeeNumber } from '../../data/personnel/employeeDisplay'
import { fetchLineStationConfig } from '../../data/personnel/lineStationConfig'
import {
  getLineVisualTypeOrder,
  getLineVisualTypes,
  getPersonnelVisualType,
} from '../../data/personnel/lineVisualType'
import {
  checkInEmployee,
  getLineWorkstationsWithOccupancy,
  getSuggestedCandidates,
  reconcileLineAssignments,
} from '../../data/personnel/repository'
import { usePersonnelVersion } from '../../data/personnel/usePersonnelVersion'
import {
  CURRENT_SHIFT,
  canonicalOperationalAreaId,
  getCurrentShift,
  getTaktTime,
  LINE_FAMILY_AREA_IDS,
  operationalGroupMembers,
  workCenterById,
} from '../../data/production/catalog'
import {
  classifyAreaStatus,
  getActividadForEmployee,
  getAreaHeadcount,
  getAreaStatusMeta,
  getEffectiveTodayRoster,
  getGroupAreaStaffing,
  getGroupPeople,
  getPeopleWithoutStation,
} from '../../data/production/personnelByArea'
import { useAuth } from '../../state/auth'
import { useDndAssign } from '../../state/dndAssign'
import { useRoleMode } from '../../state/roleMode'
import { EmptyState } from '../../ui'
import DraggablePersonChip from '../../ui/DraggablePersonChip'
import { useEmployeeDropTarget } from '../../ui/dnd'
import AssignedPersonChip from './AssignedPersonChip'
import AvailablePersonnelTray from './AvailablePersonnelTray'
import EmployeeAssignSearchBar from './EmployeeAssignSearchBar'
import EmployeeAvatar from './EmployeeAvatar'
import EmployeeHistoryDialog from './EmployeeHistoryDialog'
import LineHistoryDialog from './LineHistoryDialog'
import LineProcessFlow from './LineProcessFlow'
import LineStationConfigDrawer from './LineStationConfigDrawer'
import { LineTypeIcon } from './LineVisualLegend'
import MoveConfirmDialog from './MoveConfirmDialog'
import RegisterPersonnelDialog from './RegisterPersonnelDialog'
import SelfAssignDialog from './SelfAssignDialog'
import SuggestedEmployeeCard from './SuggestedEmployeeCard'
import WorkCenterNavControls from './WorkCenterNavControls'

/* ─────────────────────────────────────────────
   Tablero operativo de estaciones, EXCLUSIVO de WC LINEA 0-10
   (2026-08-28, "REDISEÑO DE WC LINEA 0 A WC LINEA 10", a peticion
   explicita del usuario). Este componente ya no es compartido: desde el
   rediseño anterior de LINE_LIKE (Paletizado/Accesorios/Insumos/Midea/
   Conveyor), AreaDetail.jsx solo lo invoca para la variante LINE -- por
   eso se edita directamente aqui, con identidad visual PROPIA (nunca la
   de Paletizado): TIPO DE PERSONAL (lineVisualType.js/LineVisualLegend.jsx)
   separado de ESTADO DE ESTACION. Rama "vista simple" (DropZoneBanner) se
   conserva tal cual, solo por defensividad (ver getAreaDetailVariant,
   catalog.js).

   2026-08-31 (a peticion explicita del usuario, foto de pizarron fisico):
   "Distribución de estaciones" (antes una cuadricula de LineWorkstationCard
   con drag&drop para asignar personal puesto por puesto -- ese archivo se
   elimino, sin otro consumidor) se reemplaza por LineProcessFlow.jsx, un
   diagrama de flujo ESTATICO (mismo para las 11 lineas, no depende de
   personal/ocupacion) que al hacer click en un nodo abre una ventana
   flotante de 2 pasos ("Hoja de Proceso" / "Planos por puesto") con
   contenido placeholder -- el usuario confirmo explicitamente que la
   asignacion por puesto especifico ya no hace falta desde aqui (se sigue
   asignando a la linea en general desde el layout). `selectedStation`
   (sidebar derecho) ya no se puede elegir manualmente sin ese grid --
   sigue mostrando su fallback de siempre (primera disponible o primera
   estacion), efecto aceptado de este cambio.

   Fase 6c (Centro de Trabajo): portado de MUI a Tailwind. Es el archivo
   mas grande del repo -- reutiliza integramente toda la logica de
   datos/acciones sin tocar, solo cambia la capa de presentacion. */

/* Zona de "soltar aqui" generica -- solo se usa hoy en el caso
   defensivo (area futura sin estaciones que cayera aqui por
   clasificacion por defecto, ver getAreaDetailVariant, catalog.js). */
function DropZoneBanner({ areaId, label }) {
  const { t } = useTranslation('centroTrabajo')
  const { isOver, dropProps } = useEmployeeDropTarget(areaId)
  return (
    <div
      {...dropProps}
      className={cn(
        'flex min-h-[64px] items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed transition-all duration-150',
        isOver ? 'border-[#3B82F6] bg-[#3B82F6]/[0.08] dark:bg-[#3B82F6]/[0.18]' : 'border-border',
      )}
    >
      <Hand
        className={cn('h-[18px] w-[18px]', isOver ? 'text-[#3B82F6]' : 'text-muted-foreground/60')}
      />
      <p
        className={cn(
          'text-[12.5px] font-bold',
          isOver ? 'text-[#3B82F6]' : 'text-muted-foreground',
        )}
      >
        {isOver
          ? t('lineDetailDrawer.dropToAssignLabel', { label })
          : t('lineDetailDrawer.dragEmployeesHereLabel', { label })}
      </p>
    </div>
  )
}

/* "07:00" -> "07:00 AM" -- solo para mostrar el horario real del
   turno oficial (OFFICIAL_SHIFTS, catalog.js); el resto del sistema
   sigue guardando/mostrando horas en 24h ("HH:mm") tal cual. */
function formatHour12(hhmm) {
  return dayjs(`2000-01-01 ${hhmm}`, 'YYYY-MM-DD HH:mm').format('hh:mm A')
}

export default function LineDetailDrawer({
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
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMINISTRADOR'
  const dnd = useDndAssign()

  const [registerOpen, setRegisterOpen] = useState(false)
  const [selfAssignOpen, setSelfAssignOpen] = useState(false)
  const [lineHistoryOpen, setLineHistoryOpen] = useState(false)
  const [historyEmployee, setHistoryEmployee] = useState(null)
  const [moveTarget, setMoveTarget] = useState(null) // { employee, currentAssignment, presetTo }
  const [selectedStationName, setSelectedStationName] = useState(null)
  const [includeAbsent, setIncludeAbsent] = useState(false)
  const [actionError, setActionError] = useState('')
  /* "estaciones configurables por ADMINISTRADOR" (2026-08-27): configLoaded
     solo se pone en true si la configuracion real (DB) de esta linea ya se
     cargo -- mientras tanto, aunque isAdmin sea true, no se muestran
     controles de editar/eliminar (workstation.id todavia seria el id
     sintetico del generador JS, no un cuid real de Workstation -- ver
     lineStationConfig.js/workstations.js). configVersion fuerza a
     `workstations` a releerse tras cualquier alta/edicion/baja/reorden. */
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false)
  const [editStationId, setEditStationId] = useState(null)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [configVersion, setConfigVersion] = useState(0)

  /* Reinicio de estado transitorio al cambiar de Work Center (Anterior/
     Siguiente) -- el Dialog no se desmonta entre lineas (workCenterId
     cambia con el mismo `open`), asi que sin esto quedaria la estacion/
     dialogo/error de la linea anterior. */
  // biome-ignore lint/correctness/useExhaustiveDependencies: ver comentario arriba
  useEffect(() => {
    setRegisterOpen(false)
    setSelfAssignOpen(false)
    setLineHistoryOpen(false)
    setHistoryEmployee(null)
    setMoveTarget(null)
    setSelectedStationName(null)
    setIncludeAbsent(false)
    setActionError('')
    setConfigDrawerOpen(false)
    setEditStationId(null)
    setConfigLoaded(false)
  }, [workCenterId])

  const isLine = workCenterId ? LINE_FAMILY_AREA_IDS.has(workCenterId) : false
  // isStationBased: true para toda WC LINEA real. false solo en el caso
  // defensivo (area futura sin clasificar que cayera aqui por defecto,
  // ver getAreaDetailVariant en catalog.js) -- ahi se usa la rama
  // "vista simple" de abajo, nunca "Distribución de estaciones".
  const isStationBased = isLine
  const canonicalId = workCenterId ? canonicalOperationalAreaId(workCenterId) : null
  const memberIds = workCenterId ? operationalGroupMembers(workCenterId) : []
  const area = canonicalId ? workCenterById(canonicalId) : null
  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza recalcular aunque no se lea en el callback (mismo patron en todo este folder)
  const staffing = useMemo(
    () => (memberIds.length ? getGroupAreaStaffing(memberIds) : null),
    [workCenterId, version],
  )
  const areaStatusKey =
    staffing?.ideal != null ? classifyAreaStatus(staffing.real, staffing.ideal) : null
  const areaStatusMeta = areaStatusKey ? getAreaStatusMeta()[areaStatusKey] : null
  const coveragePct = staffing?.ideal ? Math.round((staffing.real / staffing.ideal) * 100) : null
  const currentOfficialShift = getCurrentShift()
  const ShiftIcon = currentOfficialShift.id === 'NOCHE' ? Moon : Sun
  // activeLineCount (2026-09-03, a peticion explicita del usuario -- "una linea no puede sacar
  // las 1500, es imposible"): cuantas de las 11 lineas FFT (LINEA1..10 + PROYECTO/"WC LINEA 0")
  // tienen al menos una persona real asignada hoy -- la meta de planta (1500/500) se reparte entre
  // ellas para el Takt Time teorico de ESTA linea (ver getTaktTime, catalog.js). Se recalcula con
  // `version` (mismo patron de todo este archivo) porque cambia en vivo con cada movimiento real.
  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza recalcular aunque no se lea en el callback
  const activeLineCount = useMemo(
    () => [...LINE_FAMILY_AREA_IDS].filter((id) => getAreaHeadcount(id) > 0).length,
    [version],
  )
  const taktTime = getTaktTime(currentOfficialShift, activeLineCount)
  // biome-ignore lint/correctness/useExhaustiveDependencies: version/configVersion fuerzan recalcular aunque no se lean en el callback (mismo patron en todo este folder)
  const workstations = useMemo(
    () => (canonicalId ? getLineWorkstationsWithOccupancy(canonicalId) : []),
    [canonicalId, version, configVersion],
  )
  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza recalcular aunque no se lea en el callback (mismo patron en todo este folder)
  const people = useMemo(
    () => (memberIds.length ? getGroupPeople(memberIds) : []),
    [workCenterId, version],
  )

  /* Carga la configuracion real de puestos de esta linea (DB, ver
     lineStationConfig.js) al abrir -- mientras no llegue, `workstations`
     sigue viniendo del generador JS de siempre (comportamiento identico).
     configLoaded solo se activa si la respuesta trajo filas reales, para
     no exponer edicion/eliminacion contra ids sinteticos (ver comentario
     junto al estado arriba). */
  useEffect(() => {
    if (!open || !isStationBased || !canonicalId) {
      setConfigLoaded(false)
      return
    }
    let cancelled = false
    setConfigLoaded(false)
    fetchLineStationConfig(canonicalId).then((rows) => {
      if (cancelled) return
      setConfigLoaded(Boolean(rows?.length))
      setConfigVersion((v) => v + 1)
    })
    return () => {
      cancelled = true
    }
  }, [canonicalId, isStationBased, open])

  function handleStationConfigChanged() {
    setConfigVersion((v) => v + 1)
  }

  /* Piezas REALES de hoy por linea (2026-09-02, a peticion explicita del usuario: "puedes poner
     las piezas que se estan produciendo por linea") -- complementa el Takt Time TEORICO de arriba
     (meta fija/duracion de turno) sin reemplazarlo. Fuente: api/production/takt-real.js, que cruza
     BinManager/SmartControl (quien inspecciono cuantas piezas hoy) con quien esta asignado HOY a
     cada linea en esta app, por NOMBRE (nunca hay un id compartido entre los 2 sistemas) -- ver el
     comentario de ese endpoint. Un solo fetch trae TODAS las lineas (nunca uno por linea abierta);
     best-effort: si SmartControl no responde o no esta configurado, `realTakt` queda null y esta
     card simplemente no aparece, el Takt Time teorico sigue mostrandose igual que siempre. */
  const [realTaktByLine, setRealTaktByLine] = useState({})
  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza re-fetch aunque no se lea en el callback (mismo patron en todo este folder)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch('/api/production/takt-real', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.byLine) setRealTaktByLine(data.byLine)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, version])
  const realTaktForLine = canonicalId ? realTaktByLine[canonicalId] : null
  const realTakt =
    realTaktForLine && taktTime
      ? {
          realPieces: realTaktForLine.realPieces,
          secondsPerUnit: taktTime.durationSeconds / realTaktForLine.realPieces,
        }
      : null

  /* Agrupacion por categoria -- usada SOLO por "Resumen de la linea" (sidebar,
     ver lineSummary abajo). La cuadricula principal ("Distribución de
     estaciones") NO se separa en secciones (a peticion explicita del
     usuario, 2026-08-27: "quiero que las estaciones esten juntas, todas
     del mismo tamaño") -- se renderiza como una sola grilla plana con
     `workstations` tal cual, cada card ya muestra su categoria
     explicitamente (icono+etiqueta, LineWorkstationCard.jsx). La
     categoria es una propiedad de la ESTACION (workstation.category, o el
     respaldo por rol/actividad de getPersonnelVisualType), nunca del
     ocupante -- por eso se calcula incluso para estaciones vacias. */
  const stationCategories = useMemo(() => {
    const leadership = []
    const byCategory = new Map()
    workstations.forEach((w) => {
      const occupant = w.occupants[0]
      const actividad = occupant?.employee?.id
        ? getActividadForEmployee(occupant.employee.id)
        : null
      const vt = getPersonnelVisualType({ stationRole: w.role, actividad, category: w.category })
      if (vt?.key === 'LIDERAZGO') {
        leadership.push(w)
        return
      }
      const key = vt?.key || '__SIN_CLASIFICAR__'
      const label = vt?.label || t('lineDetailDrawer.otherStationsLabel')
      const color = vt?.color || '#94A3B8'
      if (!byCategory.has(key)) byCategory.set(key, { key, label, color, stations: [] })
      byCategory.get(key).stations.push(w)
    })
    const groups = getLineVisualTypeOrder()
      .filter((vt2) => vt2.key !== 'LIDERAZGO')
      .map((vt2) => byCategory.get(vt2.key))
      .filter(Boolean)
    if (byCategory.has('__SIN_CLASIFICAR__')) groups.push(byCategory.get('__SIN_CLASIFICAR__'))
    return { leadership, groups }
  }, [workstations, t])

  /* Resumen de la linea (Seccion 13/14 del pedido) -- conteos por
     categoria, calculados dinamicamente de las estaciones reales, nunca
     guardados aparte. Total/faltan siguen viniendo de `staffing`
     (getGroupAreaStaffing, SIN recalcular -- Decision D3 del plan: la
     dotacion ideal no cambia de fuente). */
  const lineSummary = useMemo(() => {
    const leadershipGroup = stationCategories.leadership.length
      ? {
          key: 'LIDERAZGO',
          label: getLineVisualTypes().LIDERAZGO.label,
          color: getLineVisualTypes().LIDERAZGO.color,
          occupied: stationCategories.leadership.filter((w) => w.occupants.length > 0).length,
          total: stationCategories.leadership.length,
        }
      : null
    const rest = stationCategories.groups.map((g) => ({
      key: g.key,
      label: g.label,
      color: g.color,
      occupied: g.stations.filter((w) => w.occupants.length > 0).length,
      total: g.stations.length,
    }))
    return { groups: [leadershipGroup, ...rest].filter(Boolean) }
  }, [stationCategories])

  /* Reconcilia estaciones reales al abrir una WC LINEA -- corrige tanto a
     quien ya esta en el area pero sin ninguna asignacion real hoy
     (snapshot de BASE) COMO a quien ya tiene una asignacion real pero con
     un stationId invalido/heredado -- ver reconcileLineAssignments en
     repository.js para la regla completa. Orden estable por nombre
     (nunca aleatorio); idempotente. */
  // biome-ignore lint/correctness/useExhaustiveDependencies: memberIds se recalcula desde workCenterId en cada render, incluirlo forzaria un loop -- mismo patron en todo este folder
  useEffect(() => {
    if (!open || !isStationBased || !canonicalId) return
    const ids = memberIds
      .flatMap((id) => getGroupPeople([id]))
      .slice()
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .map((p) => p.id)
    reconcileLineAssignments(canonicalId, ids)
  }, [canonicalId, isStationBased, open])

  const selectedStation = useMemo(() => {
    if (!workstations.length) return null
    return (
      workstations.find((w) => w.name === selectedStationName) ||
      workstations.find((w) => w.isAvailable) ||
      workstations[0]
    )
  }, [workstations, selectedStationName])

  const selectedStationOccupantActividad = selectedStation?.occupants[0]?.employee?.id
    ? getActividadForEmployee(selectedStation.occupants[0].employee.id)
    : null
  const selectedStationVisualType = selectedStation
    ? getPersonnelVisualType({
        stationRole: selectedStation.role,
        actividad: selectedStationOccupantActividad,
        category: selectedStation.category,
      })
    : null

  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza recalcular aunque no se lea en el callback (mismo patron en todo este folder)
  const suggestions = useMemo(() => {
    if (!canonicalId || !selectedStation || selectedStation.occupants.length > 0) return []
    return getSuggestedCandidates(canonicalId, selectedStation.name, { includeAbsent })
  }, [canonicalId, selectedStation, includeAbsent, version])

  /* getEffectiveTodayRoster (no solo workstations.occupants): en lineas con
     personal historico de BASE que todavia nadie movio hoy (ej. CT LINEA 0),
     ese personal cuenta en staffing.real pero NO tiene una estacion real
     asignada -- si la tabla solo mostrara occupants de estaciones, esas
     personas reales quedarian invisibles aunque el encabezado ya las cuenta
     (Seccion 31/32 del pedido: nunca se pierde personal real). */
  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza recalcular aunque no se lea en el callback (mismo patron en todo este folder)
  const roster = useMemo(
    () =>
      memberIds.length ? getEffectiveTodayRoster().filter((r) => memberIds.includes(r.areaId)) : [],
    [workCenterId, version],
  )
  // "PERSONAL SIN ESTACIÓN" (2026-08-28, "CORRECCIÓN DE PUESTOS Y ESTACIONES OPERATIVAS", a
  // peticion explicita del usuario) -- 100% derivado, ver getPeopleWithoutStation
  // (personnelByArea.js): nunca escribe nada, solo compara contra `workstations` (la lista real
  // actual). Si una estacion se elimina/renombra (ej. Team Leader/Montaje 2 en esta correccion),
  // quien la ocupaba aparece aqui, sin perderse.
  const peopleWithoutStation = useMemo(
    () => (memberIds.length ? getPeopleWithoutStation(memberIds, workstations) : []),
    [memberIds, workstations],
  )

  if (!area || !staffing) return null

  const handleAssignSuggested = (candidate) => {
    setActionError('')
    if (!candidate.assignment) {
      const res = checkInEmployee({
        employeeId: candidate.employee.id,
        employeeNumber: candidate.employee.employeeNumber,
        areaId: canonicalId,
        stationId: selectedStation.name,
        shift: CURRENT_SHIFT,
      })
      if (res.status !== 'OK')
        setActionError(res.message || t('lineDetailDrawer.assignGenericError'))
    } else {
      setMoveTarget({
        employee: candidate.employee,
        currentAssignment: candidate.assignment,
        presetTo: { areaId: canonicalId, stationId: selectedStation.name },
      })
    }
  }

  const personnelCountLabel = t('lineDetailDrawer.personnelCountLabel', { count: people.length })
  const headerColor = areaStatusMeta?.color || (people.length > 0 ? '#10B981' : '#94A3B8')

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="inset-0 left-0 top-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none bg-background">
        <DialogTitle className="sr-only">
          {t('lineDetailDrawer.dialogTitle', {
            areaName: area?.name || t('lineDetailDrawer.areaFallback'),
          })}
        </DialogTitle>
        {/* Header */}
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-3 py-3.5 md:px-6">
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <p className="text-[20px] font-extrabold tracking-[-0.4px]">{area.name}</p>
          <span
            className="inline-flex h-6 items-center rounded-full border px-2 text-xs font-bold"
            style={{
              backgroundColor: hexToRgba(headerColor, 0.13),
              color: headerColor,
              borderColor: hexToRgba(headerColor, 0.33),
            }}
          >
            {areaStatusMeta
              ? areaStatusMeta.label
              : people.length > 0
                ? t('lineDetailDrawer.headerLabelHasStaff')
                : t('lineDetailDrawer.headerLabelNoStaffToday')}
          </span>
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
              ? t('lineDetailDrawer.registerPersonnelButton')
              : t('lineDetailDrawer.selfAssignButton')}
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
          {isStationBased && staffing.ideal != null ? (
            <>
              {/* 2026-09-01 (a peticion explicita del usuario, "ordenalas bien
                  que esten a las mismas medidas"): las 4 tarjetas (antes en un
                  grid de 6 columnas donde "Turno actual" ocupaba el doble de
                  ancho que las otras 3) ahora son 4 columnas iguales -- la
                  barra de cobertura se separa como su propia fila de ancho
                  completo debajo, ya no comparte el mismo grid. */}
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className={kpiCardClass('blue')}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
                    {t('lineDetailDrawer.currentAssignmentLabel')}
                  </p>
                  <p className="mt-0.5 text-xl font-extrabold">
                    {staffing.real} / {staffing.ideal}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t('lineDetailDrawer.peopleUnitLabel')}
                  </p>
                </div>
                <div className={kpiCardClass('slate')}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
                    {t('lineDetailDrawer.idealStaffingLabel')}
                  </p>
                  <p className="mt-0.5 text-xl font-extrabold">{staffing.ideal}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t('lineDetailDrawer.peopleUnitLabel')}
                  </p>
                </div>
                <div className={kpiCardClass(staffing.diff < 0 ? 'red' : 'green')}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
                    {staffing.diff > 0
                      ? t('lineDetailDrawer.additionalStaffLabel')
                      : staffing.diff === 0
                        ? t('lineDetailDrawer.coverageLabel')
                        : t('lineDetailDrawer.missingLabel')}
                  </p>
                  <p
                    className="mt-0.5 text-xl font-extrabold"
                    style={{ color: staffing.diff < 0 ? '#EF4444' : '#10B981' }}
                  >
                    {staffing.diff === 0 ? '✓' : Math.abs(staffing.diff)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {staffing.diff === 0
                      ? t('lineDetailDrawer.completeLabel')
                      : t('lineDetailDrawer.personUnitLabel', { count: Math.abs(staffing.diff) })}
                  </p>
                </div>
                <div className={kpiCardClass('purple')}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
                    {t('lineDetailDrawer.currentShiftLabel')}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1">
                    <ShiftIcon className="h-[18px] w-[18px] text-[#A855F7]" />
                    <p className="text-[15px] font-extrabold">{currentOfficialShift.label}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {formatHour12(currentOfficialShift.start)} –{' '}
                    {formatHour12(currentOfficialShift.end)} · {dayjs().format('DD/MM/YYYY')}
                  </p>
                </div>
              </div>
              {/* !h-auto (2026-09-01): kpiCardClass() trae h-full fijo, pensado
                  para vivir dentro de un grid (donde antes se autolimitaba al
                  ser el unico item de su fila) -- fuera del grid, h-full se
                  estira contra el contenedor scrolleable completo de la
                  pantalla. Bug real reportado por el usuario viendo el
                  Preview en vivo. */}
              <div
                className={cn(kpiCardClass(coveragePct >= 100 ? 'green' : 'cyan'), 'mb-4 !h-auto')}
              >
                <div className="mb-2 flex justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
                    {t('lineDetailDrawer.lineCoverageTitle')}
                  </p>
                  <p className="text-[15px] font-extrabold">{coveragePct}%</p>
                </div>
                <div className={progressBarClass}>
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(.4,0,.2,1)]"
                    style={{
                      width: `${Math.max(0, Math.min(100, coveragePct))}%`,
                      backgroundColor: coveragePct >= 100 ? '#10B981' : '#06B6D4',
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="mb-4">
              <p className="text-[22px] font-extrabold">
                {staffing.ideal != null
                  ? t('lineDetailDrawer.peopleCountLabel', {
                      real: staffing.real,
                      ideal: staffing.ideal,
                    })
                  : personnelCountLabel}
              </p>
              {staffing.ideal == null && (
                <p className="text-[13px] font-bold text-muted-foreground">
                  {t('lineDetailDrawer.noTemplateDefinedLabel')}
                </p>
              )}
            </div>
          )}

          {/* 2026-09-01 (a peticion explicita del usuario): "Personal
              disponible" se mueve aqui, al lado de la busqueda por
              numero/nombre, para que arrastrar y asignar sea mas rapido --
              antes vivia hasta abajo de la columna principal, lejos de la
              barra de busqueda. Orden (mismo dia, segunda correccion):
              Personal disponible a la izquierda, buscador a la derecha. */}
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start">
            <div className={cn(cardClass, 'min-w-0 flex-1 p-3')}>
              <AvailablePersonnelTray
                scopedAreaId={canonicalId}
                title={t('lineDetailDrawer.availablePersonnelTitle')}
              />
            </div>
            <div className="w-full max-w-[480px] shrink-0">
              <EmployeeAssignSearchBar areaId={canonicalId} />
            </div>
          </div>

          {actionError && (
            <Alert className={cn(alertToneClass('error'), 'mb-4')}>
              {actionError}
              <button
                type="button"
                onClick={() => setActionError('')}
                className="absolute right-2 top-2 rounded-full p-1 hover:bg-black/[.06] dark:hover:bg-white/[.08]"
              >
                <X className="h-4 w-4" />
              </button>
            </Alert>
          )}

          {isStationBased && (
            /* 2026-08-31 (a peticion explicita del usuario): "Proceso de
               produccion" debe cubrir el ancho COMPLETO del contenido
               (de extremo a extremo), no solo la columna principal -- por
               eso vive FUERA del grid de 12 columnas de abajo, como su
               propia seccion de ancho completo. `workstations` se pasa
               para que los nodos con posicion real (P.E/LIM/ACE/ET/EM/CAL)
               muestren numero+nombre del empleado ocupante -- mismo array
               ya usado por el resto de este drawer, sin recalcular nada. */
            <LineProcessFlow
              workstations={workstations}
              areaId={canonicalId}
              onViewHistory={setHistoryEmployee}
              taktTime={taktTime}
              realTakt={realTakt}
              shiftLabel={currentOfficialShift.label}
              headerAction={
                isAdmin &&
                configLoaded && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditStationId(null)
                      setConfigDrawerOpen(true)
                    }}
                    className="shrink-0 font-bold"
                  >
                    <Settings className="h-4 w-4" />
                    {t('lineDetailDrawer.configureStationsButton')}
                  </Button>
                )
              }
            />
          )}

          {isStationBased ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              {/* Columna principal */}
              <div className="md:col-span-8">
                {peopleWithoutStation.length > 0 && (
                  <div className={cn(cardClass, 'mb-4')}>
                    <div className={cardHeaderClass}>
                      <div className="min-w-0 flex-1">
                        <p className={cardHeaderTitleClass}>
                          {t('lineDetailDrawer.peopleWithoutStationTitle', {
                            count: peopleWithoutStation.length,
                          })}
                        </p>
                        <p className={cardHeaderSubtitleClass}>
                          {t('lineDetailDrawer.peopleWithoutStationSubtitle')}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 p-4">
                      {peopleWithoutStation.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-3 rounded-xl border border-border p-2.5"
                        >
                          <EmployeeAvatar employee={r.employee} size={36} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-bold">
                              {r.employee?.name || '—'}
                            </p>
                            <p className="truncate text-[11.5px] text-muted-foreground">
                              {r.stationId
                                ? t('lineDetailDrawer.previousStationLabel', {
                                    stationId: r.stationId,
                                  })
                                : t('lineDetailDrawer.noStationRegisteredTodayLabel')}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setMoveTarget({ employee: r.employee, currentAssignment: r })
                            }
                            className="shrink-0 font-bold"
                          >
                            <UserSearch className="h-4 w-4" />
                            {t('lineDetailDrawer.assignToStationButton')}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className={cn(cardClass, 'mb-4')}>
                  <div className={cardHeaderClass}>
                    <p className={cardHeaderTitleClass}>
                      {t('lineDetailDrawer.assignedToLineTodayTitle', { count: roster.length })}
                    </p>
                  </div>
                  <div className="max-h-[340px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow className={tableHeaderRowClass}>
                          <TableHead>{t('lineDetailDrawer.colEmployeeNumber')}</TableHead>
                          <TableHead>{t('lineDetailDrawer.colName')}</TableHead>
                          <TableHead>{t('lineDetailDrawer.colStation')}</TableHead>
                          <TableHead>{t('lineDetailDrawer.colRole')}</TableHead>
                          <TableHead>{t('lineDetailDrawer.typeLabel')}</TableHead>
                          <TableHead>{t('lineDetailDrawer.colEntry')}</TableHead>
                          <TableHead>{t('lineDetailDrawer.colStatus')}</TableHead>
                          <TableHead className="text-right">
                            {t('lineDetailDrawer.colActions')}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {roster.map((r, idx) => {
                          const ws = workstations.find((w) => w.name === r.stationId)
                          const isReal = r.source === 'REGISTRO'
                          const rowActividad = getActividadForEmployee(r.employeeId)
                          const rowType = getPersonnelVisualType({
                            stationRole: ws?.role,
                            actividad: rowActividad,
                            category: ws?.category,
                          })
                          return (
                            <TableRow key={r.id} className={tableRowClass(idx)}>
                              <TableCell className={cn(cellTextClass, 'font-mono font-semibold')}>
                                {formatEmployeeNumber(r.employeeNumber)}
                              </TableCell>
                              <TableCell className={cellTextClass}>
                                <DraggablePersonChip employeeId={r.employeeId}>
                                  {r.employee?.name || '—'}
                                </DraggablePersonChip>
                              </TableCell>
                              <TableCell className={cellTextSecondaryClass}>
                                {r.stationId || '—'}
                              </TableCell>
                              <TableCell className={cellTextSecondaryClass}>
                                {ws?.requiredRole || '—'}
                              </TableCell>
                              <TableCell>
                                {rowType ? (
                                  <span
                                    className="inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-bold"
                                    style={{
                                      backgroundColor: hexToRgba(rowType.color, 0.12),
                                      color: rowType.color,
                                      borderColor: hexToRgba(rowType.color, 0.3),
                                    }}
                                  >
                                    <LineTypeIcon type={rowType} size={12} />
                                    {rowType.label.toUpperCase()}
                                  </span>
                                ) : (
                                  <p className={cellTextSecondaryClass}>—</p>
                                )}
                              </TableCell>
                              <TableCell className={cellTextSecondaryClass}>
                                {r.checkInAt || '—'}
                              </TableCell>
                              <TableCell>
                                {isReal ? (
                                  <span className={statusChipClass('COMPLETADA')}>
                                    {t('lineDetailDrawer.presentStatus')}
                                  </span>
                                ) : (
                                  <span className={statusChipClass('PENDIENTE')}>
                                    {t('lineDetailDrawer.noCheckInTodayStatus')}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setHistoryEmployee(r.employee)}
                                  className="font-bold"
                                >
                                  {t('lineDetailDrawer.viewDetailButton')}
                                </Button>
                                {isReal && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => dnd.requestRelease(r.employeeId)}
                                    className="font-bold text-destructive hover:text-destructive"
                                  >
                                    {t('lineDetailDrawer.removeButton')}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        {roster.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8}>
                              <EmptyState
                                compact
                                title={t('lineDetailDrawer.noOneAssignedYetTitle')}
                                description={t('lineDetailDrawer.noOneAssignedTableDescription')}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="border-t border-border p-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLineHistoryOpen(true)}
                      className="font-bold"
                    >
                      <History className="h-4 w-4" />
                      {t('lineDetailDrawer.viewLineHistoryButton')}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Columna lateral */}
              <div className="md:col-span-4">
                {/* 2026-08-31 (a peticion explicita del usuario, segunda
                    correccion): "Detalle de estacion" va PRIMERO (arriba) y
                    "Resumen de la linea" despues (abajo) -- orden original.
                    Ya no compite visualmente con "Proceso de produccion"
                    porque ese ahora es una seccion de ancho completo, fuera
                    de este grid de 2 columnas (ver mas arriba). */}
                <div className={cn(cardClass, 'mb-4')}>
                  <div className={cardHeaderClass}>
                    <div className="min-w-0 flex-1">
                      <p className={cardHeaderTitleClass}>
                        {t('lineDetailDrawer.stationDetailTitle')}
                      </p>
                      {selectedStation && (
                        <p className={cardHeaderSubtitleClass}>
                          {t('lineDetailDrawer.positionOfLabel', {
                            order: selectedStation.order,
                            total: workstations.length,
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="p-4">
                    {!selectedStation && (
                      <EmptyState
                        compact
                        title={t('lineDetailDrawer.selectStationTitle')}
                        description={t('lineDetailDrawer.selectStationDescription')}
                      />
                    )}
                    {selectedStation && (
                      <>
                        <div className="mb-1 flex items-center gap-2">
                          {selectedStationVisualType && (
                            <div
                              className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full"
                              style={{
                                backgroundColor: hexToRgba(selectedStationVisualType.color, 0.14),
                              }}
                            >
                              <LineTypeIcon type={selectedStationVisualType} size={14} />
                            </div>
                          )}
                          <p
                            className="text-[17px] font-extrabold"
                            style={{
                              color: selectedStation.isAvailable ? '#B45309' : undefined,
                            }}
                          >
                            {selectedStation.name}
                          </p>
                        </div>
                        <p className="mb-2 text-[12.5px] text-muted-foreground">
                          {t('lineDetailDrawer.requiredRoleLabel')}{' '}
                          <b>{selectedStation.requiredRole}</b> · {selectedStation.occupants.length}
                          /{selectedStation.capacity}
                        </p>
                        <div className="mb-3 flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: selectedStation.isAvailable ? '#F59E0B' : '#10B981',
                            }}
                          />
                          <p
                            className="text-[11px] font-extrabold tracking-[0.3px]"
                            style={{ color: selectedStation.isAvailable ? '#B45309' : '#059669' }}
                          >
                            {selectedStation.isAvailable
                              ? t('lineDetailDrawer.stationAvailableStatus')
                              : t('lineDetailDrawer.stationOccupiedStatus')}
                          </p>
                        </div>

                        <p className={cn(sectionTitleClass, 'mb-2 text-[12.5px]')}>
                          {t('lineDetailDrawer.stationInfoTitle')}
                        </p>
                        <div className="mb-3 flex flex-col gap-2">
                          <div>
                            <p className="text-[10.5px] font-bold uppercase text-muted-foreground">
                              {t('lineDetailDrawer.areaLabel')}
                            </p>
                            <p className="text-[13px] font-bold">
                              {area.isProduction ? t('lineDetailDrawer.productionValue') : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10.5px] font-bold uppercase text-muted-foreground">
                              {t('lineDetailDrawer.typeLabel')}
                            </p>
                            <p className="text-[13px] font-bold">
                              {t('lineDetailDrawer.operativeValue')}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10.5px] font-bold uppercase text-muted-foreground">
                              {t('lineDetailDrawer.shiftLabel')}
                            </p>
                            <p className="text-[13px] font-bold">
                              {currentOfficialShift.label} (
                              {formatHour12(currentOfficialShift.start)} –{' '}
                              {formatHour12(currentOfficialShift.end)})
                            </p>
                          </div>
                          <div>
                            <p className="text-[10.5px] font-bold uppercase text-muted-foreground">
                              {t('lineDetailDrawer.categoryLabel')}
                            </p>
                            <p
                              className="text-[13px] font-bold"
                              style={{ color: selectedStationVisualType?.color }}
                            >
                              {selectedStationVisualType?.label ||
                                t('lineDetailDrawer.unclassifiedLabel')}
                            </p>
                          </div>
                        </div>

                        {selectedStation.occupants.length > 0 && (
                          <>
                            <div className="my-3 border-t border-border" />
                            <p className={cn(sectionTitleClass, 'mb-2 text-[12.5px]')}>
                              {t('lineDetailDrawer.assignedEmployeeTitle')}
                            </p>
                            <div className="mb-3 flex flex-col gap-2">
                              {selectedStation.occupants.map((o) => (
                                <button
                                  type="button"
                                  key={o.id}
                                  onClick={() => setHistoryEmployee(o.employee)}
                                  className="flex w-full items-center gap-2.5 text-left"
                                >
                                  <EmployeeAvatar employee={o.employee} size={36} />
                                  <div>
                                    <p className="text-[13px] font-bold">
                                      {t('lineDetailDrawer.employeeHeaderLabel', {
                                        employeeNumber: o.employeeNumber,
                                        name: o.employee?.name,
                                      })}
                                    </p>
                                    <p className="text-[11.5px] text-muted-foreground">
                                      {t('lineDetailDrawer.checkInAtLabel', {
                                        checkInAt: o.checkInAt,
                                      })}
                                    </p>
                                    {selectedStationVisualType && (
                                      <p
                                        className="text-[10.5px] font-extrabold tracking-[0.3px]"
                                        style={{ color: selectedStationVisualType.color }}
                                      >
                                        {selectedStationVisualType.label.toUpperCase()}
                                      </p>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>

                            {/* Area de origen / Tipo de apoyo -- SOLO para Apoyo/Calidad
                               (unico caso con algo genuinamente distinto que decir).
                               Nunca inventado: area de origen = el `role` real de la
                               estacion (workstation.role), tipo de apoyo = descriptor
                               fijo de la categoria (no un dato inventado por persona). */}
                            {selectedStationVisualType?.key === 'CALIDAD' && (
                              <div className="mb-3 flex flex-col gap-2">
                                <div>
                                  <p className="text-[10.5px] font-bold uppercase text-muted-foreground">
                                    {t('lineDetailDrawer.originAreaLabel')}
                                  </p>
                                  <p className="text-[13px] font-bold">{selectedStation.role}</p>
                                </div>
                                <div>
                                  <p className="text-[10.5px] font-bold uppercase text-muted-foreground">
                                    {t('lineDetailDrawer.supportTypeLabel')}
                                  </p>
                                  <p className="text-[13px] font-bold">
                                    {t('lineDetailDrawer.transversalValue')}
                                  </p>
                                </div>
                              </div>
                            )}

                            <div className="my-3 border-t border-border" />
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setHistoryEmployee(selectedStation.occupants[0].employee)
                                }
                                className="flex-1 font-bold"
                              >
                                <History className="h-4 w-4" />
                                {t('lineDetailDrawer.viewHistoryButton')}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() =>
                                  setHistoryEmployee(selectedStation.occupants[0].employee)
                                }
                                className="flex-1 font-bold"
                              >
                                <ArrowLeftRight className="h-4 w-4" />
                                {t('lineDetailDrawer.changeAssignmentButton')}
                              </Button>
                            </div>
                          </>
                        )}

                        {selectedStation.isAvailable && (
                          <>
                            <div className="my-3 border-t border-border" />
                            <p className={cn(sectionTitleClass, 'mb-2.5 text-[13px]')}>
                              {t('lineDetailDrawer.suggestedPersonnelTitle')}
                            </p>
                            {suggestions.length === 0 ? (
                              <EmptyState
                                compact
                                title={t('lineDetailDrawer.noCandidatesTitle')}
                                description={t('lineDetailDrawer.noCandidatesDescription')}
                              />
                            ) : (
                              <div className="flex flex-col gap-2">
                                {suggestions.map((c) => (
                                  <SuggestedEmployeeCard
                                    key={c.employee.id}
                                    candidate={c}
                                    onAssign={handleAssignSuggested}
                                    disabled={!c.present}
                                  />
                                ))}
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setIncludeAbsent((v) => !v)}
                              className="mt-2 font-bold"
                            >
                              {includeAbsent
                                ? t('lineDetailDrawer.hideUnregisteredButton')
                                : t('lineDetailDrawer.moreOptionsButton')}
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className={cn(cardClass, 'mb-4 p-4')}>
                  <p className={cn(sectionTitleClass, 'mb-3 text-[13px]')}>
                    {t('lineDetailDrawer.lineSummaryTitle')}
                  </p>
                  <div className="flex flex-col gap-2">
                    {lineSummary.groups.map((g) => (
                      <div key={g.key} className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: g.color }}
                        />
                        <p className="flex-1 truncate text-[12.5px]">{g.label}</p>
                        <p className="text-[12.5px] font-bold">
                          {g.occupied} / {g.total}
                        </p>
                      </div>
                    ))}
                  </div>
                  {staffing.ideal != null && (
                    <>
                      <div className="my-3 border-t border-border" />
                      <div className="flex items-center gap-2">
                        <p className="flex-1 text-[12.5px] font-extrabold">
                          {t('lineDetailDrawer.totalAssignedLabel')}
                        </p>
                        <p className="text-[12.5px] font-extrabold">
                          {staffing.real} / {staffing.ideal}
                        </p>
                      </div>
                      {staffing.diff < 0 && (
                        <div className="mt-1 flex items-center gap-2">
                          <p className="flex-1 text-xs text-[#EF4444]">
                            {t('lineDetailDrawer.missingCoverageLabel')}
                          </p>
                          <p className="text-xs font-bold text-[#EF4444]">
                            {Math.abs(staffing.diff)}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Vista simplificada, solo por defensividad -- ver comentario junto
               a isStationBased arriba. Nunca "Distribucion de estaciones" aqui. */
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              <div className="md:col-span-8">
                <div className={cn(cardClass, 'mb-4')}>
                  <div className={cardHeaderClass}>
                    <p className={cardHeaderTitleClass}>
                      {t('lineDetailDrawer.assignedPersonnelTitle', { count: people.length })}
                    </p>
                  </div>
                  <div className="p-4">
                    {people.length === 0 ? (
                      <EmptyState
                        compact
                        title={t('lineDetailDrawer.noOneAssignedYetTitle')}
                        description={t('lineDetailDrawer.emptyAssignedDescription')}
                      />
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                        {people.map((p) => (
                          <AssignedPersonChip key={p.id} employeeId={p.id} name={p.name} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <DropZoneBanner areaId={canonicalId} label={area.name} />
                </div>

                <div className={cn(cardClass, 'p-4')}>
                  <AvailablePersonnelTray scopedAreaId={canonicalId} />
                </div>
              </div>
            </div>
          )}
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
        <EmployeeHistoryDialog
          employee={historyEmployee}
          open={Boolean(historyEmployee)}
          onClose={() => setHistoryEmployee(null)}
          onChanged={() => {}}
        />
        <LineHistoryDialog
          lineId={canonicalId}
          open={lineHistoryOpen}
          onClose={() => setLineHistoryOpen(false)}
        />
        {isAdmin && configLoaded && (
          <LineStationConfigDrawer
            open={configDrawerOpen}
            onClose={() => {
              setConfigDrawerOpen(false)
              setEditStationId(null)
            }}
            lineId={canonicalId}
            areaName={area.name}
            workstations={workstations}
            editStationId={editStationId}
            onChanged={handleStationConfigChanged}
          />
        )}
        {moveTarget && (
          <MoveConfirmDialog
            open={Boolean(moveTarget)}
            onClose={() => setMoveTarget(null)}
            employee={moveTarget.employee}
            currentAssignment={moveTarget.currentAssignment}
            presetTo={moveTarget.presetTo}
            onDone={() => setMoveTarget(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
