import { Package } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cardClass } from '@/lib/pageStyles'
import { cn } from '@/lib/utils'
import { fetchLineStationConfig } from '../../data/personnel/lineStationConfig'
import { getLineWorkstationsWithOccupancy } from '../../data/personnel/repository'
import { usePersonnelVersion } from '../../data/personnel/usePersonnelVersion'
import { getAreaStaffing } from '../../data/production/personnelByArea'

/* Layout visual real de Sorting (2026-09-08, a peticion explicita del usuario -- pizarron a
   mano: RCY y FRM separadas por una entrada "E", una linea de 7 "V" abajo (pallets arriba, cada V
   con 2 personas en un extremo y 2 en el otro -- 4 por linea), y aparte KITS/PATINES/DMR-DML en
   una fila y PNP/Gerente de Sorting/DMA-DMT en otra. A diferencia de OperatingFloorPlan.jsx (el
   plano de FFT, 1279 lineas de canvas pan/zoom con la geometria exacta de esa planta), este es
   deliberadamente un layout estatico simple -- Sorting arranca sin ese nivel de detalle fisico
   confirmado todavia; cada caja SI es real (datos reales via getAreaStaffing/
   getLineWorkstationsWithOccupancy, generico, mismo que usa cualquier otra area del catalogo) y
   clickeable hacia el mismo detalle (`onSelectArea`, igual patron que WorkAreaBottomSummary).

   2026-09-08 (segunda ronda, viendo el layout en vivo): se agregan las 2 areas que faltaban
   ("Patines", "Gerente de Sorting" -- cuadro chico, area de apoyo) y se corrige la capacidad
   real de SORT_LINEA de 2 a 4 personas por estacion (ver catalogSorting.js y
   scripts/update-sort-linea-capacity-2026-09-08.mjs).

   2026-09-08 (cuarta ronda, a peticion explicita del usuario -- "quiero que el layout de fft y
   sorting se vea como en la empresa real... que hagan match", foto de referencia): el "conveyor"
   (Línea de Sorting) termina hasta PNP, asi que PNP y DMA/DMT ahora comparten fila con la Línea
   de Sorting y crecen (grid `items-stretch`, sin alturas fijas) para quedar nivelados con ella;
   Patines/Gerente de Sorting se quedan como una franja angosta bajo PNP; RCY/Entrada/FRM/KITS/
   DMR-DML bajan a una segunda fila de tamaño normal. */

const SIMPLE_AREAS = [
  { id: 'SORT_RCY', name: 'RCY' },
  { id: 'SORT_FRM', name: 'FRM' },
]
// 2026-09-08 (septima ronda): SORT_LINEA1..7, 7 areas de catalogo reales e independientes (ver
// catalogSorting.js) -- ya NO son puestos dentro de una sola area compartida.
const SORTING_LINE_IDS = [
  'SORT_LINEA1',
  'SORT_LINEA2',
  'SORT_LINEA3',
  'SORT_LINEA4',
  'SORT_LINEA5',
  'SORT_LINEA6',
  'SORT_LINEA7',
]
// 2026-09-08 (tercera ronda -- a peticion explicita del usuario, foto real del pizarron para
// esta seccion especifica): KITS/DMR-DML arriba y PNP/DMA-DMT abajo son las 4 areas grandes de
// siempre; Patines (mediano) y Gerente de Sorting (chico) van juntos en una franja angosta entre
// esas dos filas, del lado izquierdo -- DMA/DMT ocupa esa misma altura del lado derecho (crece
// hacia abajo en vez de tener su propia franja), tal cual el dibujo. Layout armado con
// grid-template-areas (ver JSX) en vez de un grid uniforme 3x2 -- por eso KITS/DMR-DML/PNP/DMA-
// DMT no llevan `size` (grandes, tamaño de siempre) y solo Patines/Gerente son mas chicos.
const KITS = { id: 'SORT_KITS', name: 'KITS' }
const DMR_DML = { id: 'SORT_DMR_DML', name: 'DMR / DML' }
const PNP = { id: 'SORT_PNP', name: 'PNP' }
const DMA_DMT = { id: 'SORT_DMA_DMT', name: 'DMA / DMT' }
// 2026-09-08 (sexta ronda, a peticion explicita del usuario -- "mueve la card de lugar donde
// esta patines cambialo por gerente de sorting y en ese va patines"): Gerente de Sorting pasa a
// la ranura ancha (`size:'medium'`), Patines a la chica (`size:'small'`) -- justo al reves que
// antes. `equipment: true` en Patines: "ahi no va personal, solo los patines del area" -- ver
// SimpleAreaBox, nunca muestra conteo de personal para un area marcada asi.
const PATINES = { id: 'SORT_PATINES', name: 'Patines', size: 'small', equipment: true }
const GERENTE = { id: 'SORT_GERENTE', name: 'Gerente de Sorting', size: 'medium' }
const SUPERVISOR = { id: 'SORT_SUPERVISOR', name: 'Supervisor', size: 'small' }

function statusColor(staffing) {
  if (staffing.ideal == null) return '#94A3B8'
  if (staffing.real <= 0) return '#94A3B8'
  return staffing.status === 'COMPLETA' ? '#10B981' : '#EF4444'
}

const SIZE_CLASSES = {
  small: { box: 'min-h-[56px] p-3', title: 'text-xs font-extrabold', value: 'text-xs' },
  medium: { box: 'min-h-[76px] p-4', title: 'text-sm font-extrabold', value: 'text-sm' },
  large: { box: 'min-h-[104px] p-6', title: 'text-lg font-extrabold', value: 'text-base' },
}

function SimpleAreaBox({ area, onSelectArea, className, style }) {
  const { t } = useTranslation('centroTrabajo')
  const staffing = getAreaStaffing(area.id)
  const color = statusColor(staffing)
  const sizeClasses = SIZE_CLASSES[area.size || 'large']
  return (
    <button
      type="button"
      onClick={() => onSelectArea(area.id)}
      className={cn(
        'flex flex-col items-start justify-between rounded-3xl border-2 text-left transition-colors hover:bg-accent',
        sizeClasses.box,
        className,
      )}
      style={{ borderColor: color, ...style }}
    >
      <p className={sizeClasses.title}>{area.name}</p>
      {area.equipment ? (
        <p className="mt-1 text-sm text-muted-foreground">{t('sortingFloorPlan.equipmentLabel')}</p>
      ) : staffing.ideal == null ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {staffing.real} {t('sortingFloorPlan.peopleSuffix')}
        </p>
      ) : (
        <p className={cn('mt-1 font-bold', sizeClasses.value)} style={{ color }}>
          {staffing.real} / {staffing.ideal}
        </p>
      )}
    </button>
  )
}

// Renderiza `slots` (personas o `undefined` = vacante) en una fila de 2 o 3 columnas -- extraido
// para que VLineStation lo reutilice arriba y abajo con cualquier capacidad real (4 o 5, ver
// comentario de VLineStation mas abajo).
function OccupantRow({ slots, nameOrVacant }) {
  return (
    <div className={cn('grid w-full gap-1', slots.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
      {slots.map((o, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: slots son posiciones fijas de la V (arriba/abajo), nunca se reordenan
          key={i}
          className={cn(
            i < slots.length - 1 && 'border-r border-dashed border-border/70 pr-1',
            i > 0 && 'pl-1',
          )}
        >
          {nameOrVacant(o)}
        </div>
      ))}
    </div>
  )
}

// Una "V" real: 1 persona por punta (2 arriba, en las puntas de la V; 2 abajo, en las puntas de
// la V invertida) -- a peticion explicita del usuario ("cada punto de extremo a extremo lleva una
// persona"). occupants ya viene ordenado por checkInAt (repository.js).
//
// 2026-09-08 (septima ronda, a peticion explicita del usuario -- "ahi te falta poner que las
// lineas sean por separado, son 7 lineas independientes, no solo una"): cada V es ahora su
// PROPIA area de catalogo real (SORT_LINEA1..7, ver catalogSorting.js) -- antes las 7 eran solo
// puestos dentro de una unica area "SORT_LINEA" compartida. El boton ya no vive en el
// contenedor exterior (que ahora es un simple agrupador visual): cada VLineStation es su propio
// <button> clickeable hacia su propia area real.
//
// `capacity`/`lineNumber` (2026-09-10, a peticion explicita del usuario viendo el plano en vivo
// -- "las lineas en vertical son del 2 al 8... la numero 8 es de 5 personas"): antes `index+1`
// asumia siempre 4 personas (2 arriba/2 abajo) fijas; ahora el numero mostrado y el reparto
// arriba/abajo (ceil(capacity/2) arriba, resto abajo) son configurables por linea -- la que se
// muestra como "8" reparte 3 arriba/2 abajo en vez de 2/2, sin tocar a las demas.
function VLineStation({ areaId, station, lineNumber, capacity, color, onSelectArea }) {
  const { t } = useTranslation('centroTrabajo')
  const topCount = Math.ceil(capacity / 2)
  const topSlots = Array.from({ length: topCount }, (_, i) => station.occupants[i])
  const bottomSlots = Array.from(
    { length: capacity - topCount },
    (_, i) => station.occupants[topCount + i],
  )
  const hasPeople = station.occupants.length > 0
  const nameOrVacant = (o) =>
    o ? (
      <p className="truncate font-semibold">{o.employee?.name || '—'}</p>
    ) : (
      <p className="text-muted-foreground/70">{t('sortingFloorPlan.vacantLabel')}</p>
    )
  return (
    <button
      type="button"
      onClick={() => onSelectArea(areaId)}
      className={cn(
        'flex flex-col items-center gap-1 rounded-xl border-2 p-2.5 text-center text-[12px] transition-colors hover:bg-accent',
        hasPeople ? 'bg-emerald-500/[0.08]' : 'bg-black/[.02] dark:bg-white/[.03]',
      )}
      style={{ borderColor: color }}
    >
      {/* Puntas de la V (arriba, abre hacia arriba). */}
      <OccupantRow slots={topSlots} nameOrVacant={nameOrVacant} />
      {/* V + tramo vertical BIEN visible + V invertida "parada" (la punta hacia arriba, abre
          hacia abajo) -- a peticion explicita del usuario tras ver el primer intento ("no es v
          una linea vertical y otra v parada la punta de la v invertida"): el primer intento
          tenia el tramo vertical demasiado corto y se veia como una sola X. Dos polylines
          simetricas que comparten los 2 puntos centrales (24,14) y (24,38), separados 24
          unidades para que la linea vertical se lea como un tramo propio, no una bisagra. */}
      <svg
        viewBox="0 0 48 56"
        className="h-10 w-12 text-muted-foreground/60"
        aria-hidden="true"
        role="presentation"
      >
        <polyline
          points="4,2 24,14 24,38 4,50"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="44,2 24,14 24,38 44,50"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {/* Puntas de la V invertida (abajo). */}
      <OccupantRow slots={bottomSlots} nameOrVacant={nameOrVacant} />
      <p className="font-bold text-muted-foreground">{lineNumber}</p>
      {/* Pallet abajo de todo -- a peticion explicita del usuario ("el dibujo del pallet en vez
          de que este ahi arriba es abajo"). */}
      <div
        className="grid h-6 w-6 place-items-center rounded-md border border-dashed border-border/70 text-muted-foreground/70"
        title={t('sortingFloorPlan.palletLabel')}
      >
        <Package className="h-3.5 w-3.5" />
      </div>
    </button>
  )
}

// "Línea de Sorting 1" (2026-09-10, a peticion explicita del usuario viendo el plano en vivo --
// "agregas una nueva linea la 1 que es en horizontal, la pones a lado derecho de la linea 8"):
// misma info real que una V (nombre, personas reales via getAreaStaffing/
// getLineWorkstationsWithOccupancy, numero de linea) pero en una franja horizontal -- ANCHA y
// BAJA, personas en una sola fila -- nunca una tarjeta alta como las V. Mismo estilo visual
// exacto que SortingConveyorBar (franja delgada, border-t marcado) en vez del `h-full` que
// antes la estiraba a la altura de las V (2026-09-10, segunda pasada, a peticion explicita del
// usuario tras verla en vivo -- "la linea 1 no esta en horizontal esta en vertical"): el
// contenedor es un grid de 8 columnas con las V (altas) al lado, y CSS Grid estira por default
// todos los items de una fila a la misma altura -- `self-start` en el <button> evita que esta
// franja corta se estire, dejandola compacta arriba de su columna en vez de alta como las demas.
function HorizontalLineStation({ areaId, station, lineNumber, capacity, color, onSelectArea }) {
  const { t } = useTranslation('centroTrabajo')
  const slots = Array.from({ length: capacity }, (_, i) => station.occupants[i])
  const nameOrVacant = (o) => (o ? o.employee?.name || '—' : t('sortingFloorPlan.vacantLabel'))
  return (
    <button
      type="button"
      onClick={() => onSelectArea(areaId)}
      className="flex w-full flex-col gap-1.5 self-start rounded-2xl border border-t-[3px] p-2.5 text-left transition-colors hover:bg-accent"
      style={{ borderColor: color }}
    >
      <p className="text-xs font-extrabold tracking-[0.4px]">{lineNumber}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {slots.map((o, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: slots son posiciones fijas (4 puestos), nunca se reordenan
          <p key={i} className="text-[11px] font-semibold text-muted-foreground">
            {i + 1}. {nameOrVacant(o)}
          </p>
        ))}
      </div>
    </button>
  )
}

// "Conveyor de Sorting" (2026-09-08, quinta ronda -- a peticion explicita del usuario, "no veo
// el conveyor aqui... debe ser el conveyor del mismo grosor que el de FFT"): franja delgada
// (border-t-[3px], padding chico) en vez de una caja grande como las demas areas -- mismo
// "grosor" visual que "WC Conveyor General" (ConveyorGeneralBar, OperatingFloorPlan.jsx), pero
// con el estilo simple ya establecido en este archivo (border por color de estado) en vez de
// las clases de tono/EmployeeAvatar de esa vista, que es exclusiva del plano canvas de FFT.
function SortingConveyorBar({ stations, staffing, color, onSelectArea }) {
  const { t } = useTranslation('centroTrabajo')
  return (
    <button
      type="button"
      onClick={() => onSelectArea('SORT_CONVEYOR')}
      className="flex flex-col gap-1.5 rounded-2xl border border-t-[3px] p-2.5 text-left transition-colors hover:bg-accent"
      style={{ borderColor: color }}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-extrabold tracking-[0.4px]">
          {t('sortingFloorPlan.conveyorName')}
        </p>
        <p className="text-xs font-bold" style={{ color }}>
          {staffing.real} / {staffing.ideal}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {stations.map((s, idx) => (
          <p key={s.id} className="text-[11px] font-semibold text-muted-foreground">
            {idx + 1}. {s.occupants[0]?.employee?.name || t('sortingFloorPlan.vacantLabel')}
          </p>
        ))}
      </div>
    </button>
  )
}

export default function SortingFloorPlan({ onSelectArea }) {
  const { t } = useTranslation('centroTrabajo')
  usePersonnelVersion()
  const [, setConfigVersion] = useState(0)

  // Los puestos reales de SORT_LINEA1..7 (1 c/u), SORT_LINEA8 (1, nueva 2026-09-10) y
  // SORT_CONVEYOR (2) viven en la BD (scripts/split-sort-linea-2026-09-08.mjs, scripts/seed-
  // sorting-conveyor-2026-09-08.mjs, scripts/rename-sorting-lines-add-linea1-2026-09-10.mjs),
  // pero getWorkstationsForLine() solo los usa si ya estan en cache (lineStationConfig.js) --
  // mismo patron exacto que LineDetailDrawer.jsx al abrir una WC LINEA. Sin este fetch, cada uno
  // cae en el generador JS generico (1 solo puesto "catch-all") porque ninguno tiene
  // CUSTOM_STATION_PLANS propio.
  useEffect(() => {
    let cancelled = false
    Promise.all(
      [...SORTING_LINE_IDS, 'SORT_LINEA8', 'SORT_CONVEYOR'].map((id) => fetchLineStationConfig(id)),
    ).then(() => {
      if (!cancelled) setConfigVersion((v) => v + 1)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 2026-09-08 (septima ronda): 8 areas reales independientes (SORT_LINEA1..8) en vez de 1 sola
  // con 7 puestos adentro -- ver comentario de catalogSorting.js/VLineStation. El header sigue
  // mostrando un total agregado (suma de las 8) para no perder la vista rapida de "cuanta gente
  // en total". `lineNumber` (2026-09-10): se muestra como 2..8 para las V (idx+2, ver
  // catalogSorting.js) y como 1 para la nueva linea horizontal.
  const lineaRows = SORTING_LINE_IDS.map((id, idx) => ({
    id,
    lineNumber: idx + 2,
    staffing: getAreaStaffing(id),
    station: getLineWorkstationsWithOccupancy(id)[0] || { id, occupants: [] },
  }))
  const linea1Row = {
    id: 'SORT_LINEA8',
    lineNumber: 1,
    staffing: getAreaStaffing('SORT_LINEA8'),
    station: getLineWorkstationsWithOccupancy('SORT_LINEA8')[0] || {
      id: 'SORT_LINEA8',
      occupants: [],
    },
  }
  const allLineaRows = [...lineaRows, linea1Row]
  const lineaTotalReal = allLineaRows.reduce((sum, r) => sum + r.staffing.real, 0)
  const lineaTotalIdeal = allLineaRows.reduce((sum, r) => sum + (r.staffing.ideal || 0), 0)
  const lineaGroupColor = statusColor({
    ideal: lineaTotalIdeal,
    real: lineaTotalReal,
    status: lineaTotalIdeal > 0 && lineaTotalReal >= lineaTotalIdeal ? 'COMPLETA' : 'OTRO',
  })
  const conveyorStations = getLineWorkstationsWithOccupancy('SORT_CONVEYOR')
  const conveyorStaffing = getAreaStaffing('SORT_CONVEYOR')
  const conveyorColor = statusColor(conveyorStaffing)

  return (
    <div className={cn(cardClass, 'p-8')}>
      <p className="mb-1 text-xl font-extrabold">{t('sortingFloorPlan.title')}</p>
      <p className="mb-6 text-sm text-muted-foreground">{t('sortingFloorPlan.subtitle')}</p>

      <div className="flex flex-col gap-6">
        {/* Fila superior: el "conveyor" (Línea de Sorting) termina hasta PNP -- PNP y DMA/DMT
            crecen para quedar nivelados con el conveyor. `items-stretch` (grid default) hace
            que ambas columnas compartan la misma altura, sin alturas fijas a mano.

            2026-09-08 (quinta ronda, a peticion explicita del usuario -- "donde esta el
            conveyor... que el conveyor siga por donde esta el conveyor de paletizado"): el
            conveyor de FFT (WC Paletizado) esta del lado DERECHO en el plano de FFT
            (OperatingFloorPlan.jsx) -- Línea de Sorting se mueve al lado derecho para calzar con
            eso, y el cluster PNP/Patines/Gerente/DMA-DMT pasa al izquierdo (antes al reves).
            Mismo cambio en la fila de abajo: KITS/DMR-DML ahora a la izquierda,
            RCY/Entrada/FRM a la derecha -- un espejo horizontal completo del layout anterior,
            exactamente lo que pidio el usuario ("cambia estos 3 [+ entrada] adonde estan los
            otros 6, y los otros 6 adonde estan esos 3"). */}
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[460px_1fr]">
          <div
            className="grid grid-cols-2 grid-rows-2 gap-3"
            style={{ gridTemplateAreas: '"pnp dmadmt" "mid dmadmt"' }}
          >
            <SimpleAreaBox
              area={PNP}
              onSelectArea={onSelectArea}
              className="h-full"
              style={{ gridArea: 'pnp' }}
            />
            <div className="flex gap-2" style={{ gridArea: 'mid' }}>
              <SimpleAreaBox area={GERENTE} onSelectArea={onSelectArea} className="flex-1" />
              <SimpleAreaBox area={PATINES} onSelectArea={onSelectArea} className="w-20 shrink-0" />
            </div>
            <SimpleAreaBox
              area={DMA_DMT}
              onSelectArea={onSelectArea}
              className="h-full"
              style={{ gridArea: 'dmadmt' }}
            />
          </div>

          <div className="flex h-full flex-col gap-3">
            <SortingConveyorBar
              stations={conveyorStations}
              staffing={conveyorStaffing}
              color={conveyorColor}
              onSelectArea={onSelectArea}
            />
            <div
              className="flex flex-1 flex-col rounded-3xl border-2 p-6"
              style={{ borderColor: lineaGroupColor }}
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-lg font-extrabold">{t('sortingFloorPlan.lineName')}</p>
                <p className="text-base font-bold" style={{ color: lineaGroupColor }}>
                  {lineaTotalReal} / {lineaTotalIdeal}
                </p>
              </div>

              <div className="grid flex-1 grid-cols-4 gap-3 sm:grid-cols-8">
                {lineaRows.map((row) => (
                  <VLineStation
                    key={row.id}
                    areaId={row.id}
                    station={row.station}
                    lineNumber={row.lineNumber}
                    capacity={row.staffing.ideal || 4}
                    color={statusColor(row.staffing)}
                    onSelectArea={onSelectArea}
                  />
                ))}
                {/* "Línea de Sorting 1" (2026-09-10, a peticion explicita del usuario -- "agregas
                    una nueva linea la 1 que es en horizontal, la pones a lado derecho de la
                    linea 8"): a la derecha de las 7 V (que van del 2 al 8), en el mismo grid. */}
                <HorizontalLineStation
                  areaId={linea1Row.id}
                  station={linea1Row.station}
                  lineNumber={linea1Row.lineNumber}
                  capacity={linea1Row.staffing.ideal || 4}
                  color={statusColor(linea1Row.staffing)}
                  onSelectArea={onSelectArea}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Fila inferior: KITS/DMR-DML a la izquierda, RCY/Entrada/FRM a la derecha (espejo de
            la fila de arriba). */}
        <div className="grid grid-cols-5 items-stretch gap-3">
          <SimpleAreaBox area={KITS} onSelectArea={onSelectArea} />
          <SimpleAreaBox area={DMR_DML} onSelectArea={onSelectArea} />
          <SimpleAreaBox area={SIMPLE_AREAS[0]} onSelectArea={onSelectArea} />
          <SimpleAreaBox area={SUPERVISOR} onSelectArea={onSelectArea} />
          <SimpleAreaBox area={SIMPLE_AREAS[1]} onSelectArea={onSelectArea} />
        </div>
      </div>
    </div>
  )
}
