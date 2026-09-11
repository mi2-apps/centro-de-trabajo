import { Users } from 'lucide-react'
import { Children, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cardClass, pageClass } from '@/lib/pageStyles'
import { cn } from '@/lib/utils'
import { ORG_CHART } from './orgChartData'

// Modulo Organigrama (2026-09-11, reconstruccion completa a peticion explicita del usuario):
// reemplaza la imagen plana estructura-organizacional.png (2026-09-09) por un arbol
// interactivo real -- darle clic a alguien muestra su foto + info (puesto/area/departamento/
// jefe directo/fecha de ingreso/celular/correo). El shell de la pagina (label/subtitulo del
// modulo, etiquetas de la tarjeta de info) sigue el idioma normal de la app via i18n; el
// CONTENIDO del arbol en si (nombres/puestos reales de orgChartData.js) queda fijo, nunca via
// i18n, tal cual el usuario lo definio.
//
// QUINTA PASADA (mismo dia, rediseño visual completo a peticion explicita del usuario, spec
// detallado + imagen de referencia -- "convertirlo en un organigrama empresarial moderno,
// compacto, profesional"): tarjetas HORIZONTALES (foto izquierda + nombre/puesto derecha, ancho
// fijo, misma altura en toda la fila via line-clamp), etiquetas de grupo en pill azul, conectores
// con nodos/puntos, encabezado de pagina con eyebrow + titulo + subtitulo. Arbol recursivo
// (TreeNode, ver cuarta pasada) sin cambios de fondo -- Oscar Enrique Pizano Guzman se agrega
// como nueva raiz en orgChartData.js (ver ese archivo), Juan Sillas es ahora su unico hijo.
const FALLBACK = '—'
const CARD_WIDTH = 208

function initialsOf(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

function PersonAvatar({ person, size = 48 }) {
  const style = { width: size, height: size, minWidth: size }
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
      className="flex items-center justify-center rounded-full border-2 border-blue-500 bg-blue-500/10 font-bold text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
    >
      {initialsOf(person.name)}
    </div>
  )
}

// Tarjeta horizontal (2026-09-11, quinta pasada -- a peticion explicita del usuario, "cards
// horizontales pequeñas y elegantes... mismo ancho, mismo alto"): ancho fijo (CARD_WIDTH) y
// min-h fijo para que TODAS las tarjetas de una misma fila midan exactamente lo mismo sin
// importar si el puesto es corto o largo -- line-clamp-2 evita que un puesto largo estire la
// tarjeta mas que las demas.
function PersonNode({ person, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(person)}
      style={{ width: CARD_WIDTH }}
      className="flex min-h-[72px] items-center gap-2.5 rounded-2xl border border-border bg-card p-2.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md dark:bg-card/80"
    >
      <PersonAvatar person={person} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold leading-tight">{person.name}</p>
        {person.title && (
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-tight text-muted-foreground">
            {person.title}
          </p>
        )}
      </div>
    </button>
  )
}

// Pill de encabezado de grupo ("Production Management"/"Operational Leadership"/"Area
// Leaders") -- a peticion explicita del usuario, "no quiero que sean simplemente texto gris
// flotando... convertirlos en pequeños pills/etiquetas elegantes".
function GroupLabel({ children }) {
  return (
    <span className="whitespace-nowrap rounded-full bg-blue-500/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
      {children}
    </span>
  )
}

// Nodo/punto azul en los conectores (2026-09-11, a peticion explicita del usuario -- "agregar
// pequeños puntos/nodos azules donde tenga sentido").
function Dot() {
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
}

// Conector delgado (1.5px), solo lineas verticales/horizontales en angulos de 90° -- nunca
// diagonales. `flex-col` en mobile (grupos se acomodan verticalmente, sin la barra horizontal)
// y `sm:flex-row` en tablet/desktop (el abanico clasico de organigrama), a peticion explicita
// del usuario para el comportamiento responsive.
function ConnectorRow({ label, children }) {
  const items = Children.toArray(children)
  const count = items.length
  return (
    <div className="flex flex-col items-center">
      <Dot />
      <div className="h-4 w-px bg-blue-400" />
      {label && <GroupLabel>{label}</GroupLabel>}
      <div className="h-4 w-px bg-blue-400" />
      <div className="relative flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-center sm:gap-3">
        {count > 1 && (
          <div
            className="absolute top-0 hidden h-px bg-blue-400 sm:block"
            style={{ left: `${50 / count}%`, right: `${50 / count}%` }}
          />
        )}
        {items.map((child) => (
          <div key={child.key} className="flex flex-col items-center px-2">
            <div className="hidden h-4 w-px bg-blue-400 sm:block" />
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}

// Nodo de arbol recursivo (2026-09-11, cuarta pasada -- corrige bug real: antes "Operational
// Leadership"/"Area Leaders" colgaban del centro de la pagina, no de Cain especificamente):
// cada persona dibuja su propia tarjeta y, si tiene hijos, su propia ConnectorRow debajo,
// DENTRO de su misma columna -- nunca como fila suelta al nivel de la pagina. Cain tiene DOS
// grupos reales (Operational Leadership, Area Leaders), ambos cuelgan de su columna.
function TreeNode({ person, onSelect }) {
  const hasChildren = person.children?.length > 0
  const hasSecondGroup = person.secondGroupChildren?.length > 0
  return (
    <div className="flex flex-col items-center">
      <PersonNode person={person} onSelect={onSelect} />
      {hasChildren && (
        <>
          <Dot />
          <div className="h-4 w-px bg-blue-400" />
          <ConnectorRow label={person.groupLabel}>
            {person.children.map((child) => (
              <TreeNode key={child.id} person={child} onSelect={onSelect} />
            ))}
          </ConnectorRow>
        </>
      )}
      {hasSecondGroup && (
        <ConnectorRow label={person.secondGroupLabel}>
          {person.secondGroupChildren.map((child) => (
            <TreeNode key={child.id} person={child} onSelect={onSelect} />
          ))}
        </ConnectorRow>
      )}
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

  return (
    <div className={pageClass}>
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[2px] text-blue-600 dark:text-blue-400">
            {t('eyebrow')}
          </p>
          <p className="mt-1 text-[1.35rem] font-extrabold tracking-[-0.4px] text-foreground sm:text-[1.6rem]">
            {t('pageTitle')}
          </p>
          <p className="mt-1 text-[13px] font-medium text-muted-foreground">{t('pageSubtitle')}</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 dark:bg-blue-500/10">
          <Users className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-[12px] font-semibold leading-snug text-blue-700 dark:text-blue-300">
            {t('calloutText')}
          </p>
        </div>
      </div>

      <div className={cn(cardClass, 'overflow-x-auto p-6 sm:p-8')}>
        <div className="flex min-w-fit flex-col items-center">
          <TreeNode person={ORG_CHART} onSelect={setSelected} />
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
                <InfoRow label={t('infoPosition')} value={selected.title} />
                <InfoRow label={t('infoArea')} value={selected.area} />
                <InfoRow label={t('infoDepartment')} value={selected.department} />
                <InfoRow label={t('infoManager')} value={selected.manager} />
                <InfoRow label={t('infoHireDate')} value={selected.hireDate} />
                <InfoRow label={t('infoPhone')} value={selected.phone} />
                <InfoRow label={t('infoEmail')} value={selected.email} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
