import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

/* ─────────────────────────────────────────────
   Identidad visual general de la plataforma ("Centro de Control" /
   "CONTROL OPERATIVO") -- FUENTE UNICA de branding.

   2026-09-04 (a peticion explicita del usuario, logo oficial definitivo --
   "NO reconstruyas el logo utilizando icono+texto HTML... QUIERO UTILIZAR
   LA IMAGEN COMPLETA DEL LOGO TAL CUAL COMO UN SOLO ASSET"): se eliminan
   TODOS los bloques de icono+`<p>texto</p>` por variante que vivian aqui --
   ahora solo hay 2 imagenes reales (public/branding/), nunca texto HTML
   independiente para representar el branding:

   - centro-control-full.png -- lockup COMPLETO (icono + "Centro de
     Control" + "CONTROL OPERATIVO"), recortado tal cual de la imagen
     oficial que proporciono el usuario ("ChatGPT Image 4 sept 2026,
     06_54_32.png", Downloads) -- el texto YA esta dibujado dentro de la
     imagen, nunca se vuelve a escribir aparte. Se usa donde hay espacio
     real: sidebar expandido, login/solicitud de acceso, header propio de
     Centro de Trabajo.
   - centro-control-icon.png -- SOLO el isotipo (circulo), recortado de la
     MISMA imagen oficial (mismo archivo, mismos colores, nunca un dibujo
     aparte). Se usa donde el espacio es angosto -- favicon (index.html) y
     la barra superior global de 56px (AppLayout.jsx): ahi el lockup
     completo se veria ilegible o forzaria a agrandar esa barra, un cambio
     de layout que el usuario no pidio ("NO MODIFIQUES... dashboard" /
     esto es solo branding).

   Ambas imagenes tienen fondo BLANCO real (diseño del usuario: "mi logo
   esta diseñado para fondo claro/blanco... NO le pongas fondo oscuro").
   En modo oscuro se envuelven en una superficie clara FIJA (blanca, nunca
   `dark:` invertida -- ver LogoSurface) para que no queden mal contra el
   fondo oscuro de la app, en vez de reprocesar la imagen o forzarle un
   fondo que no es el suyo (pedido explicito: "mantener el asset...  o una
   superficie clara si el logo fue diseñado para fondo blanco"). En modo
   claro esa superficie es invisible (fondo de la app ya es blanco/casi
   blanco), por eso el estilo solo se aplica con el prefijo `dark:`.

   `alt`/`aria-label` (i18n, brandLogo.brandName) siguen siendo texto real
   -- es metadata de accesibilidad para lectores de pantalla, no
   "representacion visual" del branding, asi que no rompe la regla del
   usuario ("la prohibicion de escribir el logo como texto aplica
   solamente a la representacion visual dentro de la aplicacion"). No
   existe un "sidebar colapsado" (icon-rail persistente) en la arquitectura
   actual del sidebar (Sidebar.jsx: overlay totalmente oculto o totalmente
   visible, nunca un estado intermedio angosto) -- por eso variant="icon"
   queda disponible en la API tal como el usuario pidio
   (<BrandLogo variant="icon" />) para cuando ese estado exista, pero hoy
   no tiene consumidor real; no se inventa una nueva funcionalidad de
   sidebar aqui, esto es solo branding. */

const FULL_LOGO_SRC = '/branding/centro-control-full.png'
const ICON_LOGO_SRC = '/branding/centro-control-icon.png'

// Ancho maximo del logo COMPLETO por contexto -- el alto sale solo del
// aspect-ratio real de la imagen (w-full h-auto + object-contain, nunca
// deformado). Calculado contra el espacio REAL disponible en cada
// contenedor existente (sidebar: 290px de ancho - padding - boton de
// expandir; login: tarjeta de max-w-[400px]; header: fila con mas
// espacio), dentro del rango que pidio el usuario.
const FULL_LOGO_MAX_WIDTH = {
  sidebar: 220,
  login: 320,
  header: 260,
}

// Tamaño del icono aislado por contexto -- header-compact (barra global
// angosta) se mantiene chico como antes; "icon" es el tamaño por defecto
// para cualquier uso futuro.
const ICON_SIZE_CLASS = {
  'header-compact': 'h-7 w-7',
  icon: 'h-8 w-8',
}

function LogoSurface({ className, children }) {
  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center rounded-xl dark:bg-white dark:p-1.5 dark:shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}

/* variant:
   - "header": lockup completo -- usado en el header propio de
     CentroTrabajoPage.jsx.
   - "header-compact": SOLO icono (ver comentario grande arriba) -- usado
     en la barra superior global de AppLayout.jsx.
   - "sidebar": lockup completo -- usado en SidebarHeader (Sidebar.jsx),
     sidebar siempre expandido cuando visible (nunca hay un rail colapsado
     hoy, ver comentario grande arriba).
   - "login": lockup completo, mas grande -- usado en LoginPage.jsx y
     RequestAccessPage.jsx.
   - "icon": SOLO icono -- sin consumidor real hoy, disponible para el
     futuro tal como pidio el usuario. */
export default function BrandLogo({ variant = 'header', className }) {
  const { t } = useTranslation('common')
  const brandName = t('brandLogo.brandName')

  if (variant === 'icon' || variant === 'header-compact') {
    return (
      <LogoSurface className={className}>
        <img
          src={ICON_LOGO_SRC}
          alt={variant === 'icon' ? brandName : ''}
          aria-hidden={variant === 'header-compact'}
          className={cn('shrink-0 object-contain', ICON_SIZE_CLASS[variant])}
        />
      </LogoSurface>
    )
  }

  return (
    <LogoSurface className={className}>
      <img
        src={FULL_LOGO_SRC}
        alt={brandName}
        className="h-auto w-full object-contain"
        style={{ maxWidth: FULL_LOGO_MAX_WIDTH[variant] ?? 260 }}
      />
    </LogoSurface>
  )
}
