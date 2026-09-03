import dayjs from 'dayjs'
import { Boxes, Package, RefreshCw, Tag as TagIcon, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { alertToneClass, pageClass } from '@/lib/pageStyles'
import { cn } from '@/lib/utils'
import ClassificationMatrix from './ClassificationMatrix'
import DonutBreakdownCard from './DonutBreakdownCard'
import PalletProgressCard from './PalletProgressCard'
import ProductionFilters from './ProductionFilters'
import ProductionHeader from './ProductionHeader'
import ProductionKpiCard from './ProductionKpiCard'
import SkuTrackerDialog from './SkuTrackerDialog'
import TagBreakdownCard from './TagBreakdownCard'
import TopInspectorsCard from './TopInspectorsCard'
import WeeklyComparisonCard from './WeeklyComparisonCard'

/* Modulo "Producción FFT" (rediseño 2026-09-02, a peticion explicita del usuario, sobre un mockup
   visual de referencia: "DATOS Y FUNCIONALIDAD = implementacion real, DISEÑO Y COMPOSICION =
   mockup adjunto"). SOLO LECTURA. Espejo dentro de esta app de la pagina externa FFT Dashboard
   Production de BinManager -- ver api/production/fft-summary.js para la historia completa de cada
   tarjeta y el pendiente sin resolver documentado (el total de "Piezas procesadas" no cierra
   exacto contra la pagina real, investigado 3 veces, requiere permiso EXECUTE que esta cuenta de
   solo lectura no tiene).
   Arquitectura: esta pagina orquesta el estado de filtros + un solo fetch a /api/production/
   fft-summary; cada tarjeta vive en su propio componente (ProductionHeader/ProductionFilters/
   ProductionKpiCard/DonutBreakdownCard/TopInspectorsCard/PalletProgressCard/TagBreakdownCard/
   ClassificationMatrix/WeeklyComparisonCard/SkuTrackerDialog) para que sean mantenibles por
   separado, sin refactorizar nada fuera de este modulo. */

function todayIso() {
  return dayjs().format('YYYY-MM-DD')
}

const DEFAULT_FILTERS = { workCenterId: 49, dateFrom: todayIso(), dateTo: todayIso(), classificationCode: '', size: '' }

export default function ProduccionFftPage() {
  const { t } = useTranslation('produccionFft')
  const [data, setData] = useState(null) // null = cargando
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS)
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS)
  const [skuTrackerOpen, setSkuTrackerOpen] = useState(false)
  const [skuTrackerSearch, setSkuTrackerSearch] = useState('')

  async function fetchData(filters) {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('workCenterId', filters.workCenterId)
      params.set('dateFrom', filters.dateFrom)
      params.set('dateTo', filters.dateTo)
      if (filters.classificationCode) params.set('classificationCode', filters.classificationCode)
      if (filters.size) params.set('size', filters.size)
      const res = await fetch(`/api/production/fft-summary?${params.toString()}`, { credentials: 'include' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || t('loadErrorGeneric'))
      setData(json)
      // json.error (2026-09-02): la respuesta puede venir 200 con datos vacios cuando SmartControl
      // no respondio (best-effort, ver api/production/fft-summary.js) -- eso NO es un fetch fallido,
      // pero igual debe mostrarse como error real dentro del modulo (a peticion explicita del
      // usuario: "Si falla BinManager/SmartControl: mostrar error claro... No tumbar toda la app").
      setError(json?.error ? t('fetchErrorBanner') : '')
    } catch (e) {
      setError(e.message || t('loadErrorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: solo debe correr una vez al montar, fetchData ya recibe los filtros por parametro
  useEffect(() => {
    fetchData(DEFAULT_FILTERS)
  }, [])

  function handleApply() {
    setAppliedFilters(draftFilters)
    fetchData(draftFilters)
  }

  function handleClear() {
    setDraftFilters(DEFAULT_FILTERS)
    setAppliedFilters(DEFAULT_FILTERS)
    fetchData(DEFAULT_FILTERS)
  }

  function handleTagClick(tagName) {
    setSkuTrackerSearch(tagName)
    setSkuTrackerOpen(true)
  }

  function handleBreakdownClick(name) {
    setSkuTrackerSearch(name)
    setSkuTrackerOpen(true)
  }

  const throughputData = useMemo(() => {
    if (!data?.dailyThroughput) return []
    const today = todayIso()
    return data.dailyThroughput.map((row) => ({
      value: row.qty,
      date: row.date,
      label: row.date === today ? t('todayLabel') : dayjs(row.date).format('DD/MM'),
    }))
  }, [data, t])

  if (data === null && !error) {
    return (
      <div className={pageClass}>
        <p className="px-1 py-16 text-center text-sm text-muted-foreground">{t('loadingMessage')}</p>
      </div>
    )
  }

  return (
    <div className={pageClass}>
      <ProductionHeader t={t} updatedAt={data?.updatedAt} />

      {data?.filters && (
        <ProductionFilters
          t={t}
          workCenters={data.filters.workCenters}
          classificationOptions={data.filters.classifications}
          sizeOptions={data.filters.sizes}
          draft={draftFilters}
          onDraftChange={setDraftFilters}
          onApply={handleApply}
          onClear={handleClear}
          loading={loading}
        />
      )}

      {error && (
        <Alert className={cn(alertToneClass('error'), 'mb-4 flex items-center justify-between gap-3')}>
          <span>{error}</span>
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 font-bold normal-case"
            onClick={() => fetchData(appliedFilters)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t('retryLabel')}
          </Button>
        </Alert>
      )}

      {data?.configured === false && (
        <Alert className={cn(alertToneClass('warning'), 'mb-4')}>{t('notConfiguredMessage')}</Alert>
      )}

      {data && data.configured !== false && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ProductionKpiCard
              title={t('totalTodayLabel')}
              value={data.totalToday}
              subtitle={t('piecesUnitLabel')}
              icon={Package}
              accent="blue"
              comparison={data.totalComparison}
              comparisonLabel={t('noComparisonLabel')}
              sparklineData={throughputData}
            />
            <ProductionKpiCard
              title={t('activePeopleLabel')}
              value={data.people.length}
              subtitle={t('activePeopleUnitLabel')}
              icon={Users}
              accent="green"
              comparison={data.peopleComparison}
              comparisonLabel={t('noComparisonLabel')}
            />
            <ProductionKpiCard
              title={t('palletsCompletedKpiTitle')}
              value={`${data.pallets.closedCount} / ${data.pallets.totalCount}`}
              subtitle={t('palletsCompletedLabel')}
              icon={Boxes}
              accent="amber"
              rightSlot={
                <span className="shrink-0 text-[15px] font-extrabold text-[#F59E0B]">
                  {data.pallets.totalCount > 0
                    ? `${((data.pallets.closedCount / data.pallets.totalCount) * 100).toFixed(1)}%`
                    : '—'}
                </span>
              }
              progress={{
                pct: data.pallets.totalCount > 0 ? (data.pallets.closedCount / data.pallets.totalCount) * 100 : 0,
              }}
            />
            <ProductionKpiCard
              title={t('tagTypesKpiTitle')}
              value={data.tags.length}
              subtitle={t('tagsUsedUnitLabel')}
              icon={TagIcon}
              accent="purple"
              comparison={data.tagsComparison}
              comparisonLabel={t('noComparisonLabel')}
            />
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <DonutBreakdownCard
              title={t('suppliersCardTitle')}
              items={data.suppliers.map((s) => ({ name: s.supplierName, qty: s.qty }))}
              nullLabel={t('unknownLabel')}
              emptyMessage={t('emptyDataMessage')}
              onItemClick={handleBreakdownClick}
            />
            <DonutBreakdownCard
              title={t('categoriesCardTitle')}
              items={data.categories.map((c) => ({ name: c.categoryName, qty: c.qty }))}
              nullLabel={t('unknownLabel')}
              emptyMessage={t('emptyDataMessage')}
              onItemClick={handleBreakdownClick}
            />
            <TopInspectorsCard t={t} people={data.people} emptyMessage={t('emptyDataMessage')} />
            <PalletProgressCard t={t} pallets={data.pallets} emptyMessage={t('emptyDataMessage')} />
            <TagBreakdownCard t={t} tags={data.tags} onTagClick={handleTagClick} emptyMessage={t('emptyDataMessage')} />
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[65fr_35fr]">
            <ClassificationMatrix t={t} sizeByClassification={data.sizeByClassification} emptyMessage={t('emptyDataMessage')} />
            <WeeklyComparisonCard t={t} weeklyComparison={data.weeklyComparison} emptyMessage={t('emptyDataMessage')} />
          </div>
        </>
      )}

      <SkuTrackerDialog
        open={skuTrackerOpen}
        onOpenChange={setSkuTrackerOpen}
        search={skuTrackerSearch}
        onSearchChange={setSkuTrackerSearch}
        queryFilters={appliedFilters}
        t={t}
      />
    </div>
  )
}
