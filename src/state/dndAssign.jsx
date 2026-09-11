import { createContext, useContext, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatEmployeeNumber } from '../data/personnel/employeeDisplay'
import {
  checkInEmployee,
  getAssignmentsForArea,
  getCurrentAssignment,
  getEmployeeById,
  getLineWorkstationsWithOccupancy,
  releaseAssignment,
  swapOrBumpStation,
} from '../data/personnel/repository'
import { getWorkstationsForLine, hasMultipleStations } from '../data/personnel/workstations'
import { CURRENT_SHIFT, workCenterById } from '../data/production/catalog'
import { getAreaStaffing, getEffectiveAreaForEmployee } from '../data/production/personnelByArea'
import MoveConfirmDialog from '../pages/centro-trabajo/MoveConfirmDialog'
import { showToast } from '../ui/toast'
import { useAuth } from './auth'

/* ─────────────────────────────────────────────
   Orquesta TODO movimiento/asignacion originado por drag & drop (o
   por el equivalente en click de una tarjeta de personal), desde un
   solo lugar — para que "arrastrar a Yailen a Accesorios" y "tocar
   Asignar en la tarjeta de Yailen" terminen llamando exactamente a
   checkInEmployee/moveEmployee (repository.js), nunca una segunda
   logica paralela de asignaciones.

   Reglas que respeta:
   - Linea 1..10 requiere elegir una ESTACION antes de asignar (nunca
     se elige "Montaje" sola por soltar sobre la linea) — se abre un
     picker compacto de estaciones disponibles.
   - Areas WORK_AREA/SUPPORT_AREA usan su unico puesto generico, sin
     ambiguedad, sin picker.
   - Si el empleado ya tiene ubicacion hoy en otro lugar: se pide
     confirmacion ligera (MoveConfirmDialog) antes de mover — nunca
     se duplica (moveEmployee actualiza la misma fila de
     DailyAssignment, checkInEmployee/repository.js garantiza una
     sola asignacion ACTIVA por empleado/dia).
   - IDEAL nunca bloquea la asignacion (ver workstations.js) — solo
     se advierte con un toast si al asignar se supera la plantilla.
   ───────────────────────────────────────────── */

const DndAssignContext = createContext(null)

export function DndAssignProvider({ children }) {
  const { t } = useTranslation('app')
  const { user } = useAuth()
  // 2026-09-09 (a peticion explicita del usuario -- "no quiero que se muevan
  // solos, solo yo u otro administrador o supervisor pueden moverlo"):
  // confirmSwap/confirmRelease abajo llamaban swapOrBumpStation/
  // releaseAssignment DIRECTO, sin el mismo filtro isLider que
  // MoveConfirmDialog.jsx ya aplica para un movimiento normal (ese siempre
  // redirige a requestMove/aprobacion). El servidor ya rechaza esto para un
  // LIDER (requireRole en swap.js/release.js), este aviso es solo para no
  // mostrar un error crudo de red.
  const isLider = user?.role === 'LIDER'
  const [stationPicker, setStationPicker] = useState(null) // { employee, current, targetAreaId }
  const [moveTarget, setMoveTarget] = useState(null) // { employee, currentAssignment, presetTo }
  const [releaseTarget, setReleaseTarget] = useState(null) // { employee, currentAssignment }
  const [swapTarget, setSwapTarget] = useState(null) // { employeeA, employeeB, current, targetAreaId, stationName }

  function warnIfOverIdeal(areaId) {
    const wc = workCenterById(areaId)
    if (!wc || wc.idealHeadcount == null) return
    const staffing = getAreaStaffing(areaId)
    if (staffing.real > wc.idealHeadcount) {
      showToast(
        t('dndAssign.overIdealWarning', { areaName: wc.name, idealHeadcount: wc.idealHeadcount }),
        'warning',
      )
    }
  }

  function finalize(employee, current, targetAreaId, stationName) {
    const areaName = workCenterById(targetAreaId)?.name || targetAreaId
    const alreadyHere =
      current && current.areaId === targetAreaId && current.stationId === stationName
    if (alreadyHere) {
      showToast(t('dndAssign.alreadyAssignedInfo', { name: employee.name, areaName }), 'info')
      return
    }
    if (current) {
      setMoveTarget({
        employee,
        currentAssignment: current,
        presetTo: { areaId: targetAreaId, stationId: stationName },
      })
      return
    }
    const res = checkInEmployee({
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      areaId: targetAreaId,
      stationId: stationName,
      shift: CURRENT_SHIFT,
    })
    if (res.status === 'OK') {
      showToast(t('dndAssign.assignedToast', { name: employee.name, areaName }))
      warnIfOverIdeal(targetAreaId)
    } else {
      showToast(res.message || t('dndAssign.assignFailedFallback'), 'error')
    }
  }

  function requestAssign(employeeId, targetAreaId) {
    const employee = getEmployeeById(employeeId)
    if (!employee) return
    const current = getCurrentAssignment(employeeId)
    // 2026-08-26: antes se usaba hasLineStations() (solo type===PRODUCTION_LINE)
    // -- ahora Accesorios/Paletizado/Insumos/Midea tambien tienen multiples
    // estaciones reales sin ser WC LINEA, asi que el guard es por CANTIDAD
    // real de estaciones, no por tipo de area (ver workstations.js/hasMultipleStations).
    if (hasMultipleStations(targetAreaId)) {
      if (current && current.areaId === targetAreaId) {
        showToast(
          t('dndAssign.alreadyInAreaInfo', {
            name: employee.name,
            areaName: workCenterById(targetAreaId)?.name,
          }),
          'info',
        )
        return
      }
      setStationPicker({ employee, current, targetAreaId })
      return
    }
    const stationName = getWorkstationsForLine(targetAreaId)[0]?.name
    finalize(employee, current, targetAreaId, stationName)
  }

  /* Si la estacion destino ya tiene OTRA persona hoy, no se bloquea
     (2026-08-26, peticion explicita del usuario) -- se pide confirmar
     un intercambio real: swapOrBumpStation (repository.js) decide si
     es swap (ambos ya asignados) o "bump" (A no tenia asignacion, B
     queda liberado). */
  function requestAssignToStation(employeeId, targetAreaId, stationName) {
    const employee = getEmployeeById(employeeId)
    if (!employee) return
    const occupied = getAssignmentsForArea(targetAreaId).find((a) => a.stationId === stationName)
    if (occupied && occupied.employeeId !== employeeId) {
      const occupant = getEmployeeById(occupied.employeeId)
      if (occupant) {
        const current = getCurrentAssignment(employeeId)
        setSwapTarget({
          employeeA: employee,
          employeeB: occupant,
          current,
          targetAreaId,
          stationName,
        })
        return
      }
    }
    const current = getCurrentAssignment(employeeId)
    finalize(employee, current, targetAreaId, stationName)
  }

  function confirmSwap() {
    if (!swapTarget) return
    if (isLider) {
      showToast(t('dndAssign.liderCannotDirectlyMove'), 'error')
      setSwapTarget(null)
      return
    }
    const { employeeA, employeeB, targetAreaId, stationName } = swapTarget
    const res = swapOrBumpStation({
      employeeIdA: employeeA.id,
      toAreaId: targetAreaId,
      toStationId: stationName,
    })
    if (res.status === 'OK') {
      if (res.bumpedEmployeeId) {
        showToast(
          t('dndAssign.swapBumpedToast', {
            employeeAName: employeeA.name,
            employeeBName: employeeB.name,
          }),
        )
      } else {
        showToast(
          t('dndAssign.swapExchangedToast', {
            employeeAName: employeeA.name,
            employeeBName: employeeB.name,
          }),
        )
      }
      warnIfOverIdeal(targetAreaId)
    } else {
      showToast(res.message || t('dndAssign.swapFailedFallback'), 'error')
    }
    setSwapTarget(null)
  }

  /* Quitar a alguien de su area actual (sin asignarlo a otro lado) —
     pide confirmacion ligera y termina el DailyAssignment activo via
     releaseAssignment (repository.js: quita la fila, agrega un
     EmployeeMovement tipo RELEASE, conserva historial).

     Si la persona nunca fue "tocada" hoy (solo aparece en un area
     por su zona del snapshot de BASE, sin DailyAssignment real) no
     hay fila que borrar — se usa el area EFECTIVA (la misma que ve
     el layout, getEffectiveAreaForEmployee) como origen para que el
     RELEASE quede registrado igual y la persona deje de contarse
     ahi. Si no aparece en ninguna area, no hay nada que quitar. */
  function requestRelease(employeeId) {
    const employee = getEmployeeById(employeeId)
    if (!employee) return
    const current = getCurrentAssignment(employeeId)
    const effectiveAreaId = current?.areaId || getEffectiveAreaForEmployee(employeeId)
    if (!effectiveAreaId) return
    setReleaseTarget({
      employee,
      currentAssignment: current || { areaId: effectiveAreaId, stationId: null },
    })
  }

  function confirmRelease() {
    if (!releaseTarget) return
    if (isLider) {
      showToast(t('dndAssign.liderCannotDirectlyMove'), 'error')
      setReleaseTarget(null)
      return
    }
    const { employee, currentAssignment } = releaseTarget
    const areaName = workCenterById(currentAssignment.areaId)?.name || currentAssignment.areaId
    const res = releaseAssignment(employee.id, currentAssignment.areaId)
    if (res.status === 'OK') {
      showToast(t('dndAssign.releasedToast', { name: employee.name, areaName }))
    } else {
      showToast(res.message || t('dndAssign.releaseFailedFallback'), 'error')
    }
    setReleaseTarget(null)
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: value se memoiza UNA sola vez a proposito -- las 3 funciones solo llaman setters de useState (identidad estable entre renders) y nunca leen stationPicker/moveTarget/releaseTarget/swapTarget por closure, asi que recrearlas en cada render solo forzaria un re-render innecesario de todo consumidor de useDndAssign().
  const value = useMemo(() => ({ requestAssign, requestAssignToStation, requestRelease }), [])

  const pickerStations = stationPicker
    ? getLineWorkstationsWithOccupancy(stationPicker.targetAreaId)
    : []

  return (
    <DndAssignContext.Provider value={value}>
      {children}

      <Dialog
        open={Boolean(stationPicker)}
        onOpenChange={(next) => !next && setStationPicker(null)}
      >
        <DialogContent>
          {stationPicker && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {t('dndAssign.stationPickerTitle', {
                    areaName: workCenterById(stationPicker.targetAreaId)?.name,
                  })}
                </DialogTitle>
              </DialogHeader>
              <div className="px-6 pb-6">
                <p className="text-[13px] text-muted-foreground">
                  {t('dndAssign.assigningToLabel')} <b>{stationPicker.employee.name}</b>
                </p>
                <p className="mb-4 text-xs text-muted-foreground">
                  {t('dndAssign.employeeNumberLabel')}{' '}
                  <b>{formatEmployeeNumber(stationPicker.employee.employeeNumber)}</b>{' '}
                  {t('dndAssign.pickerInstructions')}
                </p>
                {/* Cuadrícula (2026-09-11, a petición explícita del usuario viendo Paletizado
                    con 20 puestos reales, "no se ven todos"): antes era una sola columna de
                    filas anchas, necesitaba scroll largo uno por uno. Ahora 2-3 columnas según
                    el ancho, con scroll corto -- mismo dato/comportamiento de siempre. */}
                <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                  {pickerStations.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={!s.isAvailable}
                      onClick={() => {
                        const { employee, current, targetAreaId } = stationPicker
                        setStationPicker(null)
                        finalize(employee, current, targetAreaId, s.name)
                      }}
                      className={cn(
                        'flex flex-col items-start gap-1.5 rounded-[20px] border border-border p-2.5 text-left transition-colors',
                        s.isAvailable
                          ? 'cursor-pointer hover:border-blue-500'
                          : 'cursor-not-allowed opacity-50',
                      )}
                    >
                      <span className="text-[13.5px] font-bold leading-tight">{s.name}</span>
                      <span
                        className={cn(
                          'inline-flex h-5 items-center rounded-full px-2 text-[10.5px] font-bold',
                          s.isAvailable
                            ? 'bg-emerald-500/[0.13] text-emerald-700'
                            : 'bg-slate-400/[0.13] text-slate-500',
                        )}
                      >
                        {s.isAvailable
                          ? t('dndAssign.availableLabel')
                          : t('dndAssign.fullCapacityLabel', {
                              occupants: s.occupants.length,
                              capacity: s.capacity,
                            })}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
                <Button variant="outline" onClick={() => setStationPicker(null)}>
                  {t('dndAssign.cancelButton')}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {moveTarget && (
        <MoveConfirmDialog
          open={Boolean(moveTarget)}
          onClose={() => setMoveTarget(null)}
          employee={moveTarget.employee}
          currentAssignment={moveTarget.currentAssignment}
          presetTo={moveTarget.presetTo}
          onDone={(res) => {
            const toName =
              workCenterById(moveTarget.presetTo.areaId)?.name || moveTarget.presetTo.areaId
            if (res?.pending) {
              showToast(
                t('dndAssign.moveRequestedInfo', { name: moveTarget.employee.name }),
                'info',
              )
            } else {
              const fromName =
                workCenterById(moveTarget.currentAssignment.areaId)?.name ||
                moveTarget.currentAssignment.areaId
              showToast(
                t('dndAssign.movedToast', { name: moveTarget.employee.name, fromName, toName }),
              )
              warnIfOverIdeal(moveTarget.presetTo.areaId)
            }
            setMoveTarget(null)
          }}
        />
      )}

      <Dialog open={Boolean(swapTarget)} onOpenChange={(next) => !next && setSwapTarget(null)}>
        <DialogContent>
          {swapTarget && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {swapTarget.current
                    ? t('dndAssign.swapTitleActive')
                    : t('dndAssign.swapTitleOccupied')}
                </DialogTitle>
              </DialogHeader>
              <div className="px-6 pb-6 text-sm">
                {swapTarget.current ? (
                  <p>
                    <b>{swapTarget.employeeA.name}</b> {t('dndAssign.swapTakesPositionOf')}{' '}
                    <b>{swapTarget.employeeB.name}</b> {t('dndAssign.swapAreaConnector')}{' '}
                    <b>{workCenterById(swapTarget.targetAreaId)?.name}</b> ({swapTarget.stationName}
                    ), {t('dndAssign.swapAndConnector')} <b>{swapTarget.employeeB.name}</b>{' '}
                    {t('dndAssign.swapVacatedPositionOf')} <b>{swapTarget.employeeA.name}</b>{' '}
                    {t('dndAssign.swapAreaConnector')}{' '}
                    <b>{workCenterById(swapTarget.current.areaId)?.name}</b> (
                    {swapTarget.current.stationId}).
                  </p>
                ) : (
                  <p>
                    <b>{swapTarget.stationName}</b> {t('dndAssign.swapOccupiedByLabel')}{' '}
                    <b>{swapTarget.employeeB.name}</b>
                    {t('dndAssign.swapContinueNotice')} <b>{swapTarget.employeeA.name}</b>{' '}
                    {t('dndAssign.swapWillTakePosition')} <b>{swapTarget.employeeB.name}</b>{' '}
                    {t('dndAssign.swapWillBeUnassigned')}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
                <Button variant="outline" onClick={() => setSwapTarget(null)}>
                  {t('dndAssign.cancelButton')}
                </Button>
                <Button onClick={confirmSwap} className="font-bold">
                  {swapTarget.current
                    ? t('dndAssign.swapConfirmButton')
                    : t('dndAssign.swapOccupyButton')}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(releaseTarget)}
        onOpenChange={(next) => !next && setReleaseTarget(null)}
      >
        <DialogContent>
          {releaseTarget && (
            <>
              <DialogHeader>
                <DialogTitle>{t('dndAssign.releaseDialogTitle')}</DialogTitle>
              </DialogHeader>
              <div className="px-6 pb-6 text-sm">
                {t('dndAssign.releaseConfirmPrefix')} <b>{releaseTarget.employee.name}</b>{' '}
                {t('dndAssign.releaseConfirmConnector')}{' '}
                <b>
                  {workCenterById(releaseTarget.currentAssignment.areaId)?.name ||
                    releaseTarget.currentAssignment.areaId}
                </b>
                {t('dndAssign.releaseConfirmSuffix')}
              </div>
              <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
                <Button variant="outline" onClick={() => setReleaseTarget(null)}>
                  {t('dndAssign.cancelButton')}
                </Button>
                <Button variant="destructive" onClick={confirmRelease} className="font-bold">
                  {t('dndAssign.releaseButton')}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DndAssignContext.Provider>
  )
}

export function useDndAssign() {
  return useContext(DndAssignContext)
}
