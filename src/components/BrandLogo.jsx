import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

/* ─────────────────────────────────────────────
   Identidad visual general de la plataforma ("Centro de Control" /
   "CONTROL OPERATIVO") -- FUENTE UNICA de branding, a peticion
   explicita del usuario (cambio de marca, 2026-08-29). Reemplaza el
   viejo icono+texto "Centro de Trabajo FFT" que vivia repetido en 4
   lugares (AppLayout.jsx, Sidebar.jsx, LoginPage.jsx,
   CentroTrabajoPage.jsx).

   IMPORTANTE -- esto es SOLO la marca, no el modulo: "Centro de
   Trabajo" sigue siendo el nombre real del modulo/ruta
   /centro-trabajo (Sidebar.jsx NAV_ITEMS, CentroTrabajoPage.jsx), y
   "FFT"/"WC Líneas de producción (FFT)" siguen siendo nombres
   operativos reales del catalogo -- ninguno de los dos se toca aqui.

   2026-09-04 (a peticion explicita del usuario -- "no quiero que
   escribas quiero que uses el logo, en todo: login, barra lateral, en
   la pagina, y arriba en el buscador web"): el icono ya NO es un SVG
   dibujado a mano -- es la imagen real que el usuario genero
   (public/logo-icon.png, recortada 1:1 de
   "ChatGPT Image 3 sept 2026, 23_41_01.png" en sus Downloads, el mismo
   diseño de marco/dashboard/flujo de siempre pero con acabado
   glossy/3D real). El PNG trae su propio fondo navy solido (parte del
   diseño del icono, no transparente) -- se ve igual en claro/oscuro a
   proposito, como cualquier app-icon real. Mismo archivo se usa como
   favicon (index.html) -- unica fuente de verdad de la imagen en toda
   la app, nunca una copia distinta por lugar. El texto (wordmark)
   sigue siendo texto real via i18n, con los tokens de tema de
   siempre -- eso no cambio. */

function BrandIcon({ className, 'aria-hidden': ariaHidden = true, ...rest }) {
  return (
    <img
      src="/logo-icon.png"
      alt=""
      className={cn('shrink-0 rounded-[22%]', className)}
      aria-hidden={ariaHidden}
      {...rest}
    />
  )
}

/* variant:
   - "header": lockup completo (icono + titulo + subtitulo), una linea de
     texto por fila -- usado en el header propio de CentroTrabajoPage.jsx.
   - "header-compact": icono + titulo en una sola linea, sin subtitulo --
     usado en la barra superior global de AppLayout.jsx (min-h-14, sin
     espacio vertical para una segunda linea).
   - "sidebar": icono + titulo en dos lineas ("Centro de"/"Control") +
     subtitulo chico -- usado en SidebarHeader (Sidebar.jsx), pensado para
     el ancho angosto de la sidebar.
   - "login": lockup centrado y mas grande -- usado en LoginPage.jsx.
   - "icon": solo el icono, sin texto -- para contextos futuros donde no
     quepa ni la variante compacta. */
export default function BrandLogo({ variant = 'header', className }) {
  const { t } = useTranslation('common')

  if (variant === 'icon') {
    return (
      <BrandIcon
        className={cn('h-8 w-8', className)}
        aria-hidden={false}
        role="img"
        aria-label={t('brandLogo.brandName')}
      />
    )
  }

  if (variant === 'header-compact') {
    return (
      <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
        <BrandIcon className="h-6 w-6" />
        <p className="truncate text-[15px] font-extrabold tracking-[-0.2px] text-foreground">
          {t('brandLogo.brandName')}
        </p>
      </div>
    )
  }

  if (variant === 'sidebar') {
    return (
      <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
        <BrandIcon className="h-9 w-9" />
        <div className="min-w-0 flex-1 leading-[1.15]">
          <p className="truncate text-[13px] font-extrabold leading-[1.2] text-foreground">
            {t('brandLogo.brandNameLine1')}
          </p>
          <p className="truncate text-[13px] font-extrabold leading-[1.2] text-foreground">
            {t('brandLogo.brandNameLine2')}
          </p>
          <p className="mt-0.5 truncate text-[9px] font-bold tracking-[0.8px] text-muted-foreground">
            {t('brandLogo.subtitle')}
          </p>
        </div>
      </div>
    )
  }

  if (variant === 'login') {
    return (
      <div className={cn('flex flex-col items-center gap-2', className)}>
        <BrandIcon className="h-12 w-12" />
        <div className="text-center">
          <p className="text-[19px] font-extrabold leading-tight text-foreground">
            {t('brandLogo.brandName')}
          </p>
          <p className="mt-0.5 text-[10.5px] font-bold tracking-[1.2px] text-muted-foreground">
            {t('brandLogo.subtitle')}
          </p>
        </div>
      </div>
    )
  }

  // "header" (default)
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <BrandIcon className="h-[30px] w-[30px]" />
      <div className="min-w-0">
        <p className="truncate text-[1.15rem] font-extrabold leading-tight tracking-[-0.4px] text-foreground sm:text-[1.4rem]">
          {t('brandLogo.brandName')}
        </p>
        <p className="mt-0.5 truncate text-[11px] font-bold tracking-[1.2px] text-muted-foreground">
          {t('brandLogo.subtitle')}
        </p>
      </div>
    </div>
  )
}
