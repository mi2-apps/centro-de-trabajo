import { ClipboardCheck, Cog, Gauge, Hourglass } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  cardClass,
  cardHeaderClass,
  cardHeaderSubtitleClass,
  cardHeaderTitleClass,
} from '@/lib/pageStyles'
import { useFftIndicators } from '../../data/dashboard/useFftIndicators'
import { FFT_INDICATORS } from '../../data/production/catalog'

const ICONS = {
  EFICIENCIA: Gauge,
  DEMORAS: Hourglass,
  PRODUCCION: Cog,
  CUMPLIMIENTO_PROGRAMAS: ClipboardCheck,
}

/* "Indicadores FFT" (2026-08-26, a peticion explicita del usuario; conectado a datos reales el
   2026-09-10 -- ver useFftIndicators.js para el detalle exacto de cada calculo). Orden oficial
   1-4 desde FFT_INDICATORS (catalog.js, UNICA fuente de label/orden, nunca reordenar) -- el
   `value`/`hasSource` de EFICIENCIA/DEMORAS/PRODUCCION ya NO sale de catalog.js (no pueden ser
   un numero fijo, cambian todo el dia) sino de useFftIndicators() aqui mismo. CUMPLIMIENTO_
   PROGRAMAS se queda con el `hasSource:false` de catalog.js a proposito: ni el usuario tenia
   claro que debia representar al revisarlo, asi que no se inventa un calculo para el. */
function IndicatorRow({ indicator, t }) {
  const Icon = ICONS[indicator.id] || Gauge
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-bold">
          {indicator.order}. {indicator.label}
        </p>
        {indicator.hasSource ? (
          <p className="text-[15px] font-extrabold">{indicator.value}</p>
        ) : (
          <p className="text-[11.5px] italic text-muted-foreground">
            {indicator.value || t('fftIndicatorsCard.noSourceMessage')}
          </p>
        )}
      </div>
    </div>
  )
}

export default function FftIndicatorsCard() {
  const { t } = useTranslation('dashboard')
  const { loading, demorasMinutes, productionExpected, productionActual } = useFftIndicators()

  const hasProductionCapture = productionExpected > 0
  const indicators = FFT_INDICATORS.map((i) => {
    if (loading) {
      return { ...i, hasSource: false, value: t('fftIndicatorsCard.loadingValue') }
    }
    if (i.id === 'DEMORAS' && demorasMinutes != null) {
      return {
        ...i,
        hasSource: true,
        value: t('fftIndicatorsCard.demorasValue', { minutes: demorasMinutes }),
      }
    }
    if (i.id === 'PRODUCCION' && productionExpected != null) {
      return {
        ...i,
        hasSource: hasProductionCapture,
        value: hasProductionCapture
          ? t('fftIndicatorsCard.productionValue', {
              actual: productionActual.toLocaleString('es-MX'),
              expected: productionExpected.toLocaleString('es-MX'),
            })
          : t('fftIndicatorsCard.noCaptureToday'),
      }
    }
    if (i.id === 'EFICIENCIA' && productionExpected != null) {
      const pct = hasProductionCapture
        ? Math.round((productionActual / productionExpected) * 100)
        : null
      return {
        ...i,
        hasSource: hasProductionCapture,
        value: hasProductionCapture
          ? t('fftIndicatorsCard.efficiencyValue', { pct })
          : t('fftIndicatorsCard.noCaptureToday'),
      }
    }
    return i
  })

  return (
    <div className={`${cardClass} h-full`}>
      <div className={cardHeaderClass}>
        <div className="min-w-0">
          <p className={cardHeaderTitleClass}>{t('fftIndicatorsCard.title')}</p>
          <p className={cardHeaderSubtitleClass}>{t('fftIndicatorsCard.subtitle')}</p>
        </div>
      </div>
      <div className="p-4 pt-1">
        <div className="divide-y divide-border">
          {indicators.map((i) => (
            <IndicatorRow key={i.id} indicator={i} t={t} />
          ))}
        </div>
      </div>
    </div>
  )
}
