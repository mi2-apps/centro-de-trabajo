import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

/* ─────────────────────────────────────────────
   Identidad visual general de la plataforma ("Centro de Control" /
   "CONTROL OPERATIVO") -- FUENTE UNICA de branding.

   2026-09-04 (a peticion explicita del usuario, logo oficial definitivo --
   "NO reconstruyas el logo utilizando icono+texto HTML... QUIERO UTILIZAR
   LA IMAGEN COMPLETA DEL LOGO TAL CUAL COMO UN SOLO ASSET"): nunca texto
   HTML independiente para representar el branding, siempre imagenes reales
   (public/branding/) -- el texto YA esta dibujado dentro de cada imagen.

   2026-09-04, MISMO DIA, tercera correccion (a peticion explicita del
   usuario, con los 2 assets oficiales de dark mode ya provistos --
   "quiero utilizar DOS ARCHIVOS REALES... NO filter/invert/brightness...
   NO recrear el logo con HTML/texto"): el intento anterior (una placa
   clara de fondo detras del MISMO logo diseñado para fondo blanco) se
   reemplaza por 4 assets reales, 2 por tema:
   - centro-control-full.png / centro-control-icon.png -- version LIGHT
     oficial (sin cambios, siguen siendo las mismas imagenes de siempre).
   - centro-control-full-dark.png / centro-control-icon-dark.png --
     version DARK oficial (fondo real transparente, preparada a partir de
     la imagen que proporciono el usuario -- traia un fondo navy solido
     horneado en el PNG, se le quito ese fondo para dejar un asset
     transparente real, mismo criterio con que ya se recorto el icono
     actual de la imagen oficial, NUNCA un filtro CSS).
   Cada variante renderiza AMBAS imagenes (light + dark) superpuestas,
   mostrando/ocultando cada una con las mismas clases `dark:` de Tailwind
   que ya usa toda la app (`dark:hidden` / `hidden dark:block`) -- el
   cambio de tema (App.jsx, `document.documentElement.classList.toggle
   ('dark', ...)`, unica fuente de tema, no next-themes) ya dispara este
   toggle solo, sin JS adicional aqui y sin esperar un reload. En modo
   claro el comportamiento/tamaño/posicion es EXACTAMENTE el de antes
   (mismo `FULL_LOGO_MAX_WIDTH` por variante, mismo `object-contain`) --
   la unica superficie con fondo propio que sobrevive es "login"/"header"
   en modo claro (el logo light SIGUE diseñado para fondo blanco ahi), sin
   ningun tratamiento nuevo en modo oscuro (el logo dark ya trae su propio
   fondo transparente, no necesita placa).

   `alt`/`aria-label` (i18n, brandLogo.brandName) siguen siendo texto real
   -- es metadata de accesibilidad para lectores de pantalla, no
   "representacion visual" del branding. */

const FULL_LOGO_SRC = {
  light: '/branding/centro-control-full.png',
  dark: '/branding/centro-control-full-dark.png',
}
const ICON_LOGO_SRC = {
  light: '/branding/centro-control-icon.png',
  dark: '/branding/centro-control-icon-dark.png',
}

// Ancho maximo del logo COMPLETO por contexto -- el alto sale solo del
// aspect-ratio real de la imagen (w-full h-auto + object-contain, nunca
// deformado). Ambos temas comparten el mismo maxWidth por variante --
// los 2 assets (light/dark) tienen un aspect-ratio casi identico, asi que
// el alto real no salta de forma perceptible al cambiar de tema.
const FULL_LOGO_MAX_WIDTH = {
  sidebar: 220,
  login: 320,
  header: 260,
}

// Un <img> por tema, mostrado/ocultado con `dark:` -- nunca los dos
// montados con opacity/filter, siempre "cual de los dos existe en el DOM
// visible" (mismo patron de toggle que el resto de la app).
function ThemedImg({ srcByTheme, alt, className, style }) {
  return (
    <>
      <img
        src={srcByTheme.light}
        alt={alt}
        className={cn(className, 'dark:hidden')}
        style={style}
      />
      <img
        src={srcByTheme.dark}
        alt={alt}
        className={cn(className, 'hidden dark:block')}
        style={style}
      />
    </>
  )
}

export default function BrandLogo({ variant = 'header', className }) {
  const { t } = useTranslation('common')
  const brandName = t('brandLogo.brandName')

  if (variant === 'icon') {
    return (
      <div className={cn('inline-flex items-center rounded-lg', className)}>
        <ThemedImg
          srcByTheme={ICON_LOGO_SRC}
          alt={brandName}
          className="h-8 w-8 shrink-0 object-contain"
        />
      </div>
    )
  }

  // "sidebar": sin superficie propia en ningun tema -- el asset dark ya
  // trae su propio fondo transparente, no hace falta ninguna placa detras.
  if (variant === 'sidebar') {
    return (
      <ThemedImg
        srcByTheme={FULL_LOGO_SRC}
        alt={brandName}
        className={cn('h-auto w-full object-contain', className)}
        style={{ maxWidth: FULL_LOGO_MAX_WIDTH.sidebar }}
      />
    )
  }

  // "login" / "header": SIN superficie propia en ningun tema -- en modo
  // claro exactamente igual que siempre (el logo light ya se ve bien
  // directo sobre el fondo de la app, sin caja); en modo oscuro el asset
  // dark ya es transparente, tampoco necesita ninguna.
  return (
    <div className={cn('inline-flex max-w-full items-center rounded-2xl', className)}>
      <ThemedImg
        srcByTheme={FULL_LOGO_SRC}
        alt={brandName}
        className="h-auto w-full object-contain"
        style={{ maxWidth: FULL_LOGO_MAX_WIDTH[variant] ?? 260 }}
      />
    </div>
  )
}
