import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  alertToneClass,
  cellTextClass,
  cellTextSecondaryClass,
  metricChipClass,
  tableHeaderRowClass,
  tableRowClass,
} from '@/lib/pageStyles'
import { EmptyState } from '../../ui'

/* Rastreador de SKUs (2026-09-02, a peticion explicita del usuario: "un rastreador de skus... ver
   en que pallet id se fue, si se fue en alguna orden... ver si hay duplicados"). Se carga BAJO
   DEMANDA (solo al abrir el dialogo) -- ver api/production/sku-tracker.js, ~1,400 filas reales,
   mas pesado que el resto del modulo. Respeta los MISMOS filtros globales del modulo (rango de
   fechas/clasificacion/pulgadas/work center, `queryFilters`) -- a peticion explicita del
   rediseño, en vez de siempre mostrar "hoy" sin importar el filtro elegido arriba. */
export default function SkuTrackerDialog({ open, onOpenChange, search, onSearchChange, queryFilters, t }) {
  const [rows, setRows] = useState(null) // null = no cargado todavia
  const [error, setError] = useState('')

  // biome-ignore lint/correctness/useExhaustiveDependencies: solo debe recargar cuando se abre el dialogo, no en cada cambio de queryFilters/t/search/onSearchChange
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setRows(null)
    setError('')
    async function load() {
      try {
        const params = new URLSearchParams()
        if (queryFilters.workCenterId) params.set('workCenterId', queryFilters.workCenterId)
        if (queryFilters.dateFrom) params.set('dateFrom', queryFilters.dateFrom)
        if (queryFilters.dateTo) params.set('dateTo', queryFilters.dateTo)
        if (queryFilters.classificationCode) params.set('classificationCode', queryFilters.classificationCode)
        if (queryFilters.size) params.set('size', queryFilters.size)
        const res = await fetch(`/api/production/sku-tracker?${params.toString()}`, { credentials: 'include' })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.error || t('loadErrorGeneric'))
        if (!cancelled) setRows(json.rows || [])
      } catch (e) {
        if (!cancelled) setError(e.message || t('loadErrorGeneric'))
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open])

  const filtered = useMemo(() => {
    if (!rows) return []
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [r.lpn, r.sku, r.serialNumber, r.brand, r.model, r.tags, r.orderNumber, r.supplierName, r.categoryName]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q)),
    )
  }, [rows, search])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-[95vw] flex-col p-6 lg:max-w-[1200px]">
        <DialogTitle className="font-extrabold">{t('skuTrackerTitle')}</DialogTitle>
        <p className="text-[12.5px] text-muted-foreground">{t('skuTrackerSubtitle')}</p>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('skuTrackerSearchPlaceholder')}
            className="pl-9"
          />
        </div>

        {error && <Alert className={alertToneClass('error')}>{error}</Alert>}

        {rows === null && !error && (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('loadingMessage')}</p>
        )}

        {rows !== null && (
          <>
            <p className="text-[11px] text-muted-foreground">
              {t('skuTrackerCountLabel', { shown: filtered.length, total: rows.length })}
            </p>
            {filtered.length === 0 ? (
              <EmptyState compact title={t('emptyDataMessage')} />
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow className={tableHeaderRowClass}>
                      <TableHead>{t('colLpn')}</TableHead>
                      <TableHead>{t('colSku')}</TableHead>
                      <TableHead>{t('colBrandModel')}</TableHead>
                      <TableHead>{t('colClassification')}</TableHead>
                      <TableHead>{t('colSupplier')}</TableHead>
                      <TableHead>{t('colCategory')}</TableHead>
                      <TableHead>{t('colPallet')}</TableHead>
                      <TableHead>{t('colTags')}</TableHead>
                      <TableHead>{t('colOrder')}</TableHead>
                      <TableHead>{t('colDuplicate')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r, idx) => (
                      <TableRow key={r.lpn} className={tableRowClass(idx)}>
                        <TableCell className={`${cellTextClass} font-bold`}>{r.lpn}</TableCell>
                        <TableCell className={cellTextSecondaryClass}>{r.sku}</TableCell>
                        <TableCell className={cellTextSecondaryClass}>
                          {[r.brand, r.model].filter(Boolean).join(' ') || '—'}
                          {r.size ? ` (${r.size}")` : ''}
                        </TableCell>
                        <TableCell className={cellTextSecondaryClass}>
                          {r.classificationName || r.classificationCode}
                        </TableCell>
                        <TableCell className={cellTextSecondaryClass}>{r.supplierName || '—'}</TableCell>
                        <TableCell className={cellTextSecondaryClass}>{r.categoryName || '—'}</TableCell>
                        <TableCell className={cellTextSecondaryClass}>{r.palletNumber ?? '—'}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-[12px] text-muted-foreground">
                          {r.tags || '—'}
                        </TableCell>
                        <TableCell className={cellTextSecondaryClass}>
                          {r.orderNumber || t('noOrderLabel')}
                        </TableCell>
                        <TableCell>
                          {r.isDuplicateSerial ? (
                            <span className={metricChipClass('warn')}>{t('duplicateLabel')}</span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
