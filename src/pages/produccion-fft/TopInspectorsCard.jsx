import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  cardClass,
  cardHeaderClass,
  cardHeaderTitleClass,
  cellTextClass,
  cellTextSecondaryClass,
  metricChipClass,
  tableHeaderRowClass,
  tableRowClass,
} from '@/lib/pageStyles'
import { EmptyState } from '../../ui'

const AVATAR_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#A855F7', '#EF4444', '#06B6D4', '#64748B']
const TOP_PREVIEW_COUNT = 6

function hashColor(seed) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function initialsOf(name) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase()
}

const MATCH_TONE = {
  OK: 'ok',
  AMBIGUO: 'warn',
  REVISAR: 'warn',
  SIN_MATCH: 'bad',
  USERNAME_DESCONOCIDO: 'bad',
}

/* "TOP INSPECTORES (USUARIOS ACTIVOS)" del rediseño de "Producción FFT" (2026-09-02, mockup
   adjunto) -- reemplaza visualmente a la tabla plana "Personal activo hoy" que ya existia, pero
   NO le quita informacion: "Ver todos los usuarios" abre el mismo detalle completo (persona/
   numero de empleado/piezas/estado) en un dialogo, mismo dato/misma logica de matching de
   siempre (server-lib/binmanager-matching.js), solo cambia la presentacion. */
export default function TopInspectorsCard({ t, people, emptyMessage }) {
  const [open, setOpen] = useState(false)
  const total = people.reduce((s, p) => s + p.qty, 0)
  const preview = people.slice(0, TOP_PREVIEW_COUNT)

  return (
    <div className={cardClass}>
      <div className={cardHeaderClass}>
        <div className="min-w-0 flex-1">
          <p className={cardHeaderTitleClass}>{t('topInspectorsTitle')}</p>
        </div>
      </div>
      {people.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState compact title={emptyMessage} />
        </div>
      ) : (
        <>
          <div className="space-y-2.5 px-5 py-4">
            {preview.map((p) => {
              const label = p.fullName || p.resolvedName || p.username
              return (
                <div key={p.username} className="flex items-center gap-2.5">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                    style={{ backgroundColor: hashColor(p.username) }}
                  >
                    {initialsOf(label)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{label}</span>
                  <span className="shrink-0 text-[13px] font-extrabold">{p.qty}</span>
                  <span className="w-12 shrink-0 text-right text-[11px] text-muted-foreground">
                    {total > 0 ? ((p.qty / total) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-[11px] font-semibold text-[#3B82F6] hover:underline"
            >
              {t('viewAllUsersLabel')}
            </button>
            <p className="text-[11px] text-muted-foreground">
              {t('totalActiveUsersLabel')}: <span className="font-bold text-foreground">{people.length}</span>
            </p>
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-[720px] flex-col p-6">
          <DialogTitle className="font-extrabold">{t('peopleTableTitle')}</DialogTitle>
          <p className="text-[12.5px] text-muted-foreground">{t('peopleTableSubtitle')}</p>
          <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className={tableHeaderRowClass}>
                  <TableHead>{t('colPerson')}</TableHead>
                  <TableHead>{t('colEmployeeNumber')}</TableHead>
                  <TableHead className="text-right">{t('colQty')}</TableHead>
                  <TableHead>{t('colStatus')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((p, idx) => (
                  <TableRow key={p.username} className={tableRowClass(idx)}>
                    <TableCell className={`${cellTextClass} font-bold`}>
                      {p.fullName || p.resolvedName || p.username}
                    </TableCell>
                    <TableCell className={cellTextSecondaryClass}>{p.employeeNumber || '—'}</TableCell>
                    <TableCell className="text-right font-bold">{p.qty}</TableCell>
                    <TableCell>
                      <span className={metricChipClass(MATCH_TONE[p.matchStatus] || 'default')}>
                        {t(`matchStatus.${p.matchStatus}`, p.matchStatus)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
