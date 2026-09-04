import { Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { alertToneClass } from '@/lib/pageStyles'
import { cn } from '@/lib/utils'
import { computeCompliancePct, computeGap } from '../../data/horaPorHora/metrics'
import { showToast } from '../../ui/toast'

/* Modal de captura de una hora (2026-09-04, a peticion explicita del usuario -- "el usuario SOLO
   captura lo necesario... GAP/cumplimiento calculados automaticamente"). Las incidencias NUEVAS
   se acumulan localmente (pendingIncidents) y se guardan todas junto con la produccion real al
   presionar "Guardar registro" -- un solo guardado decisivo, nunca parcial si el usuario cancela.
   Borrar una incidencia YA guardada (de una edicion anterior) SI es inmediato -- es una accion de
   remover, no de capturar, no tiene sentido "encolarla". */
export default function HourlyEntryModal({ entry, readOnly, onClose, onSaved }) {
  const { t } = useTranslation('horaPorHora')
  const [actualQty, setActualQty] = useState(entry.actualQty != null ? String(entry.actualQty) : '')
  const [showStandardOverride, setShowStandardOverride] = useState(false)
  const [standardOverride, setStandardOverride] = useState(String(entry.standardQty))
  const [existingIncidents, setExistingIncidents] = useState(entry.incidents || [])
  const [pendingIncidents, setPendingIncidents] = useState([])
  const [addingIncident, setAddingIncident] = useState(false)
  const [causes, setCauses] = useState([])
  const [draft, setDraft] = useState({
    causeId: '',
    measurementType: 'MINUTES',
    value: '',
    customDescription: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    fetch('/api/hora-por-hora/causes', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setCauses(data?.causes || []))
      .catch(() => setCauses([]))
  }, [])

  const effectiveStandard = showStandardOverride ? Number(standardOverride) || 0 : entry.standardQty
  const qtyNum = actualQty === '' ? null : Number(actualQty)
  const gap = computeGap(effectiveStandard, qtyNum)
  const compliance = computeCompliancePct(effectiveStandard, qtyNum)
  const selectedCause = causes.find((c) => c.id === draft.causeId)
  const isOtherCause = selectedCause?.code === 'otra'

  function addIncidentToQueue() {
    if (!draft.causeId) return
    const numValue = Number(draft.value)
    if (!Number.isFinite(numValue) || numValue <= 0 || !Number.isInteger(numValue)) return
    if (isOtherCause && !draft.customDescription.trim()) return
    setPendingIncidents((prev) => [
      ...prev,
      {
        localId: `pending-${Date.now()}-${prev.length}`,
        causeId: draft.causeId,
        causeName: selectedCause.name,
        measurementType: draft.measurementType,
        value: numValue,
        customDescription: isOtherCause ? draft.customDescription.trim() : null,
        notes: draft.notes.trim() || null,
      },
    ])
    setDraft({
      causeId: '',
      measurementType: 'MINUTES',
      value: '',
      customDescription: '',
      notes: '',
    })
    setAddingIncident(false)
  }

  function removePendingIncident(localId) {
    setPendingIncidents((prev) => prev.filter((i) => i.localId !== localId))
  }

  async function deleteExistingIncident(id) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/hora-por-hora/incidents/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || t('saveErrorGeneric'))
      setExistingIncidents((prev) => prev.filter((i) => i.id !== id))
      onSaved(data)
    } catch (err) {
      showToast(err.message || t('saveErrorGeneric'), 'error')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSave() {
    if (saving) return
    if (qtyNum != null && (!Number.isInteger(qtyNum) || qtyNum < 0)) {
      setSubmitError(t('validationActualQty'))
      return
    }
    setSaving(true)
    setSubmitError('')
    try {
      let lastDetail = null
      const body = {}
      if (qtyNum != null) body.actualQty = qtyNum
      if (showStandardOverride) body.standardQty = Number(standardOverride)
      if (Object.keys(body).length > 0) {
        const res = await fetch(`/api/hora-por-hora/entries/${entry.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || t('saveErrorGeneric'))
        lastDetail = data
      }
      for (const incident of pendingIncidents) {
        const res = await fetch(`/api/hora-por-hora/entries/${entry.id}/incidents`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(incident),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || t('saveErrorGeneric'))
        lastDetail = data
      }
      showToast(t('toastEntrySaved'), 'success')
      onSaved(lastDetail || { session: null, entries: [] })
    } catch (err) {
      setSubmitError(err.message || t('saveErrorGeneric'))
    } finally {
      setSaving(false)
    }
  }

  const allIncidents = [
    ...existingIncidents,
    ...pendingIncidents.map((p) => ({ ...p, id: p.localId, pending: true })),
  ]

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[88vh] max-w-[520px] flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {entry.startTime} - {entry.endTime}
          </DialogTitle>
          <DialogClose asChild>
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </DialogClose>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 pb-6">
          {readOnly && (
            <Alert className={alertToneClass('info')}>{t('shiftFinalizedNotice')}</Alert>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs">{t('fieldStandardLabel')}</Label>
              {showStandardOverride && !readOnly ? (
                <Input
                  type="number"
                  inputMode="numeric"
                  value={standardOverride}
                  onChange={(e) => setStandardOverride(e.target.value)}
                />
              ) : (
                <p className="text-[22px] font-extrabold">{entry.standardQty}</p>
              )}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setShowStandardOverride((v) => !v)}
                  className="mt-1 text-[11px] font-semibold text-primary underline"
                >
                  {showStandardOverride
                    ? t('cancelStandardOverride')
                    : t('editStandardForThisHour')}
                </button>
              )}
            </div>
            <div>
              <Label className="mb-1 block text-xs">{t('fieldActualLabel')}</Label>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                value={actualQty}
                onChange={(e) => setActualQty(e.target.value)}
                disabled={readOnly}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border p-3.5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.02em] text-muted-foreground">
                {t('fieldGapLabel')}
              </p>
              <p
                className={cn(
                  'text-[19px] font-extrabold',
                  gap == null
                    ? 'text-muted-foreground'
                    : gap >= 0
                      ? 'text-[#10B981]'
                      : 'text-[#EF4444]',
                )}
              >
                {gap == null ? '—' : `${gap > 0 ? '+' : ''}${gap}`}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.02em] text-muted-foreground">
                {t('fieldComplianceLabel')}
              </p>
              <p className="text-[19px] font-extrabold">
                {compliance == null ? '—' : `${compliance.toFixed(1)}%`}
              </p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-bold text-foreground">{t('incidentsTitle')}</p>
              {!readOnly && !addingIncident && (
                <Button variant="outline" size="sm" onClick={() => setAddingIncident(true)}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t('addIncidentButton')}
                </Button>
              )}
            </div>

            {allIncidents.length === 0 && !addingIncident && (
              <p className="text-[12.5px] text-muted-foreground">{t('noIncidentsYet')}</p>
            )}

            <div className="flex flex-col gap-1.5">
              {allIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-[12.5px]"
                >
                  <div className="min-w-0">
                    <span className="font-semibold">
                      {incident.causeCode === 'otra' && incident.customDescription
                        ? incident.customDescription
                        : incident.causeName}
                    </span>
                    {incident.notes && (
                      <span className="ml-1.5 text-muted-foreground">· {incident.notes}</span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-bold">
                      {incident.value}{' '}
                      {incident.measurementType === 'MINUTES'
                        ? t('unitMinutesShort')
                        : t('unitPiecesShort')}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() =>
                          incident.pending
                            ? removePendingIncident(incident.id)
                            : deleteExistingIncident(incident.id)
                        }
                        disabled={deletingId === incident.id}
                        className="text-muted-foreground hover:text-[#EF4444]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {addingIncident && (
              <div className="mt-2 flex flex-col gap-2.5 rounded-2xl border border-border p-3.5">
                <div>
                  <Label className="mb-1 block text-xs">{t('fieldCauseLabel')}</Label>
                  <Select
                    value={draft.causeId}
                    onValueChange={(v) => setDraft((d) => ({ ...d, causeId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('fieldCausePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {causes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isOtherCause && (
                  <div>
                    <Label className="mb-1 block text-xs">{t('fieldCustomDescriptionLabel')}</Label>
                    <Input
                      value={draft.customDescription}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, customDescription: e.target.value }))
                      }
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="mb-1 block text-xs">{t('fieldValueLabel')}</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={draft.value}
                      onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs">{t('fieldMeasurementTypeLabel')}</Label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, measurementType: 'PIECES' }))}
                        className={cn(
                          'flex-1 rounded-lg border px-2 py-1.5 text-[12px] font-semibold',
                          draft.measurementType === 'PIECES'
                            ? 'border-[#3B82F6] bg-[#3B82F6]/[0.1] text-[#3B82F6]'
                            : 'border-border text-muted-foreground',
                        )}
                      >
                        {t('unitPieces')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, measurementType: 'MINUTES' }))}
                        className={cn(
                          'flex-1 rounded-lg border px-2 py-1.5 text-[12px] font-semibold',
                          draft.measurementType === 'MINUTES'
                            ? 'border-[#3B82F6] bg-[#3B82F6]/[0.1] text-[#3B82F6]'
                            : 'border-border text-muted-foreground',
                        )}
                      >
                        {t('unitMinutes')}
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">{t('fieldObservationLabel')}</Label>
                  <Input
                    value={draft.notes}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                    placeholder={t('fieldObservationPlaceholder')}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setAddingIncident(false)}>
                    {t('cancelButton')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={addIncidentToQueue}
                    disabled={
                      !draft.causeId ||
                      !draft.value ||
                      Number(draft.value) <= 0 ||
                      (isOtherCause && !draft.customDescription.trim())
                    }
                  >
                    {t('addIncidentButton')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {submitError && <Alert className={alertToneClass('error')}>{submitError}</Alert>}

          {!readOnly && (
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={onClose} disabled={saving}>
                {t('cancelButton')}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? t('saving') : t('saveEntryButton')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
