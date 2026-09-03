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
  bandForScore,
  FIVE_S_CATEGORIES,
  FIVE_S_META,
  FIVE_S_SCALE,
} from '../../data/audits5s/criteria'
import { workCenterById } from '../../data/production/catalog'
import FiveSRadarChart from './FiveSRadarChart'

/* "Resultado de auditoría 5'S" (2026-09-03, a peticion explicita del usuario -- pantalla grande
   inspirada en las hojas finales de "Presentacion 5S's.ppt", NUNCA solo un toast de "guardado
   correctamente"). Recibe la auditoria YA CALCULADA por el servidor (evaluation.sNScore/
   totalScore) -- este componente NUNCA recalcula nada, solo la presenta: se usa TANTO justo al
   terminar una auditoria nueva COMO al reabrir una del historial (mismos props, misma
   reconstruccion exacta -- "no recalcular usando configuraciones nuevas"). answers (opcional)
   habilita el detalle de "criterios con menor cumplimiento" dentro de areas de oportunidad;
   previousEvaluation (opcional) habilita la comparacion "actual / anterior / variacion". */
export default function FiveSResultDialog({ evaluation, previousEvaluation, answers, onClose }) {
  const { t } = useTranslation('auditoria')
  if (!evaluation) return null

  const scores = {
    s1: evaluation.s1Score,
    s2: evaluation.s2Score,
    s3: evaluation.s3Score,
    s4: evaluation.s4Score,
    s5: evaluation.s5Score,
  }
  const opportunities = FIVE_S_CATEGORIES.map((cat) => ({
    category: cat,
    score: scores[cat],
    criteria: (answers || [])
      .filter((a) => a.category === cat && a.answer !== 'CUMPLE')
      .sort((a, b) => a.score - b.score),
  }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)

  const variation =
    previousEvaluation != null ? evaluation.totalScore - previousEvaluation.totalScore : null

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-[720px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('resultTitle')}</DialogTitle>
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
          <p className="-mt-2 text-[12.5px] text-muted-foreground">{t('resultSubtitle')}</p>

          {/* Encabezado real: area/puesto/empleado/auditor/fecha/turno */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-2xl border border-border bg-black/[.015] p-4 text-[12.5px] dark:bg-white/[.02] sm:grid-cols-3">
            <InfoField
              label={t('fieldArea')}
              value={workCenterById(evaluation.areaId)?.name || evaluation.areaId}
            />
            <InfoField
              label={t('fieldPuesto')}
              value={evaluation.stationName || t('fieldNoAplica')}
            />
            <InfoField
              label={t('fieldEmpleado')}
              value={
                evaluation.employeeName
                  ? `${evaluation.employeeNumber || '—'} · ${evaluation.employeeName}`
                  : t('fieldNoAplica')
              }
            />
            <InfoField
              label={t('fieldAuditor')}
              value={evaluation.auditorName || t('fieldNoAplica')}
            />
            <InfoField
              label={t('fieldFecha')}
              value={dayjs(evaluation.auditDate).format('DD/MM/YYYY')}
            />
            <InfoField label={t('fieldTurno')} value={evaluation.shift || t('fieldNoAplica')} />
          </div>

          {/* Resultado 5S -- lista + total */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-muted-foreground">
              {t('resultScoresTitle')}
            </p>
            <div className="flex flex-col divide-y divide-border rounded-2xl border border-border">
              {FIVE_S_CATEGORIES.map((cat) => {
                const meta = FIVE_S_META[cat]
                const band = bandForScore(scores[cat])
                return (
                  <div key={cat} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                      {t(meta.titleKey)}
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                      {t(band.labelKey)}
                    </span>
                    <span className="w-14 shrink-0 text-right text-[14px] font-extrabold">
                      {scores[cat]} / 20
                    </span>
                  </div>
                )
              })}
              <div className="flex items-center justify-between bg-black/[.02] px-4 py-3 dark:bg-white/[.03]">
                <span className="text-[13px] font-extrabold uppercase tracking-[0.4px]">
                  {t('resultTotalLabel')}
                </span>
                <span className="text-xl font-extrabold">{evaluation.totalScore} / 100</span>
              </div>
            </div>
          </div>

          {variation != null && (
            <div className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
              <InfoField label={t('comparisonCurrentLabel')} value={`${evaluation.totalScore}`} />
              <InfoField
                label={t('comparisonPreviousLabel')}
                value={`${previousEvaluation.totalScore}`}
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

          {/* Radar real */}
          <div>
            <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.5px] text-muted-foreground">
              {t('radarTitle')}
            </p>
            <FiveSRadarChart scores={scores} />
          </div>

          {/* Escala 5S */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-muted-foreground">
              {t('scaleTitle')}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 rounded-2xl border border-dashed border-border px-4 py-3">
              {FIVE_S_SCALE.map((band) => (
                <div key={band.value} className="flex items-center gap-1.5 text-[12px]">
                  <span className="font-extrabold">{band.value}</span>
                  <span className="text-muted-foreground">{t(band.labelKey)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Areas de oportunidad -- orden matematico, nunca IA */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-muted-foreground">
              {t('opportunitiesTitle')}
            </p>
            <div className="flex flex-col gap-2">
              {opportunities.map((op, idx) => {
                const meta = FIVE_S_META[op.category]
                return (
                  <div
                    key={op.category}
                    className="rounded-xl border border-l-[3px] p-3"
                    style={{ borderLeftColor: meta.color, borderColor: 'hsl(var(--border))' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-bold">
                        {idx + 1}. {t(meta.titleKey)}
                      </span>
                      <span className="text-[13px] font-extrabold">{op.score} / 20</span>
                    </div>
                    {op.criteria.length > 0 && (
                      <ul className="mt-1.5 flex flex-col gap-0.5 pl-1">
                        {op.criteria.slice(0, 3).map((c) => (
                          <li key={c.criterionId} className="text-[11.5px] text-muted-foreground">
                            • {t(`${c.criterionId}_title`)} ({t(`answer.${c.answer}`)})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
