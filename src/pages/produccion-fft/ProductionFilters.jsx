import { RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cardClass } from '@/lib/pageStyles'

const ALL_VALUE = '__ALL__'

/* Barra de filtros del modulo "Producción FFT" (2026-09-02, rediseño sobre mockup adjunto).
   TODOS los valores de los dropdowns salen de /api/production/fft-summary (filters.workCenters/
   classifications/sizes, catalogo real via server-lib/binmanager-sql.js getWorkCenters/
   getFilterOptions) -- nunca opciones inventadas. "Sitio / Planta" se muestra fijo (no como
   dropdown funcional): este servidor solo tiene acceso real a UN almacen (Warehouse=68,
   MX-MTY-WH02/MTY-MAXX) -- inventar mas opciones seria falso. Los cambios de filtro son LOCALES
   hasta que el usuario aprieta "Actualizar" (a peticion explicita del usuario: "NO recrear la
   pagina completa innecesariamente" -- evita una consulta SQL pesada por cada click mientras el
   usuario todavia esta ajustando varios filtros a la vez). */
export default function ProductionFilters({
  t,
  workCenters,
  classificationOptions,
  sizeOptions,
  draft,
  onDraftChange,
  onApply,
  onClear,
  loading,
}) {
  return (
    <div className={`${cardClass} mb-4 flex flex-wrap items-end gap-3 p-4`}>
      <div className="flex min-w-[180px] flex-1 flex-col gap-1">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
          {t('filterSite')}
        </span>
        <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-[13px] font-semibold text-muted-foreground">
          MX-MTY-WH02 (MTY-MAXX)
        </div>
      </div>

      <div className="flex min-w-[200px] flex-1 flex-col gap-1">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
          {t('filterArea')}
        </span>
        <Select
          value={String(draft.workCenterId)}
          onValueChange={(v) => onDraftChange({ ...draft, workCenterId: Number(v) })}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {workCenters.map((wc) => (
              <SelectItem key={wc.id} value={String(wc.id)}>
                {wc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-w-[150px] flex-col gap-1">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
          {t('filterFrom')}
        </span>
        <Input
          type="date"
          className="h-9"
          value={draft.dateFrom}
          onChange={(e) => onDraftChange({ ...draft, dateFrom: e.target.value })}
        />
      </div>

      <div className="flex min-w-[150px] flex-col gap-1">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
          {t('filterTo')}
        </span>
        <Input
          type="date"
          className="h-9"
          value={draft.dateTo}
          onChange={(e) => onDraftChange({ ...draft, dateTo: e.target.value })}
        />
      </div>

      <div className="flex min-w-[160px] flex-col gap-1">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
          {t('filterClassification')}
        </span>
        <Select
          value={draft.classificationCode || ALL_VALUE}
          onValueChange={(v) => onDraftChange({ ...draft, classificationCode: v === ALL_VALUE ? '' : v })}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{t('filterAll')}</SelectItem>
            {classificationOptions.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name || c.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-w-[120px] flex-col gap-1">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
          {t('filterSize')}
        </span>
        <Select
          value={draft.size || ALL_VALUE}
          onValueChange={(v) => onDraftChange({ ...draft, size: v === ALL_VALUE ? '' : v })}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{t('filterAll')}</SelectItem>
            {sizeOptions.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s}&quot;
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Turno (2026-09-02, a peticion explicita del usuario): horario real de ESTE work center
          verificado en vivo contra el SP real (ver server-lib/binmanager-sql.js/
          buildFilteredBaseCte) -- Turno 1 = manana + tiempo extra (06:00-20:59), Turno 2 =
          noche/vespertino (21:00-05:59, cruza medianoche). Nombres alternos que usa la gente en la
          planta (nocturno/vespertino/noche) se muestran juntos en la etiqueta para no imponer un
          solo nombre "correcto". */}
      <div className="flex min-w-[190px] flex-col gap-1">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
          {t('filterShift')}
        </span>
        <Select
          value={draft.shift || ALL_VALUE}
          onValueChange={(v) => onDraftChange({ ...draft, shift: v === ALL_VALUE ? '' : v })}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{t('filterAll')}</SelectItem>
            <SelectItem value="1">{t('shift1Label')}</SelectItem>
            <SelectItem value="2">{t('shift2Label')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={onApply}
          disabled={loading}
          className="h-9 bg-[#3B82F6] font-bold normal-case hover:bg-[#3B82F6]/90"
        >
          <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          {t('filterApply')}
        </Button>
        <Button variant="outline" onClick={onClear} className="h-9 font-bold normal-case">
          <X className="h-4 w-4" />
          {t('filterClear')}
        </Button>
      </div>
    </div>
  )
}
