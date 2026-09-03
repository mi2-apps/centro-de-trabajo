import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cardClass, cardHeaderClass, cardHeaderTitleClass, progressBarClass } from '@/lib/pageStyles'
import { EmptyState } from '../../ui'

const PALLET_PREVIEW_COUNT = 5

/* Fila de un pallet -- 2026-09-02, CORREGIDO tras confirmar que el widget real identifica cada
   pallet por su BinCode (ver server-lib/binmanager-sql.js getPalletsProgress para la investigacion
   completa: son bins fisicos de BM.Bins, no PO.PurchasePallets). pct = items ya clasificados en FFT
   (ProductSKU sin sufijo -PNP) / total de items en el bin. */
function PalletRow({ pallet, t }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[12.5px] font-bold">{pallet.binCode}</span>
        <span className="text-[11px] text-muted-foreground">
          {pallet.pct.toFixed(0)}% · {pallet.done}/{pallet.total} {t('palletUnitsLabel')}
        </span>
      </div>
      <div className={progressBarClass}>
        <div
          className="h-full rounded-full bg-[#F59E0B] transition-[width] duration-500 ease-[cubic-bezier(.4,0,.2,1)]"
          style={{ width: `${Math.max(pallet.pct, pallet.pct > 0 ? 2 : 0)}%` }}
        />
      </div>
    </div>
  )
}

function SummaryStat({ label, bucket, t }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-md bg-muted/40 px-2 py-2 text-center">
      <span className="text-[10px] font-bold uppercase tracking-[0.4px] text-muted-foreground">{label}</span>
      <span className="text-[16px] font-extrabold">{bucket.pallets}</span>
      <span className="text-[10.5px] text-muted-foreground">
        {bucket.pz} {t('palletsPzLabel')}
      </span>
    </div>
  )
}

/* "PROGRESO DE PALLETS" del rediseño de "Producción FFT" (2026-09-02, CORREGIDO el mismo dia tras
   reportar el usuario que la version anterior -- basada en PO.PurchasePallets -- no coincidia con
   la tarjeta real: IDs distintos ("405576-0700" vs. numeros de pallet chicos) y estructura distinta
   (RECIBIDOS/EN PROCESO/TERMINADOS). Ver server-lib/binmanager-sql.js getPalletsProgress para la
   investigacion completa via el MCP de BinManager. Snapshot fisico EN VIVO del area de FFT -- a
   proposito NO se filtra por turno/fecha/clasificacion/pulgadas (confirmado con 2 capturas reales
   del usuario en turnos distintos con RECIBIDOS/TERMINADOS identicos). */
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
          <div className="grid grid-cols-3 gap-2 px-5 pt-4">
            <SummaryStat label={t('palletsReceivedLabel')} bucket={pallets.summary.recibidos} t={t} />
            <SummaryStat label={t('palletsInProgressLabel')} bucket={pallets.summary.enProceso} t={t} />
            <SummaryStat label={t('palletsDoneLabel')} bucket={pallets.summary.terminados} t={t} />
          </div>
          <div className="space-y-3 px-5 py-4">
            {preview.map((p) => (
              <PalletRow key={p.id} pallet={p} t={t} />
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
        <DialogContent className="flex max-h-[85vh] max-w-[520px] flex-col p-6">
          <DialogTitle className="font-extrabold">{t('palletsCardTitle')}</DialogTitle>
          <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
            {pallets.items.map((p) => (
              <PalletRow key={p.id} pallet={p} t={t} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
