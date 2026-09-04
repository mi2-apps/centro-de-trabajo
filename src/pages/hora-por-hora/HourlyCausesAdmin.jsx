import { ArrowDown, ArrowLeft, ArrowUp, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  cardClass,
  cellTextClass,
  pageClass,
  pageSubtitleClass,
  pageTitleClass,
} from '@/lib/pageStyles'
import { cn } from '@/lib/utils'
import { EmptyState } from '../../ui'
import { showToast } from '../../ui/toast'

/* Configuracion de causas de Hora por Hora (2026-09-04, a peticion explicita del usuario --
   "ADMIN puede: crear causa, editar nombre, activar/desactivar, cambiar orden... NO eliminar
   fisicamente una causa que ya tenga historico"). Exclusivo de ADMINISTRADOR (mismo criterio de
   gating por rol ya usado en el backend, api/hora-por-hora/causes/*.js). Reordenar es con
   flechas arriba/abajo (nunca drag-and-drop) -- simple, tactil, sin libreria nueva. */
export default function HourlyCausesAdmin({ onBack }) {
  const { t } = useTranslation('horaPorHora')
  const [causes, setCauses] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/hora-por-hora/causes?includeInactive=1', {
        credentials: 'include',
      })
      const data = await res.json().catch(() => null)
      setCauses(data?.causes || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function patchCause(id, body) {
    const res = await fetch(`/api/hora-por-hora/causes/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      showToast(data?.error || t('saveErrorGeneric'), 'error')
      return false
    }
    return true
  }

  async function handleToggleActive(cause) {
    const ok = await patchCause(cause.id, { active: !cause.active })
    if (ok) await load()
  }

  async function handleRename(cause, name) {
    if (!name.trim() || name.trim() === cause.name) return
    const ok = await patchCause(cause.id, { name: name.trim() })
    if (ok) await load()
  }

  async function handleMove(index, direction) {
    const other = causes[index + direction]
    if (!other) return
    const current = causes[index]
    await Promise.all([
      patchCause(current.id, { sortOrder: other.sortOrder }),
      patchCause(other.id, { sortOrder: current.sortOrder }),
    ])
    await load()
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/hora-por-hora/causes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || t('saveErrorGeneric'))
      setNewName('')
      showToast(t('causeCreated'), 'success')
      await load()
    } catch (err) {
      showToast(err.message || t('saveErrorGeneric'), 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className={pageClass}>
      <div className={cn(cardClass, 'mb-4')}>
        <div className="flex items-center gap-2 border-b border-border bg-black/[.015] px-5 py-3.5 dark:bg-white/[.02]">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className={pageTitleClass}>{t('causesAdminTitle')}</p>
            <p className={pageSubtitleClass}>{t('causesAdminSubtitle')}</p>
          </div>
        </div>
        <div className="flex items-end gap-2 px-5 py-3.5">
          <div>
            <Label className="mb-1.5 block text-xs">{t('causesAdminNewLabel')}</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('causesAdminNewPlaceholder')}
              className="w-[260px]"
            />
          </div>
          <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
            <Plus className="mr-1 h-4 w-4" />
            {creating ? t('generating') : t('causesAdminCreateButton')}
          </Button>
        </div>
      </div>

      <div className={cardClass}>
        {loading ? (
          <div className="px-5 py-10">
            <EmptyState compact title={t('loading')} />
          </div>
        ) : (
          <div className="flex flex-col">
            {causes.map((cause, idx) => (
              <div
                key={cause.id}
                className={cn(
                  'flex items-center gap-3 border-b border-border/60 px-5 py-2.5 last:border-b-0',
                  !cause.active && 'opacity-50',
                )}
              >
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => handleMove(idx, -1)}
                    disabled={idx === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(idx, 1)}
                    disabled={idx === causes.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input
                  defaultValue={cause.name}
                  onBlur={(e) => handleRename(cause, e.target.value)}
                  disabled={cause.code === 'otra'}
                  className={cn('flex-1', cellTextClass)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleActive(cause)}
                  disabled={cause.code === 'otra'}
                >
                  {cause.active ? t('causesAdminDeactivate') : t('causesAdminActivate')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
