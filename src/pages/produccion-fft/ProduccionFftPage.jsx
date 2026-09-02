import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Alert } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  alertToneClass,
  cardClass,
  cardHeaderClass,
  cardHeaderSubtitleClass,
  cardHeaderTitleClass,
  cellTextClass,
  cellTextSecondaryClass,
  kpiCardClass,
  metricChipClass,
  pageClass,
  pageSubtitleClass,
  pageTitleClass,
  tableHeaderRowClass,
  tableRowClass,
} from '@/lib/pageStyles'
import { cn } from '@/lib/utils'
import ChartCard from '../dashboard/ChartCard'
import { EmptyState } from '../../ui'

/* Modulo "Producción FFT" (2026-09-02, segunda parte del pedido de Takt Time real -- ver
   api/production/fft-summary.js para la nota completa sobre por que los totales de aqui no son
   identicos a los del dashboard externo de BinManager). SOLO LECTURA. */

const MATCH_TONE = {
  OK: 'ok',
  AMBIGUO: 'warn',
  REVISAR: 'warn',
  SIN_MATCH: 'bad',
  USERNAME_DESCONOCIDO: 'bad',
}

const GRID_COLOR = 'hsl(var(--foreground) / 0.06)'
const AXIS_COLOR = 'hsl(var(--muted-foreground))'
const CURSOR_FILL = 'hsl(var(--foreground) / 0.04)'

function ClassificationTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[15px] border border-border bg-popover px-3 py-2 shadow-md text-popover-foreground">
      <div className="mb-0.5 text-[12.5px] font-bold">{label}</div>
      <div className="text-xs text-muted-foreground">{payload[0].value} pzs</div>
    </div>
  )
}

export default function ProduccionFftPage() {
  const { t } = useTranslation('produccionFft')
  const [data, setData] = useState(null) // null = cargando
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/production/fft-summary', { credentials: 'include' })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error((json && json.error) || t('loadErrorGeneric'))
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setError(e.message || t('loadErrorGeneric'))
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [t])

  const throughputData = useMemo(() => {
    if (!data?.dailyThroughput) return []
    const today = dayjs().format('YYYY-MM-DD')
    return data.dailyThroughput.map((row) => ({
      ...row,
      label: row.date === today ? t('todayLabel') : dayjs(row.date).format('DD/MM'),
    }))
  }, [data, t])

  const classificationData = useMemo(() => {
    if (!data?.classifications) return []
    return data.classifications.map((c) => ({ ...c, label: c.name || c.code }))
  }, [data])

  return (
    <div className={pageClass}>
      <div className={cn(cardClass, 'mb-4')}>
        <div className="border-b border-border bg-black/[.015] px-5 py-3.5 dark:bg-white/[.02]">
          <p className={pageTitleClass}>{t('pageTitle')}</p>
          <p className={pageSubtitleClass}>{t('pageSubtitle')}</p>
        </div>
      </div>

      {error && <Alert className={cn(alertToneClass('error'), 'mb-4')}>{error}</Alert>}

      {data?.configured === false && (
        <Alert className={cn(alertToneClass('warning'), 'mb-4')}>{t('notConfiguredMessage')}</Alert>
      )}

      {data === null && !error && (
        <p className="px-1 py-10 text-center text-sm text-muted-foreground">{t('loadingMessage')}</p>
      )}

      {data && data.configured !== false && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={kpiCardClass('blue')}>
              <p className="text-[10px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
                {t('totalTodayLabel')}
              </p>
              <p className="mt-0.5 text-2xl font-extrabold">{data.totalToday}</p>
              <p className="text-[11px] text-muted-foreground">{t('piecesUnitLabel')}</p>
            </div>
            <div className={kpiCardClass('green')}>
              <p className="text-[10px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
                {t('activePeopleLabel')}
              </p>
              <p className="mt-0.5 text-2xl font-extrabold">{data.people.length}</p>
              <p className="text-[11px] text-muted-foreground">{t('activePeopleUnitLabel')}</p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard
              title={t('classificationChartTitle')}
              subtitle={t('classificationChartSubtitle')}
              empty={classificationData.length === 0}
              emptyMessage={t('emptyDataMessage')}
            >
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={classificationData}
                    margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
                    barCategoryGap="25%"
                  >
                    <CartesianGrid vertical={false} stroke={GRID_COLOR} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: AXIS_COLOR }}
                      axisLine={{ stroke: GRID_COLOR }}
                      tickLine={false}
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: AXIS_COLOR }}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                      allowDecimals={false}
                    />
                    <Tooltip content={<ClassificationTooltip />} cursor={{ fill: CURSOR_FILL }} />
                    <Bar dataKey="qty" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard
              title={t('throughputChartTitle')}
              subtitle={t('throughputChartSubtitle')}
              empty={throughputData.length === 0}
              emptyMessage={t('emptyDataMessage')}
            >
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={throughputData}
                    margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
                    barCategoryGap="30%"
                  >
                    <CartesianGrid vertical={false} stroke={GRID_COLOR} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: AXIS_COLOR }}
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
                    <Tooltip content={<ClassificationTooltip />} cursor={{ fill: CURSOR_FILL }} />
                    <Bar dataKey="qty" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          <div className={cardClass}>
            <div className={cardHeaderClass}>
              <div className="min-w-0 flex-1">
                <p className={cardHeaderTitleClass}>{t('peopleTableTitle')}</p>
                <p className={cardHeaderSubtitleClass}>{t('peopleTableSubtitle')}</p>
              </div>
            </div>

            {data.people.length === 0 ? (
              <EmptyState title={t('emptyPeopleTitle')} description={t('emptyPeopleDescription')} />
            ) : (
              <div className="max-h-[60vh] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow className={tableHeaderRowClass}>
                      <TableHead>{t('colPerson')}</TableHead>
                      <TableHead>{t('colEmployeeNumber')}</TableHead>
                      <TableHead className="text-right">{t('colQty')}</TableHead>
                      <TableHead>{t('colStatus')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.people.map((p, idx) => (
                      <TableRow key={p.username} className={tableRowClass(idx)}>
                        <TableCell className={cn(cellTextClass, 'font-bold')}>
                          {p.fullName || p.resolvedName || p.username}
                        </TableCell>
                        <TableCell className={cellTextSecondaryClass}>
                          {p.employeeNumber || '—'}
                        </TableCell>
                        <TableCell className="text-right font-bold">{p.qty}</TableCell>
                        <TableCell>
                          <span className={metricChipClass(MATCH_TONE[p.matchStatus] || 'default')}>
                            {t(`matchStatus.${p.matchStatus}`, p.matchStatus)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
