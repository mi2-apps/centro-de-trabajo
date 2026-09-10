import i18n from '../../i18n'
import {
  getAssignmentsForDate,
  getEmployeeById,
  getMovementsForDate,
} from '../personnel/repository'
import { LINES_ONLY, OFFICIAL_SHIFTS, workCenterById } from '../production/catalog'
import {
  areaIdBelongsToActiveGroup,
  classifyAreaStatus,
  getAllAreaSummaries,
  getAreaHeadcount,
  getAreaStatusMeta,
} from '../production/personnelByArea'

/* ─────────────────────────────────────────────
   Capa de calculo EXCLUSIVA del rediseño del Dashboard (2026-08-25).
   Nunca reimplementa real/ideal/faltante/cobertura: todo se apoya en
   los mismos selectors que ya usan Centro de Trabajo y el plano 2D
   (personnelByArea.js) -- si esos cambian, esto cambia solo, sin una
   segunda fuente de verdad.

   AREA_STATUS_META/classifyAreaStatus (2026-08-26, correccion explicita
   del usuario: "no quiero que Centro de Trabajo calcule Parcial de una
   manera y Dashboard de otra") -- ANTES eran una copia manual literal de
   personnelByArea.js (idénticas caracter por caracter, pero una segunda
   fuente que podia desincronizarse con el tiempo). Ahora se REEXPORTAN
   de ahi directo, nunca se reimplementan. */
export { classifyAreaStatus, getAreaStatusMeta }

/* Areas para las graficas del Dashboard -- misma fuente que "Resumen por
   área" de Centro de Trabajo (getAllAreaSummaries). Se excluyen SOLO las
   areas puramente decorativas: sin plantilla oficial (ideal null) Y sin
   ninguna persona real hoy (count 0) -- conveyors, Sellado, Insumos,
   Suministro de material, que nunca han tenido personal y no aportan
   nada a un dashboard ejecutivo. Cualquier area CON ideal definido se
   conserva aunque este en 0 (es un hueco real que vale la pena mostrar,
   ej. "CT Gerente 0/1"). */
export function getDashboardAreas() {
  return getAllAreaSummaries()
    .filter((a) => a.ideal != null || a.count > 0)
    .map((a) => ({
      id: a.id,
      name: a.name,
      actual: a.count,
      ideal: a.ideal,
      missing: a.ideal != null ? Math.max(0, a.ideal - a.count) : null,
      coveragePct:
        a.ideal != null && a.ideal > 0 ? Math.round((a.count / a.ideal) * 1000) / 10 : null,
      status: classifyAreaStatus(a.count, a.ideal),
    }))
}

/* Cuenta AREAS por estado (no personas) -- a proposito: los 4 estados
   son una propiedad de cada area (real vs su propio ideal), nunca de
   una persona individual. Solo areas con ideal definido participan
   (status null se ignora), para no fingir un estado de "sin plantilla". */
export function getAreaStatusCounts(areas) {
  const counts = { COMPLETA: 0, PARCIAL: 0, FALTA: 0, SIN_PERSONAL: 0 }
  areas.forEach((a) => {
    if (a.status) counts[a.status] += 1
  })
  return counts
}

/* Lineas de produccion (LINEA1..10) con personal incompleto -- para el
   hallazgo "N líneas requieren atención", distinto de "areas con
   faltante" en general (una línea es un WORK_CENTER kind:'linea', las
   demas areas no cuentan aqui). */
export function getIncompleteLines() {
  return LINES_ONLY.map((wc) => ({
    id: wc.id,
    name: wc.name,
    actual: getAreaHeadcount(wc.id),
    ideal: wc.idealHeadcount,
  })).filter((l) => l.ideal != null && l.actual < l.ideal)
}

function shortAreaName(name) {
  return name.replace(/^WC /, '')
}

/* Hallazgos del dia -- reglas deterministicas sobre datos reales, nunca
   texto generado por IA/inventado (2026-08-25, a peticion explicita del
   usuario). Orden de prioridad fijo (Parte 22 del prompt): areas sin
   personal > faltantes criticos > lineas incompletas > movimientos
   pendientes > areas completas > areas sobre plantilla > (relleno)
   movimientos de hoy. Maximo 6, minimo lo que realmente aplique (puede
   haber menos de 4 si el dia esta genuinamente bien). */
export function getDashboardFindings({
  areas,
  incompleteLines,
  pendingMovesCount,
  canSeeApprovals,
  movementsToday,
}) {
  const findings = []
  const andJoiner = i18n.t('dataLayer:dashboardMetrics.andJoiner')
  const moreSuffix = i18n.t('dataLayer:dashboardMetrics.moreSuffix')

  const withIdeal = areas.filter((a) => a.ideal != null)

  const noPersonnel = withIdeal.filter((a) => a.status === 'SIN_PERSONAL')
  noPersonnel.slice(0, 2).forEach((a) => {
    findings.push({
      id: `none-${a.id}`,
      tone: 'bad',
      title: i18n.t('dataLayer:dashboardMetrics.noStaffAssignedTitle', {
        areaName: shortAreaName(a.name),
      }),
      detail: i18n.t('dataLayer:dashboardMetrics.requiresStaffDetail', { count: a.ideal }),
    })
  })

  const critical = withIdeal
    .filter(
      (a) =>
        a.status === 'FALTA' && (a.missing >= 3 || (a.coveragePct != null && a.coveragePct < 50)),
    )
    .sort((a, b) => b.missing - a.missing)
  critical.slice(0, 2).forEach((a) => {
    findings.push({
      id: `critical-${a.id}`,
      tone: 'warn',
      title: i18n.t('dataLayer:dashboardMetrics.criticalCoverageTitle', {
        areaName: shortAreaName(a.name),
        coveragePct: a.coveragePct,
      }),
      detail: i18n.t('dataLayer:dashboardMetrics.missingStaffDetail', { count: a.missing }),
    })
  })

  if (incompleteLines.length > 0) {
    const names = incompleteLines.map((l) => shortAreaName(l.name))
    const list =
      names.length <= 3
        ? names.join(names.length === 2 ? andJoiner : ', ').replace(/, ([^,]*)$/, `${andJoiner}$1`)
        : `${names.slice(0, 2).join(', ')}${andJoiner}${names.length - 2}${moreSuffix}`
    findings.push({
      id: 'lines-incomplete',
      tone: incompleteLines.length >= 3 ? 'bad' : 'warn',
      title: i18n.t('dataLayer:dashboardMetrics.incompleteLinesTitle', {
        count: incompleteLines.length,
      }),
      detail: list,
    })
  }

  if (canSeeApprovals && pendingMovesCount > 0) {
    findings.push({
      id: 'pending-moves',
      tone: 'info',
      title: i18n.t('dataLayer:dashboardMetrics.pendingMovesTitle', { count: pendingMovesCount }),
      detail: i18n.t('dataLayer:dashboardMetrics.pendingMovesDetail'),
    })
  }

  const complete = withIdeal.filter((a) => a.status === 'COMPLETA')
  if (complete.length > 0) {
    const names = complete.slice(0, 2).map((a) => shortAreaName(a.name))
    const label =
      complete.length > 2
        ? `${names.join(', ')}${andJoiner}${complete.length - 2}${moreSuffix}`
        : names.join(andJoiner)
    findings.push({
      id: 'areas-complete',
      tone: 'ok',
      title: i18n.t('dataLayer:dashboardMetrics.areasCompleteTitle', {
        count: complete.length,
        label,
      }),
      detail: i18n.t('dataLayer:dashboardMetrics.areasCompleteDetail', { count: complete.length }),
    })
  }

  const overIdeal = withIdeal
    .filter((a) => a.actual > a.ideal)
    .sort((a, b) => b.actual - b.ideal - (a.actual - a.ideal))
  if (overIdeal.length > 0) {
    const a = overIdeal[0]
    const surplus = a.actual - a.ideal
    findings.push({
      id: `over-${a.id}`,
      tone: 'ok',
      title: i18n.t('dataLayer:dashboardMetrics.overIdealTitle', {
        areaName: shortAreaName(a.name),
      }),
      detail: i18n.t('dataLayer:dashboardMetrics.overIdealDetail', { count: surplus }),
    })
  }

  if (findings.length < 4 && movementsToday > 0) {
    findings.push({
      id: 'movements-today',
      tone: 'info',
      title: i18n.t('dataLayer:dashboardMetrics.movementsTodayTitle', { count: movementsToday }),
      detail: i18n.t('dataLayer:dashboardMetrics.movementsTodayDetail'),
    })
  }

  return findings.slice(0, 6)
}

export function workCenterShortName(id) {
  return shortAreaName(workCenterById(id)?.name || id)
}

/* Distribucion por turno (2026-08-26, a peticion explicita del usuario)
   -- usa EXCLUSIVAMENTE OFFICIAL_SHIFTS, nunca SHIFT_HOURS ni el
   "07:00-14:00" ya corregido en otras vistas. El campo `shift` real solo
   existe en una asignacion local de alguien que tuvo un check-in/
   movimiento explicito HOY (repository.js) -- la mayoria de "Personal
   actual" viene del snapshot BASE sin ese campo (ver PersonalDeHoyTab.jsx/
   AUTO_ACTIVE_AREAS: esa gente se muestra activa visualmente pero SIN
   crear ninguna asignacion real). Ademas el valor guardado usa el
   vocabulario legacy de los selects (SHIFT_OPTIONS: Matutino/Vespertino/
   Nocturno), que NO coincide con las 3 etiquetas oficiales salvo
   "Matutino". Por eso: se cuenta SOLO a quien tiene un `shift` que hace
   match EXACTO con una etiqueta oficial, y el resto de "Personal actual"
   cae en un bucket explicito "Sin turno registrado" -- nunca se inventa
   a que turno pertenece alguien sin ese dato real.

   2026-09-10 (a peticion explicita del usuario, "en el area de sorting me sale esos datos pero
   esos datos son de FFT... son dos areas independientes"): a esta funcion le faltaba el mismo
   filtro por `areaIdBelongsToActiveGroup` que ya tenia getDailyMovementsBreakdown -- contaba
   TODAS las asignaciones con turno oficial (de FFT y Sorting juntas) sin importar el grupo
   activo, asi que el donut de Sorting mostraba el total real de FFT. */
export function getShiftDistribution(realTotal) {
  const assignments = getAssignmentsForDate().filter((a) => areaIdBelongsToActiveGroup(a.areaId))
  const counts = new Map(OFFICIAL_SHIFTS.map((s) => [s.label, 0]))
  let matched = 0
  assignments.forEach((a) => {
    if (counts.has(a.shift)) {
      counts.set(a.shift, counts.get(a.shift) + 1)
      matched += 1
    }
  })
  const sinTurno = Math.max(0, realTotal - matched)
  return [
    ...OFFICIAL_SHIFTS.map((s) => ({ id: s.id, label: s.label, count: counts.get(s.label) || 0 })),
    {
      id: 'SIN_TURNO',
      label: i18n.t('dataLayer:dashboardMetrics.noShiftRegistered'),
      count: sinTurno,
    },
  ]
}

/* Movimientos del dia, desglosados por tipo real (2026-08-26) --
   `movements` local ya distingue CHECK_IN/MOVE/RELEASE (repository.js,
   escrito por checkInEmployee/moveEmployee/releaseAssignment). ANTES el
   Dashboard solo mostraba getMovesCountForDate() (solo tipo MOVE) bajo
   el nombre generico "movimientos hoy" -- aqui se desglosan los 3 tipos
   reales por separado, tal como se pidio explicitamente. */
export function getDailyMovementsBreakdown(date) {
  // 2026-09-08 (a peticion explicita del usuario, "en el area de sorting no debe salir datos de
  // FFT y en FFT no debe salir datos de sorting"): se filtra por el area de destino de cada
  // movimiento (areaIdBelongsToActiveGroup, personnelByArea.js) antes de desglosar por tipo.
  const moves = getMovementsForDate(date).filter((m) => areaIdBelongsToActiveGroup(m.toAreaId))
  const asignaciones = moves.filter((m) => m.type === 'CHECK_IN').length
  const removidos = moves.filter((m) => m.type === 'RELEASE').length
  const movimientos = moves.filter((m) => m.type === 'MOVE').length
  return {
    asignaciones,
    removidos,
    movimientos,
    neto: asignaciones - removidos,
    total: moves.length,
  }
}

/* Funcion (nunca objeto estatico): el label debe resolverse fresco en
   cada llamada via i18n.t(), nunca congelarse en el idioma que estaba
   activo cuando el modulo se importo -- ver HARD RULE de i18n en
   src/i18n.js. Solo se usa dentro de este archivo (getRecentActivity). */
function getActivityLabels() {
  return {
    CHECK_IN: i18n.t('dataLayer:dashboardMetrics.activityCheckIn'),
    MOVE: i18n.t('dataLayer:dashboardMetrics.activityMove'),
    RELEASE: i18n.t('dataLayer:dashboardMetrics.activityRelease'),
  }
}

/* Actividades recientes (2026-08-26) -- misma fuente que el desglose de
   arriba (getMovementsForDate, ya sincronizada localmente, cero
   requests nuevos), solo enriquecida con nombre real de empleado/area
   para mostrar. `movedAt` es "HH:mm" del dia de hoy (nowTime(),
   repository.js) -- nunca un timestamp completo, por eso se muestra tal
   cual (hora real) en vez de fabricar un "hace X minutos" que
   implicaria una precision que el dato no tiene. */
export function getRecentActivity(limit = 30) {
  const moves = getMovementsForDate().filter((m) => areaIdBelongsToActiveGroup(m.toAreaId))
  return [...moves]
    .sort((a, b) => (a.movedAt < b.movedAt ? 1 : a.movedAt > b.movedAt ? -1 : 0))
    .slice(0, limit)
    .map((m) => {
      const employee = getEmployeeById(m.employeeId)
      return {
        id: m.id,
        type: m.type,
        label: getActivityLabels()[m.type] || m.type,
        employeeName:
          employee?.name ||
          m.employeeNumber ||
          i18n.t('dataLayer:dashboardMetrics.unknownEmployee'),
        fromAreaName: m.fromAreaId ? workCenterById(m.fromAreaId)?.name || m.fromAreaId : null,
        toAreaName: m.toAreaId ? workCenterById(m.toAreaId)?.name || m.toAreaId : null,
        time: m.movedAt,
      }
    })
}
