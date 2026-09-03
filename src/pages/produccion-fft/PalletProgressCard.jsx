import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cardClass, cardHeaderClass, cardHeaderTitleClass, progressBarClass } from '@/lib/pageStyles'
import { EmptyState } from '../../ui'

const PALLET_PREVIEW_COUNT = 5

function palletPct(p) {
  if (!p.expected) return 0
  return Math.max(0, Math.min(100, (p.processed / p.expected) * 100))
}

/* Fila de un pallet -- 2026-09-02, mockup adjunto. NOTA HONESTA (documentada tambien en
   server-lib/binmanager-sql.js getPalletsProgress): no se pudo verificar con certeza el
   significado real de "Recibidos/En proceso/Terminados" a nivel de UN pallet individual con los
   campos bit disponibles -- se muestran las cantidades REALES (recibido/esperado) en vez de
   inventar 3 etiquetas de estado sin poder respaldarlas. */
function PalletRow({ pallet, t }) {
  const pct = palletPct(pallet)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[12.5px] font-bold">{pallet.palletNumber}</span>
        <span className="text-[11px] text-muted-foreground">
          {pallet.received}/{pallet.expected} {t('palletUnitsLabel')}
        </span>
      </div>
      <div className={progressBarClass}>
        <div
          className="h-full rounded-full bg-[#F59E0B] transition-[width] duration-500 ease-[cubic-bezier(.4,0,.2,1)]"
          style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
        />
      </div>
    </div>
  )
}

/* "PROGRESO DE PALLETS" del rediseño de "Producción FFT" (2026-09-02, mockup adjunto). Fuente
   real: PO.PurchasePallets (ver getPalletsProgress) -- es una cola de pallets abiertos/recientes
   de este work center, NO se filtra por rango de fechas (la tabla no tiene fecha propia por
   pallet, mismo comportamiento que "Progreso de pallets" en la pagina externa real). */
export default function PalletProgressCard({ t, pallets, emptyMessage }) {
  const [open, setOpen] = useState(false)
  const preview = pallets.items.slice(0, PALLET_PREVIEW_COUNT)

  return (
    <div className={cardClass}>
      <div className={cardHeaderClass}>
        <div className="min-w-0 flex-1">
          <p className={cardHeaderTitleClass}>{t('palletsCardTitle')}</p>
        </div>
      </div>
      {pallets.items.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState compact title={emptyMessage} />
        </div>
      ) : (
        <>
          <div className="space-y-3 px-5 py-4">
            {preview.map((p) => (
              <PalletRow key={p.palletNumber} pallet={p} t={t} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="block w-full border-t border-border px-5 py-3 text-left text-[11px] font-semibold text-[#3B82F6] hover:underline"
          >
            {t('viewAllPalletsLabel')} ({pallets.items.length})
          </button>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-[520px] flex-col">
          <DialogTitle className="font-extrabold">{t('palletsCardTitle')}</DialogTitle>
          <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
            {pallets.items.map((p) => (
              <PalletRow key={p.palletNumber} pallet={p} t={t} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
