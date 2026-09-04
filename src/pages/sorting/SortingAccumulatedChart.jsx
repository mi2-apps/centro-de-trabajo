import { useTranslation } from 'react-i18next'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { computeAccumulatedSeries } from '../../data/shiftProduction/metrics.js'
import ChartCard from '../dashboard/ChartCard'

const GRID_COLOR = 'hsl(var(--foreground) / 0.06)'
const AXIS_COLOR = 'hsl(var(--muted-foreground))'

/* "Avance acumulado" (2026-09-04, a peticion explicita del usuario -- "NO quiero una grafica
   exageradamente grande, debe complementar la informacion, no dominar toda la pagina"): altura
   chica (220 vs 280 del Dashboard), 2 series (esperado/real acumulado), mismo lenguaje visual
   (tokens de color, ChartCard) que el resto del sistema. */
function ChartTooltip({ active, payload, label }) {
  const { t } = useTranslation('sorting')
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[15px] border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <div className="mb-0.5 text-[12.5px] font-bold">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="text-xs text-muted-foreground">
          {t(p.dataKey === 'expected' ? 'chartExpectedLabel' : 'chartActualLabel')}: {p.value}
        </div>
      ))}
    </div>
  )
}

export default function SortingAccumulatedChart({ entries, activeIndex }) {
  const { t } = useTranslation('sorting')
  const data = computeAccumulatedSeries(entries, activeIndex)

  return (
    <ChartCard
      title={t('accumulatedChartTitle')}
      subtitle={t('accumulatedChartSubtitle')}
      height={200}
      empty={data.length === 0}
      emptyMessage={t('accumulatedChartEmpty')}
    >
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10.5, fill: AXIS_COLOR }}
              axisLine={{ stroke: GRID_COLOR }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: AXIS_COLOR }}
              axisLine={false}
              tickLine={false}
              width={32}
              allowDecimals={false}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(v) => t(v === 'expected' ? 'chartExpectedLabel' : 'chartActualLabel')}
            />
            <Line
              type="monotone"
              dataKey="expected"
              stroke="#94A3B8"
              strokeWidth={2}
              dot={false}
              strokeDasharray="4 3"
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#3B82F6"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#3B82F6', strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
