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
//
// SEXTA PASADA (mismo dia, correccion visual sobre esta MISMA implementacion -- a peticion
// explicita del usuario: "no quiero un rediseño nuevo... solo corregir alineacion, proporciones
// y espaciado"): 3 correcciones reales, no solo estilo:
// 1) Nombre de Oscar se truncaba con "..." -- se quita `truncate` de los nombres (regla
//    explicita del usuario, "NO usar ellipsis para nombres"), se usa line-clamp-2 igual que los
//    puestos, y Oscar usa un ancho de tarjeta mayor (orgChartData.js: cardWidth).
// 2) Bug real de simetria: Cain (con descendientes anchos -- 2 filas de 3 tarjetas) y Felipe
//    (sin descendientes) compartian fila bajo "Production Management" -- al empacarse con
//    justify-center, Felipe quedaba visualmente lejos del centro real porque el "centro" se
//    calculaba sobre el ANCHO TOTAL de la columna de Cain (inflada por sus descendientes), no
//    sobre la posicion real de las 2 tarjetas. Se corrige dejando la fila Cain/Felipe ANGOSTA
//    (solo sus 2 tarjetas, "reducir el ancho de esa rama" -- pedido explicito) y desplazando los
//    grupos de Cain (ver `descendantShift` en renderSiblingRow/TreeNode) para que queden
//    centrados bajo SU tarjeta, no bajo el centro de la fila -- Cain y Felipe quedan simetricos
//    y cercanos, sus descendientes se siguen expandiendo mas abajo sin empujarlos. Solo aplica
//    desde `sm:` (tablet/desktop) via variable CSS, nunca en mobile (evita overflow horizontal).
// 3) Espaciado general reducido ~15-20% (stems mas cortos, un solo stem cuando no hay pill de
//    grupo en vez de dos, padding del contenedor mas ajustado) -- misma jerarquia, mismos datos,
//    solo mas compacto.
const FALLBACK = '—'
const CARD_WIDTH = 208
const ROW_GAP = 16

function rowWidth(count) {
  return count * CARD_WIDTH + (count - 1) * ROW_GAP
}

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

// Tarjeta horizontal -- ancho fijo (CARD_WIDTH, salvo cardWidth propio como el de Oscar) y
// min-h fijo para que TODAS las tarjetas de una misma fila midan exactamente lo mismo sin
// importar si el puesto es corto o largo. Ni el nombre ni el puesto usan `truncate`/ellipsis (a
// peticion explicita del usuario, sexta pasada) -- ambos usan line-clamp-2 como tope real.
function PersonNode({ person, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(person)}
      style={{ width: person.cardWidth || CARD_WIDTH }}
      className="flex min-h-[80px] items-center gap-2.5 rounded-2xl border border-border bg-card p-2.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md dark:bg-card/80"
    >
      <PersonAvatar person={person} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] font-bold leading-tight">{person.name}</p>
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
// y `sm:flex-row` en tablet/desktop (el abanico clasico de organigrama). Compacto (sexta pasada):
// un solo stem corto cuando no hay pill de grupo, en vez de dos stems + hueco vacio.
function ConnectorRow({ label, children }) {
  const items = Children.toArray(children)
  const count = items.length
  return (
    <div className="flex flex-col items-center">
      {label ? (
        <>
          <div className="h-2 w-px bg-blue-400" />
          <GroupLabel>{label}</GroupLabel>
          <div className="h-2 w-px bg-blue-400" />
        </>
      ) : (
        <div className="h-3 w-px bg-blue-400" />
      )}
      <Dot />
      <div className="relative flex flex-col items-center gap-2.5 sm:flex-row sm:items-start sm:justify-center sm:gap-4">
        {count > 1 && (
          <div
            className="absolute top-0 hidden h-px bg-blue-400 sm:block"
            style={{ left: `${50 / count}%`, right: `${50 / count}%` }}
          />
        )}
        {items.map((child) => (
          <div key={child.key} className="flex flex-col items-center">
            <div className="hidden h-2.5 w-px bg-blue-400 sm:block" />
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}

// Fila de hermanos (2026-09-11, sexta pasada -- corrige bug real de simetria: Cain, con 2 filas
// de 3 tarjetas debajo, y Felipe, sin nada debajo, compartian fila bajo "Production
// Management" -- Felipe quedaba visualmente lejos del centro real porque el centro se calculaba
// sobre el ANCHO TOTAL de la columna de Cain (inflada por sus descendientes), no sobre la
// posicion real de las 2 tarjetas.
//
// Solucion: la fila Cain/Felipe se queda ANGOSTA (solo el ancho de sus propias 2 tarjetas,
// "reducir el ancho total de esa rama" -- pedido explicito del usuario), y a Cain se le calcula
// cuanto hay que desplazar SUS PROPIOS grupos de abajo (Operational Leadership/Area Leaders,
// mas anchos que la fila de arriba) para que quede CENTRADOS bajo su tarjeta especificamente,
// no bajo el centro de toda la fila. `descendantShift` = posicion real de la tarjeta de esta
// persona dentro de su propia fila, menos el centro de esa fila -- 0 cuando la persona es hija
// unica (Juan bajo Oscar) o esta ya centrada, distinto de 0 solo cuando comparte fila con
// alguien mas y tiene descendientes mas anchos que esa fila (el unico caso real hoy: Cain).
//
// Funcion simple (NO componente) a proposito: debe devolver el arreglo de <TreeNode> como hijos
// DIRECTOS de <ConnectorRow>, para que Children.toArray() ahi adentro vea cada hermano por
// separado -- si fuera un componente, ConnectorRow solo veria UN hijo, no los N hermanos reales.
function renderSiblingRow(people, onSelect) {
  const rowW = rowWidth(people.length)
  return people.map((person, index) => {
    const positionInRow = index * (CARD_WIDTH + ROW_GAP) + CARD_WIDTH / 2
    const descendantShift = positionInRow - rowW / 2
    return (
      <TreeNode
        key={person.id}
        person={person}
        onSelect={onSelect}
        descendantShift={descendantShift}
      />
    )
  })
}

// Nodo de arbol recursivo (2026-09-11, cuarta pasada -- corrige bug real: antes "Operational
// Leadership"/"Area Leaders" colgaban del centro de la pagina, no de Cain especificamente):
// cada persona dibuja su propia tarjeta y, si tiene hijos, su propia ConnectorRow debajo,
// DENTRO de su misma columna -- nunca como fila suelta al nivel de la pagina. Cain tiene DOS
// grupos reales (Operational Leadership, Area Leaders), ambos cuelgan de su columna, desplazados
// (ver renderSiblingRow) para quedar centrados bajo SU tarjeta, no bajo el centro de la fila
// Cain/Felipe. Solo desde `sm:` (via variable CSS) -- en mobile todo se apila en columna, sin
// desplazamiento horizontal.
function TreeNode({ person, onSelect, descendantShift = 0 }) {
  const hasChildren = person.children?.length > 0
  const hasSecondGroup = person.secondGroupChildren?.length > 0
  const shiftStyle = descendantShift ? { '--descendant-shift': `${descendantShift}px` } : undefined
  const shiftClass = descendantShift ? 'sm:ml-[var(--descendant-shift)]' : undefined
  return (
    <div className="flex flex-col items-center">
      <PersonNode person={person} onSelect={onSelect} />
      {hasChildren && (
        <div style={shiftStyle} className={shiftClass}>
          <ConnectorRow label={person.groupLabel}>
            {renderSiblingRow(person.children, onSelect)}
          </ConnectorRow>
        </div>
      )}
      {hasSecondGroup && (
        <div style={shiftStyle} className={shiftClass}>
          <ConnectorRow label={person.secondGroupLabel}>
            {renderSiblingRow(person.secondGroupChildren, onSelect)}
          </ConnectorRow>
        </div>
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
      <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
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

      <div className={cn(cardClass, 'overflow-x-auto p-5 sm:p-6')}>
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
