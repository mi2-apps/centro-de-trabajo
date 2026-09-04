import { ChevronsLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import BrandLogo from '@/components/BrandLogo'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { listAllModules } from '../../shared/moduleRegistry'
import { useEffectiveModules } from '../state/auth'
import { getModuleIcon, groupModules, iconKeyFor } from './navigationConfig'

// 250-270px (rediseño visual 2026-08-28, "sidebar blanca/azul tipo
// referencia") -- antes 232, sube dentro del rango pedido. Es un overlay de
// posicion fija (nunca reserva espacio en el layout), asi que este cambio
// no mueve ni redimensiona el contenido principal.
// 2026-09-01 (a peticion explicita del usuario, "hazla mas grande"): sube
// de 260 a 290 -- sigue siendo overlay/Sheet de posicion fija, el mismo
// razonamiento de arriba aplica sin cambios.
export const SIDEBAR_WIDTH = 290

// Mismo azul de marca que ya usa toda la app (AppBar/LoginPage/
// CentroTrabajoPage, ver PrecisionManufacturingIcon sx={{ color: '#3B82F6' }}
// en esos archivos) -- una sola constante aqui para no repetir el literal.
const BRAND_BLUE = '#3B82F6'

// El sidebar es solo UX -- la proteccion real esta en el backend
// (requireModuleAccess en cada API), no en que este menu se muestre u oculte.
//
// 2026-09-04 (rediseño de sidebar + agrupacion dinamica, a peticion explicita
// del usuario -- "NO quiero esto hardcodeado en el JSX... NO duplicar
// fuentes de verdad"): el NAV_ITEMS plano que vivia aqui se elimina --
// MODULE_REGISTRY (shared/moduleRegistry.js) YA ERA la fuente real de
// nombre/icono/descripcion/permiso de cada modulo (la usan /api/modules y
// "Gestion de permisos" desde antes); solo le faltaban `group`/`order`/
// `labelKey`/`roles` para tambien poder armar la navegacion, asi que se
// extendio ESE registro en vez de mantener dos listas separadas. La regla de
// visibilidad es EXACTAMENTE la misma que el NAV_ITEMS anterior, solo que
// ahora lee `permissionProtected`/`roles` del registro en vez de
// `configurable`/`roles` locales:
//   - permissionProtected:true  -> visible si allowedModules (permiso real
//     por rol + override individual, useEffectiveModules) incluye la key.
//   - permissionProtected:false -> visible si el rol actual esta en
//     module.roles (fijo, no editable desde "Gestion de permisos" -- Manual
//     de Usuario/Developer Manual/Cambios, igual que siempre).
// listAllModules() ya viene ordenado por insercion en el registro; el ORDEN
// visual real lo decide `order`/`group` de cada modulo (ver navigationConfig.js
// groupModules()), no la posicion en el array.
function useVisibleModules(role) {
  const { modules: allowedModules, loading: permsLoading } = useEffectiveModules()
  const items = listAllModules().filter((m) =>
    m.permissionProtected
      ? // Mientras carga (allowedModules === null) no se oculta nada: evita el
        // parpadeo de "sin modulos" un instante antes de que llegue la respuesta.
        permsLoading || allowedModules === null || allowedModules.includes(m.key)
      : (m.roles || []).includes(role),
  )
  return { items, permsLoading }
}

// Estilo de item de menu (rediseño visual 2026-08-28, referencia "sidebar
// blanca/azul"): sin card/borde individual por item (aire visual, lista
// limpia), activo = fondo azul extremadamente claro + texto/icono azul +
// barra vertical azul de 3px pegada al borde izquierdo (via `before:`, nunca
// un elemento aparte) en vez del bgcolor gris grande de antes; hover = mismo
// azul clarito mas un desplazamiento sutil (2px). Nunca toca rutas/permisos --
// ESTO sigue siendo exactamente el mismo filtro de siempre (ver
// useVisibleModules arriba), solo cambia la presentacion.
//
// 2026-09-04 (rediseño de sidebar, a peticion explicita del usuario): antes
// `items` era una lista plana; ahora recibe `sections` ya agrupadas por
// groupModules() (navigationConfig.js) -- un titulo de grupo (mayusculas,
// pequeño, gris) + los modulos de esa seccion, y una linea muy sutil ANTES
// de cada seccion salvo la primera (nunca antes/despues de todas, para no
// duplicar el borde con el header). Altura de cada item baja de 56px a
// ~46px (44-50px pedido explicitamente) -- unico ajuste de medida, el resto
// del estilo (colores/radius/hover/activo) es literalmente el mismo de
// antes.
//
// 2026-09-04, PQCDSM (mismo dia, a peticion explicita del usuario -- "quiero
// una insignia chica de letra junto al titulo, nada de badges gigantes"):
// `section.badgeClass` (shared/moduleRegistry.js) solo existe para las 6
// familias PQCDSM -- cuando esta presente se muestra una insignia chica
// (la letra del id del grupo, ej. "P") antes del titulo; las secciones de
// soporte (Vision general/Administracion/Recursos/Sistema/Otros) no traen
// badgeClass y se ven exactamente igual que antes de PQCDSM.
function NavList({ sections, onItemClick }) {
  const { t } = useTranslation('navigation')
  return (
    <nav className="flex-1 overflow-y-auto px-2.5 pb-2 pt-2">
      {sections.map((section, sectionIdx) => (
        <div key={section.id}>
          {sectionIdx > 0 && <div className="my-2.5 border-t border-border/60" />}
          <p className="mb-1 flex items-center gap-1.5 px-3.5 text-[11px] font-bold uppercase tracking-[0.03em] text-muted-foreground">
            {section.badgeClass && (
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] text-[10px] font-bold',
                  section.badgeClass,
                )}
              >
                {section.id}
              </span>
            )}
            {t(section.labelKey || section.id, { defaultValue: section.fallbackLabel })}
          </p>
          <div className="space-y-0.5">
            {section.items.map((m) => {
              const Icon = getModuleIcon(iconKeyFor(m))
              return (
                <NavLink
                  key={m.key}
                  to={m.key}
                  end={m.key === '/'}
                  onClick={onItemClick}
                  className={({ isActive }) =>
                    cn(
                      'relative flex min-h-[46px] items-center gap-0 rounded-[11px] px-3.5 py-2.5 text-foreground transition-[background-color,color,transform] duration-[180ms] ease-in-out',
                      'hover:translate-x-[2px] hover:bg-[#EFF6FF] dark:hover:bg-[rgba(59,130,246,.14)]',
                      isActive &&
                        "text-[#3B82F6] bg-[#EFF6FF] dark:bg-[rgba(59,130,246,.18)] before:absolute before:left-1 before:top-[22%] before:bottom-[22%] before:w-[3px] before:rounded before:bg-[#3B82F6] before:content-['']",
                    )
                  }
                >
                  <span className="flex min-w-[34px] items-center text-inherit">
                    <Icon size={21} />
                  </span>
                  <span className="text-[14.5px] font-semibold text-inherit">
                    {t(m.labelKey || m.key, { defaultValue: m.name })}
                  </span>
                </NavLink>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

// Encabezado (2026-08-29, cambio de branding a peticion explicita del
// usuario): la marca general "Centro de Control" / "CONTROL OPERATIVO"
// reemplaza el icono+texto "CENTRO DE TRABAJO FFT" que vivia aqui -- ver
// src/components/BrandLogo.jsx, fuente unica del branding (variant="sidebar",
// pensada para el ancho angosto de esta columna). `onToggle` es exactamente
// el mismo handler que antes (onTogglePin): el boton solo cambia de icono
// (pin -> chevron) y de estilo, el comportamiento de fijar/soltar el menu
// abierto NO cambia.
function SidebarHeader({ onToggle, toggleTitle, pinned }) {
  return (
    // 2026-09-04, logo con asset real por tema (a peticion explicita del
    // usuario -- "quiero utilizar DOS ARCHIVOS REALES, NO filtros CSS"):
    // el parche anterior (pintar TODA esta franja de blanco en modo
    // oscuro porque el unico logo disponible estaba diseñado para fondo
    // blanco) ya no hace falta -- BrandLogo.jsx ahora renderiza el asset
    // dark oficial (fondo transparente real) directo sobre el fondo
    // normal del sidebar (`bg-card`, igual que el boton de al lado, que
    // ya estaba diseñado para este mismo fondo). Header sin superficie
    // especial en ningun tema.
    <div className="flex min-h-16 items-center gap-2.5 border-b border-border px-3.5 py-3.5">
      <BrandLogo variant="sidebar" className="flex-1" />
      {onToggle && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggle}
              className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-[rgba(59,130,246,.18)] bg-card transition-colors duration-[180ms] ease-in-out hover:bg-[#EFF6FF] dark:border-[rgba(59,130,246,.35)] dark:hover:bg-[rgba(59,130,246,.16)]"
            >
              <ChevronsLeft
                size={20}
                className="transition-transform duration-[220ms] ease-in-out"
                style={{ color: BRAND_BLUE, transform: pinned ? 'none' : 'rotate(180deg)' }}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent>{toggleTitle}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

/* Sidebar con dos modos completamente distintos, elegidos por
   AppLayout segun capacidad de puntero real del dispositivo
   (no por ancho de pantalla):

   - variant="overlay" (desktop/laptop con mouse real, hover:hover):
     panel flotante de posicion fija que aparece/desaparece por
     hover — nunca reserva espacio en el layout, por eso el
     contenido principal siempre usa el 100% del ancho disponible.
     AppLayout controla open/close (hotspot + temporizador); aqui
     solo se reenvian los mouse handlers para que entrar al propio
     sidebar cancele el cierre programado.

   - variant="temporary" (touch / sin hover fino — tablet y movil):
     Sheet (shadcn/Radix Dialog) con backdrop y cierre al seleccionar
     o hacer click afuera -- reemplaza al Drawer de MUI, mismo
     comportamiento (abre/cierra por `open`/`onClose`, sin boton de
     hamburguesa propio: eso lo sigue disparando AppLayout).

   Login/logout/roles/ProtectedRoute no se tocan: es solo
   presentacion de la misma lista de rutas de siempre. */
export default function Sidebar({
  role,
  open,
  onClose,
  variant,
  pinned,
  onTogglePin,
  onMouseEnter,
  onMouseLeave,
  // 2026-09-01 (a peticion explicita del usuario, "le falta un poco mas
  // para arriba"): antes el overlay usaba top-14 (56px) fijo SIN IMPORTAR
  // la ruta -- en /centro-trabajo (unica ruta sin la barra superior
  // global, ver AppLayout.jsx isWideLayoutRoute) eso dejaba un hueco vacio
  // de 56px arriba del panel, porque no hay header con el que alinearse.
  // AppLayout ya resolvia esto mismo para el hotspot invisible
  // (`top: isWideLayoutRoute ? 0 : 56`); el sidebar real nunca lo recibia.
  // 2026-09-01 (segundo cambio, mismo dia, a peticion explicita del
  // usuario): AppLayout ahora SIEMPRE pasa topOffset={0} -- el gap de 56px
  // que quedaba en el resto de rutas (con barra superior global) no se
  // queria ni ahi. El default de aqui abajo solo es un respaldo si algun
  // consumidor futuro no pasa la prop.
  topOffset = 0,
}) {
  // Misma lista de modulos permitidos para CUALQUIER dispositivo (desktop,
  // tablet, movil) -- solo cambia el contenedor visual (overlay vs Sheet,
  // ver variant mas abajo), nunca el contenido. Bug critico corregido
  // 2026-08-25: antes existia un TOUCH_NAV_ORDER hardcodeado que en touch
  // descartaba el calculo real de permisos y dejaba ver solo 2 rutas fijas
  // sin importar el rol -- eso rompia tablet incluso para ADMINISTRADOR.
  //
  // Pipeline real (2026-09-04, a peticion explicita del usuario -- "usuario
  // -> permisos -> modulos visibles -> categorias -> sidebar, NUNCA al
  // reves"): useVisibleModules() filtra por permiso PRIMERO (arriba en este
  // archivo), groupModules() agrupa DESPUES (navigationConfig.js) -- nunca
  // se agrupa el catalogo completo para luego ocultar categorias.
  const { items } = useVisibleModules(role)
  const sections = groupModules(items)

  if (variant === 'overlay') {
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: mismo hotspot de AppLayout.jsx, solo cancela/programa el auto-cierre por hover
      <div
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="fixed bottom-0 left-0 z-[1202] flex flex-col border-r border-border bg-card transition-[transform,box-shadow] duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          top: topOffset,
          width: SIDEBAR_WIDTH,
          transform: open || pinned ? 'translateX(0)' : 'translateX(-100%)',
          boxShadow: open || pinned ? '4px 0 20px rgba(15,23,42,0.08)' : 'none',
        }}
      >
        <SidebarHeader
          onToggle={onTogglePin}
          toggleTitle={pinned ? 'Dejar de fijar' : 'Fijar menú abierto'}
          pinned={pinned}
        />
        <NavList sections={sections} />
      </div>
    )
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="left" style={{ width: SIDEBAR_WIDTH }} className="flex flex-col">
        <SidebarHeader />
        <NavList sections={sections} onItemClick={onClose} />
      </SheetContent>
    </Sheet>
  )
}
