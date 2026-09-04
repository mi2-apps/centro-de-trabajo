import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  alertToneClass,
  cardClass,
  cardHeaderClass,
  cardHeaderTitleClass,
  cellTextClass,
  pageClass,
  pageSubtitleClass,
  pageTitleClass,
} from '@/lib/pageStyles'
import { cn } from '@/lib/utils'
import { EQUIPMENT_STATUSES, EQUIPMENT_TYPES } from '../../data/controlEquipo/catalog'
import { getWorkstationsForLine } from '../../data/personnel/workstations'
import { LINE_FAMILY_AREA_IDS, WORK_CENTERS, workCenterById } from '../../data/production/catalog'
import { EmptyState } from '../../ui'

/* Modulo Control de Equipo (2026-09-04, a peticion explicita del usuario): registro real de
   estado de equipo fisico, mismo patron de seleccion de area/estacion que Demoras/Auditoria
   (AREA_GROUPS -- 5 grupos, "Lineas de produccion" pide una linea especifica antes de llegar a
   Estacion). Cada registro es una OBSERVACION de estado (append-only, ver
   src/data/controlEquipo/catalog.js) -- el checklist formal periodico "Levantamiento de
   equipos" vive dentro del modulo Auditoria como su propio tipo de auditoria. */
const AREA_GROUPS = [
  { key: 'LINEAS', labelKey: 'areaGroupLines' },
  { key: 'INSUMOS', labelKey: 'areaGroupInsumos', areaId: 'INSUMOS' },
  { key: 'ACCESORIOS', labelKey: 'areaGroupAccesorios', areaId: 'ACCESORIOS' },
  { key: 'MIDEA', labelKey: 'areaGroupMidea', areaId: 'HIGH_VALUE' },
  { key: 'PALETIZADO', labelKey: 'areaGroupPaletizado', areaId: 'PALETIZADO' },
]

const STATUS_BADGE_CLASS = {
  OPERATIVO: 'bg-emerald-500/[0.12] text-emerald-600',
  DANADO: 'bg-red-500/[0.12] text-red-600',
  EN_REPARACION: 'bg-amber-500/[0.12] text-amber-600',
  BAJA: 'bg-gray-500/[0.12] text-gray-600',
}

const emptyForm = {
  groupKey: '',
  lineId: '',
  areaId: '',
  stationName: '',
  typeKey: '',
  code: '',
  status: 'OPERATIVO',
  notes: '',
}

export default function ControlEquipoPage() {
  const { t } = useTranslation('controlEquipo')
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(true)

  const loadItems = useCallback(async () => {
    setLoadingItems(true)
    try {
      const res = await fetch('/api/control-equipo', { credentials: 'include' })
      const data = await res.json().catch(() => null)
      setItems(data?.items || [])
    } finally {
      setLoadingItems(false)
    }
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const selectedArea = form.areaId ? workCenterById(form.areaId) : null
  const stationOptions = form.areaId
    ? Array.from(new Map(getWorkstationsForLine(form.areaId).map((w) => [w.name, w])).values())
    : []

  function handleGroupChange(groupKey) {
    const group = AREA_GROUPS.find((g) => g.key === groupKey)
    setForm((prev) => ({
      ...prev,
      groupKey,
      lineId: '',
      stationName: '',
      areaId: group?.areaId || '',
    }))
  }

  function handleLineChange(lineId) {
    setForm((prev) => ({ ...prev, lineId, stationName: '', areaId: lineId }))
  }

  const canSubmit = Boolean(form.areaId) && Boolean(form.typeKey) && Boolean(form.status)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/control-equipo', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typeKey: form.typeKey,
          areaId: form.areaId,
          stationName: form.stationName || null,
          code: form.code || null,
          status: form.status,
          notes: form.notes || null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || t('saveErrorGeneric'))
      setForm(emptyForm)
      await loadItems()
    } catch (err) {
      setSubmitError(err.message || t('saveErrorGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={pageClass}>
      <div className={cn(cardClass, 'mb-4')}>
        <div className="border-b border-border bg-black/[.015] px-5 py-3.5 dark:bg-white/[.02]">
          <p className={pageTitleClass}>{t('pageTitle')}</p>
          <p className={pageSubtitleClass}>{t('pageSubtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
        <form onSubmit={handleSubmit} className={cn(cardClass, 'h-fit p-5')}>
          <p className={cn(cardHeaderTitleClass, 'mb-4')}>{t('formTitle')}</p>

          <div className="space-y-3.5">
            <div>
              <Label className="mb-1.5 block text-xs">{t('fieldType')}</Label>
              <Select
                value={form.typeKey}
                onValueChange={(v) => setForm((prev) => ({ ...prev, typeKey: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('fieldTypePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_TYPES.map((eq) => (
                    <SelectItem key={eq.key} value={eq.key}>
                      {t(`types.${eq.key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block text-xs">{t('fieldArea')}</Label>
              <Select value={form.groupKey} onValueChange={handleGroupChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('fieldAreaPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {AREA_GROUPS.map((g) => (
                    <SelectItem key={g.key} value={g.key}>
                      {t(g.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.groupKey === 'LINEAS' && (
              <div>
                <Label className="mb-1.5 block text-xs">{t('fieldLine')}</Label>
                <Select value={form.lineId} onValueChange={handleLineChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('fieldLinePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_CENTERS.filter((w) => LINE_FAMILY_AREA_IDS.has(w.id)).map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {workCenterById(w.id).name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedArea && stationOptions.length > 0 && (
              <div>
                <Label className="mb-1.5 block text-xs">{t('fieldStation')}</Label>
                <Select
                  value={form.stationName}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, stationName: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('fieldStationPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {stationOptions.map((s) => (
                      <SelectItem key={s.name} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="mb-1.5 block text-xs">{t('fieldCode')}</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                placeholder={t('fieldCodePlaceholder')}
              />
            </div>

            <div>
              <Label className="mb-1.5 block text-xs">{t('fieldStatus')}</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((prev) => ({ ...prev, status: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`status.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block text-xs">{t('fieldNotes')}</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder={t('fieldNotesPlaceholder')}
              />
            </div>

            {submitError && (
              <Alert className={cn(alertToneClass('error'), 'text-sm')}>{submitError}</Alert>
            )}

            <Button type="submit" disabled={!canSubmit || submitting} className="w-full">
              {submitting ? t('submitting') : t('submit')}
            </Button>
          </div>
        </form>

        <div className={cn(cardClass, 'p-0')}>
          <div className={cardHeaderClass}>
            <p className={cardHeaderTitleClass}>{t('historyTitle')}</p>
          </div>
          {loadingItems ? (
            <div className="px-5 py-8">
              <EmptyState compact title={t('loading')} />
            </div>
          ) : items.length === 0 ? (
            <div className="px-5 py-8">
              <EmptyState compact title={t('historyEmpty')} />
            </div>
          ) : (
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b border-border">
                    <Th>{t('colType')}</Th>
                    <Th>{t('colArea')}</Th>
                    <Th>{t('colStation')}</Th>
                    <Th>{t('colCode')}</Th>
                    <Th>{t('colStatus')}</Th>
                    <Th>{t('colCreatedBy')}</Th>
                    <Th>{t('colCreatedAt')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-b border-border/60">
                      <Td>{t(`types.${i.typeKey}`)}</Td>
                      <Td>{workCenterById(i.areaId)?.name || i.areaId}</Td>
                      <Td>{i.stationName || '—'}</Td>
                      <Td>{i.code || '—'}</Td>
                      <Td>
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-bold',
                            STATUS_BADGE_CLASS[i.status],
                          )}
                        >
                          {t(`status.${i.status}`)}
                        </span>
                      </Td>
                      <Td>{i.createdByName || '—'}</Td>
                      <Td>{new Date(i.createdAt).toLocaleString()}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Th({ children }) {
  return (
    <th className="px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.03em] text-muted-foreground">
      {children}
    </th>
  )
}

function Td({ children }) {
  return <td className={cn('px-3.5 py-2.5', cellTextClass)}>{children}</td>
}
