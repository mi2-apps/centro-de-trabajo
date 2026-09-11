import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cardClass, pageClass, pageSubtitleClass, pageTitleClass } from '@/lib/pageStyles'
import { ORG_CHART } from './orgChartData'

// Modulo Organigrama (2026-09-11, reconstruccion completa a peticion explicita del usuario):
// reemplaza la imagen plana estructura-organizacional.png (2026-09-09) por un arbol
// interactivo real -- el usuario pidio que darle clic a alguien muestre su foto + info
// (puesto/area/departamento/jefe directo/fecha de ingreso/celular/correo), lineas mas
// delgadas, y el CONTENIDO siempre en ingles (orgChartData.js, nunca via i18n). El shell de
// la pagina (titulo/subtitulo del modulo) si sigue el idioma normal de la app.
const FALLBACK = '—'

function initialsOf(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

function PersonAvatar({ person, size = 88 }) {
  const style = { width: size, height: size }
  if (person.photo) {
    return (
      <img
        src={person.photo}
        alt={person.name}
        style={style}
        className="rounded-full border-2 border-blue-500 object-cover"
      />
    )
  }
  return (
    <div
      style={style}
      className="flex items-center justify-center rounded-full border-2 border-blue-500 bg-blue-500/10 text-lg font-bold text-blue-600 dark:text-blue-400"
    >
      {initialsOf(person.name)}
    </div>
  )
}

function PersonNode({ person, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(person)}
      className="flex flex-col items-center gap-1.5 rounded-xl p-2 text-center transition-colors hover:bg-accent"
    >
      {person.title && (
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {person.title}
        </span>
      )}
      <PersonAvatar person={person} />
      <span className="text-sm font-bold">{person.name}</span>
    </button>
  )
}

// Conector delgado (2026-09-11, a peticion explicita del usuario -- "las lineas azules estén
// más delgadas"): 2px, en vez del grosor grueso de la imagen anterior. Tronco vertical +
// barra horizontal repartida entre los hijos, con caidas verticales a cada uno -- mismo
// truco clasico de organigramas en CSS puro (li con ::before/::after), aqui hecho con divs
// simples ya que solo hay un puñado de filas fijas, nunca un arbol generico recursivo.
function ConnectorRow({ label, people, onSelect }) {
  const count = people.length
  return (
    <div className="flex flex-col items-center">
      <div className="h-6 w-0.5 bg-blue-500" />
      {label && <p className="mb-1 text-sm font-bold">{label}</p>}
      <div className="relative flex items-start justify-center">
        {count > 1 && (
          <div
            className="absolute top-0 h-0.5 bg-blue-500"
            style={{ left: `${50 / count}%`, right: `${50 / count}%` }}
          />
        )}
        {people.map((person) => (
          <div key={person.id} className="flex flex-col items-center px-4">
            <div className="h-5 w-0.5 bg-blue-500" />
            <PersonNode person={person} onSelect={onSelect} />
          </div>
        ))}
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value || FALLBACK}</span>
    </div>
  )
}

export default function OrganigramaPage() {
  const { t } = useTranslation('organigrama')
  const [selected, setSelected] = useState(null)
  const cain = ORG_CHART.children[0]
  const felipe = ORG_CHART.children[1]

  return (
    <div className={pageClass}>
      <div className="mb-5">
        <p className={pageTitleClass}>{t('pageTitle')}</p>
        <p className={pageSubtitleClass}>{t('pageSubtitle')}</p>
      </div>

      <div className={`${cardClass} overflow-x-auto p-6`}>
        <div className="flex min-w-[720px] flex-col items-center">
          <PersonNode person={ORG_CHART} onSelect={setSelected} />

          <ConnectorRow people={[cain, felipe]} onSelect={setSelected} />

          <ConnectorRow
            label="Operational Leadership"
            people={cain.children}
            onSelect={setSelected}
          />

          <ConnectorRow
            label="Area Leaders"
            people={cain.secondGroupChildren}
            onSelect={setSelected}
          />
        </div>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(next) => !next && setSelected(null)}>
        <DialogContent className="max-w-[420px]">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.name}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center gap-3 px-6 pb-2">
                <PersonAvatar person={selected} size={112} />
              </div>
              <div className="px-6 pb-6">
                <InfoRow label="Position" value={selected.title} />
                <InfoRow label="Area" value={selected.area} />
                <InfoRow label="Department" value={selected.department} />
                <InfoRow label="Direct Manager" value={selected.manager} />
                <InfoRow label="Hire Date" value={selected.hireDate} />
                <InfoRow label="Cell Phone" value={selected.phone} />
                <InfoRow label="Email" value={selected.email} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
