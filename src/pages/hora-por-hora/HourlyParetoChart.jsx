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
import { computeParetoData } from '../../data/horaPorHora/dynamicLossMetrics.js'
import ChartCard from '../dashboard/ChartCard'

const GRID_COLOR = 'hsl(var(--foreground) / 0.06)'
const AXIS_COLOR = 'hsl(var(--muted-foreground))'

/* Perdidas por causa (2026-09-04 v2 -- catalogo de causas por area, ver
   src/data/horaPorHora/dynamicLossMetrics.js): una sola unidad por TURNO (session.lossUnit),
   nunca un selector -- ya no se puede "mezclar minutos con piezas" porque no hay nada que
   mezclar. Barras + linea de % acumulado, mismo patron combo-chart ya establecido
   (MissingVsIdealComboCard). */
function ChartTooltip({ active, payload, label, unitLabel }) {
  const { t } = useTranslation('horaPorHora')
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-[15px] border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <div className="mb-0.5 text-[12.5px] font-bold">{label}</div>
      <div className="text-xs text-muted-foreground">
        {t('paretoValueLabel')}: {row.value} {unitLabel} ({row.pct.toFixed(1)}%)
      </div>
      <div className="text-xs text-muted-foreground">
        {t('paretoCumulativeLabel')}: {row.cumulativePct.toFixed(1)}%
      </div>
    </div>
  )
}

export default function HourlyParetoChart({ entries, lossUnit, causes }) {
  const { t } = useTranslation('horaPorHora')
  const rawData = computeParetoData(entries, causes)
  const data = rawData.map((c) => ({ ...c, cause: c.name }))
  const unitLabel = lossUnit === 'MINUTES' ? t('unitMinutesShort') : t('unitPiecesShort')

  return (
    <ChartCard
      title={t('paretoTitle')}
      subtitle={t('paretoSubtitleUnit', {
        unit: lossUnit === 'MINUTES' ? t('unitMinutes') : t('unitPieces'),
      })}
      height={200}
      empty={data.length === 0}
      emptyMessage={t('paretoEmpty')}
    >
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
            <Tooltip content={<ChartTooltip unitLabel={unitLabel} />} />
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
