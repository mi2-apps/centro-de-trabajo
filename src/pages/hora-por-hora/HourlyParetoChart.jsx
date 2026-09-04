import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { computeParetoData } from '../../data/horaPorHora/metrics.js'
import ChartCard from '../dashboard/ChartCard'

const GRID_COLOR = 'hsl(var(--foreground) / 0.06)'
const AXIS_COLOR = 'hsl(var(--muted-foreground))'

/* Pareto de causas (2026-09-04, a peticion explicita del usuario -- "NO mezclar minutos con
   piezas... selector [Minutos] [Piezas] para cambiar el Pareto"). Barras + linea de % acumulado,
   mismo patron combo-chart ya establecido (MissingVsIdealComboCard). */
function ChartTooltip({ active, payload, label }) {
  const { t } = useTranslation('horaPorHora')
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-[15px] border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <div className="mb-0.5 text-[12.5px] font-bold">{label}</div>
      <div className="text-xs text-muted-foreground">
        {t('paretoValueLabel')}: {row.value} ({row.pct.toFixed(1)}%)
      </div>
      <div className="text-xs text-muted-foreground">
        {t('paretoCumulativeLabel')}: {row.cumulativePct.toFixed(1)}%
      </div>
    </div>
  )
}

export default function HourlyParetoChart({ entries }) {
  const { t } = useTranslation('horaPorHora')
  const [measurementType, setMeasurementType] = useState('MINUTES')
  const data = computeParetoData(entries, measurementType)

  return (
    <ChartCard
      title={t('paretoTitle')}
      subtitle={t('paretoSubtitle')}
      height={200}
      empty={data.length === 0}
      emptyMessage={t('paretoEmpty')}
    >
      <div className="mb-2 flex justify-end gap-1.5">
        {['MINUTES', 'PIECES'].map((mt) => (
          <button
            key={mt}
            type="button"
            onClick={() => setMeasurementType(mt)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold',
              measurementType === mt
                ? 'border-[#3B82F6] bg-[#3B82F6]/[0.1] text-[#3B82F6]'
                : 'border-border text-muted-foreground',
            )}
          >
            {mt === 'MINUTES' ? t('unitMinutes') : t('unitPieces')}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis
              dataKey="cause"
              tick={{ fontSize: 10, fill: AXIS_COLOR }}
              axisLine={{ stroke: GRID_COLOR }}
              tickLine={false}
              interval={0}
              angle={-15}
              textAnchor="end"
              height={42}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: AXIS_COLOR }}
              axisLine={false}
              tickLine={false}
              width={30}
              allowDecimals={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: AXIS_COLOR }}
              axisLine={false}
              tickLine={false}
              width={34}
              domain={[0, 100]}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar
              yAxisId="left"
              dataKey="value"
              fill="#3B82F6"
              radius={[3, 3, 0, 0]}
              maxBarSize={26}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cumulativePct"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={{ r: 3, fill: '#F59E0B', strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
