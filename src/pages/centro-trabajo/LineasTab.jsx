import {
  ChevronRight,
  Cog,
  Info,
  LayoutGrid,
  List,
  PieChart,
  Search,
  Users,
  Users2,
  UserX,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { cn } from '@/lib/utils'
import { usePersonnelVersion } from '../../data/personnel/usePersonnelVersion'
import { getWorkstationsForLine } from '../../data/personnel/workstations'
import { hasLineStations, WORK_CENTERS } from '../../data/production/catalog'
import { getAreaStaffing } from '../../data/production/personnelByArea'
import { useEmployeeDropTarget } from '../../ui/dnd'

/* ─────────────────────────────────────────────
   Rediseño 2026-08-24 (a petición explícita del usuario, mockup
   proporcionado) -- EXCLUSIVO de esta pestaña "Líneas". Cuadrícula
   uniforme (5 columnas en desktop grande) en vez del flex-wrap
   anterior (que dejaba una fila irregular 7+3). Sigue siendo
   ÚNICAMENTE Línea 1..10 (hasLineStations, igual que antes) -- Línea
   de Proyecto/CT LINEA 0 y el resto de áreas (Paletizado, Accesorios,
   Cajas, etc.) NUNCA aparecen aquí, viven en "Áreas de trabajo". No se
   tocó ninguna fuente de datos: REAL/IDEAL sigue viniendo de
   getAreaStaffing() (personnelByArea.js, ya excluye bajas y respeta
   asignación diaria real sobre snapshot), estaciones reales de
   getWorkstationsForLine() (workstations.js, distintas por línea --
   nunca se hardcodea "5 estaciones" para todas).

   Estado visual de 2 niveles -- amarillo si la línea está vacía (0
   personas), verde si tiene gente, sin importar si ya llegó al ideal
   (2026-09-03, a petición explícita del usuario: "si una WC LINEA esta
   vacia que este en color amarillo la card ya si hay gente en verde").
   Reemplaza la version anterior de 3 niveles (100% verde / 1-99%
   naranja / 0% rojo) -- el badge "Completa"/"Faltan N" (arriba a la
   derecha de cada card) es un indicador aparte, sin tocar, que sigue
   comparando contra el ideal. Es EXCLUSIVO de esta vista, a petición
   explícita del usuario ("esto es únicamente estado visual, no
   confundir con reglas de producción") -- no se tocó STATUS_META/
   statusFor de OperatingFloorPlan.jsx (4 estados, otros colores), cada
   vista mantiene su propia semántica visual sin mezclarse.

   Fase 6c (Centro de Trabajo): portado de MUI a Tailwind. Los 5 colores
   hex originales (#10B981/#F59E0B/#EF4444/#3B82F6/#A855F7) coinciden
   exactamente con emerald-500/amber-500/red-500/blue-500/purple-500 de
   la paleta por defecto de Tailwind -- se usan esas clases con nombre en
   vez de hex arbitrario para mantenerse dentro del sistema de diseño. */

// Fase 4 (i18n): las etiquetas visibles de este mapa ya no viven aqui --
// `dot`/`text` son clases CSS (nunca texto de usuario), y `label` se
// resuelve via t() solo donde se muestra (SummaryPanel, unico lugar que
// renderiza la leyenda), ver STATUS_LABEL_KEYS mas abajo.
const VISUAL_STATUS = {
  CON_PERSONAL: { dot: 'bg-emerald-500', text: 'text-emerald-500' },
  VACIA: { dot: 'bg-amber-500', text: 'text-amber-500' },
}

const STATUS_LABEL_KEYS = {
  CON_PERSONAL: 'lineasTab.statusHasStaff',
  VACIA: 'lineasTab.statusEmpty',
}

function visualStatusFor(real) {
  return real > 0 ? 'CON_PERSONAL' : 'VACIA'
}

function normalize(text) {
  return text.toString().trim().toLowerCase()
}

/* Acepta "1".."10", "linea 3", "línea 3", "linea3", "ct linea 3" —
   cualquier forma razonable de referirse a una línea por número o
   nombre. */
function matchesQuery(linea, rawQuery) {
  const q = normalize(rawQuery)
  if (!q) return true
  const num = linea.id.replace('LINEA', '')
  const candidates = [
    normalize(linea.id),
    normalize(linea.name),
    `linea ${num}`,
    `línea ${num}`,
    `linea${num}`,
    num,
  ]
  return candidates.some((c) => c.includes(q))
}

export default function LineasTab({ onOpenLine }) {
  const { t } = useTranslation('centroTrabajo')
  usePersonnelVersion()
  const [query, setQuery] = useState('')
  const [view, setView] = useState('grid')

  const lineas = useMemo(() => WORK_CENTERS.filter((w) => hasLineStations(w.id)), [])

  const rows = useMemo(
    () =>
      lineas.map((linea) => {
        const staffing = getAreaStaffing(linea.id)
        const ideal = staffing.ideal || 0
        const real = staffing.real || 0
        const pct = ideal > 0 ? Math.min((real / ideal) * 100, 100) : 0
        const missing = Math.max(ideal - real, 0)
        const stationsCount = getWorkstationsForLine(linea.id).length
        return {
          linea,
          staffing,
          real,
          ideal,
          pct,
          missing,
          complete: real >= ideal && ideal > 0,
          stationsCount,
        }
      }),
    [lineas],
  )

  const filteredRows = useMemo(
    () => rows.filter((r) => matchesQuery(r.linea, query)),
    [rows, query],
  )

  const totals = useMemo(() => {
    const totalReal = rows.reduce((s, r) => s + r.real, 0)
    const totalIdeal = rows.reduce((s, r) => s + r.ideal, 0)
    const faltante = Math.max(totalIdeal - totalReal, 0)
    const coverage = totalIdeal > 0 ? (totalReal / totalIdeal) * 100 : 0
    return { totalReal, totalIdeal, faltante, coverage, count: rows.length }
  }, [rows])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <p className="text-[15px] font-extrabold">
            {t('lineasTab.title', { count: lineas.length })}
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 cursor-help text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>{t('lineasTab.tooltipInfo')}</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('lineasTab.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="inline-flex items-center rounded-md border border-input p-0.5">
            <button
              type="button"
              aria-label={t('lineasTab.gridViewLabel')}
              onClick={() => setView('grid')}
              className={cn(
                'inline-flex h-8 w-9 items-center justify-center rounded-sm transition-colors',
                view === 'grid'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50',
              )}
            >
              <LayoutGrid className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              aria-label={t('lineasTab.listViewLabel')}
              onClick={() => setView('lista')}
              className={cn(
                'inline-flex h-8 w-9 items-center justify-center rounded-sm transition-colors',
                view === 'lista'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50',
              )}
            >
              <List className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredRows.map((row) => (
            <LineaCard key={row.linea.id} row={row} onOpenLine={onOpenLine} />
          ))}
        </div>
      ) : (
        <LineasListView rows={filteredRows} onOpenLine={onOpenLine} />
      )}

      {filteredRows.length === 0 && (
        <p className="py-8 text-center text-[13px] text-muted-foreground">
          {t('lineasTab.noMatch', { query })}
        </p>
      )}

      <SummaryPanel totals={totals} />

      <p className="mt-3 text-center text-[11px] text-muted-foreground/60">
        {t('lineasTab.dataNote')}
      </p>
    </div>
  )
}

function LineaCard({ row, onOpenLine }) {
  const { t } = useTranslation('centroTrabajo')
  const { linea, real, ideal, pct, missing, complete, stationsCount } = row
  const statusKey = visualStatusFor(real)
  const status = VISUAL_STATUS[statusKey]
  const { isOver, dropProps } = useEmployeeDropTarget(linea.id)

  return (
    <button
      {...dropProps}
      type="button"
      onClick={() => onOpenLine?.(linea.id)}
      className={cn(
        'flex select-none flex-col gap-2 rounded-[16px] border p-3.5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-[180ms] hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-[0_6px_16px_rgba(16,24,40,0.08)]',
        isOver
          ? 'border-blue-500 bg-blue-500/[0.06] dark:bg-blue-500/[0.18]'
          : 'border-border bg-card',
      )}
    >
      <div className="flex items-center gap-1.5">
        <div className={cn('h-2 w-2 shrink-0 rounded-full', status.dot)} />
        <p className="flex-1 truncate text-[14.5px] font-extrabold">{linea.name}</p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold text-muted-foreground">
          {t('lineasTab.peopleCount', { real, ideal })}
        </p>
        <span
          className={cn(
            'inline-flex h-5 items-center rounded-full px-2 text-[10.5px] font-bold',
            complete ? 'bg-emerald-500/[0.14] text-emerald-500' : 'bg-red-500/[0.12] text-red-500',
          )}
        >
          {complete ? t('lineasTab.complete') : t('lineasTab.missingCount', { count: missing })}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full', status.dot)} style={{ width: `${pct}%` }} />
        </div>
        <span className={cn('min-w-[34px] text-right text-[11.5px] font-bold', status.text)}>
          {Math.round(pct)}%
        </span>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-dashed border-border pt-1">
        <div className="flex items-center gap-[4.8px]">
          <Cog className="h-[15px] w-[15px] text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground">
            {t('lineasTab.stationsCount', { count: stationsCount })}
          </p>
        </div>
        <ChevronRight className="h-[18px] w-[18px] text-muted-foreground/60" />
      </div>

      {isOver && <p className="text-[10px] font-bold text-blue-500">{t('lineasTab.dropHint')}</p>}
    </button>
  )
}

function LineasListView({ rows, onOpenLine }) {
  const { t } = useTranslation('centroTrabajo')
  return (
    <div className="overflow-auto rounded-[20px] border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[11.5px] font-extrabold uppercase text-muted-foreground">
              {t('lineasTab.colLinea')}
            </TableHead>
            <TableHead className="text-[11.5px] font-extrabold uppercase text-muted-foreground">
              {t('lineasTab.colPersonal')}
            </TableHead>
            <TableHead className="text-[11.5px] font-extrabold uppercase text-muted-foreground">
              {t('lineasTab.colEstado')}
            </TableHead>
            <TableHead className="text-[11.5px] font-extrabold uppercase text-muted-foreground">
              {t('lineasTab.colCobertura')}
            </TableHead>
            <TableHead className="text-[11.5px] font-extrabold uppercase text-muted-foreground">
              {t('lineasTab.colEstaciones')}
            </TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const { linea, real, ideal, pct, missing, complete, stationsCount } = row
            const status = VISUAL_STATUS[visualStatusFor(real)]
            return (
              <TableRow
                key={linea.id}
                onClick={() => onOpenLine?.(linea.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onOpenLine?.(linea.id)
                  }
                }}
                className="cursor-pointer"
              >
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <div className={cn('h-[7px] w-[7px] shrink-0 rounded-full', status.dot)} />
                    <p className="text-[13px] font-bold">{linea.name}</p>
                  </div>
                </TableCell>
                <TableCell className="text-[13px] font-semibold">
                  {real} / {ideal}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex h-5 items-center rounded-full px-2 text-[10.5px] font-bold',
                      complete
                        ? 'bg-emerald-500/[0.14] text-emerald-500'
                        : 'bg-red-500/[0.12] text-red-500',
                    )}
                  >
                    {complete
                      ? t('lineasTab.complete')
                      : t('lineasTab.missingCount', { count: missing })}
                  </span>
                </TableCell>
                <TableCell className={cn('text-[13px] font-bold', status.text)}>
                  {Math.round(pct)}%
                </TableCell>
                <TableCell className="text-[13px]">{stationsCount}</TableCell>
                <TableCell className="text-right">
                  <ChevronRight className="ml-auto h-[18px] w-[18px] text-muted-foreground/60" />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function SummaryPanel({ totals }) {
  const { t } = useTranslation('centroTrabajo')
  const items = [
    {
      label: t('lineasTab.totalLinesLabel'),
      value: totals.count,
      icon: <Users className="h-[17px] w-[17px]" />,
      border: 'border-blue-500/20',
      bg: 'bg-blue-500/[0.05] dark:bg-blue-500/[0.08]',
      iconBg: 'bg-blue-500/[0.14]',
      iconText: 'text-blue-500',
    },
    {
      label: t('lineasTab.assignedPersonnelLabel'),
      value: `${totals.totalReal} / ${totals.totalIdeal}`,
      icon: <Users2 className="h-[17px] w-[17px]" />,
      border: 'border-emerald-500/20',
      bg: 'bg-emerald-500/[0.05] dark:bg-emerald-500/[0.08]',
      iconBg: 'bg-emerald-500/[0.14]',
      iconText: 'text-emerald-500',
    },
    {
      label: t('lineasTab.missingPersonnelLabel'),
      value: totals.faltante,
      icon: <UserX className="h-[17px] w-[17px]" />,
      border: 'border-red-500/20',
      bg: 'bg-red-500/[0.05] dark:bg-red-500/[0.08]',
      iconBg: 'bg-red-500/[0.14]',
      iconText: 'text-red-500',
    },
    {
      label: t('lineasTab.overallCoverageLabel'),
      value: `${totals.coverage.toFixed(1)}%`,
      icon: <PieChart className="h-[17px] w-[17px]" />,
      border: 'border-purple-500/20',
      bg: 'bg-purple-500/[0.05] dark:bg-purple-500/[0.08]',
      iconBg: 'bg-purple-500/[0.14]',
      iconText: 'text-purple-500',
    },
  ]
  return (
    <div className="mt-5 rounded-[16px] border border-border p-4">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.4px] text-muted-foreground">
            {t('lineasTab.statusLegendTitle')}
          </p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(VISUAL_STATUS).map(([key, meta]) => (
              <div key={key} className="flex items-center gap-[4.8px]">
                <div className={cn('h-2 w-2 rounded-full', meta.dot)} />
                <p className="text-xs font-semibold text-muted-foreground">
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
              className={cn(
                'flex min-w-[150px] items-center gap-2 rounded-[20px] border px-3 py-2',
                item.border,
                item.bg,
              )}
            >
              <div
                className={cn(
                  'grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full',
                  item.iconBg,
                  item.iconText,
                )}
              >
                {item.icon}
              </div>
              <div>
                <p className="text-base font-extrabold leading-[1.15]">{item.value}</p>
                <p className="text-[10.5px] font-semibold text-muted-foreground">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
