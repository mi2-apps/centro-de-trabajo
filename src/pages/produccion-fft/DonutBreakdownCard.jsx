import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { cardClass, cardHeaderClass, cardHeaderTitleClass } from '@/lib/pageStyles'
import { EmptyState } from '../../ui'

const DONUT_COLORS = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#A855F7', '#06B6D4', '#64748B']

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-[15px] border border-border bg-popover px-3 py-2 shadow-md text-popover-foreground">
      <div className="text-[12.5px] font-bold">{row.name}</div>
      <div className="text-xs text-muted-foreground">{row.qty} pzs</div>
    </div>
  )
}

/* Donut de Proveedor/Categoria del rediseño de "Producción FFT" (2026-09-02, mockup adjunto) --
   mismo patron ya establecido en Dashboard (src/pages/dashboard/charts/AreaStatusDonutCard.jsx),
   reutilizado aqui en vez de inventar un segundo componente de donut distinto. `onItemClick`
   (opcional) abre el Rastreador de SKUs filtrado por ese proveedor/categoria -- mismo puente ya
   construido para Tags. */
export default function DonutBreakdownCard({ title, items, nullLabel, emptyMessage, onItemClick }) {
  const data = items.map((i) => ({ name: i.name || nullLabel, qty: i.qty }))
  const total = data.reduce((s, d) => s + d.qty, 0)

  return (
    <div className={cardClass}>
      <div className={cardHeaderClass}>
        <div className="min-w-0 flex-1">
          <p className={cardHeaderTitleClass}>{title}</p>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState compact title={emptyMessage} />
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="relative mx-auto h-[130px] w-[130px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="qty" nameKey="name" innerRadius="66%" outerRadius="95%" paddingAngle={1.5} stroke="none">
                  {data.map((row, idx) => (
                    <Cell key={row.name} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <p className="text-2xl font-extrabold leading-none">{total}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {data.map((row, idx) => (
              <button
                type="button"
                key={row.name}
                onClick={() => onItemClick?.(row.name)}
                disabled={!onItemClick}
                className={
                  onItemClick
                    ? 'flex w-full items-center justify-between gap-2 rounded-md p-1 text-left transition-colors hover:bg-black/[.03] dark:hover:bg-white/[.05]'
                    : 'flex w-full items-center justify-between gap-2 p-1 text-left'
                }
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}
                  />
                  <span className="truncate text-[12.5px] font-semibold">{row.name}</span>
                </span>
                <span className="shrink-0 text-[12.5px] font-bold">
                  {row.qty} <span className="text-muted-foreground">({total > 0 ? ((row.qty / total) * 100).toFixed(1) : 0}%)</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
