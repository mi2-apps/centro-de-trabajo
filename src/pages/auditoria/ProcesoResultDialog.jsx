import dayjs from 'dayjs'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  bandForProcessScore,
  categoriesForRole,
  categoryActionKey,
} from '../../data/auditsProceso/criteria'
import { workCenterById } from '../../data/production/catalog'

/* "Resultado de Auditoría de Proceso" (2026-09-03, a peticion explicita del usuario) -- mismo
   patron que FiveSResultDialog (pantalla grande al terminar, nunca solo un toast). Recibe la
   auditoria YA CALCULADA por el servidor (audit.categoryNScore/totalScore) -- este componente
   NUNCA recalcula nada. Se usa TANTO justo al terminar una auditoria nueva COMO al reabrir una del
   historial (EvaluacionesPage) -- mismos props, misma reconstruccion exacta. previousAudit
   (opcional) habilita la comparacion "actual / anterior / variacion", igual que 5S. */
export default function ProcesoResultDialog({ audit, previousAudit, onClose }) {
  const { t } = useTranslation('auditoria')
  if (!audit) return null

  const categories = categoriesForRole(audit.role)
  const scores = categories.map((cat) => ({
    ...cat,
    score: audit[`category${cat.id}Score`],
  }))

  const band = bandForProcessScore(audit.totalScore)
  const variation = previousAudit != null ? audit.totalScore - previousAudit.totalScore : null

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-[680px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('procesoResultTitle')}</DialogTitle>
          <DialogClose asChild>
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </DialogClose>
        </DialogHeader>

        <div className="flex flex-col gap-5 px-6 pb-6">
          <p className="-mt-2 text-[12.5px] text-muted-foreground">{t('procesoResultSubtitle')}</p>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-2xl border border-border bg-black/[.015] p-4 text-[12.5px] dark:bg-white/[.02] sm:grid-cols-3">
            <InfoField
              label={t('fieldArea')}
              value={workCenterById(audit.areaId)?.name || audit.areaId}
            />
            <InfoField label={t('fieldPuesto')} value={audit.stationName || t('fieldNoAplica')} />
            <InfoField
              label={t('fieldEmpleado')}
              value={
                audit.employeeName
                  ? `${audit.employeeNumber || '—'} · ${audit.employeeName}`
                  : t('fieldNoAplica')
              }
            />
            <InfoField label={t('fieldAuditor')} value={audit.auditorName || t('fieldNoAplica')} />
            <InfoField
              label={t('fieldFecha')}
              value={dayjs(audit.auditDate).format('DD/MM/YYYY')}
            />
            <InfoField label={t('fieldTurno')} value={audit.shift || t('fieldNoAplica')} />
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-muted-foreground">
              {t('resultScoresTitle')}
            </p>
            <div className="flex flex-col divide-y divide-border rounded-2xl border border-border">
              {scores.map((cat) => {
                const actionKey = categoryActionKey(cat.score)
                return (
                  <div key={cat.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                      {t(cat.titleKey)}
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                      {t(actionKey)}
                    </span>
                    <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[#2563EB]"
                        style={{ width: `${cat.score}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right text-[14px] font-extrabold">
                      {cat.score}%
                    </span>
                  </div>
                )
              })}
              <div className="flex items-center justify-between bg-black/[.02] px-4 py-3 dark:bg-white/[.03]">
                <span className="text-[13px] font-extrabold uppercase tracking-[0.4px]">
                  {t('resultTotalLabel')}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-muted-foreground">
                    {t(band.labelKey)}
                  </span>
                  <span className="text-xl font-extrabold">{audit.totalScore}%</span>
                </div>
              </div>
            </div>
          </div>

          {variation != null && (
            <div className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
              <InfoField label={t('comparisonCurrentLabel')} value={`${audit.totalScore}%`} />
              <InfoField
                label={t('comparisonPreviousLabel')}
                value={`${previousAudit.totalScore}%`}
              />
              <div className="text-right">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
                  {t('comparisonVariationLabel')}
                </p>
                <p
                  className={cn(
                    'mt-0.5 text-sm font-extrabold',
                    variation > 0 ? 'text-[#10B981]' : variation < 0 ? 'text-[#EF4444]' : '',
                  )}
                >
                  {variation > 0 ? '+' : ''}
                  {variation}
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-muted-foreground">
              {t('procesoScaleTitle')}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 rounded-2xl border border-dashed border-border px-4 py-3">
              <ScaleEntry range="0-25" labelKey="scaleCritico" />
              <ScaleEntry range="26-50" labelKey="scaleBajo" />
              <ScaleEntry range="51-79" labelKey="scaleMedio" />
              <ScaleEntry range="80-100" labelKey="scaleAlto" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ScaleEntry({ range, labelKey }) {
  const { t } = useTranslation('auditoria')
  return (
    <div className="flex items-center gap-1.5 text-[12px]">
      <span className="font-extrabold">{range}</span>
      <span className="text-muted-foreground">{t(labelKey)}</span>
    </div>
  )
}

function InfoField({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-[12.5px] font-bold">{value}</p>
    </div>
  )
}
