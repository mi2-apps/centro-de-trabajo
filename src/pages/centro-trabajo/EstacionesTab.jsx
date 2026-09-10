import {
  ChevronDown,
  Cog,
  GraduationCap,
  Info,
  LayoutGrid,
  List,
  MonitorSmartphone,
  Package2,
  PieChart,
  PlusCircle,
  Search,
  ShoppingCart,
  SprayCan,
  Tag,
  User,
  UserCheck,
  UserCog,
  Users,
  Users2,
  UsersRound,
  UserX,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn, hexToRgba } from '@/lib/utils'
import { usePersonnelVersion } from '../../data/personnel/usePersonnelVersion'
import { operationalGroupMembers, workCenterById } from '../../data/production/catalog'
import { SORTING_LINE_FAMILY_AREA_IDS } from '../../data/production/catalogSorting'
import { FFT_LINE_IDS, REFERENCE_ONLY_ZONES } from '../../data/production/floorPlanZones'
import { colorForArea } from '../../data/production/layoutZones'
import {
  getAreaStaffing,
  getGroupAreaStaffing,
  getPeopleByArea,
} from '../../data/production/personnelByArea'
import { useAreaGroup } from '../../data/production/useAreaGroup'

/* ─────────────────────────────────────────────
   Rediseño 2026-08-25 (a petición explícita del usuario, mockup
   proporcionado) -- EXCLUSIVO de esta pestaña "Estaciones". Antes era
   una tabla simple SOLO de Línea 1-10 (estaciones configuradas/
   ocupadas/disponibles); ahora es una vista ejecutiva de TODAS las
   áreas del centro de trabajo (no solo líneas), en cards con
   real/ideal, estado, barra de cobertura y estaciones -- igual
   lenguaje visual que ya se aprobó en "Líneas", pero para el catálogo
   completo. NO es un layout 2D (eso vive en /layout-2d y en "Áreas de
   trabajo") -- aquí no se dibuja ningún plano físico ni conveyors.

   AREA_SLOTS es una lista CURADA (igual patrón que
   SUPPORT_CARD_AREA_IDS/REFERENCE_ONLY_ZONES en floorPlanZones.js),
   no un filtro automático de catalog.js (CONVEYOR/SELLADO/PROYECTO/
   CAJAS NO aparecen aquí a propósito, viven en otras pestañas). "FFT"
   agrupa las 11 líneas reales -- LINEA1..10 + PROYECTO/WC LINEA 0,
   mismo cálculo que OperatingFloorPlan.jsx y que "Líneas" (ver
   LINE_FAMILY_WORK_CENTERS en catalog.js, 2026-09-07). "INSUMOS_SUMINISTRO" fusiona
   INSUMOS+SUMINISTRO_MATERIAL en una sola tarjeta (mismo criterio que
   InsumosSuministroZone en OperatingFloorPlan.jsx) -- ninguna de las
   dos fusiones inventa un area de catalogo nueva, solo agrupan la
   presentación de areas reales ya existentes.

   Estado visual de 4 niveles (Completa verde / Parcial naranja / Falta
   personal rojo / Sin personal gris) es EXCLUSIVO de esta vista, a
   petición explícita del usuario -- no se tocó STATUS_META de
   OperatingFloorPlan.jsx ni el de LineasTab.jsx (cada vista mantiene
   su propia semántica visual, "esto es únicamente estado visual, no
   confundir con reglas de producción"). Cuando el área no tiene
   plantilla oficial (idealHeadcount null en catalog.js, ej. Calidad,
   Insumos, Suministro) NUNCA se inventa un ideal -- se muestra
   "Sin plantilla definida" en vez de un % falso. */

const STATUS_META = {
  COMPLETA: { color: '#10B981' },
  PARCIAL: { color: '#F59E0B' },
  FALTA_PERSONAL: { color: '#EF4444' },
  SIN_PERSONAL: { color: '#94A3B8' },
}

const STATUS_LABEL_KEYS = {
  COMPLETA: 'estacionesTab.statusCompleteLabel',
  PARCIAL: 'estacionesTab.statusPartialLabel',
  FALTA_PERSONAL: 'estacionesTab.statusMissingLabel',
  SIN_PERSONAL: 'estacionesTab.noStaffLabel',
}

function statusFor(real, ideal) {
  if (ideal == null) return null
  if (real <= 0) return 'SIN_PERSONAL'
  const pct = (real / ideal) * 100
  if (pct >= 100) return 'COMPLETA'
  if (pct >= 50) return 'PARCIAL'
  return 'FALTA_PERSONAL'
}

function badgeFor(real, ideal, t) {
  if (ideal == null) return null
  if (real <= 0) return { text: t('estacionesTab.noStaffLabel') }
  if (real >= ideal) return { text: t('estacionesTab.completeBadge') }
  const missing = ideal - real
  return { text: t('estacionesTab.missingCount', { count: missing }) }
}

/* La lista curada de tarjetas -- id sintético propio de esta vista
   (no siempre coincide 1:1 con un WORK_CENTER real, ver compute()).
   Se construye dentro de EstacionesTab (no a nivel de módulo) porque
   sus textos visibles requieren t(), que solo funciona dentro de un
   componente.

   2026-09-07 (a peticion explicita del usuario, "elimina calidad y
   entrenador... ahi deben aparecer las mismas que en mi layout"): se
   quitan las tarjetas CALIDAD y ENTRENADOR -- ninguna de las dos vive
   en el plano fisico (OperatingFloorPlan/layoutZones.js), asi que no
   deben aparecer en esta vista tampoco. Sus traducciones
   (areaCalidadName/Subtitle, areaEntrenadorName/Subtitle) tambien se
   quitaron de centroTrabajo.json en los 3 idiomas. */
function buildAreaSlots(t) {
  return [
    {
      id: 'FFT',
      name: t('estacionesTab.areaFFTName'),
      subtitle: t('estacionesTab.areaFFTSubtitle'),
      badge: t('estacionesTab.areaFFTBadge'),
      icon: <Cog size={22} />,
      colorAreaId: 'LINEA1',
    },
    {
      id: 'HIGH_VALUE',
      name: t('estacionesTab.areaHighValueName'),
      subtitle: t('estacionesTab.areaHighValueSubtitle'),
      icon: <MonitorSmartphone size={22} />,
      colorAreaId: 'HIGH_VALUE',
    },
    {
      id: 'PALETIZADO',
      name: t('estacionesTab.areaPaletizadoName'),
      subtitle: t('estacionesTab.areaPaletizadoSubtitle'),
      icon: <Package2 size={22} />,
      colorAreaId: 'PALETIZADO',
    },
    {
      id: 'INSUMOS_SUMINISTRO',
      name: t('estacionesTab.areaInsumosSuministroName'),
      subtitle: t('estacionesTab.areaInsumosSuministroSubtitle'),
      icon: <ShoppingCart size={22} />,
      colorAreaId: 'INSUMOS',
    },
    {
      id: 'ACCESORIOS',
      name: t('estacionesTab.areaAccesoriosName'),
      subtitle: t('estacionesTab.areaAccesoriosSubtitle'),
      icon: <Tag size={22} />,
      colorAreaId: 'ACCESORIOS',
    },
    {
      id: 'CAPACITACION',
      name: t('estacionesTab.areaCapacitacionName'),
      subtitle: t('estacionesTab.areaCapacitacionSubtitle'),
      icon: <GraduationCap size={22} />,
      colorAreaId: 'CAPACITACION',
    },
    {
      id: 'TEAM_LEADER',
      name: t('estacionesTab.areaTeamLeaderName'),
      subtitle: t('estacionesTab.areaTeamLeaderSubtitle'),
      icon: <UserCog size={22} />,
      colorAreaId: 'TEAM_LEADER',
    },
    {
      id: 'LIMPIEZA',
      name: t('estacionesTab.areaLimpiezaName'),
      subtitle: t('estacionesTab.areaLimpiezaSubtitle'),
      icon: <SprayCan size={22} />,
      colorAreaId: 'LIMPIEZA',
    },
    {
      id: 'GERENTE',
      name: t('estacionesTab.areaGerenteName'),
      subtitle: t('estacionesTab.areaGerenteSubtitle'),
      icon: <User size={22} />,
      colorAreaId: 'GERENTE',
    },
    {
      id: 'SUPERVISOR',
      name: t('estacionesTab.areaSupervisorName'),
      subtitle: t('estacionesTab.areaSupervisorSubtitle'),
      icon: <UserCheck size={22} />,
      colorAreaId: 'SUPERVISOR',
    },
  ]
}

/* 2026-09-08 (toggle FFT/Sorting, a peticion explicita del usuario -- "actualiza los otros
   apartados de mi modulo de centro de trabajo"): version Sorting de buildAreaSlots -- catalogo
   propio (catalogSorting.js). `name` se lee directo del catalogo activo (workCenterById) para no
   duplicar los nombres a mano; `subtitle` reutiliza las mismas claves compartidas que ya existen
   (areaGerenteSubtitle/areaSupervisorSubtitle) donde el concepto es identico al de FFT.

   2026-09-08 (septima ronda, a peticion explicita del usuario -- "son 7 lineas independientes,
   no solo una"): SORT_LINEA1..7 son 7 areas de catalogo reales y separadas -- 'SORT_LINEAS' es
   un slot SINTETICO que las agrupa en 1 sola tarjeta (mismo patron EXACTO que el slot 'FFT' de
   arriba, que agrupa las 11 lineas reales de FFT) -- click lleva a "Lineas", igual que 'FFT'. */
function buildSortingAreaSlots(t) {
  const nameOf = (id) => workCenterById(id)?.name || id
  return [
    {
      id: 'SORT_CONVEYOR',
      name: nameOf('SORT_CONVEYOR'),
      subtitle: t('estacionesTab.areaSortConveyorSubtitle'),
      icon: <Cog size={22} />,
      colorAreaId: 'SORT_CONVEYOR',
    },
    {
      id: 'SORT_LINEAS',
      name: t('estacionesTab.areaSortLineasName'),
      subtitle: t('estacionesTab.areaSortLineaSubtitle'),
      icon: <Package2 size={22} />,
      colorAreaId: 'SORT_LINEA1',
    },
    {
      id: 'SORT_RCY',
      name: nameOf('SORT_RCY'),
      subtitle: t('estacionesTab.areaSortWorkAreaSubtitle'),
      icon: <Tag size={22} />,
      colorAreaId: 'SORT_RCY',
    },
    {
      id: 'SORT_FRM',
      name: nameOf('SORT_FRM'),
      subtitle: t('estacionesTab.areaSortWorkAreaSubtitle'),
      icon: <Tag size={22} />,
      colorAreaId: 'SORT_FRM',
    },
    {
      id: 'SORT_KITS',
      name: nameOf('SORT_KITS'),
      subtitle: t('estacionesTab.areaSortWorkAreaSubtitle'),
      icon: <ShoppingCart size={22} />,
      colorAreaId: 'SORT_KITS',
    },
    {
      id: 'SORT_PNP',
      name: nameOf('SORT_PNP'),
      subtitle: t('estacionesTab.areaSortWorkAreaSubtitle'),
      icon: <Tag size={22} />,
      colorAreaId: 'SORT_PNP',
    },
    {
      id: 'SORT_DMR_DML',
      name: nameOf('SORT_DMR_DML'),
      subtitle: t('estacionesTab.areaSortWorkAreaSubtitle'),
      icon: <Tag size={22} />,
      colorAreaId: 'SORT_DMR_DML',
    },
    {
      id: 'SORT_DMA_DMT',
      name: nameOf('SORT_DMA_DMT'),
      subtitle: t('estacionesTab.areaSortWorkAreaSubtitle'),
      icon: <Tag size={22} />,
      colorAreaId: 'SORT_DMA_DMT',
    },
    {
      id: 'SORT_GERENTE',
      name: nameOf('SORT_GERENTE'),
      subtitle: t('estacionesTab.areaGerenteSubtitle'),
      icon: <User size={22} />,
      colorAreaId: 'SORT_GERENTE',
    },
    {
      id: 'SORT_SUPERVISOR',
      name: nameOf('SORT_SUPERVISOR'),
      subtitle: t('estacionesTab.areaSupervisorSubtitle'),
      icon: <UserCheck size={22} />,
      colorAreaId: 'SORT_SUPERVISOR',
    },
  ]
}

/* Placeholders sin área de catálogo mapeada (igual criterio que
   REFERENCE_ONLY_ZONES en floorPlanZones.js) -- nunca se les inventa
   un id de área ni se les fuerza un mapeo incierto; "Asignar personal"
   manda al formulario general de Registro de personal, donde sí se
   elige un área real. */
const PLACEHOLDER_SLOTS = REFERENCE_ONLY_ZONES

function computeRow(slot, t) {
  if (slot.id === 'FFT') {
    const real = FFT_LINE_IDS.reduce((s, id) => s + (getPeopleByArea()[id]?.length || 0), 0)
    const ideal = FFT_LINE_IDS.reduce((s, id) => s + (getAreaStaffing(id).ideal || 0), 0)
    return {
      slot,
      real,
      ideal,
      extraNote: t('estacionesTab.fftLinesNote', { count: FFT_LINE_IDS.length }),
    }
  }
  if (slot.id === 'SORT_LINEAS') {
    const ids = [...SORTING_LINE_FAMILY_AREA_IDS]
    const real = ids.reduce((s, id) => s + (getPeopleByArea()[id]?.length || 0), 0)
    const ideal = ids.reduce((s, id) => s + (getAreaStaffing(id).ideal || 0), 0)
    return {
      slot,
      real,
      ideal,
      extraNote: t('estacionesTab.fftLinesNote', { count: ids.length }),
    }
  }
  if (slot.id === 'INSUMOS_SUMINISTRO') {
    // 2026-08-26: group-aware (PNP/POC/PEN + Box Prep + Insumos + Suministro
    // de material fusionados, catalog.js/AREA_DETAIL_GROUPS.INSUMOS) --
    // mismos numeros que el detalle real, ideal ya no es null (9).
    const staffing = getGroupAreaStaffing(operationalGroupMembers('INSUMOS'))
    return { slot, real: staffing.real, ideal: staffing.ideal, extraNote: slot.subtitle }
  }
  const staffing = getAreaStaffing(slot.id)
  return { slot, real: staffing.real, ideal: staffing.ideal, extraNote: slot.subtitle }
}

function normalize(text) {
  return text.toString().trim().toLowerCase()
}

export default function EstacionesTab({ onOpenLine, onGoToLineas }) {
  const { t } = useTranslation('centroTrabajo')
  usePersonnelVersion()
  const areaGroup = useAreaGroup()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [view, setView] = useState('tarjetas')

  const areaSlots = useMemo(
    () => (areaGroup === 'SORTING' ? buildSortingAreaSlots(t) : buildAreaSlots(t)),
    [t, areaGroup],
  )
  // Sorting no tiene el concepto de "placeholder sin area de catalogo" (REFERENCE_ONLY_ZONES es
  // exclusivo del snapshot historico de FFT, Chofer/Produccion sin WORK_CENTER propio) -- lista
  // vacia en ese modo.
  const placeholderSlots = areaGroup === 'SORTING' ? [] : PLACEHOLDER_SLOTS

  const rows = useMemo(() => areaSlots.map((slot) => computeRow(slot, t)), [areaSlots, t])

  const filteredRows = useMemo(
    () => rows.filter((r) => !query.trim() || normalize(r.slot.name).includes(normalize(query))),
    [rows, query],
  )
  const filteredPlaceholders = useMemo(
    () =>
      placeholderSlots.filter(
        (p) => !query.trim() || normalize(p.label).includes(normalize(query)),
      ),
    [query, placeholderSlots],
  )

  const totals = useMemo(() => {
    const totalReal = rows.reduce((s, r) => s + r.real, 0)
    const totalIdeal = rows.reduce((s, r) => s + (r.ideal || 0), 0)
    const faltante = Math.max(totalIdeal - totalReal, 0)
    const coverage = totalIdeal > 0 ? (totalReal / totalIdeal) * 100 : 0
    return {
      totalReal,
      totalIdeal,
      faltante,
      coverage,
      count: rows.length + placeholderSlots.length,
    }
  }, [rows, placeholderSlots])

  function handleOpenRow(row) {
    if (row.slot.id === 'FFT' || row.slot.id === 'SORT_LINEAS') {
      onGoToLineas?.()
      return
    }
    if (row.slot.id === 'INSUMOS_SUMINISTRO') {
      onOpenLine?.('INSUMOS')
      return
    }
    onOpenLine?.(row.slot.id)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-[16px] font-extrabold">{t('estacionesTab.title')}</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 cursor-help text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>{t('estacionesTab.tooltipInfo')}</TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {t('estacionesTab.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('estacionesTab.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
          <div className="inline-flex shrink-0 items-center overflow-hidden rounded-lg border border-input">
            <button
              type="button"
              onClick={() => setView('tarjetas')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-bold transition-colors',
                view === 'tarjetas'
                  ? 'bg-[rgba(59,130,246,.12)] text-[#3B82F6]'
                  : 'text-muted-foreground hover:bg-accent/50',
              )}
            >
              <LayoutGrid className="h-[17px] w-[17px]" /> {t('estacionesTab.cardsViewButton')}
            </button>
            <button
              type="button"
              onClick={() => setView('lista')}
              className={cn(
                'flex items-center gap-1.5 border-l border-input px-3 py-1.5 text-[13px] font-bold transition-colors',
                view === 'lista'
                  ? 'bg-[rgba(59,130,246,.12)] text-[#3B82F6]'
                  : 'text-muted-foreground hover:bg-accent/50',
              )}
            >
              <List className="h-[17px] w-[17px]" /> {t('estacionesTab.listViewButton')}
            </button>
          </div>
        </div>
      </div>

      {view === 'tarjetas' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredRows.map((row) => (
            <AreaCard key={row.slot.id} row={row} onClick={() => handleOpenRow(row)} />
          ))}
          {filteredPlaceholders.map((p) => (
            <PlaceholderCard
              key={p.key}
              placeholder={p}
              onAssign={() => navigate('/registro-personal')}
            />
          ))}
        </div>
      ) : (
        <EstacionesListView
          rows={filteredRows}
          placeholders={filteredPlaceholders}
          onOpenRow={handleOpenRow}
          onAssign={() => navigate('/registro-personal')}
        />
      )}

      {filteredRows.length === 0 && filteredPlaceholders.length === 0 && (
        <p className="py-8 text-center text-[13px] text-muted-foreground">
          {t('estacionesTab.noMatch', { query })}
        </p>
      )}

      <SummaryPanel totals={totals} />

      <p className="mt-3 text-center text-[11px] text-muted-foreground/60">
        {t('estacionesTab.dataNote')}
      </p>
    </div>
  )
}

function AreaCard({ row, onClick }) {
  const { t } = useTranslation('centroTrabajo')
  const { slot, real, ideal, extraNote } = row
  const statusKey = statusFor(real, ideal)
  const badge = badgeFor(real, ideal, t)
  const accent = colorForArea(slot.colorAreaId)
  const statusColor = statusKey ? STATUS_META[statusKey].color : '#94A3B8'
  const pct = ideal ? Math.min((real / ideal) * 100, 999) : null

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full select-none flex-col gap-2 rounded-[16px] border border-border p-3.5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-[180ms] ease-in-out hover:-translate-y-0.5 hover:border-[rgba(59,130,246,0.4)] hover:shadow-[0_6px_16px_rgba(16,24,40,0.08)]"
    >
      <div className="flex items-start gap-2.5">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
          style={{ backgroundColor: hexToRgba(accent, 0.12), color: accent }}
        >
          {slot.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-extrabold leading-[1.25]">{slot.name}</p>
          {slot.badge && (
            <span
              className="mt-[3.2px] inline-flex h-[18px] items-center rounded-full px-1.5 text-[9.5px] font-bold"
              style={{ backgroundColor: hexToRgba(accent, 0.1), color: accent }}
            >
              {slot.badge}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[15px] font-extrabold">
          {real} / {ideal != null ? ideal : '—'}
        </p>
        {badge && (
          <span
            className="inline-flex h-5 items-center rounded-full px-2 text-[10.5px] font-bold"
            style={{ backgroundColor: hexToRgba(statusColor, 0.14), color: statusColor }}
          >
            {badge.text}
          </span>
        )}
      </div>

      {ideal != null ? (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: statusColor }}
            />
          </div>
          <span
            className="min-w-[40px] text-right text-[11.5px] font-bold"
            style={{ color: statusColor }}
          >
            {pct.toFixed(1)}%
          </span>
        </div>
      ) : (
        <p className="text-[10.5px] italic text-muted-foreground/60">
          {t('estacionesTab.noTemplateNote')}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-dashed border-border pt-1">
        <p className="text-[11.5px] font-semibold text-muted-foreground">{extraNote}</p>
        <ChevronDown className="h-[18px] w-[18px] -rotate-90 text-muted-foreground/60" />
      </div>
    </button>
  )
}

function PlaceholderCard({ placeholder, onAssign }) {
  const { t } = useTranslation('centroTrabajo')
  return (
    <div className="flex flex-col items-start gap-2 rounded-[16px] border-[1.5px] border-dashed border-border bg-muted p-3.5">
      <div className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card text-muted-foreground/60">
        <PlusCircle className="h-[22px] w-[22px]" />
      </div>
      <p className="text-[13.5px] font-extrabold">{placeholder.label}</p>
      <p className="text-[12px] text-muted-foreground">{t('estacionesTab.unassignedNote')}</p>
      <Button
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation()
          onAssign()
        }}
        className="mt-auto h-auto justify-start p-0 text-[13px] font-bold text-primary hover:bg-transparent hover:text-primary"
      >
        {t('estacionesTab.assignPersonnelButton')}
      </Button>
    </div>
  )
}

function EstacionesListView({ rows, placeholders, onOpenRow, onAssign }) {
  const { t } = useTranslation('centroTrabajo')
  return (
    <div className="overflow-auto rounded-2xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[11.5px] font-extrabold uppercase">
              {t('estacionesTab.colArea')}
            </TableHead>
            <TableHead className="text-[11.5px] font-extrabold uppercase">
              {t('estacionesTab.colPersonal')}
            </TableHead>
            <TableHead className="text-[11.5px] font-extrabold uppercase">
              {t('estacionesTab.colEstado')}
            </TableHead>
            <TableHead className="text-[11.5px] font-extrabold uppercase">
              {t('estacionesTab.colCobertura')}
            </TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const statusKey = statusFor(row.real, row.ideal)
            const badge = badgeFor(row.real, row.ideal, t)
            const color = statusKey ? STATUS_META[statusKey].color : '#94A3B8'
            const pct = row.ideal ? Math.min((row.real / row.ideal) * 100, 999) : null
            return (
              <TableRow
                key={row.slot.id}
                onClick={() => onOpenRow(row)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onOpenRow(row)
                  }
                }}
                className="cursor-pointer"
              >
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-[7px] w-[7px] shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <p className="text-[13px] font-bold">{row.slot.name}</p>
                  </div>
                </TableCell>
                <TableCell className="text-[13px] font-semibold">
                  {row.real} / {row.ideal != null ? row.ideal : '—'}
                </TableCell>
                <TableCell>
                  {badge && (
                    <span
                      className="inline-flex h-5 items-center rounded-full px-2 text-[10.5px] font-bold"
                      style={{ backgroundColor: hexToRgba(color, 0.14), color }}
                    >
                      {badge.text}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-[13px] font-bold" style={{ color }}>
                  {pct != null ? `${pct.toFixed(1)}%` : t('estacionesTab.noTemplateShort')}
                </TableCell>
                <TableCell className="text-right">
                  <ChevronDown className="ml-auto h-[18px] w-[18px] -rotate-90 text-muted-foreground/60" />
                </TableCell>
              </TableRow>
            )
          })}
          {placeholders.map((p) => (
            <TableRow key={p.key} className="[&>td]:text-muted-foreground/60">
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#94A3B8]" />
                  <p className="text-[13px] font-bold">{p.label}</p>
                </div>
              </TableCell>
              <TableCell colSpan={3} className="text-[12.5px] italic">
                {t('estacionesTab.unassignedNote')}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onAssign}
                  className="font-bold text-primary hover:bg-transparent hover:text-primary"
                >
                  {t('estacionesTab.assignPersonnelButton')}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function SummaryPanel({ totals }) {
  const { t } = useTranslation('centroTrabajo')
  const items = [
    {
      label: t('estacionesTab.totalAreasLabel'),
      value: totals.count,
      icon: <Users size={16} />,
      color: '#3B82F6',
    },
    {
      label: t('estacionesTab.assignedPersonnelLabel'),
      value: totals.totalReal,
      icon: <Users2 size={16} />,
      color: '#10B981',
    },
    {
      label: t('estacionesTab.idealStaffingLabel'),
      value: totals.totalIdeal,
      icon: <UsersRound size={16} />,
      color: '#A855F7',
    },
    {
      label: t('estacionesTab.missingPersonnelLabel'),
      value: totals.faltante,
      icon: <UserX size={16} />,
      color: '#EF4444',
    },
    {
      label: t('estacionesTab.overallCoverageLabel'),
      value: `${totals.coverage.toFixed(1)}%`,
      icon: <PieChart size={16} />,
      color: '#06B6D4',
    },
  ]
  return (
    <div className="mt-5 rounded-[16px] border border-border p-4">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.4px] text-muted-foreground">
            {t('estacionesTab.statusLegendTitle')}
          </p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <div key={key} className="flex items-center gap-[4.8px]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                <p className="text-[12px] font-semibold text-muted-foreground">
                  {t(STATUS_LABEL_KEYS[key])}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex min-w-[140px] items-center gap-2 rounded-[20px] border bg-[var(--chip-bg-light)] px-3 py-2 dark:bg-[var(--chip-bg-dark)]"
              style={{
                borderColor: hexToRgba(item.color, 0.2),
                '--chip-bg-light': hexToRgba(item.color, 0.05),
                '--chip-bg-dark': hexToRgba(item.color, 0.08),
              }}
            >
              <div
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
                style={{ backgroundColor: hexToRgba(item.color, 0.14), color: item.color }}
              >
                {item.icon}
              </div>
              <div>
                <p className="text-[15px] font-extrabold leading-[1.15]">{item.value}</p>
                <p className="text-[10px] font-semibold text-muted-foreground">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
