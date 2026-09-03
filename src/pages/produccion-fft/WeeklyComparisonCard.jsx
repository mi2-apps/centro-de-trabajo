import { cardClass, cardHeaderClass, cardHeaderTitleClass } from '@/lib/pageStyles'
import { EmptyState } from '../../ui'

/* "COMPARATIVA SEMANAL" del rediseño de "Producción FFT" (2026-09-02, mockup adjunto) -- barras
   horizontales por dia (semana actual vs semana anterior), calculado en el backend a partir de
   getDailyThroughput (14 dias reales), nunca un stored procedure propio. La variacion total
   (arriba a la derecha) es verde si la semana actual crecio vs la anterior, roja si bajo --
   "mejora"/"empeora" aqui es un conteo de piezas mas alto, no una interpretacion de negocio mas
   compleja que no se pueda respaldar con el dato disponible. */
export default function WeeklyComparisonCard({ t, weeklyComparison, emptyMessage }) {
  const { currentWeekTotal, previousWeekTotal, days } = weeklyComparison
  const totalPct =
    previousWeekTotal > 0 ? ((currentWeekTotal - previousWeekTotal) / previousWeekTotal) * 100 : null
  const maxQty = Math.max(1, ...days.flatMap((d) => [d.currentQty, d.previousQty]))

  return (
    <div className={cardClass}>
      <div className={`${cardHeaderClass} items-start justify-between`}>
        <div className="min-w-0 flex-1">
          <p className={cardHeaderTitleClass}>{t('weeklyChartTitle')}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#3B82F6]" />
              {t('weeklyCurrentSeries')} ({currentWeekTotal})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#CBD5E1]" />
              {t('weeklyPreviousSeries')} ({previousWeekTotal})
            </span>
          </div>
        </div>
        {typeof totalPct === 'number' && (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-extrabold"
            style={{
              color: totalPct >= 0 ? '#047857' : '#B91C1C',
              backgroundColor: totalPct >= 0 ? '#ECFDF5' : '#FEF2F2',
            }}
          >
            {totalPct >= 0 ? '+' : ''}
            {totalPct.toFixed(1)}%
          </span>
        )}
      </div>
      {days.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState compact title={emptyMessage} />
        </div>
      ) : (
        <div className="space-y-3.5 px-5 py-4">
          {days.map((d) => (
            <div key={d.label}>
              <div className="mb-1 flex items-center justify-between text-[12px] font-semibold">
                <span>{t(`weekday${d.label}`)}</span>
                {typeof d.pctChange === 'number' && (
                  <span style={{ color: d.pctChange >= 0 ? '#047857' : '#B91C1C' }}>
                    {d.pctChange >= 0 ? '+' : ''}
                    {d.pctChange.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/[.05] dark:bg-white/[.06]">
                    <div
                      className="h-full rounded-full bg-[#3B82F6]"
                      style={{ width: `${Math.max((d.currentQty / maxQty) * 100, d.currentQty > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-[11.5px] font-bold">{d.currentQty}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/[.05] dark:bg-white/[.06]">
                    <div
                      className="h-full rounded-full bg-[#CBD5E1]"
                      style={{ width: `${Math.max((d.previousQty / maxQty) * 100, d.previousQty > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-[11.5px] text-muted-foreground">
                    {d.previousQty}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
