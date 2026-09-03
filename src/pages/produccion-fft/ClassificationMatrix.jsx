import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cardClass, cardHeaderClass, cardHeaderTitleClass, cellTextClass } from '@/lib/pageStyles'
import { cn } from '@/lib/utils'
import { EmptyState } from '../../ui'

/* "RESUMEN: UNIDADES POR TAMAÑO Y CLASIFICACIÓN" (2026-09-02, mockup adjunto). MUY IMPORTANTE
   -- a peticion explicita del usuario, NO se elimino ningun dato de la version anterior, solo se
   rediseño visualmente: primera columna (Clasificación) y ultima columna (Total General) fijas
   con `sticky`, fila de totales al final, header fijo (`sticky top-0`), scroll interno horizontal
   Y vertical (nunca scroll global de la pagina). El catalogo de tamaños/clasificaciones sigue
   siendo 100% real (viene de sizeByClassification.sizes/rows, nunca hardcodeado aqui). */
export default function ClassificationMatrix({ t, sizeByClassification, emptyMessage }) {
  const { sizes, rows } = sizeByClassification
  const columnTotals = sizes.reduce((acc, size) => {
    acc[size] = rows.reduce((s, r) => s + (r.bySize[size] || 0), 0)
    return acc
  }, {})
  const grandTotal = rows.reduce((s, r) => s + r.total, 0)

  return (
    <div className={cardClass}>
      <div className={cardHeaderClass}>
        <div className="min-w-0 flex-1">
          <p className={cardHeaderTitleClass}>{t('sizeTableTitle')}</p>
          <p className="text-[11.5px] text-muted-foreground">{t('sizeTableSubtitle')}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState compact title={emptyMessage} />
        </div>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <Table className="border-separate border-spacing-0">
            <TableHeader className="sticky top-0 z-20 bg-card">
              <TableRow>
                <TableHead className="sticky left-0 z-30 bg-card text-[11px] font-bold uppercase">
                  {t('colClassification')}
                </TableHead>
                {sizes.map((size) => (
                  <TableHead key={size} className="text-right text-[11px] font-bold">
                    {size}
                  </TableHead>
                ))}
                <TableHead className="sticky right-0 z-30 bg-[#3B82F6] text-right text-[11px] font-extrabold uppercase text-white">
                  {t('colTotal')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.code}>
                  <TableCell className={cn(cellTextClass, 'sticky left-0 z-10 bg-card font-bold')}>
                    {row.code}
                  </TableCell>
                  {sizes.map((size) => (
                    <TableCell key={size} className="text-right text-[12.5px]">
                      {row.bySize[size] || '-'}
                    </TableCell>
                  ))}
                  <TableCell className="sticky right-0 z-10 bg-[#3B82F6]/10 text-right font-extrabold text-[#3B82F6]">
                    {row.total}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 border-border">
                <TableCell className="sticky left-0 z-10 bg-muted/60 font-extrabold uppercase">
                  {t('totalGeneralLabel')}
                </TableCell>
                {sizes.map((size) => (
                  <TableCell key={size} className="bg-muted/60 text-right font-extrabold">
                    {columnTotals[size] || '-'}
                  </TableCell>
                ))}
                <TableCell className="sticky right-0 z-10 bg-[#3B82F6] text-right font-extrabold text-white">
                  {grandTotal}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
