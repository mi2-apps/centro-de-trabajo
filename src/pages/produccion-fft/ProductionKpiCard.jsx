import { TrendingDown, TrendingUp } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { kpiCardClass, progressBarClass } from '@/lib/pageStyles'
import { cn } from '@/lib/utils'

const ACCENT_COLOR = { blue: '#3B82F6', green: '#10B981', amber: '#F59E0B', purple: '#A855F7' }

/* KPI grande del rediseño de "Producción FFT" (2026-09-02, mockup adjunto). `comparison` (previous/
   pctChange) viene YA calculado por el backend contra el periodo anterior real -- si pctChange es
   null (periodo no comparable, ej. el rango elegido no tiene un periodo anterior equivalente con
   datos) se muestra un estado neutral, NUNCA un porcentaje inventado (a peticion explicita del
   usuario: "Si no existe periodo comparable: mostrar un estado neutral"). `sparklineData` es
   opcional -- se omite el mini-grafico por completo si no hay suficiente historico real, en vez de
   inventar puntos. */
export default function ProductionKpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
  comparison,
  comparisonLabel,
  sparklineData,
  rightSlot,
  progress,
}) {
  const color = ACCENT_COLOR[accent] || ACCENT_COLOR.blue
  const hasComparison = comparison && typeof comparison.pctChange === 'number'
  const isUp = hasComparison && comparison.pctChange >= 0

  return (
    <div className={cn(kpiCardClass(accent), '!h-auto')}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${color}1A`, color }}
          >
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.4px] text-muted-foreground">{title}</p>
        </div>
        {hasComparison ? (
          <span
            className="flex shrink-0 items-center gap-0.5 text-[11.5px] font-bold"
            style={{ color: isUp ? '#10B981' : '#EF4444' }}
          >
            {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {Math.abs(comparison.pctChange).toFixed(1)}%
          </span>
        ) : (
          comparisonLabel && <span className="shrink-0 text-[11px] text-muted-foreground">{comparisonLabel}</span>
        )}
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[30px] font-extrabold leading-none">{value}</p>
          <p className="mt-1 text-[11.5px] text-muted-foreground">{subtitle}</p>
        </div>
        {rightSlot}
      </div>

      {progress && (
        <div className="mt-2.5">
          <div className={progressBarClass}>
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(.4,0,.2,1)]"
              style={{ width: `${Math.max(0, Math.min(100, progress.pct))}%`, backgroundColor: color }}
            />
          </div>
        </div>
      )}

      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-2 h-[30px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
