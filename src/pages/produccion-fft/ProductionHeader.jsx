import dayjs from 'dayjs'
import { LayoutDashboard } from 'lucide-react'
import { cardClass, pageSubtitleClass, pageTitleClass } from '@/lib/pageStyles'
import { cn } from '@/lib/utils'

/* Header del modulo "Producción FFT" (2026-09-02, rediseño visual sobre mockup adjunto -- ver
   ProduccionFftPage.jsx para la nota completa). "En vivo" y "Última actualización" salen del
   `updatedAt` real que el backend devuelve en cada respuesta de /api/production/fft-summary --
   nunca un timestamp hardcodeado ni una animacion de "live" sin dato real detras. */
export default function ProductionHeader({ t, updatedAt }) {
  return (
    <div className={cn(cardClass, 'mb-4')}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-black/[.015] px-5 py-3.5 dark:bg-white/[.02]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#3B82F6]/10 text-[#3B82F6]">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className={pageTitleClass}>{t('pageTitle')}</p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#047857] dark:border-[rgba(16,185,129,.25)] dark:bg-[rgba(16,185,129,.1)] dark:text-[#6EE7B7]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                {t('liveLabel')}
              </span>
            </div>
            <p className={pageSubtitleClass}>{t('pageSubtitle')}</p>
          </div>
        </div>
        {updatedAt && (
          <p className="shrink-0 text-[11.5px] text-muted-foreground">
            {t('lastUpdatedLabel')}{' '}
            <span className="font-semibold text-foreground">{dayjs(updatedAt).format('DD/MM/YYYY HH:mm')}</span>
          </p>
        )}
      </div>
    </div>
  )
}
