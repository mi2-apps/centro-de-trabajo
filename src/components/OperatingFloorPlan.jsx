import { Focus, Info, Maximize, Minimize, Minus, Plus, User, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { getPersonnelRank } from '../data/personnel/rankSystem'
import { getLineWorkstationsWithOccupancy } from '../data/personnel/repository'
import { usePersonnelVersion } from '../data/personnel/usePersonnelVersion'
import {
  AREA_STATION_SOURCE_OVERRIDE,
  canonicalOperationalAreaId,
  operationalGroupMembers,
  WORK_CENTERS,
  workCenterById,
} from '../data/production/catalog'
import { FFT_LINE_IDS, SUPPORT_CARD_AREA_IDS } from '../data/production/floorPlanZones'
import {
  getAreaHeadcount,
  getAreaStaffing,
  getFftPeopleWithLine,
  getGroupAreaStaffing,
  getGroupPeople,
  getPeopleByArea,
  getStaffingTotals,
  hasAnyPersonnelToday,
} from '../data/production/personnelByArea'
import EmployeeAvatar from '../pages/centro-trabajo/EmployeeAvatar'
import { useSelectedWorkCenter } from '../pages/centro-trabajo/useSelectedWorkCenter'
import DraggablePersonChip from '../ui/DraggablePersonChip'
import { useEmployeeDropTarget } from '../ui/dnd'

/* ─────────────────────────────────────────────
   "Área operando" -- plano 2D completo (rediseño 2026-08-24 a partir
   del mockup que el usuario compartió). Componente compartido: vive en
   Layout2DPage (ruta /layout-2d) y en Centro de Trabajo > Áreas de
   trabajo (AreasLayoutView.jsx, reemplazo de WorkAreaMap, 2026-08-25) --
   una sola fuente de verdad visual, nunca dos planos que puedan
   desincronizarse. Cada pagina solo monta <OperatingFloorPlan /> dentro
   de su propio contenedor (cada una le pone su propio Paper de tarjeta
   por fuera). Ya NO vive en el Dashboard (se quito de ahi a peticion
   explicita del usuario, 2026-08-25) -- readOnly sigue existiendo como
   capacidad del componente por si algun consumidor futuro lo necesita
   de solo lectura, pero hoy ningun caller real lo usa.

   Decisiones explícitas del usuario (2026-08-24, salvo donde se anota):
   - 2026-08-28 ("Corregir diseño y estructura del Conveyor General"):
     la decision de "los dos conveyors son solo decoracion, prohibido
     crear card" se REVIERTE explicitamente -- ahora existe UN solo
     bloque real "CONVEYOR GENERAL" (ver ConveyorGeneralBar), con sus 2
     puestos reales ("Ayudante General de Conveyor", ver
     AREA_STATION_SOURCE_OVERRIDE en catalog.js -- viven fisicamente en
     WC Paletizado, esto es solo una VENTANA hacia ellos). Alineado por
     CSS Grid (misma fila del grid que fft/highvalue/palletizing, ver
     gridTemplateAreas mas abajo -- nunca un ancho en % calculado a ojo).
     2026-08-28, segunda correccion: pasa de "inicio de WC LINEA 2 -- fin
     de WC Midea" a "de extremo a extremo" (columna 1 a 15 completas,
     inicio de WC LINEA 1 -- fin de WC Paletizado), a peticion explicita
     del usuario.
   - "WC Sellado" no aparece en este módulo bajo ninguna forma.
   Ver floorPlanZones.js para el detalle completo de estas exclusiones
   y los ajustes de fusion/intercambio de cajas (Paletizado, Insumos+
   Suministro, Midea+Mixtos, Accesorios).

   Los conteos en vivo salen de las mismas funciones que ya usan
   AreaSummaryStrip/WorkAreaMap (personnelByArea.js) -- ninguna fuente
   de datos paralela; usePersonnelVersion() cubre tanto cambios
   locales como el sondeo del backend real (Fase 2) sin plomería
   extra.

   Fase 6c (Centro de Trabajo): portado de MUI a Tailwind. La matemática
   de interacción (zoom/ajustar vista/pantalla completa/CSS Grid de
   alineación/drag&drop) se deja INTACTA -- solo cambia la capa visual
   (sx -> className). El grid-template-columns/rows/areas se mantiene
   como `style` inline literal (no como clases Tailwind) para no
   arriesgar ni un pixel de la alineación ya afinada explícitamente por
   el usuario en varias rondas. */

function buildStatusMeta(t) {
  return {
    COMPLETA: {
      label: t('operatingFloorPlan.statusCompleteLabel'),
      description: t('operatingFloorPlan.statusCompleteDescription'),
    },
    FALTA: {
      label: t('operatingFloorPlan.statusMissingLabel'),
      description: t('operatingFloorPlan.statusMissingDescription'),
    },
    PARCIAL: {
      label: t('operatingFloorPlan.statusPartialLabel'),
      description: t('operatingFloorPlan.statusPartialDescription'),
    },
    SIN_PERSONAL: {
      label: t('operatingFloorPlan.statusNoneLabel'),
      description: t('operatingFloorPlan.statusNoneDescription'),
    },
  }
}

/* Clases Tailwind por estado -- los 4 colores de STATUS_META (antes hex
   MUI: #10B981/#EF4444/#3B82F6/#94A3B8) son exactamente los defaults de
   Tailwind (emerald-500/red-500/blue-500/slate-400), así que en vez de
   `alpha()` en tiempo de ejecución se usan clases con opacidad entre
   corchetes -- el MISMO número decimal que antes recibía `alpha(color, N)`,
   nunca un valor inventado. Todos los literales completos están escritos
   tal cual (Tailwind no puede descubrir clases armadas por interpolación
   de string en tiempo de ejecución). */
const ZONE_TONE = {
  COMPLETA: {
    border: 'border-emerald-500/[0.35]',
    border30: 'border-emerald-500/[0.3]',
    borderTop: 'border-t-emerald-500',
    borderLeft: 'border-l-emerald-500',
    bgIdle: 'bg-emerald-500/[0.035] dark:bg-emerald-500/[0.05]',
    bgIdleAlt: 'bg-emerald-500/[0.06] dark:bg-emerald-500/[0.1]',
    ring25: 'hover:shadow-[0_0_0_2px_rgba(16,185,129,.25)]',
    ring20: 'hover:shadow-[0_0_0_2px_rgba(16,185,129,.2)]',
    track18: 'bg-emerald-500/[0.18]',
    divider25: 'bg-emerald-500/[0.25]',
    chip: 'bg-emerald-500/[0.15] text-emerald-500',
    fill55: 'bg-emerald-500/[0.55]',
    empty8: 'bg-emerald-500/[0.08]',
    itemBorder25: 'border-emerald-500/[0.25]',
    solid: 'bg-emerald-500',
    text: 'text-emerald-500',
  },
  FALTA: {
    border: 'border-red-500/[0.35]',
    border30: 'border-red-500/[0.3]',
    borderTop: 'border-t-red-500',
    borderLeft: 'border-l-red-500',
    bgIdle: 'bg-red-500/[0.035] dark:bg-red-500/[0.05]',
    bgIdleAlt: 'bg-red-500/[0.06] dark:bg-red-500/[0.1]',
    ring25: 'hover:shadow-[0_0_0_2px_rgba(239,68,68,.25)]',
    ring20: 'hover:shadow-[0_0_0_2px_rgba(239,68,68,.2)]',
    track18: 'bg-red-500/[0.18]',
    divider25: 'bg-red-500/[0.25]',
    chip: 'bg-red-500/[0.15] text-red-500',
    fill55: 'bg-red-500/[0.55]',
    empty8: 'bg-red-500/[0.08]',
    itemBorder25: 'border-red-500/[0.25]',
    solid: 'bg-red-500',
    text: 'text-red-500',
  },
  PARCIAL: {
    border: 'border-blue-500/[0.35]',
    border30: 'border-blue-500/[0.3]',
    borderTop: 'border-t-blue-500',
    borderLeft: 'border-l-blue-500',
    bgIdle: 'bg-blue-500/[0.035] dark:bg-blue-500/[0.05]',
    bgIdleAlt: 'bg-blue-500/[0.06] dark:bg-blue-500/[0.1]',
    ring25: 'hover:shadow-[0_0_0_2px_rgba(59,130,246,.25)]',
    ring20: 'hover:shadow-[0_0_0_2px_rgba(59,130,246,.2)]',
    track18: 'bg-blue-500/[0.18]',
    divider25: 'bg-blue-500/[0.25]',
    chip: 'bg-blue-500/[0.15] text-blue-500',
    fill55: 'bg-blue-500/[0.55]',
    empty8: 'bg-blue-500/[0.08]',
    itemBorder25: 'border-blue-500/[0.25]',
    solid: 'bg-blue-500',
    text: 'text-blue-500',
  },
  SIN_PERSONAL: {
    border: 'border-slate-400/[0.35]',
    border30: 'border-slate-400/[0.3]',
    borderTop: 'border-t-slate-400',
    borderLeft: 'border-l-slate-400',
    bgIdle: 'bg-slate-400/[0.035] dark:bg-slate-400/[0.05]',
    bgIdleAlt: 'bg-slate-400/[0.06] dark:bg-slate-400/[0.1]',
    ring25: 'hover:shadow-[0_0_0_2px_rgba(148,163,184,.25)]',
    ring20: 'hover:shadow-[0_0_0_2px_rgba(148,163,184,.2)]',
    track18: 'bg-slate-400/[0.18]',
    divider25: 'bg-slate-400/[0.25]',
    chip: 'bg-slate-400/[0.15] text-slate-400',
    fill55: 'bg-slate-400/[0.55]',
    empty8: 'bg-slate-400/[0.08]',
    itemBorder25: 'border-slate-400/[0.25]',
    solid: 'bg-slate-400',
    text: 'text-slate-400',
  },
}

// isOver (arrastrando encima): siempre azul, sin importar el estado real
// del área -- mismo comportamiento que antes (`isOver ? '#3B82F6' : ...`).
const OVER_TONE = {
  border: 'border-blue-500',
  bg: 'bg-blue-500/[0.08] dark:bg-blue-500/[0.18]',
}

function toneFor(status) {
  return ZONE_TONE[status] || ZONE_TONE.SIN_PERSONAL
}

// Nodo de Conveyor General (ConveyorNode): 2 colores fijos, ocupado/vacante
// -- no dependen de STATUS_META.
const NODE_TONE = {
  occupied: {
    border: 'border-emerald-500/[0.4]',
    hoverBg: 'hover:bg-emerald-500/[0.07] dark:hover:bg-emerald-500/[0.14]',
    text: 'text-emerald-500',
  },
  vacant: {
    border: 'border-amber-500/[0.4]',
    hoverBg: 'hover:bg-amber-500/[0.07] dark:hover:bg-amber-500/[0.14]',
    text: 'text-amber-500',
  },
}

/* 4 estados a partir de real/ideal (2026-08-24, a peticion del
   usuario) -- getAreaStaffing() de personnelByArea.js solo distingue
   COMPLETA/FALTAN/SIN_PLANTILLA; esta clasificacion mas fina es
   puramente de presentacion para este modulo, no cambia esa funcion
   compartida. null cuando el area no tiene plantilla oficial (se
   muestra aparte, sin barra de estado). */
function statusFor(real, ideal) {
  if (ideal == null) return null
  if (real <= 0) return 'SIN_PERSONAL'
  if (real >= ideal) return 'COMPLETA'
  if (real >= ideal - 1 || real / ideal >= 0.75) return 'PARCIAL'
  return 'FALTA'
}

function statusText(t, status, staffing) {
  if (!status) return null
  const statusMeta = buildStatusMeta(t)
  if (status === 'COMPLETA' || status === 'SIN_PERSONAL') return statusMeta[status].label
  return t('operatingFloorPlan.statusMissingCountSuffix', {
    label: statusMeta[status].label,
    missing: staffing.ideal - staffing.real,
  })
}

// 2026-08-26 ("Reestructuracion operativa FFT"): se excluyen tambien las
// areas `active:false` sin fusion (SOPORTE, archivada de verdad) -- las
// fusionadas (BOX_PREP/SUMINISTRO_MATERIAL, canonico=INSUMOS) se quedan,
// su personal real sigue siendo personal real, solo ahora conceptualmente
// pertenece a Insumos (mismo criterio que getStaffingTotals()).
// CONVEYOR_PRINCIPAL/CONVEYOR_SECUNDARIO/SELLADO se excluyen SIEMPRE de
// aqui, sin importar su `active` (2026-08-28, "corrección navegación
// Conveyor General": CONVEYOR_PRINCIPAL volvio a `active:true` pero sus 2
// puestos reales siguen viviendo en Paletizado -- getAreaHeadcount('PALETIZADO')
// ya los cuenta; si tambien se sumara getAreaHeadcount('CONVEYOR_PRINCIPAL')
// aqui se duplicarian en el total "N personas" del encabezado).
const SHOWN_AREA_IDS = WORK_CENTERS.filter(
  (w) => w.id !== 'CONVEYOR_PRINCIPAL' && w.id !== 'CONVEYOR_SECUNDARIO' && w.id !== 'SELLADO',
)
  .filter((w) => w.active !== false || canonicalOperationalAreaId(w.id) !== w.id)
  .map((w) => w.id)

/* readOnly: por defecto false (interactivo) -- ni Layout2DPage.jsx ni
   AreasLayoutView.jsx (Centro de Trabajo) lo pasan, ambos quieren
   click/drag&drop/asignar. Se conserva la capacidad de solo lectura por
   si algun consumidor futuro la necesita (era la usada por el Dashboard
   hasta que se le quito el layout, 2026-08-25). */
export default function OperatingFloorPlan({ readOnly = false }) {
  const { t } = useTranslation('centroTrabajo')
  const statusMeta = useMemo(() => buildStatusMeta(t), [t])
  usePersonnelVersion()
  /* 2026-08-27 (a peticion explicita del usuario): el click directo en
     una zona del plano ahora abre el detalle a traves del MISMO estado
     compartido (?area= en la URL) que ya usa CentroTrabajoPage.jsx --
     antes este componente tenia su propio useState local (assignAreaId)
     e instanciaba su PROPIO <AreaDetail>, completamente desconectado de
     lo que las pestañas "Lineas"/"Estaciones" creian abierto (un click
     aqui nunca actualizaba esa otra vista). openWorkCenter() solo
     actualiza la URL; el UNICO <AreaDetail> que de verdad se renderiza
     para /centro-trabajo sigue viviendo en CentroTrabajoPage.jsx. */
  const { openWorkCenter } = useSelectedWorkCenter()
  const [zoom, setZoom] = useState(1)
  const [autoZoom, setAutoZoom] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const wrapperRef = useRef(null)
  const planRef = useRef(null)
  const floorRef = useRef(null)

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // 2026-09-02 (correccion a peticion explicita del usuario: "que se vea
  // completo de verdad" al hacer click en pantalla completa) -- ANTES el
  // Fullscreen API se pedia sobre planRef (solo el plano) -- la leyenda
  // "Area operando" y la barra de zoom/salir viven FUERA de planRef, asi
  // que al entrar a pantalla completa el navegador solo pinta planRef y
  // sus hijos: la leyenda y los controles (incluido el boton para salir)
  // desaparecian por completo. Ahora se pide sobre wrapperRef, que envuelve
  // TODO (leyenda + toolbar + plano), asi que en pantalla completa se sigue
  // viendo/usando todo -- solo cambia el layout a columna con el plano
  // ocupando el espacio restante (ver className mas abajo).
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen()
    else wrapperRef.current?.requestFullscreen?.()
  }

  /* "Ajustar vista" real (2026-08-25, a peticion explicita del usuario):
     calcula la escala a partir del ancho disponible del contenedor y el
     ancho natural del plano (floorRef, sin transform -- transform no
     afecta el layout box, solo el pintado, asi que scrollWidth siempre
     da el tamaño real sin escalar). Nunca oculta contenido: solo ajusta
     escala; si el contenedor es mas angosto que el plano, la escala baja
     pero el usuario siempre puede hacer scroll interno para ver el resto.
     Se recalcula solo, mientras el usuario no haya tocado +/- a mano
     (autoZoom), para reaccionar a resize/rotacion de tablet sin pisar un
     zoom manual. */
  function computeFit() {
    const container = planRef.current
    const floor = floorRef.current
    if (!container || !floor?.scrollWidth) return 1
    const availableWidth = container.clientWidth - 4
    return Math.max(0.5, Math.min(1.4, +(availableWidth / floor.scrollWidth).toFixed(2)))
  }

  function fitToScreen() {
    setAutoZoom(true)
    setZoom(computeFit())
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: computeFit lee planRef/floorRef (refs estables) y no debe re-crear el observer en cada render -- solo reacciona a cambios de autoZoom, igual que antes con el eslint-disable original.
  useEffect(() => {
    const container = planRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    let frame = null
    const observer = new ResizeObserver(() => {
      if (!autoZoom) return
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setZoom(computeFit()))
    })
    observer.observe(container)
    setZoom(computeFit())
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [autoZoom])

  // Click en cualquier zona con area real (2026-08-25, a peticion explicita
  // del usuario: arrastrar Y asignar debe funcionar en TODAS las zonas de
  // Layout 2D, igual que en Centro de Trabajo -- antes solo Conveyor
  // Principal/Secundario lo permitian). En readOnly (Dashboard) se comporta
  // EXACTAMENTE igual que siempre: solo abre el detalle de solo lectura.
  function handleZoneOpen(areaId) {
    if (readOnly) {
      setDetailId(areaId)
      return
    }
    openWorkCenter(areaId)
  }

  const operating = hasAnyPersonnelToday()
  const totals = getStaffingTotals()
  const totalPeople = SHOWN_AREA_IDS.reduce((sum, id) => sum + getAreaHeadcount(id), 0)

  return (
    <div
      ref={wrapperRef}
      className={cn('bg-background p-5', isFullscreen && 'flex h-screen flex-col')}
    >
      {/* Leyenda superior (2026-08-25, correccion definitiva a peticion
          explicita del usuario): UNICA leyenda del plano -- reemplaza el
          aviso azul de "mapeo no confirmado" que vivia aqui antes (se
          quito por completo, no aporta nada operativo al dia a dia) y a
          la vieja leyenda flotante de abajo (eliminada, ver mas abajo:
          ya no existe showLegend/Paper de "Referencias" al fondo). Los
          totales (personas/cobertura) son los mismos que ya se
          calculaban arriba -- ninguna fuente de datos nueva. */}
      <div className="mb-4 shrink-0 rounded-[20px] border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                operating ? 'bg-emerald-500' : 'bg-slate-400',
              )}
            />
            <p className="text-[17px] font-extrabold">
              {t('operatingFloorPlan.areaOperatingTitle')}
            </p>
          </div>

          <div className="flex flex-1 flex-wrap justify-center gap-5">
            {Object.entries(statusMeta).map(([status, meta]) => (
              <LegendItem
                key={meta.label}
                dotClass={toneFor(status).solid}
                label={meta.label}
                description={meta.description}
              />
            ))}
            <LegendItem
              icon={<Info className="h-[15px] w-[15px]" />}
              label={t('operatingFloorPlan.referencesLabel')}
              description={t('operatingFloorPlan.referencesDescription')}
            />
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <InfoStat
              icon={<Users className="h-4 w-4" />}
              value={t('operatingFloorPlan.peopleCountLabel', { count: totalPeople })}
              label={t('operatingFloorPlan.totalAssignedLabel')}
            />
            <InfoStat
              value={`${totals.realTotal} / ${totals.idealTotal}`}
              label={t('operatingFloorPlan.catalogCoverageLabel')}
            />
          </div>
        </div>
      </div>

      <div className="mb-3 flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={fitToScreen}
          className="h-9 font-bold text-muted-foreground"
        >
          <Focus className="h-4 w-4" />
          {t('operatingFloorPlan.fitViewButton')}
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                setAutoZoom(false)
                setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))
              }}
            >
              <Minus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('operatingFloorPlan.zoomOutTooltip')}</TooltipContent>
        </Tooltip>
        <span className="w-[34px] text-center text-xs font-bold">{Math.round(zoom * 100)}%</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                setAutoZoom(false)
                setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('operatingFloorPlan.zoomInTooltip')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isFullscreen
              ? t('operatingFloorPlan.exitFullscreenTooltip')
              : t('operatingFloorPlan.enterFullscreenTooltip')}
          </TooltipContent>
        </Tooltip>
      </div>

      <div
        ref={planRef}
        className={cn(
          'overflow-auto overscroll-x-contain bg-background',
          isFullscreen && 'min-h-0 flex-1',
        )}
      >
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            transition: 'transform .15s ease',
            width: `${100 / zoom}%`,
          }}
        >
          <FloorPlan
            floorRef={floorRef}
            onOpen={handleZoneOpen}
            onOpenSummary={setDetailId}
            readOnly={readOnly}
          />
        </div>
      </div>

      <DetailDialog areaId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}

/* Item de leyenda de dos lineas (etiqueta + descripcion), a partir del
   mockup que el usuario compartio 2026-08-25 -- reemplaza los Chips de
   una sola linea que habia antes. */
function LegendItem({ dotClass, icon, label, description }) {
  return (
    <div className="flex items-start gap-1.5">
      {icon || <span className={cn('mt-[3.2px] h-2 w-2 shrink-0 rounded-full', dotClass)} />}
      <div className="flex flex-col">
        <p className="text-[11.5px] font-bold leading-[1.2]">{label}</p>
        <p className="text-[10px] leading-[1.2] text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

/* Bloque de totales (personas asignadas / cobertura del catalogo) --
   mismos valores ya calculados arriba (totalPeople, totals), solo
   presentacion nueva a dos lineas junto a la leyenda. */
function InfoStat({ icon, value, label }) {
  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-1">
        {icon}
        <p className="text-[13.5px] font-extrabold">{value}</p>
      </div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}

function FloorPlan({ floorRef, onOpen, onOpenSummary, readOnly }) {
  const { t } = useTranslation('centroTrabajo')
  return (
    <div ref={floorRef} className="min-w-[1180px]">
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns:
            'minmax(90px,0.7fr) minmax(90px,0.7fr) repeat(10, minmax(56px,1fr)) minmax(150px,1.1fr) minmax(108px,0.8fr) minmax(190px,1.3fr)',
          /* minmax(_, auto) en vez de px fijo (2026-08-25, correccion
             definitiva a peticion explicita del usuario): esa altura sigue
             siendo el piso normal de siempre, pero ya nunca es un techo que
             recorte personal en silencio si una caja necesita mas espacio --
             cada lista interna ya tiene su propio scroll (PersonList,
             overflow:auto), esto es solo una red de seguridad adicional.
             Fila 0 (2026-08-28, "Corregir diseño y estructura del Conveyor
             General", a peticion explicita del usuario): antes las 2 barras
             de Conveyor vivian FUERA de este grid (Stack de ancho libre, sin
             relacion real con las columnas de abajo). Ahora "conveyor" es
             una fila mas de ESTE MISMO grid -- por eso su alineacion con
             WC LINEA2..10/WC Midea es exacta incluso si cambia el viewport,
             nunca un porcentaje calculado a ojo. */
          gridTemplateRows: 'auto minmax(250px, auto) minmax(160px, auto)',
          /* Fila 2 (2026-08-26, "Reestructuracion operativa FFT", a peticion
             explicita del usuario): antes eran 4 celdas independientes
             (pnp/boxprep/stock/accessories) -- ahora "insumos" (fusion de
             PNP/POC/PEN + Box Prep + Insumos + Suministro de material, ver
             InsumosSuministroZone) ocupa las primeras 7 columnas (desde
             donde empezaba PNP hasta aproximadamente donde termina, arriba,
             la 5a columna del bloque FFT -- Parte 27 del pedido) y
             "accessories" ocupa las 7 columnas siguientes (Parte 28: se
             extiende "hasta Línea 6"). Las columnas de FFT/highvalue/
             palletizing (fila 1) NO se tocaron -- solo se redistribuyo el
             span interno de la fila 2 sobre las mismas 15 columnas de
             siempre, sin overlap (verificado: 7+7+1=15).
             Fila 0 ("conveyor", 2026-08-28, segunda correccion, a peticion
             explicita del usuario -- "de extremo a extremo... que empiece
             desde WC LINEA 1 y termine en WC Paletizado"): ocupa las 15
             columnas completas -- desde la columna 1 hasta la columna 15
             (area "palletizing", WC Paletizado). Antes dejaba "." en
             columnas 1-2 y 15 para no invadir esas dos cards; ahora las
             cubre por completo (edge-to-edge del grid), a peticion
             explicita del usuario -- las cards de abajo (fila 1/2) no
             cambian de posicion/tamaño, el Conveyor solo pasa por ENCIMA de
             ellas en su propia fila.
             Columnas 1-2, fila 1 (2026-08-30, a peticion explicita del
             usuario, "WC LINEA 0 ya no debe mostrarse como area/card
             independiente"; corregido el mismo dia -- el usuario aclaro que
             el AGRUPAMIENTO/conteo esta bien pero el diseño visual debe
             seguir siendo el de antes, solo con WC LINEA 0 primero y LINEA 1
             despues, ambas horizontales): el area "paletizado" (columnas
             1-2) se conserva exactamente como antes -- WC LINEA 0/PROYECTO y
             LINEA1 se siguen dibujando como barras horizontales aparte, no
             como columna dentro de FftBlock. Lo unico que cambio de verdad
             (y se conserva) es el AGRUPAMIENTO logico: FFT_LINE_IDS
             (floorPlanZones.js) ya incluye PROYECTO, asi que el total
             mostrado en el header de "WC Líneas de producción (FFT)" suma
             las 11 lineas (antes solo sumaba LINEA1..10); ver
             FFT_COLUMN_LINE_IDS mas abajo para las columnas verticales
             (LINEA2..10, sin cambios). */
          /* 2026-09-02 (a peticion explicita del usuario, "has mas grande
             paletizado a la altura de conveyor y juntalas cards, es uno
             solo, pero no le cambies los nombres solo juntalos"): la
             columna 15 ("palletizing") ahora ocupa TAMBIEN la fila 0
             (antes "." -- un hueco vacio arriba de WC Paletizado, a la
             misma altura que WC Conveyor General). Paletizado crece hacia
             arriba y su borde superior queda al ras del de Conveyor,
             leyendose como un solo bloque vertical continuo -- ningun
             nombre/etiqueta cambia, ninguna otra columna/fila se toca. */
          gridTemplateAreas: `
            "conveyor conveyor conveyor conveyor conveyor conveyor conveyor conveyor conveyor conveyor conveyor conveyor conveyor conveyor palletizing"
            "fft fft fft fft fft fft fft fft fft fft fft fft highvalue highvalue palletizing"
            "insumos insumos insumos insumos insumos insumos insumos accessories accessories accessories accessories accessories accessories accessories palletizing"
          `,
        }}
      >
        <ConveyorGeneralBar gridArea="conveyor" onOpen={onOpen} readOnly={readOnly} />

        <FftBlock onOpen={onOpen} onOpenSummary={onOpenSummary} readOnly={readOnly} />

        <BigZone
          areaId="HIGH_VALUE"
          gridArea="highvalue"
          title={t('operatingFloorPlan.midaHighValueTitle')}
          onOpen={onOpen}
          readOnly={readOnly}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 gap-2">
              <div className="min-w-0 flex-[1.4]">
                <HighValueGrid areaId="HIGH_VALUE" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1 border-l border-dashed border-border pl-2">
                <p className="text-center text-[9.5px] font-bold text-muted-foreground">
                  {t('operatingFloorPlan.mixedProductsLabel')}
                </p>
                <MixtosDecoration />
              </div>
            </div>
            {/* Nombres reales debajo de la cuadricula decorativa (2026-08-25, a
                peticion explicita del usuario: si hay personal en cualquier
                area, debe verse su nombre igual que en WC Accesorios, no solo
                un indicador visual abstracto). */}
            <div className="mt-1.5 min-h-0 flex-1 overflow-auto border-t border-dashed border-border pt-1.5">
              <PersonList areaId="HIGH_VALUE" columns={2} readOnly={readOnly} />
            </div>
          </div>
        </BigZone>

        <BigZone
          areaId="PALETIZADO"
          gridArea="palletizing"
          squareTopLeft
          title={t('operatingFloorPlan.palletizingTitle')}
          onOpen={onOpen}
          readOnly={readOnly}
        >
          <PersonList areaId="PALETIZADO" columns={2} readOnly={readOnly} />
        </BigZone>

        <InsumosSuministroZone
          gridArea="insumos"
          onOpen={onOpen}
          onOpenSummary={onOpenSummary}
          readOnly={readOnly}
        />

        <BigZone
          areaId="ACCESORIOS"
          gridArea="accessories"
          title={t('operatingFloorPlan.accessoriesTitle')}
          onOpen={onOpen}
          readOnly={readOnly}
        >
          <PersonList areaId="ACCESORIOS" columns={2} readOnly={readOnly} />
        </BigZone>
      </div>

      <div className="mt-3 border-t border-dashed border-border pt-3">
        <div className="flex flex-wrap gap-2">
          {SUPPORT_CARD_AREA_IDS.map((id) => (
            <SupportCard key={id} areaId={id} onOpen={onOpen} readOnly={readOnly} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* WC Conveyor General -- UN SOLO bloque (2026-08-28, "Corregir diseño y
   estructura del Conveyor General", a peticion explicita del usuario:
   reemplaza las 2 barras decorativas "CONVEYOR PRINCIPAL"/"CONVEYOR
   SECUNDARIO" de antes). Mismo lenguaje visual que BigZone (fondo segun
   estado, borde superior de color, hover con box-shadow) para no introducir
   un estilo nuevo, pero MAS compacto (menos padding, sin PersonList de lista
   larga).

   2026-08-28 ("corrección navegación Conveyor General", tercera ronda, a
   peticion explicita del usuario -- CORRIGE un bug reportado, NO la decision
   de fondo de la ronda anterior): esta barra sigue leyendo EXACTAMENTE los 2
   puestos reales "Ayudante General de Conveyor" que viven dentro de
   CUSTOM_STATION_PLANS.PALETIZADO (AREA_STATION_SOURCE_OVERRIDE.CONVEYOR_PRINCIPAL,
   catalog.js -- misma fuente que usa el header del bloque abajo, nunca
   hardcodeada dos veces) -- eso NO cambio, sigue siendo "una sola fuente
   real de asignación", nunca doble conteo. Lo que SI cambio: click en el
   bloque O en cualquier posicion ahora abre CONVEYOR_PRINCIPAL (su propia
   pantalla de detalle, LineLikeAreaDetail via onOpen -- ver
   AREA_STATION_SOURCE_OVERRIDE en ese componente para como lee los mismos 2
   puestos desde Paletizado), NO WC Paletizado completo -- bug reportado por
   el usuario ("me manda incorrectamente a WC Paletizado"). drag&drop sigue
   escribiendo en el area real (Paletizado, via el mismo override) -- eso
   tampoco cambio. */
const CONVEYOR_ROLE = 'Ayudante General de Conveyor'
const CONVEYOR_SOURCE_AREA_ID = AREA_STATION_SOURCE_OVERRIDE.CONVEYOR_PRINCIPAL.sourceAreaId

function ConveyorGeneralBar({ gridArea, onOpen, readOnly }) {
  const { t } = useTranslation('centroTrabajo')
  const stations = getLineWorkstationsWithOccupancy(CONVEYOR_SOURCE_AREA_ID).filter(
    (w) => w.role === CONVEYOR_ROLE,
  )
  const real = stations.filter((w) => w.occupants.length > 0).length
  const ideal = stations.length
  const status = statusFor(real, ideal)
  const tone = toneFor(status)
  const label = `${real} / ${ideal}`
  const { isOver, dropProps } = useEmployeeDropTarget(readOnly ? null : CONVEYOR_SOURCE_AREA_ID)

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: contenedor no interactivo -- cada ConveyorNode adentro ya es un <button> real con su propio soporte de teclado; este onClick es solo una conveniencia de mouse ("click en cualquier parte de la barra"), no la única forma de llegar a la acción.
    // biome-ignore lint/a11y/noStaticElementInteractions: mismo motivo -- no puede ser <button> porque contendría botones anidados (ConveyorNode), HTML invalido.
    <div
      id="area-CONVEYOR_PRINCIPAL"
      {...(readOnly ? {} : dropProps)}
      onClick={() => onOpen('CONVEYOR_PRINCIPAL')}
      style={{ gridArea }}
      className={cn(
        // -mr-2 + rounded-r-none (2026-09-02, a peticion explicita del
        // usuario, "que la card de WC Conveyor y Paletizado se junte, que
        // sea una sola"): el borde derecho de Conveyor come el gap-2 del
        // grid y pierde su esquina redondeada para que quede al ras contra
        // el borde izquierdo de WC Paletizado (ver BigZone, roundedTopLeft)
        // -- se leen como una sola forma continua sin fusionar el DOM (no
        // es geometricamente un rectangulo: Conveyor es una franja ancha
        // arriba, Paletizado una columna angosta a la derecha; fusionarlas
        // de verdad taparia WC Lineas/WC Midea que quedan entre ellas).
        '-mr-2 cursor-pointer select-none rounded-[16px] rounded-r-none border border-t-[3px] p-1.5 scroll-mt-4 transition-[box-shadow,background-color] duration-150',
        isOver ? 'border-blue-500' : tone.border,
        isOver ? 'border-t-blue-500' : tone.borderTop,
        isOver ? OVER_TONE.bg : tone.bgIdle,
        tone.ring25,
      )}
    >
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-[11px] font-extrabold tracking-[0.4px]">
          {t('operatingFloorPlan.conveyorGeneralTitle')}
        </p>
        <p className="text-[12px] font-bold">
          {isOver ? t('operatingFloorPlan.dropHereLabel') : label}
        </p>
      </div>
      <div className={cn('mb-1 h-px', tone.divider25)} />
      {/* flexWrap (2026-08-28, a peticion explicita del usuario, Parte 14):
          las 2 posiciones se centran en una sola fila -- si el bloque se
          angostara demasiado (tablet), igual se reparten solas sin dejar de
          ser UN SOLO contenedor, nunca cards independientes. justifyContent
          'center' (2026-08-28, segunda ronda -- "distribuir visualmente los
          DOS puestos de forma limpia, equilibrada y centrada", "no quiero
          cuatro huecos enormes simulando cuatro personas"): con solo 2
          nodos angostos (maxWidth 140), dejarlos pegados a la izquierda del
          bloque ancho se veia desbalanceado -- centrados se ve como una
          franja limpia, no como una card a medio llenar. */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5">
        {stations.map((w, i) => (
          <ConveyorNode
            key={w.id}
            index={i + 1}
            station={w}
            onOpen={() => onOpen('CONVEYOR_PRINCIPAL')}
          />
        ))}
      </div>
    </div>
  )
}

/* Posicion/nodo compacto (Partes 4-7 del pedido: "NO quiero cuatro cards
   independientes enormes" -- avatar+nombre+rol+estado en un nodo angosto,
   nunca una BigZone). Reusa EmployeeAvatar (mismo componente de iniciales/
   color estable/dashed-si-vacante que ya usan las tarjetas de estacion de
   Accesorios/Insumos/Paletizado, Parte 16: nunca se inventa un nombre) y
   getPersonnelRank(station.role) -- exactamente la misma fuente de rango que
   usa LineStationCard.jsx para el resto de areas LINE_LIKE, sin logica de
   rango paralela. */
function ConveyorNode({ index, station, onOpen }) {
  const { t } = useTranslation('centroTrabajo')
  const occupant = station.occupants[0]?.employee || null
  const rank = occupant ? getPersonnelRank(station.role) : null
  const tone = occupant ? NODE_TONE.occupied : NODE_TONE.vacant
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      className={cn(
        'flex min-w-[76px] max-w-[140px] flex-[1_1_84px] cursor-pointer flex-row items-center gap-1.5 rounded-[12px] border border-dashed px-1.5 py-0.5',
        tone.border,
        tone.hoverBg,
      )}
    >
      <p className="text-[9px] font-extrabold leading-none text-muted-foreground/60">{index}</p>
      <EmployeeAvatar employee={occupant} size={20} />
      <p className="min-w-0 flex-1 truncate text-left text-[10px] font-bold leading-[1.15]">
        {occupant ? occupant.name : t('operatingFloorPlan.vacantLabel')}
      </p>
      {rank && (
        <p className="hidden truncate text-[8.5px] leading-[1.1] text-muted-foreground sm:block">
          {rank.label}
        </p>
      )}
      <p className={cn('shrink-0 text-[8px] font-extrabold tracking-[0.3px]', tone.text)}>
        {occupant
          ? t('operatingFloorPlan.occupiedStatusLabel')
          : t('operatingFloorPlan.availableStatusLabel')}
      </p>
    </button>
  )
}

function BigZone({ areaId, gridArea, title, onOpen, readOnly, children, squareTopLeft }) {
  const { t } = useTranslation('centroTrabajo')
  const wc = workCenterById(areaId)
  const staffing = getAreaStaffing(areaId)
  const status = statusFor(staffing.real, staffing.ideal)
  const tone = toneFor(status)
  const label =
    staffing.ideal != null
      ? `${staffing.real} / ${staffing.ideal}`
      : t('operatingFloorPlan.personCount', { count: staffing.real })
  const { isOver, dropProps } = useEmployeeDropTarget(readOnly ? null : areaId)

  return (
    <button
      type="button"
      id={`area-${areaId}`}
      {...(readOnly ? {} : dropProps)}
      onClick={() => onOpen(areaId)}
      style={{ gridArea }}
      className={cn(
        'flex cursor-pointer select-none flex-col gap-[4.8px] overflow-hidden rounded-[20px] border border-t-[3px] p-2.5 text-left scroll-mt-4 transition-[box-shadow,background-color] duration-150',
        // squareTopLeft (2026-09-02, a peticion explicita del usuario --
        // ver comentario en ConveyorGeneralBar): SOLO WC Paletizado lo usa,
        // para que su esquina superior izquierda quede al ras contra el
        // borde derecho (sin rounding) de WC Conveyor General.
        squareTopLeft && 'rounded-tl-none',
        isOver ? 'border-blue-500' : tone.border,
        isOver ? 'border-t-blue-500' : tone.borderTop,
        isOver ? OVER_TONE.bg : tone.bgIdle,
        tone.ring25,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between">
        <p className="text-[13px] font-extrabold">{title || wc?.name}</p>
        <p className="text-sm font-bold">
          {isOver ? t('operatingFloorPlan.dropHereLabel') : label}
        </p>
      </div>
      {status && (
        <p className={cn('text-[10.5px] font-bold', tone.text)}>
          {statusText(t, status, staffing)}
        </p>
      )}
      {/* minHeight:0 (2026-08-25, correccion definitiva): sin esto, este
          hijo flex nunca se encoge por debajo de su contenido -- el
          overflow:auto de arriba quedaba sin efecto y el personal que no
          cabia se recortaba en silencio (visible en desktop grande, pero
          mucho mas facil de disparar en tablet con menos alto disponible). */}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </button>
  )
}

/* LINEA1 y WC LINEA 0 (PROYECTO) vuelven a dibujarse DENTRO de esta misma
   card (2026-09-01, a peticion explicita del usuario: "todas son WC lineas
   de produccion FFT", debe ser una sola card) -- como barras horizontales
   (HorizontalLineBar, igual que antes) en una columna angosta a la
   izquierda, junto a las columnas verticales LINEA2..10. FFT_LINE_IDS
   (floorPlanZones.js) ya incluye las 11 lineas para que totalReal/
   totalIdeal reflejen el agregado completo. FFT_COLUMN_LINE_IDS sigue
   filtrando ambas de las columnas verticales -- solo LINEA2..10 se dibujan
   como columna, LINEA1/PROYECTO como barra. id="area-fft" (usado por
   CriticalAreasCard para scroll+highlight del agregado FFT). */
const FFT_COLUMN_LINE_IDS = FFT_LINE_IDS.filter((id) => id !== 'LINEA1' && id !== 'PROYECTO')

function FftBlock({ onOpen, onOpenSummary, readOnly }) {
  const { t } = useTranslation('centroTrabajo')
  const totalReal = FFT_LINE_IDS.reduce((sum, id) => sum + getAreaHeadcount(id), 0)
  const totalIdeal = FFT_LINE_IDS.reduce(
    (sum, id) => sum + (workCenterById(id)?.idealHeadcount || 0),
    0,
  )
  return (
    <div
      id="area-FFT"
      style={{ gridArea: 'fft' }}
      className="flex flex-col gap-2 overflow-hidden rounded-[20px] border border-t-[3px] border-border border-t-blue-500 bg-blue-500/[0.035] p-2.5 dark:bg-blue-500/[0.05] scroll-mt-4"
    >
      <button
        type="button"
        onClick={() => onOpenSummary('FFT_ALL')}
        className="flex w-full cursor-pointer flex-wrap items-baseline justify-between text-left"
      >
        <p className="text-[13.5px] font-extrabold">
          {t('operatingFloorPlan.fftProductionLinesTitle')}
        </p>
        <p className="text-sm font-bold">
          {totalReal} / {totalIdeal}
        </p>
      </button>
      {/* minHeight:0 (2026-08-25, correccion definitiva, mismo motivo que
          BigZone): sin esto la fila nunca se encogia por debajo de sus
          columnas y FftBlock (overflow:hidden) recortaba el personal
          sobrante en silencio. */}
      <div className="flex min-h-0 flex-1 gap-[4.8px]">
        <div className="flex w-[160px] shrink-0 flex-col gap-[4.8px]">
          <HorizontalLineBar lineId="LINEA1" onOpen={onOpen} readOnly={readOnly} />
          <HorizontalLineBar
            lineId="PROYECTO"
            title={t('operatingFloorPlan.line0Title')}
            onOpen={onOpen}
            readOnly={readOnly}
          />
        </div>
        {FFT_COLUMN_LINE_IDS.map((id) => (
          <LineColumn key={id} lineId={id} onOpen={onOpen} readOnly={readOnly} />
        ))}
      </div>
    </div>
  )
}

/* Barra horizontal ("acostada") -- usada para WC LINEA 0 (PROYECTO) y
   LINEA1, apiladas en el espacio que dejó libre la caja de Paletizado de
   arriba a la izquierda (a petición del usuario 2026-08-24; orden WC LINEA
   0 primero / LINEA1 despues a peticion explicita del usuario 2026-08-30).
   Mismo lenguaje visual que BigZone, solo horizontal. */
function HorizontalLineBar({ lineId, title, onOpen, readOnly }) {
  const { t } = useTranslation('centroTrabajo')
  const wc = workCenterById(lineId)
  const staffing = getAreaStaffing(lineId)
  const status = statusFor(staffing.real, staffing.ideal) || 'SIN_PERSONAL'
  const tone = toneFor(status)
  const label =
    staffing.ideal != null
      ? `${staffing.real} / ${staffing.ideal}`
      : t('operatingFloorPlan.personCount', { count: staffing.real })
  const pct = staffing.ideal ? Math.min(1, staffing.real / staffing.ideal) : 0
  const { isOver, dropProps } = useEmployeeDropTarget(readOnly ? null : lineId)
  return (
    <button
      type="button"
      {...(readOnly ? {} : dropProps)}
      onClick={() => onOpen(lineId)}
      className={cn(
        'flex min-h-0 flex-1 cursor-pointer select-none flex-col justify-center gap-1 rounded-[20px] border border-t-[3px] p-2 text-left transition-[box-shadow,background-color] duration-150',
        isOver ? 'border-blue-500' : tone.border,
        isOver ? 'border-t-blue-500' : tone.borderTop,
        isOver ? OVER_TONE.bg : tone.bgIdle,
        tone.ring25,
      )}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-[12.5px] font-extrabold">{title || wc?.name}</p>
        <p className="text-[13.5px] font-bold">
          {isOver ? t('operatingFloorPlan.dropHereLabel') : label}
        </p>
      </div>
      {status && (
        <p className={cn('text-[9.5px] font-bold', tone.text)}>{statusText(t, status, staffing)}</p>
      )}
      <div className={cn('h-1.5 w-full overflow-hidden rounded-full', tone.track18)}>
        <div className={cn('h-full rounded-full', tone.solid)} style={{ width: `${pct * 100}%` }} />
      </div>
      {/* Nombres reales (2026-08-25, a peticion explicita del usuario): si hay
          personal, debe verse su nombre igual que en WC Accesorios, no solo la
          barra de avance. */}
      <div className="mt-1 max-h-[70px] overflow-auto">
        <PersonList areaId={lineId} columns={2} readOnly={readOnly} />
      </div>
    </button>
  )
}

function LineColumn({ lineId, onOpen, readOnly }) {
  const { t } = useTranslation('centroTrabajo')
  const wc = workCenterById(lineId)
  const staffing = getAreaStaffing(lineId)
  const status = statusFor(staffing.real, staffing.ideal) || 'SIN_PERSONAL'
  const tone = toneFor(status)
  const pct = staffing.ideal ? Math.min(1, staffing.real / staffing.ideal) : 0
  const { isOver, dropProps } = useEmployeeDropTarget(readOnly ? null : lineId)
  return (
    <button
      type="button"
      {...(readOnly ? {} : dropProps)}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(lineId)
      }}
      className={cn(
        'flex h-full min-h-0 min-w-[46px] flex-1 cursor-pointer select-none flex-col items-center rounded-[15px] border px-[3.2px] py-1.5 transition-[box-shadow,background-color] duration-150',
        isOver ? 'border-blue-500' : tone.border30,
        isOver ? OVER_TONE.bg : tone.bgIdleAlt,
        tone.ring25,
      )}
    >
      {/* Prefijo WC completo (2026-08-27, corrigiendo un bug real: este
          Typography le quitaba "WC " al nombre real de wc.name, dejando
          "LINEA 2" en vez de "WC LINEA 2" -- el titulo del bloque FFT ya
          decia "WC Líneas de producción" pero las tarjetas internas no).
          fontSize/letterSpacing bajan un poco para que "WC LINEA 10" siga
          cabiendo en columnas angostas sin ensanchar la card; si de plano
          no cabe, el texto ya envuelve a 2 líneas solo, nunca trunca. */}
      <p className="text-center text-[9px] font-extrabold leading-[1.15] tracking-[-0.2px]">
        {isOver ? t('operatingFloorPlan.dropLabel') : wc?.name || lineId}
      </p>
      <div
        className={cn('my-1 flex h-9 w-2 items-end overflow-hidden rounded-[40px]', tone.track18)}
      >
        <div
          className={cn('w-full rounded-[40px]', tone.solid)}
          style={{ height: `${pct * 100}%` }}
        />
      </div>
      <p className="text-[11.5px] font-bold">
        {staffing.real}/{staffing.ideal}
      </p>
      {/* Nombres reales (2026-08-25, a peticion explicita del usuario): si hay
          personal, debe verse su nombre igual que en WC Accesorios, no solo la
          barra de avance. */}
      <div className="mt-[3.2px] w-full min-h-0 flex-1 overflow-auto">
        <PersonList areaId={lineId} readOnly={readOnly} />
      </div>
    </button>
  )
}

function HighValueGrid({ areaId }) {
  const staffing = getAreaStaffing(areaId)
  const status = statusFor(staffing.real, staffing.ideal) || 'SIN_PERSONAL'
  const tone = toneFor(status)
  const total = staffing.ideal || 16
  return (
    <div className="grid flex-1 grid-cols-4 gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: celdas decorativas de una cuadrícula fija por posición (sin identidad propia, nunca se reordenan) -- mismo patrón que el original en MUI.
          key={i}
          className={cn(
            'min-h-[16px] rounded-[7.5px] border',
            i < staffing.real ? tone.fill55 : tone.empty8,
            tone.itemBorder25,
          )}
        />
      ))}
    </div>
  )
}

function MixtosDecoration() {
  return (
    <div className="flex flex-1 items-center justify-center gap-2">
      {[0, 1].map((i) => (
        <div key={i} className="h-[80%] w-2.5 rounded-[10px] border border-border bg-accent" />
      ))}
    </div>
  )
}

/* WC Insumos y Suministro de Material (2026-08-26, "Reestructuracion
   operativa FFT", a peticion explicita del usuario) -- fusion visual de
   PNP/POC/PEN (decorativa, sin WORK_CENTER propio) + Box Prep + Insumos +
   Suministro de material en UNA sola caja grande, ocupando el espacio que
   antes tenian las 4 celdas separadas (ver grid gridTemplateAreas arriba).
   Sigue siendo group-aware via operationalGroupMembers('INSUMOS')
   (catalog.js/AREA_DETAIL_GROUPS) -- exactamente los mismos numeros que
   veras al abrir el detalle completo (OperationalAreaDetail.jsx), nunca
   una segunda fuente. INSUMOS es el id canonico al que cae cualquier
   arrastre/click sobre la caja fusionada. */
function InsumosSuministroZone({ gridArea, onOpen, onOpenSummary, readOnly }) {
  const { t } = useTranslation('centroTrabajo')
  const memberIds = operationalGroupMembers('INSUMOS')
  const staffing = getGroupAreaStaffing(memberIds)
  const people = getGroupPeople(memberIds)
  const status = statusFor(staffing.real, staffing.ideal)
  const tone = toneFor(status)
  const { isOver, dropProps } = useEmployeeDropTarget(readOnly ? null : 'INSUMOS')
  const label =
    staffing.ideal != null
      ? `${staffing.real} / ${staffing.ideal}`
      : t('operatingFloorPlan.personCount', { count: staffing.real })
  return (
    <button
      type="button"
      id="area-INSUMOS"
      {...(readOnly ? {} : dropProps)}
      onClick={() => (readOnly ? onOpenSummary('INSUMOS_SUMINISTRO_ALL') : onOpen('INSUMOS'))}
      style={{ gridArea }}
      className={cn(
        'flex cursor-pointer select-none flex-col gap-[4.8px] overflow-hidden rounded-[20px] border border-t-[3px] p-2.5 text-left scroll-mt-4 transition-[box-shadow,background-color] duration-150',
        isOver ? 'border-blue-500' : tone.border,
        isOver ? 'border-t-blue-500' : tone.borderTop,
        isOver ? OVER_TONE.bg : tone.bgIdle,
        tone.ring25,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between">
        <p className="text-[13px] font-extrabold">
          {t('operatingFloorPlan.insumosSuministroTitle')}
        </p>
        <p className="text-sm font-bold">
          {isOver ? t('operatingFloorPlan.dropHereLabel') : label}
        </p>
      </div>
      {status && (
        <p className={cn('text-[10.5px] font-bold', tone.text)}>
          {statusText(t, status, staffing)}
        </p>
      )}
      <p className="text-[9px] italic text-muted-foreground">
        {t('operatingFloorPlan.insumosSuministroSubtitle')}
      </p>
      <div className="min-h-0 flex-1 overflow-auto">
        <PersonList people={people} columns={2} readOnly={readOnly} />
      </div>
    </button>
  )
}

/* readOnly=false (Layout 2D, 2026-08-25): cada persona listada se vuelve
   arrastrable (DraggablePersonChip, mismo componente generico ya usado por
   WorkAreaMap/AvailablePersonnelTray) -- sin esto no habia ninguna fuente
   real de donde arrastrar dentro de este plano, solo destinos. En readOnly
   (Dashboard) sigue exactamente igual que siempre, texto plano sin arrastre. */
function PersonList({ areaId, columns = 1, people: peopleProp, readOnly }) {
  const { t } = useTranslation('centroTrabajo')
  const people = peopleProp || getPeopleByArea()[areaId] || []
  if (people.length === 0) {
    return (
      <p className="text-[11px] italic text-muted-foreground">
        {t('operatingFloorPlan.statusNoneDescription')}
      </p>
    )
  }
  return (
    <div className={columns > 1 ? 'grid grid-cols-2 gap-[3.2px]' : 'flex flex-col gap-[3.2px]'}>
      {people.map((p) => {
        const row = (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <p className="truncate text-[11.5px] leading-[1.25]">{p.name}</p>
              </div>
            </TooltipTrigger>
            <TooltipContent>{p.name}</TooltipContent>
          </Tooltip>
        )
        if (readOnly) return <div key={p.id}>{row}</div>
        return (
          <DraggablePersonChip key={p.id} employeeId={p.id} className="block">
            {row}
          </DraggablePersonChip>
        )
      })}
    </div>
  )
}

function SupportCard({ areaId, onOpen, readOnly }) {
  const { t } = useTranslation('centroTrabajo')
  const statusMeta = useMemo(() => buildStatusMeta(t), [t])
  const wc = workCenterById(areaId)
  const staffing = getAreaStaffing(areaId)
  const status = statusFor(staffing.real, staffing.ideal)
  const tone = toneFor(status)
  const label =
    staffing.ideal != null
      ? `${staffing.real}/${staffing.ideal}`
      : t('operatingFloorPlan.personCountAbbreviated', { count: staffing.real })
  const { isOver, dropProps } = useEmployeeDropTarget(readOnly ? null : areaId)

  return (
    <button
      type="button"
      id={`area-${areaId}`}
      {...(readOnly ? {} : dropProps)}
      onClick={() => onOpen(areaId)}
      className={cn(
        'max-w-[230px] min-w-[168px] flex-[1_1_168px] cursor-pointer select-none rounded-[20px] border border-l-[3px] p-2.5 text-left scroll-mt-4 transition-[box-shadow,background-color] duration-150',
        isOver ? 'border-blue-500' : tone.border,
        isOver ? 'border-l-blue-500' : tone.borderLeft,
        isOver ? OVER_TONE.bg : tone.bgIdle,
        tone.ring20,
      )}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-extrabold">{wc?.name}</p>
        <p className="text-[13px] font-bold">
          {isOver ? t('operatingFloorPlan.dropHereLabel') : label}
        </p>
      </div>
      {status && (
        <p className={cn('mt-0.5 text-[9.5px] font-bold', tone.text)}>{statusMeta[status].label}</p>
      )}
      <div className="mt-1 max-h-[90px] overflow-auto">
        <PersonList areaId={areaId} readOnly={readOnly} />
      </div>
    </button>
  )
}

function DetailDialog({ areaId, onClose }) {
  const { t } = useTranslation('centroTrabajo')
  const statusMeta = useMemo(() => buildStatusMeta(t), [t])
  const open = !!areaId
  let title = ''
  let staffing = null
  let people = []

  if (areaId === 'FFT_ALL') {
    title = t('operatingFloorPlan.fftProductionLinesTitle')
    const real = FFT_LINE_IDS.reduce((sum, id) => sum + getAreaHeadcount(id), 0)
    const ideal = FFT_LINE_IDS.reduce(
      (sum, id) => sum + (workCenterById(id)?.idealHeadcount || 0),
      0,
    )
    staffing = { real, ideal }
    people = getFftPeopleWithLine()
  } else if (areaId === 'INSUMOS_SUMINISTRO_ALL') {
    const memberIds = operationalGroupMembers('INSUMOS')
    title = workCenterById('INSUMOS')?.name || t('operatingFloorPlan.insumosSuministroTitle')
    staffing = getGroupAreaStaffing(memberIds)
    people = getGroupPeople(memberIds)
  } else if (areaId) {
    title = workCenterById(areaId)?.name || areaId
    staffing = getAreaStaffing(areaId)
    people = getPeopleByArea()[areaId] || []
  }

  const status = staffing ? statusFor(staffing.real, staffing.ideal) : null
  const meta = status ? statusMeta[status] : null
  const tone = status ? toneFor(status) : null

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      {staffing && (
        <DialogContent>
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
          <div className="px-6 pb-6">
            <div className="mb-3 flex items-baseline gap-3">
              <p className="text-xl font-extrabold">
                {staffing.ideal != null
                  ? `${staffing.real} / ${staffing.ideal}`
                  : t('operatingFloorPlan.peopleCountLabel', { count: staffing.real })}
              </p>
              {meta && (
                <span
                  className={cn(
                    'inline-flex h-6 items-center rounded-full px-2 text-xs font-bold',
                    tone.chip,
                  )}
                >
                  {meta.label}
                </span>
              )}
            </div>
            {people.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">
                {t('operatingFloorPlan.noPersonnelAssignedPeriod')}
              </p>
            ) : (
              <div className="flex max-h-[320px] flex-col gap-1.5 overflow-auto">
                {people.map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <p className="text-[13px]">
                      {p.name}
                      {p.lineName ? ` · ${p.lineName}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
