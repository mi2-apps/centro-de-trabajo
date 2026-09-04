import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

/* ─────────────────────────────────────────────
   Identidad visual general de la plataforma ("Centro de Control" /
   "CONTROL OPERATIVO") -- FUENTE UNICA de branding.

   2026-09-04 (a peticion explicita del usuario, logo oficial definitivo --
   "NO reconstruyas el logo utilizando icono+texto HTML... QUIERO UTILIZAR
   LA IMAGEN COMPLETA DEL LOGO TAL CUAL COMO UN SOLO ASSET"): solo hay 2
   imagenes reales (public/branding/), nunca texto HTML independiente para
   representar el branding:

   - centro-control-full.png -- lockup COMPLETO (icono + "Centro de
     Control" + "CONTROL OPERATIVO"), recortado tal cual de la imagen
     oficial que proporciono el usuario -- el texto YA esta dibujado
     dentro de la imagen, nunca se vuelve a escribir aparte. Se usa donde
     hay espacio real: sidebar expandido, login/solicitud de acceso,
     header propio de Centro de Trabajo.
   - centro-control-icon.png -- SOLO el isotipo, recortado de la MISMA
     imagen oficial. Queda disponible para variant="icon" (sin consumidor
     real hoy -- el sidebar actual no tiene un estado colapsado
     persistente, no se inventa uno) y es el favicon (index.html).

   2026-09-04, MISMO DIA, segunda correccion (a peticion explicita del
   usuario, viendo el resultado en vivo):
   1) "quitame el logo de ahi, esta a la izquierda" -- la barra superior
      global (AppLayout.jsx) YA NO muestra ningun logo (el sidebar, que
      siempre esta visible al fijarlo/pasar el mouse, ya trae el logo
      completo -- mostrarlo tambien ahi era redundante). Variant
      "header-compact" se elimina por completo, ya sin consumidor.
   2) "el logo se ve bien en modo claro... en modo oscuro se ve mal, haz
      que se vea bien, en modo claro ya dejalo tal cual" -- el intento
      anterior (una caja blanca CIÑIDA solo a la imagen, con sombra)
      se veia como un sticker mal pegado sobre el sidebar oscuro. Ahora:
      - "sidebar": esta funcion YA NO pone ningun fondo -- Sidebar.jsx
        pinta la FRANJA COMPLETA del header (logo + boton de expandir) de
        blanco en modo oscuro, para que se vea como una barra superior
        con marca propia a proposito, nunca un recorte suelto.
      - "login"/"header": se conserva una superficie clara, pero mas
        generosa (mas padding, sin sombra) para que se lea como una placa
        de marca intencional, no como una caja ajustada de mas.
      - "icon": placa clara chica, mismo criterio, para cuando se use.
      En modo claro NINGUNA de estas superficies es visible (fondo de la
      app ya es blanco/casi blanco) -- todo el estilo usa el prefijo
      `dark:`, nunca se toca el aspecto en modo claro.

   `alt`/`aria-label` (i18n, brandLogo.brandName) siguen siendo texto real
   -- es metadata de accesibilidad para lectores de pantalla, no
   "representacion visual" del branding. */

const FULL_LOGO_SRC = '/branding/centro-control-full.png'
const ICON_LOGO_SRC = '/branding/centro-control-icon.png'

// Ancho maximo del logo COMPLETO por contexto -- el alto sale solo del
// aspect-ratio real de la imagen (w-full h-auto + object-contain, nunca
// deformado).
const FULL_LOGO_MAX_WIDTH = {
  sidebar: 220,
  login: 320,
  header: 260,
}

export default function BrandLogo({ variant = 'header', className }) {
  const { t } = useTranslation('common')
  const brandName = t('brandLogo.brandName')

  if (variant === 'icon') {
    return (
      <div
        className={cn(
          'inline-flex items-center rounded-lg dark:bg-white dark:p-1',
          className,
        )}
      >
        <img src={ICON_LOGO_SRC} alt={brandName} className="h-8 w-8 shrink-0 object-contain" />
      </div>
    )
  }

  // "sidebar": SIN superficie propia -- Sidebar.jsx pinta la franja
  // completa del header en modo oscuro (ver comentario grande arriba).
  if (variant === 'sidebar') {
    return (
      <img
        src={FULL_LOGO_SRC}
        alt={brandName}
        className={cn('h-auto w-full object-contain', className)}
        style={{ maxWidth: FULL_LOGO_MAX_WIDTH.sidebar }}
      />
    )
  }

  // "login" / "header": placa clara generosa (solo modo oscuro).
  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center rounded-2xl dark:bg-white dark:px-4 dark:py-3',
        className,
      )}
    >
      <img
        src={FULL_LOGO_SRC}
        alt={brandName}
        className="h-auto w-full object-contain"
        style={{ maxWidth: FULL_LOGO_MAX_WIDTH[variant] ?? 260 }}
      />
    </div>
  )
}
