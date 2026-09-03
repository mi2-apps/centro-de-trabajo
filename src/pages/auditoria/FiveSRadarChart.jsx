import { useTranslation } from 'react-i18next'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { FIVE_S_CATEGORIES, FIVE_S_META } from '../../data/audits5s/criteria'

/* "Radar 5S" REAL (2026-09-03, a peticion explicita del usuario -- "el radar debe ser real, NO
   una imagen, NO Canvas estatico con puntos quemados"): recharts ya instalado en el proyecto
   (2.15.4, mismo patron ya usado en dashboard/charts/), nunca se agrega una libreria nueva. Los 5
   ejes son SIEMPRE 1S..5S en ese orden fijo (nunca reordenados por valor, a diferencia de un
   radar generico) -- domain [0,20] fijo (nunca autoescala), anillos de referencia en 0/5/10/15/20
   tal como pide el usuario, replicando el "Metrico de Radar 5 S" de la presentacion original pero
   con el lenguaje visual del Centro de Control. */
function ChartTooltip({ active, payload }) {
  const { t } = useTranslation('auditoria')
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-[15px] border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <div className="mb-0.5 text-[12.5px] font-bold">{row.subject}</div>
      <div className="text-xs text-muted-foreground">
        {t('radarTooltipScore', { score: row.value })}
      </div>
    </div>
  )
}

export default function FiveSRadarChart({ scores, height = 320 }) {
  const { t } = useTranslation('auditoria')
  const data = FIVE_S_CATEGORIES.map((cat) => ({
    category: cat,
    subject: t(FIVE_S_META[cat].titleKey),
    value: scores[cat] ?? 0,
    color: FIVE_S_META[cat].color,
  }))

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="hsl(var(--foreground) / 0.12)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 11, fontWeight: 700, fill: 'hsl(var(--foreground))' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 20]}
            tickCount={5}
            tick={{ fontSize: 9.5, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
          />
          <Radar
            dataKey="value"
            stroke="#3B82F6"
            fill="#3B82F6"
            fillOpacity={0.28}
            strokeWidth={2}
            dot={{ r: 3.5, fill: '#3B82F6' }}
          />
          <Tooltip content={<ChartTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
