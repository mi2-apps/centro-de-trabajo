import dayjs from 'dayjs'
import {
  ArrowLeftRight,
  Badge,
  Briefcase,
  CalendarDays,
  Check,
  ChevronRight,
  Contact,
  Download,
  History,
  LayoutGrid,
  Search,
  TriangleAlert,
  UserPlus,
  Users,
  UserX,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
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
  getAllEmployees,
  getCurrentAssignment,
  getMovementsForEmployee,
  getMovesCountForDate,
  getPendingMoves,
  getUnassignedPresentToday,
  searchEmployees,
  todayISO,
} from '../../data/personnel/repository'
import { usePersonnelVersion } from '../../data/personnel/usePersonnelVersion'
import { SHIFT_OPTIONS, WORK_CENTERS, workCenterById } from '../../data/production/catalog'
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
const DIRECTORY_PAGE_SIZE = 8
const AREA_SUMMARY_TOP_N = 5

export default function PersonalDeHoyTab({ onGoToBajas, onGoToAreas, onGoToSinAsignar }) {
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
  const [showAllDirectory, setShowAllDirectory] = useState(false)

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
  const visibleDirectory = showAllDirectory
    ? directoryList
    : directoryList.slice(0, DIRECTORY_PAGE_SIZE)

  // Resumen por area -- Top N por personal presente hoy (roster
  // completo, sin filtros de la barra, para que sea una foto general
  // estable igual que las alertas). Participacion = presentesArea /
  // totalPresente * 100, nunca hardcodeada.
  const areaSummary = useMemo(() => {
    const counts = {}
    roster.forEach((r) => {
      counts[r.areaId] = (counts[r.areaId] || 0) + 1
    })
    return Object.entries(counts)
      .map(([areaId, count]) => ({
        areaId,
        count,
        pct: presentToday > 0 ? (count / presentToday) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, AREA_SUMMARY_TOP_N)
  }, [roster, presentToday])

  function handleAlertClick(estado) {
    setEstadoFilter(estado)
    setShowAllRoster(true)
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

      {/* Barra de busqueda + filtros + acciones */}
      <div className={cn(cardClass, 'mb-4 p-3')}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
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
            onClick={() => (isSupervisor ? setRegisterOpen(true) : setSelfAssignOpen(true))}
            className="shrink-0 rounded-[20px] font-bold"
          >
            <UserPlus className="h-4 w-4" />
            {isSupervisor
              ? t('personalDeHoyTab.registerButtonSupervisor')
              : t('personalDeHoyTab.registerButtonSelf')}
          </Button>
          <Button
            variant="outline"
            onClick={() => exportPersonalExcel(todayISO())}
            className="shrink-0 rounded-[20px] font-bold"
          >
            <Download className="h-4 w-4" />
            {t('personalDeHoyTab.exportButton')}
          </Button>
        </div>
      </div>

      {query.trim() && (
        <div className={cn(cardClass, 'mb-4 p-5')}>
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

      {/* Contenido principal (2026-09-02, a peticion explicita del usuario: la card de
          Movimientos del dia debe verse "de extremo a extremo" -- se quita el layout de 2
          columnas 70/30 de antes; Registro de hoy/Movimientos del dia/Directorio ahora ocupan
          el ancho completo, y las 3 cards que antes vivian en la columna lateral (Resumen por
          area/Alertas/Acciones rapidas) bajan a su propia fila debajo, para que no le quiten
          espacio horizontal a la tabla ancha de Movimientos). */}
      <RegistroDeHoyCard
        rows={visibleRoster}
        total={filteredRoster.length}
        allCount={roster.length}
        showAll={showAllRoster}
        onToggleShowAll={() => setShowAllRoster((v) => !v)}
        onRowClick={setHistoryEmployee}
      />
      <MovimientosDelDiaCard />
      <DirectorioCard
        tab={directoryTab}
        onTabChange={setDirectoryTab}
        withNumberCount={directoryWithNumber.length}
        proyectosCount={directoryProyectos.length}
        query={directoryQuery}
        onQueryChange={setDirectoryQuery}
        rows={visibleDirectory}
        total={directoryList.length}
        showAll={showAllDirectory}
        onToggleShowAll={() => setShowAllDirectory((v) => !v)}
        onRowClick={setHistoryEmployee}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ResumenPorAreaCard
          areas={areaSummary}
          totalPresente={presentToday}
          onAreaClick={(id) => setAreaFilter(id)}
        />
        <AlertasCard
          sinEstacion={rosterSinEstacion.length}
          snapshot={rosterSnapshot.length}
          movimientos={movesToday}
          sinAsignar={unassignedCount}
          onClickSinEstacion={() => handleAlertClick('SIN_ESTACION')}
          onClickSnapshot={() => handleAlertClick('SNAPSHOT')}
          onClickMovimientos={() => handleAlertClick('REGISTRADO')}
          onClickSinAsignar={onGoToSinAsignar}
        />
        <AccionesRapidasCard
          onAsignar={() => (isSupervisor ? setRegisterOpen(true) : setSelfAssignOpen(true))}
          onMover={() => (isSupervisor ? setRegisterOpen(true) : setSelfAssignOpen(true))}
          onVerBajas={onGoToBajas}
          onVerLayout={onGoToAreas}
        />
      </div>

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

/* Card "Directorio completo de personal" -- mismas 2 tabs/datos de
   siempre (Con número de empleado / Proyectos), ahora con altura
   controlada + "Ver directorio completo" para expandir. */
function DirectorioCard({
  tab,
  onTabChange,
  withNumberCount,
  proyectosCount,
  query,
  onQueryChange,
  rows,
  total,
  showAll,
  onToggleShowAll,
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
      <div className={cn('mt-2 overflow-x-auto', showAll && 'max-h-[480px] overflow-y-auto')}>
        <Table>
          <TableHeader className={showAll ? 'sticky top-0 z-10 bg-card' : undefined}>
            <TableRow className={tableHeaderRowClass}>
              <TableHead>{t('personalDeHoyTab.colEmpleado')}</TableHead>
              <TableHead>{t('personalDeHoyTab.colNombre')}</TableHead>
              <TableHead>{t('personalDeHoyTab.colAreaActual')}</TableHead>
              <TableHead>{t('personalDeHoyTab.colFechaIngreso')}</TableHead>
              {tab === 'PROYECTOS' && <TableHead>{t('personalDeHoyTab.colTipo')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e, idx) => (
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
                  {areaLabel(getEffectiveAreaForEmployee(e.id)) || '—'}
                </TableCell>
                <TableCell className={cellTextSecondaryClass}>{e.fechaIngreso || '—'}</TableCell>
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
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={tab === 'PROYECTOS' ? 5 : 4}>
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
      {total > 0 && (
        <div className="border-t border-border p-3 text-right">
          <Button variant="ghost" size="sm" onClick={onToggleShowAll} className="font-bold">
            {showAll
              ? t('personalDeHoyTab.viewLessButton')
              : t('personalDeHoyTab.viewAllDirectoryButton', { count: total })}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

/* Panel derecho 1/3 -- "Resumen por area": Top N por personal
   presente hoy, con barra de participacion. SOLO referencia visual
   del roster completo (sin filtros de la barra) para que sea estable
   -- clic en una fila aplica ese filtro de Area a la tabla principal. */
function ResumenPorAreaCard({ areas, totalPresente, onAreaClick }) {
  const { t } = useTranslation('centroTrabajo')
  return (
    <div className={cardClass}>
      <div className={cardHeaderClass}>
        <div>
          <p className={cardHeaderTitleClass}>{t('personalDeHoyTab.resumenAreaTitle')}</p>
          <p className={cardHeaderSubtitleClass}>{t('personalDeHoyTab.resumenAreaSubtitle')}</p>
        </div>
      </div>
      <div className="p-4">
        {areas.length === 0 ? (
          <p className={emptyTextClass}>{t('personalDeHoyTab.noStaffTodayMessage')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {areas.map((a) => (
              <button
                type="button"
                key={a.areaId}
                onClick={() => onAreaClick(a.areaId)}
                className="group w-full text-left"
              >
                <div className="flex items-baseline justify-between">
                  <p className="truncate text-[12.5px] font-bold">{areaLabel(a.areaId)}</p>
                  <p className="ml-2 shrink-0 text-[11.5px] font-bold text-muted-foreground">
                    {a.count} · {a.pct.toFixed(1)}%
                  </p>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[.04] dark:bg-white/[.08]">
                  <div
                    className="h-full rounded-full bg-[#3B82F6] transition-opacity duration-150 group-hover:opacity-85"
                    style={{ width: `${Math.min(a.pct, 100)}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
        <div className="mt-4 flex justify-between border-t border-dashed border-border pt-3">
          <p className="text-xs font-bold text-muted-foreground">
            {t('personalDeHoyTab.totalPresenteLabel')}
          </p>
          <p className="text-sm font-extrabold">{totalPresente}</p>
        </div>
      </div>
    </div>
  )
}

/* Panel derecho 2/3 -- "Alertas / pendientes": 3 renglones reales,
   clickeables, cada uno aplica el filtro de Estado correspondiente en
   la tabla principal (Registro de hoy) -- nunca inventa un numero, si
   algo no aplica se veria en 0, no "Sin datos" ficticio (aqui las 3
   metricas siempre son calculables desde el roster real). */
function AlertasCard({
  sinEstacion,
  snapshot,
  movimientos,
  sinAsignar,
  onClickSinEstacion,
  onClickSnapshot,
  onClickMovimientos,
  onClickSinAsignar,
}) {
  const { t } = useTranslation('centroTrabajo')
  const rows = [
    {
      label: t('personalDeHoyTab.alertSinAsignarLabel'),
      value: sinAsignar,
      onClick: onClickSinAsignar,
      color: '#EF4444',
    },
    {
      label: t('personalDeHoyTab.alertSinEstacionLabel'),
      value: sinEstacion,
      onClick: onClickSinEstacion,
      color: '#F59E0B',
    },
    {
      label: t('personalDeHoyTab.alertSnapshotLabel'),
      value: snapshot,
      onClick: onClickSnapshot,
      color: '#F59E0B',
    },
    {
      label: t('personalDeHoyTab.alertMovimientosLabel'),
      value: movimientos,
      onClick: onClickMovimientos,
      color: '#3B82F6',
    },
  ]
  return (
    <div className={cardClass}>
      <div className={cardHeaderClass}>
        <TriangleAlert className="h-[18px] w-[18px] text-[#F59E0B]" />
        <p className={cardHeaderTitleClass}>{t('personalDeHoyTab.alertasTitle')}</p>
      </div>
      <div className="flex flex-col p-1">
        {rows.map((row) => (
          <button
            type="button"
            key={row.label}
            onClick={row.onClick}
            className="flex items-center justify-between rounded-lg p-2.5 text-left hover:bg-accent"
          >
            <p className="text-[12.5px] font-semibold text-muted-foreground">{row.label}</p>
            <span className="flex items-center gap-1">
              <span className="text-sm font-extrabold" style={{ color: row.color }}>
                {row.value}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* Panel derecho 3/3 -- "Acciones rapidas": cuadricula 2x2. Asignar a
   linea / Mover personal reutilizan el mismo RegisterPersonnelDialog
   de siempre (su propio flujo ya distingue registrar de mover); Ver
   bajas / Ver layout general solo cambian de pestaña. */
function AccionesRapidasCard({ onAsignar, onMover, onVerBajas, onVerLayout }) {
  const { t } = useTranslation('centroTrabajo')
  const actions = [
    {
      label: t('personalDeHoyTab.asignarLineaAction'),
      icon: UserPlus,
      color: '#3B82F6',
      onClick: onAsignar,
    },
    {
      label: t('personalDeHoyTab.moverPersonalAction'),
      icon: ArrowLeftRight,
      color: '#10B981',
      onClick: onMover,
    },
    {
      label: t('personalDeHoyTab.verBajasAction'),
      icon: UserX,
      color: '#EF4444',
      onClick: onVerBajas,
    },
    {
      label: t('personalDeHoyTab.verLayoutAction'),
      icon: LayoutGrid,
      color: '#3B82F6',
      onClick: onVerLayout,
    },
  ]
  return (
    <div className={cardClass}>
      <div className={cardHeaderClass}>
        <Zap className="h-[18px] w-[18px] text-muted-foreground" />
        <p className={cardHeaderTitleClass}>{t('personalDeHoyTab.accionesRapidasTitle')}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 p-3">
        {actions.map((a) => (
          <button
            type="button"
            key={a.label}
            onClick={a.onClick}
            disabled={!a.onClick}
            className="flex flex-col items-start gap-1.5 rounded-lg border border-border p-3 text-left transition-all duration-150 hover:-translate-y-px disabled:cursor-default"
            style={{ backgroundColor: hexToRgba(a.color, 0.03) }}
          >
            <span
              className="grid h-8 w-8 place-items-center rounded-full"
              style={{ backgroundColor: hexToRgba(a.color, 0.14), color: a.color }}
            >
              <a.icon className="h-[17px] w-[17px]" />
            </span>
            <p className="text-[12.5px] font-bold leading-[1.2]">{a.label}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
