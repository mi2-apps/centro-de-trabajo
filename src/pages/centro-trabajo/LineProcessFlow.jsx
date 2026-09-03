import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  Map as MapIcon,
  Tv,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  cardClass,
  cardHeaderClass,
  cardHeaderSubtitleClass,
  cardHeaderTitleClass,
} from '@/lib/pageStyles'
import { cn, hexToRgba } from '@/lib/utils'
import { formatEmployeeNumber } from '../../data/personnel/employeeDisplay'
import DraggablePersonChip from '../../ui/DraggablePersonChip'
import { useEmployeeDropTargetStation } from '../../ui/dnd'
import EmployeeAssignSearchBar from './EmployeeAssignSearchBar'
import EmployeeAvatar from './EmployeeAvatar'

/* ─────────────────────────────────────────────
   Reemplazo de "Distribución de estaciones" en LineDetailDrawer.jsx
   (2026-08-31, a peticion explicita del usuario, foto de pizarron
   físico). Historial de rondas (todas a peticion explicita del
   usuario, viendo el Preview en vivo cada vez):
   1) Circulos azules planos con flechas -- rechazado ("esa basura").
   2) Circulos ilustrados con icono Tv y sombra -- rechazado ("quiero
      diseño 2D").
   3) Cajas 2D estilo OperatingFloorPlan.jsx, 8 nodos FIJOS calcados
      del pizarron (N/P.E/LIM/ACE/ET/EM/LIM CAJ/CAL) en zigzag, ancho
      completo, linea de TVs arriba -- aceptado en su mayoria.
   4) Se agrega numero+nombre del empleado real en los nodos con
      posicion real conocida (P.E/LIM/ACE/ET/EM/CAL), flechas mas
      marcadas/3D.
   5) (ESTA VERSION) El usuario aclaro 3 cosas mas: (a) el primer nodo
      no es "N", es "M" de Montaje -- correccion de lectura del
      pizarron, no invencion; (b) WC LINEA 0 tiene 10 posiciones
      reales, no 8 -- el esquema fijo de 8 nodos no le queda; el
      usuario confirmo explicitamente que el diagrama debe generarse
      DINAMICAMENTE desde las estaciones reales de CADA linea
      (`workstations`, mismo array de LineDetailDrawer.jsx) en vez de
      un esquema fijo -- asi cada linea muestra sus posiciones reales
      tal cual, sin importar si son 8, 9 o 10; (c) el modal debe
      mostrar el nombre completo real entre parentesis junto a la
      abreviacion, ej. "M (Montaje) (1)".

   Los 7 roles reales que existen en CT LINEA (Montaje, Prueba
   eléctrica, Limpieza de TV, Suministro de Accesorios, Etiquetado,
   Empaque, Calidad -- ver ROLE_TO_CATEGORY_KEY en lineVisualType.js,
   unica fuente de los nombres reales de rol de este modulo) tienen
   cada uno un color reutilizado de la paleta YA existente en el
   proyecto (los mismos 6 hex de lineVisualType.js + #10B981, el verde
   de "Completa"/"Ocupada" ya usado en el sistema de estados -- nunca
   una paleta inventada de cero). Calidad reutiliza exactamente su
   color real de categoria (#DB2777, lineVisualType.js) -- no es
   coincidencia.

   2026-09-01 (a peticion explicita del usuario): las etiquetas de los
   nodos usan el NOMBRE COMPLETO del rol (Montaje, Prueba eléctrica,
   etc.), ya no las abreviaciones (M, P.E, LIM...) que se usaban antes
   -- se quita ROLE_SHORT_LABELS por completo (sin otros consumidores
   en el repo). */
const ROLE_COLORS = {
  Montaje: '#0D9488',
  'Prueba eléctrica': '#F59E0B',
  'Limpieza de TV': '#2563EB',
  'Suministro de Accesorios': '#7C3AED',
  Etiquetado: '#10B981',
  Empaque: '#64748B',
  'Limpieza de caja': '#EF4444',
  Calidad: '#DB2777',
}

// "Empaque 2" -> "Empaque", "Etiquetado" -> "Etiquetado" (sin sufijo
// numerico no cambia). Mismo patron de normalizacion de rol repetido
// usado en otras partes de este modulo (ver workstations.js).
function baseRoleName(name) {
  return name.replace(/\s+\d+$/, '').trim()
}

/* Orden de FLUJO del diagrama (2026-08-31, septima ronda, a peticion
   explicita del usuario viendo el resultado en vivo): Montaje primero,
   Calidad SIEMPRE al final -- calca el orden real del pizarron
   original (fisicamente se monta primero, la inspeccion de calidad es
   el ultimo paso antes de salir de la linea). Esto es un orden
   PURAMENTE VISUAL para este diagrama -- el usuario confirmo
   explicitamente que NO debe tocar el orden real de `workstations`
   usado en el resto de LineDetailDrawer.jsx (el panel "Detalle de
   estacion" sigue mostrando "Posicion X de Y" con Calidad como
   posicion 1 real, sin cambios -- esa regla de negocio real vive en
   workstations.js y no se toca aqui). */
const FLOW_ORDER_ROLES = [
  'Montaje',
  'Prueba eléctrica',
  'Limpieza de TV',
  'Suministro de Accesorios',
  'Etiquetado',
  'Empaque',
  'Limpieza de caja',
]

function flowPriority(base) {
  if (base === 'Calidad') return Number.POSITIVE_INFINITY
  const idx = FLOW_ORDER_ROLES.indexOf(base)
  return idx === -1 ? FLOW_ORDER_ROLES.length : idx
}

// 2026-09-01 (a peticion explicita del usuario, "el 3 y 4 esten uno
// frente del otro"): Limpieza de TV (3o rol del flujo) y Suministro de
// Accesorios (4o) son la unica excepcion al zigzag -- quedan a la MISMA
// altura ("cara a cara") en vez de alternar fila, a diferencia de
// cualquier otro cambio de rol.
function staysLevelWithPrevious(previousBase, base) {
  return previousBase === 'Limpieza de TV' && base === 'Suministro de Accesorios'
}

/* Arma los nodos del diagrama a partir de las estaciones REALES de la
   linea actual (workstations, ya viene con occupancy resuelta desde
   LineDetailDrawer.jsx -- getLineWorkstationsWithOccupancy), pero
   REORDENADAS solo para este diagrama segun FLOW_ORDER_ROLES (ver
   arriba) -- nunca se muta ni se reordena el array original. El row
   (fila superior/inferior del zigzag) ALTERNA en cada nodo, salvo las
   excepciones explicitas de abajo.

   2026-09-02 (a peticion explicita del usuario, WC LINEA 0 y WC LINEA
   1, los unicos con un rol repetido consecutivo -- Montaje x2 y
   Empaque x2): antes, un rol repetido (mismo nombre base que el nodo
   anterior) NO alternaba fila -- quedaban agrupados uno junto al otro
   en la misma fila. El usuario pidio que Montaje 2 y Empaque 8 esten
   uno arriba y el otro abajo, con la misma flecha que el resto del
   zigzag (la flecha ya sale correcta sola, se calcula del cambio de
   fila -- ver connectorIcon). Se quita la condicion "solo si cambia el
   rol": ahora alterna siempre, tambien entre dos estaciones del mismo
   rol.

   2026-09-02, segunda correccion (a peticion explicita del usuario,
   viendo WC LINEA 0 en vivo -- "los numeros 4 y 5 van arriba y el
   numero 3 va abajo"): Prueba electrica y Limpieza de TV/Suministro de
   Accesorios tienen fila FIJA (no alternada) -- en las 11 lineas el rol
   inmediatamente antes de Prueba electrica siempre alterna igual, asi
   que fijar esta fila no cambia nada en WC LINEA 2-10 (coincide con lo
   que ya salia solo); el UNICO caso real donde esto importa es WC LINEA
   0/1, donde el Montaje duplicado corria la fase del zigzag y dejaba a
   Prueba electrica arriba en vez de abajo. */
function buildNodes(workstations) {
  if (!workstations?.length) return []
  const ordered = [...workstations].sort(
    (a, b) => flowPriority(baseRoleName(a.name)) - flowPriority(baseRoleName(b.name)),
  )
  let lastBase = null
  let row = 2
  return ordered.map((ws, idx) => {
    const base = baseRoleName(ws.name)
    if (base === 'Prueba eléctrica') {
      row = 2
    } else if (base === 'Limpieza de TV') {
      row = 1
    } else if (!staysLevelWithPrevious(lastBase, base)) {
      row = row === 1 ? 2 : 1
    }
    lastBase = base
    return {
      order: idx + 1,
      col: idx + 1,
      row,
      stationName: ws.name,
      label: base,
      color: ROLE_COLORS[base] || '#64748B',
      ws,
    }
  })
}

/* Icono de conector segun el cambio de fila entre un nodo y el
   siguiente (sube/baja/misma fila). */
function connectorIcon(fromRow, toRow) {
  if (toRow < fromRow) return ArrowUpRight
  if (toRow > fromRow) return ArrowDownRight
  return ArrowRight
}

/* Barra "linea de trabajo": franja horizontal con iconos de TV
   repetidos, arriba del diagrama de estaciones -- representa la linea
   principal de producto (a peticion explicita del usuario, foto de
   pizarron: "que la linea de trabajo haya teles"). No esta ligada 1:1
   a las estaciones de abajo, es decorativa/referencial. */
function LineTrack() {
  const tvCount = 8
  return (
    <div className="relative mb-5 flex h-11 items-center overflow-hidden rounded-full border border-border bg-muted/40">
      <div
        className="absolute inset-y-0 left-0 right-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(-45deg, rgba(100,116,139,0.12) 0, rgba(100,116,139,0.12) 6px, transparent 6px, transparent 14px)',
        }}
        aria-hidden="true"
      />
      <div className="relative flex w-full items-center justify-around px-3">
        {Array.from({ length: tvCount }, (_, i) => `tv-${i}`).map((key) => (
          <Tv key={key} className="h-5 w-5 text-muted-foreground/70" strokeWidth={1.75} />
        ))}
      </div>
    </div>
  )
}

/* 2026-09-02, segunda correccion (a peticion explicita del usuario --
   "nunca te dije que quitaras lo de la hoja de proceso, te dije que ahi
   mismo pusieras ese boton de cambiar personal"): "Cambiar personal" NO
   es un dialogo aparte -- vive DENTRO de este mismo modal de "Hoja de
   Proceso"/"Planos por puesto", siempre visible arriba del contenido de
   paso 1/2 (no depende de en que paso este el usuario). Primero muestra
   a quien ocupa el puesto (si hay) + boton "Cambiar personal"; al
   tocarlo aparece el buscador real (EmployeeAssignSearchBar con
   `stationName`, misma logica de asignar/mover/intercambiar que ya usa
   el drag & drop -- nunca un tercer camino). Si el puesto esta
   DISPONIBLE, el buscador aparece de una vez (no hay a quien
   reemplazar). */
function ProcessSheetModal({ node, areaId, onClose, onViewHistory }) {
  const { t } = useTranslation('centroTrabajo')
  const [step, setStep] = useState(0)
  const [changing, setChanging] = useState(false)

  // Reinicia al paso 1 y a "no cambiando" cada vez que se abre con un
  // nodo distinto (si esta disponible, el buscador arranca abierto de
  // una vez, no hay a quien reemplazar).
  useEffect(() => {
    if (node) {
      setStep(0)
      setChanging(!node.ws.occupants?.[0])
    }
  }, [node])

  if (!node) return null

  const isFirstStep = step === 0
  const occupant = node.ws.occupants?.[0]

  return (
    <Dialog open={Boolean(node)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {isFirstStep
              ? t('lineDetailDrawer.processFlowStep1Title')
              : t('lineDetailDrawer.processFlowStep2Title')}
            {' — '}
            {node.stationName} ({node.order})
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-2">
          {occupant && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-[16px] border border-border p-3">
              <div className="flex min-w-0 items-center gap-3">
                <EmployeeAvatar employee={occupant.employee} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-bold">
                    {occupant.employee?.name || '—'}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground">
                    {t('lineDetailDrawer.currentlyAssignedLabel')}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 font-bold"
                onClick={() => onViewHistory(occupant.employee)}
              >
                {t('lineDetailDrawer.viewHistoryButton')}
              </Button>
            </div>
          )}
          {!changing ? (
            <Button onClick={() => setChanging(true)} className="mb-4 w-full font-bold">
              <ArrowLeftRight className="h-4 w-4" />
              {t('lineDetailDrawer.changePersonnelButton')}
            </Button>
          ) : (
            <div className="mb-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
                {t('lineDetailDrawer.searchReplacementLabel')}
              </p>
              <EmployeeAssignSearchBar areaId={areaId} stationName={node.stationName} />
            </div>
          )}

          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
            {t('lineDetailDrawer.processFlowStepIndicator', { current: step + 1, total: 2 })}
          </p>
          <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed border-border bg-black/[.02] px-6 py-10 text-center dark:bg-white/[.03]">
            {isFirstStep ? (
              <FileText className="h-10 w-10 text-muted-foreground/50" />
            ) : (
              <MapIcon className="h-10 w-10 text-muted-foreground/50" />
            )}
            <p className="text-[13.5px] font-bold text-muted-foreground">
              {isFirstStep
                ? t('lineDetailDrawer.processFlowStep1Placeholder')
                : t('lineDetailDrawer.processFlowStep2Placeholder')}
            </p>
          </div>
        </div>
        <div className="flex justify-between gap-2 px-6 pb-5">
          {isFirstStep ? (
            <div />
          ) : (
            <Button variant="ghost" onClick={() => setStep(0)} className="font-bold">
              <ChevronLeft className="h-4 w-4" />
              {t('lineDetailDrawer.processFlowPreviousButton')}
            </Button>
          )}
          {isFirstStep ? (
            <Button onClick={() => setStep(1)} className="font-bold">
              {t('lineDetailDrawer.processFlowNextButton')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={onClose} className="font-bold">
              {t('lineDetailDrawer.processFlowCloseButton')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* Nodo individual del diagrama -- ahora interactivo (2026-09-02, a
   peticion explicita del usuario): zona de suelta (drag & drop, misma
   logica de swap/bump que el resto de la app -- ver dndAssign.jsx) sin
   importar si esta ocupado o disponible; el ocupante (si hay) es
   ademas origen de arrastre, para moverlo de aqui a otro puesto.
   Segunda correccion (mismo dia, "nunca te dije que quitaras lo de la
   hoja de proceso"): el click en TODO el nodo abre el mismo modal de
   siempre (Hoja de Proceso), sin dividir la zona de click -- "Cambiar
   personal" vive DENTRO de ese modal (ver ProcessSheetModal arriba),
   nunca como una zona de click separada aqui. */
function ProcessFlowNode({ node, areaId, onOpenSheet }) {
  const { t } = useTranslation('centroTrabajo')
  const occupant = node.ws.occupants?.[0]
  const { isOver, dropProps } = useEmployeeDropTargetStation(areaId, node.stationName)

  return (
    // biome-ignore lint/a11y/useSemanticElements: no puede ser <button> real -- el ocupante es ademas origen de drag (DraggablePersonChip, draggable=true nativo) y el nodo es blanco de drop de HTML5 DnD (dropProps); ambos casos son incompatibles con un <button> nativo.
    <div
      {...dropProps}
      onClick={onOpenSheet}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenSheet()
        }
      }}
      className="relative z-10 flex w-[168px] shrink-0 cursor-pointer select-none flex-col items-center gap-1 justify-self-center rounded-[20px] border border-t-[3px] p-2.5 text-center transition-[box-shadow,background-color] duration-150 hover:shadow-[0_0_0_2px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_0_0_2px_rgba(255,255,255,0.08)]"
      style={{
        gridColumn: node.col,
        gridRow: node.row,
        borderColor: isOver ? '#3B82F6' : hexToRgba(node.color, 0.35),
        borderTopColor: node.color,
        backgroundColor: isOver ? 'rgba(59,130,246,0.12)' : hexToRgba(node.color, 0.05),
      }}
    >
      <span
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white"
        style={{ backgroundColor: node.color }}
      >
        {node.order}
      </span>
      <p className="text-[11.5px] font-extrabold leading-[1.15]" style={{ color: node.color }}>
        {node.label}
      </p>
      {occupant ? (
        <DraggablePersonChip
          employeeId={occupant.employee?.id}
          className="mt-0.5 w-full border-t border-border/60 pt-1"
        >
          <p className="truncate text-[11px] font-bold">
            {formatEmployeeNumber(occupant.employeeNumber)}
          </p>
          <p className="truncate text-[10.5px] text-muted-foreground">
            {occupant.employee?.name || '—'}
          </p>
        </DraggablePersonChip>
      ) : (
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.3px] text-muted-foreground/70">
          {t('lineDetailDrawer.stationAvailableStatus')}
        </p>
      )}
    </div>
  )
}

export default function LineProcessFlow({ workstations, areaId, headerAction, onViewHistory }) {
  const { t } = useTranslation('centroTrabajo')
  const [activeNode, setActiveNode] = useState(null)
  const nodes = useMemo(() => buildNodes(workstations), [workstations])

  if (!nodes.length) return null

  const totalCols = nodes.length

  return (
    <div className={cn(cardClass, 'mb-4')}>
      <div className={cardHeaderClass}>
        <div className="min-w-0 flex-1">
          <p className={cardHeaderTitleClass}>{t('lineDetailDrawer.stationDistributionTitle')}</p>
          <p className={cardHeaderSubtitleClass}>
            {t('lineDetailDrawer.stationDistributionSubtitle')}
          </p>
        </div>
        {/* Takt Time (teorico y real) se movio a su propia card -- TaktTimeCard.jsx, renderizada en
            LineDetailDrawer.jsx justo debajo de la barra de busqueda, con mas espacio (2026-09-03,
            a peticion explicita del usuario: "agrega una card para que tengas mas espacio... quiero
            la card... en las 11 lineas haya o no haya pzs"). Ya no vive aqui, comprimida en el
            header junto a "Configurar puestos". */}
        {/* 2026-09-01 (a peticion explicita del usuario): "Configurar
            puestos" se mueve aqui (arriba a la derecha) -- antes vivia en su
            propia card junto con la leyenda de JERARQUIA/TIPO DE PUESTO
            (LineVisualLegend), que se quito por completo de esta pantalla. */}
        {headerAction}
      </div>
      <div className="overflow-x-auto p-5 md:p-7">
        <div style={{ minWidth: `${Math.max(1100, totalCols * 184)}px` }}>
          <LineTrack />
          <div
            className="grid items-center gap-x-1 gap-y-6"
            style={{
              gridTemplateColumns: `repeat(${totalCols}, 1fr)`,
              gridTemplateRows: 'auto auto',
            }}
          >
            {nodes.map((node) => (
              <ProcessFlowNode
                key={node.order}
                node={node}
                areaId={areaId}
                onOpenSheet={() => setActiveNode(node)}
              />
            ))}
            {nodes.slice(0, -1).map((node, idx) => {
              const next = nodes[idx + 1]
              const Icon = connectorIcon(node.row, next.row)
              return (
                <div
                  key={`connector-${node.order}`}
                  className="pointer-events-none flex items-center justify-center"
                  style={{
                    gridColumn: `${node.col} / span 2`,
                    gridRow:
                      node.row === next.row ? node.row : `${Math.min(node.row, next.row)} / span 2`,
                  }}
                >
                  {/* Flechas "mas marcadas y 3D negreadas" (a peticion
                      explicita del usuario): icono mas grande, trazo mas
                      grueso, color oscuro solido + una copia desplazada
                      detras (mismo color, opacidad baja) simulando una
                      sombra/relieve 3D. */}
                  <div className="relative">
                    <Icon
                      className="absolute left-[1.5px] top-[1.5px] h-7 w-7 text-black/25 dark:text-black/40"
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                    <Icon
                      className="relative h-7 w-7 text-slate-700 dark:text-slate-300"
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <ProcessSheetModal
        node={activeNode}
        areaId={areaId}
        onClose={() => setActiveNode(null)}
        onViewHistory={(employee) => {
          setActiveNode(null)
          onViewHistory?.(employee)
        }}
      />
    </div>
  )
}
