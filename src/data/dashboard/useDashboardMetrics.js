import { useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { LINES_ONLY } from '../production/catalog'
import { generalKpis } from '../production/selectors'
import { areaIdBelongsToActiveGroup, getStaffingTotals } from '../production/personnelByArea'
import { getMovementsForDate, getPendingMoves } from '../personnel/repository'
import { usePersonnelVersion } from '../personnel/usePersonnelVersion'
import { useAuth } from '../../state/auth'
import {
  getDashboardAreas,
  getAreaStatusCounts,
  getIncompleteLines,
  getDashboardFindings,
  getShiftDistribution,
  getDailyMovementsBreakdown,
  getRecentActivity,
} from './dashboardMetrics'

/* Serie de /api/dashboard/trends -- unico fetch de red nuevo de este
   rediseño (2026-08-25). Todo lo demas (totales, areas, hallazgos) ya
   es reactivo via usePersonnelVersion() sin tocar la red, porque ya
   vive sincronizado localmente por apiSync.js (poll de 2s + refetch en
   visibility/focus/online, ver Parte 43 del prompt: "reutilizar
   infraestructura actual", no se crea un segundo mecanismo paralelo).
   El fetch de trends se repite en los mismos eventos (focus/visibility/
   online) y cuando cambia la version de personal (por si un movimiento
   nuevo ya afecta el conteo de "movimientos hoy"), con un pequeño
   debounce para no disparar de mas durante el poll de 2s. */
/* Agrupa los timestamps crudos (UTC ISO) en hora/dia LOCALES del
   navegador -- dayjs() sin argumentos de zona ya convierte a hora local
   automaticamente. Hacerlo aqui (no en el servidor) evita el bug real
   detectado en la primera verificacion visual: el servidor no conoce la
   zona horaria de quien pide el reporte, y agrupar con la hora UTC del
   proceso desalineaba "hoy" y las horas del turno respecto a la tarde/
   noche real en Mexico. */
function groupTrends(movements) {
  const today = dayjs().format('YYYY-MM-DD')
  const hourlyCounts = new Map()
  const dailyCounts = new Map()
  for (let i = 6; i >= 0; i -= 1) {
    dailyCounts.set(dayjs().subtract(i, 'day').format('YYYY-MM-DD'), 0)
  }

  movements.forEach((iso) => {
    const local = dayjs(iso)
    const dayKey = local.format('YYYY-MM-DD')
    if (dailyCounts.has(dayKey)) dailyCounts.set(dayKey, dailyCounts.get(dayKey) + 1)
    if (dayKey === today) {
      const hourKey = local.format('HH:00')
      hourlyCounts.set(hourKey, (hourlyCounts.get(hourKey) || 0) + 1)
    }
  })

  const hourlyToday = [...hourlyCounts.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([hour, count]) => ({ hour, count }))
  const dailyLast7 = [...dailyCounts.entries()].map(([date, count]) => ({ date, count }))
  return { hourlyToday, dailyLast7 }
}

function useDashboardTrends(version) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    hourlyToday: [],
    dailyLast7: [],
  })
  const debounceRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function fetchTrends() {
      try {
        const res = await fetch('/api/dashboard/trends', { credentials: 'include' })
        if (!res.ok) throw new Error(`trends -> ${res.status}`)
        const data = await res.json()
        const grouped = groupTrends(data.movements)
        if (!cancelled) setState({ loading: false, error: null, ...grouped })
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: e.message }))
      }
    }

    function scheduleFetch() {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(fetchTrends, 300)
    }

    scheduleFetch()

    function onVisible() {
      if (document.visibilityState === 'visible') fetchTrends()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', fetchTrends)
    window.addEventListener('online', fetchTrends)

    return () => {
      cancelled = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', fetchTrends)
      window.removeEventListener('online', fetchTrends)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  return state
}

/* Capa unica de metricas del Dashboard -- Parte 40 del prompt
   ("useDashboardMetrics()"). Todo componente de chart/KPI del
   Dashboard consume ESTE hook, nunca recalcula real/ideal/faltante por
   su cuenta -- una sola fuente de calculo central. */
export function useDashboardMetrics() {
  const version = usePersonnelVersion()
  const { user } = useAuth()
  const trends = useDashboardTrends(version)
  const [updatedAt, setUpdatedAt] = useState(() => dayjs())

  useEffect(() => {
    setUpdatedAt(dayjs())
  }, [version, trends.hourlyToday, trends.dailyLast7])

  const kpis = generalKpis()
  const totals = getStaffingTotals()
  const areas = getDashboardAreas()
  const statusCounts = getAreaStatusCounts(areas)
  const incompleteLines = getIncompleteLines()
  // 2026-09-10 (a peticion explicita del usuario, "en el area de sorting me sale esos datos pero
  // esos datos son de FFT... son dos areas independientes"): mismo filtro por
  // areaIdBelongsToActiveGroup que ya usaba getDailyMovementsBreakdown -- getMovesCountForDate()
  // y getPendingMoves() no distinguian FFT de Sorting, asi que el dashboard de Sorting mostraba
  // movimientos/pendientes reales de FFT.
  const movementsToday = getMovementsForDate().filter(
    (m) => m.type === 'MOVE' && areaIdBelongsToActiveGroup(m.toAreaId),
  ).length
  const pendingMovesCount = getPendingMoves().filter(
    (p) => p.status === 'PENDING' && areaIdBelongsToActiveGroup(p.toAreaId),
  ).length
  const canSeeApprovals = user?.role === 'SUPERVISOR' || user?.role === 'ADMINISTRADOR'
  const shifts = getShiftDistribution(totals.realTotal)
  const dailyMovements = getDailyMovementsBreakdown()
  const recentActivity = getRecentActivity()

  const findings = getDashboardFindings({
    areas,
    incompleteLines,
    pendingMovesCount,
    canSeeApprovals,
    movementsToday,
  })

  return {
    kpis: {
      personalActual: kpis.personalActivo,
      personalIdeal: kpis.personalIdeal,
      personalFaltante: kpis.personalFaltante,
      faltantePct:
        kpis.personalIdeal > 0
          ? Math.round((kpis.personalFaltante / kpis.personalIdeal) * 1000) / 10
          : null,
      lineasOperando: kpis.lineasOperando,
      lineasTotal: kpis.lineasTotal,
      coveragePct: totals.coveragePct,
      coverageBarPct: totals.coveragePct != null ? Math.min(100, totals.coveragePct) : 0,
    },
    totals,
    areas,
    statusCounts,
    incompleteLines,
    linesTotal: LINES_ONLY.length,
    movementsToday,
    dailyMovements,
    shifts,
    recentActivity,
    pendingMovesCount,
    canSeeApprovals,
    findings,
    trends,
    updatedAt,
  }
}
