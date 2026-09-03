import { Activity, Timer } from 'lucide-react'
import { cardClass, cardHeaderClass, cardHeaderSubtitleClass, cardHeaderTitleClass } from '@/lib/pageStyles'
import { cn } from '@/lib/utils'

function StatBlock({ icon: Icon, tone, title, seconds, metaLine }) {
  const toneClass =
    tone === 'purple'
      ? 'border-[#E9D5FF] bg-[#FAF5FF] dark:border-[rgba(168,85,247,.25)] dark:bg-[rgba(168,85,247,.08)]'
      : 'border-[#BBF7D0] bg-[#F0FDF4] dark:border-[rgba(34,197,94,.25)] dark:bg-[rgba(34,197,94,.08)]'
  const iconClass = tone === 'purple' ? 'text-[#A855F7]' : 'text-[#22C55E]'
  return (
    <div className={cn('flex-1 rounded-lg border px-4 py-3.5', toneClass)}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-4 w-4', iconClass)} />
        <p className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-muted-foreground">{title}</p>
      </div>
      <p className="mt-1.5 text-[28px] font-extrabold leading-none">
        {seconds != null ? `${seconds.toFixed(1)}s` : '—'}
      </p>
      <p className="mt-1.5 text-[12px] text-muted-foreground">{metaLine}</p>
    </div>
  )
}

/* Card de Takt Time (teorico + real), UNA por cada una de las 11 lineas FFT (LINEA1..10 +
   PROYECTO/"WC LINEA 0") -- rediseño 2026-09-03, a peticion explicita del usuario: "quiero la
   card... en las 11 lineas para que este completo... haya o no haya pzs ya cuando haya que se
   ponga ahi los resultados". Antes vivia comprimida como 2 pastillas en el header de "Distribución
   de estaciones" (LineProcessFlow.jsx) -- se movio aqui, su propia card con mas espacio, debajo de
   la barra de busqueda de personal (LineDetailDrawer.jsx), SIEMPRE visible en las 11 lineas
   (mientras haya un turno oficial activo -- getCurrentShift() siempre devuelve uno) sin importar si
   esta linea tiene personal o piezas reales hoy: cuando no hay piezas reales todavia, el bloque
   verde muestra "—" y el aviso de "sin piezas reales hoy todavia" en vez de desaparecer o inventar
   un numero.

   Teorico (morado): tiempo neto del turno (31,200s) / meta de ESTA linea (meta de planta 1500/500
   repartida entre las lineas activas hoy, ver getTaktTime en catalog.js).
   Real (verde): mismo tiempo del turno / piezas reales de HOY que BinManager le atribuye a esta
   linea (api/production/takt-real.js, cruce por nombre). Nunca cronometra pieza por pieza -- es una
   proyeccion de "a este ritmo, cuanto tardaria cada pieza si se mantiene todo el turno". */
export default function TaktTimeCard({ t, taktTime, realTakt, shiftLabel }) {
  if (!taktTime) return null
  const theoreticalMeta = taktTime.activeLineCount
    ? t('lineDetailDrawer.taktTimeCompactMetaSplit', {
        targetPcs: Math.round(taktTime.targetPcs).toLocaleString(),
        plantTargetPcs: taktTime.plantTargetPcs.toLocaleString(),
        activeLineCount: taktTime.activeLineCount,
        shiftLabel,
      })
    : t('lineDetailDrawer.taktTimeCompactMeta', {
        targetPcs: Math.round(taktTime.targetPcs).toLocaleString(),
        shiftLabel,
      })
  const realMeta =
    realTakt?.secondsPerUnit != null
      ? t('lineDetailDrawer.taktTimeRealCompactMeta', { realPieces: realTakt.realPieces.toLocaleString() })
      : t('lineDetailDrawer.taktTimeRealEmptyLabel')

  return (
    <div className={cn(cardClass, 'mb-6')}>
      <div className={cardHeaderClass}>
        <div className="min-w-0 flex-1">
          <p className={cardHeaderTitleClass}>{t('lineDetailDrawer.taktTimeCardTitle')}</p>
          <p className={cardHeaderSubtitleClass}>{t('lineDetailDrawer.taktTimeCardSubtitle')}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-5 sm:flex-row">
        <StatBlock
          icon={Timer}
          tone="purple"
          title={t('lineDetailDrawer.taktTimeTitle')}
          seconds={taktTime.secondsPerUnit}
          metaLine={theoreticalMeta}
        />
        <StatBlock
          icon={Activity}
          tone="green"
          title={t('lineDetailDrawer.taktTimeRealTitle')}
          seconds={realTakt?.secondsPerUnit ?? null}
          metaLine={realMeta}
        />
      </div>
    </div>
  )
}
