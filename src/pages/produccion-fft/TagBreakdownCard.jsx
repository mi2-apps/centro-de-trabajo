import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cardClass, cardHeaderClass, cardHeaderTitleClass, progressBarClass } from '@/lib/pageStyles'
import { cn } from '@/lib/utils'
import { EmptyState } from '../../ui'

const TAG_PREVIEW_COUNT = 7

/* Fila de tag clickeable -- abre el Rastreador de SKUs YA FILTRADO por ese tag (2026-09-02, a
   peticion explicita del usuario: "localizar las piezas skus de cada pieza de tag"). stopPropagation
   evita que un click en una fila dentro del dialogo "ver todos los tags" tambien dispare el click
   del boton contenedor. */
function TagRow({ tag, qty, maxQty, total, onTagClick }) {
  const pct = maxQty > 0 ? (qty / maxQty) * 100 : 0
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onTagClick(tag)
      }}
      className="block w-full space-y-1 rounded-md p-1 text-left transition-colors hover:bg-[#A855F7]/[.08]"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] font-semibold">{tag}</span>
        <span className="shrink-0 text-[12px] text-muted-foreground">
          <span className="font-extrabold text-foreground">{qty}</span>{' '}
          {total > 0 ? `(${((qty / total) * 100).toFixed(1)}%)` : ''}
        </span>
      </div>
      <div className={progressBarClass}>
        <div
          className="h-full rounded-full bg-[#A855F7] transition-[width] duration-500 ease-[cubic-bezier(.4,0,.2,1)]"
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </button>
  )
}

/* "PIEZAS POR TAG" del rediseño de "Producción FFT" (2026-09-02, mockup adjunto). Un SKU puede
   tener varios tags -- la suma de este desglose excede el total fisico de piezas a proposito
   (mismo comportamiento real que la pagina externa de BinManager), por eso NUNCA se presenta
   "Total de piezas/tag" como si fuera el total fisico -- se muestra aparte con su propia
   explicacion. */
export default function TagBreakdownCard({ t, tags, onTagClick, emptyMessage }) {
  const [open, setOpen] = useState(false)
  const maxQty = tags.length > 0 ? tags[0].qty : 0
  const sumQty = tags.reduce((s, tg) => s + tg.qty, 0)
  const preview = tags.slice(0, TAG_PREVIEW_COUNT)

  return (
    <div className={cardClass}>
      <div className={cardHeaderClass}>
        <div className="min-w-0 flex-1">
          <p className={cardHeaderTitleClass}>{t('tagsCardTitle')}</p>
        </div>
      </div>
      {tags.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState compact title={emptyMessage} />
        </div>
      ) : (
        <>
          <div className="space-y-3 px-5 py-4">
            {preview.map((tg) => (
              <TagRow key={tg.tag} tag={tg.tag} qty={tg.qty} maxQty={maxQty} total={sumQty} onTagClick={onTagClick} />
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-[11px] font-semibold text-[#A855F7] hover:underline"
            >
              {t('tagsViewAllLabel')} ({tags.length})
            </button>
            <p className="text-[11px] text-muted-foreground">
              {t('tagsTotalLabel')}: <span className="font-bold text-foreground">{sumQty}</span>
            </p>
          </div>
          <p className="border-t border-border px-5 py-2.5 text-[10.5px] text-muted-foreground">
            {t('tagsSumNotice')}
          </p>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={cn('flex max-h-[85vh] max-w-[520px] flex-col p-6')}>
          <DialogTitle className="font-extrabold">{t('tagsCardTitle')}</DialogTitle>
          <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
            {tags.map((tg) => (
              <TagRow
                key={tg.tag}
                tag={tg.tag}
                qty={tg.qty}
                maxQty={maxQty}
                total={sumQty}
                onTagClick={(tag) => {
                  setOpen(false)
                  onTagClick(tag)
                }}
              />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{t('tagsSumNotice')}</p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
