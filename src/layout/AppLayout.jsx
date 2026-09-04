import { Menu as MenuIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { setCurrentUserId } from '../data/personnel/apiSync'
import { useAuth } from '../state/auth'
import { useIsTouchDevice } from '../ui/useIsTouchDevice'
import HeaderUserActions from './HeaderUserActions'
import Sidebar from './Sidebar'

const CLOSE_DELAY_MS = 320
const HOTSPOT_WIDTH = 14

export default function AppLayout({ mode, setMode }) {
  const { user } = useAuth()
  const location = useLocation()
  // Solo controla si la ruta construye su PROPIO header (ver el bloque
  // `!hasOwnHeader &&` mas abajo) -- Centro de Trabajo es la unica pagina
  // que arma su propio logo+titulo+acciones+tabs (CentroTrabajoPage.jsx),
  // asi que sigue ocultando la barra superior global. Esto es independiente
  // del ancho del contenido (ver `max-w` mas abajo).
  const hasOwnHeader = location.pathname === '/centro-trabajo'
  // Puntero real del dispositivo, no ancho de pantalla: un mouse/trackpad
  // real habilita el auto-hide por hover; touch (tablet/movil) usa el
  // Sheet clasico con hamburguesa, sin depender de hover.
  const isTouch = useIsTouchDevice()
  const hasFineHover = !isTouch

  // Una vez adentro de la app (login ya quedo en vertical, ver
  // LoginPage), en touch se intenta fijar horizontal — es la
  // orientacion pensada para tablet en piso. "Best effort": la
  // Screen Orientation API solo permite lock() en pantalla completa o
  // dentro de una PWA instalada (Chrome/Android); Safari/iOS no la
  // implementa en absoluto. Si falla o no existe, no rompe nada, el
  // layout responsive sigue funcionando igual en cualquier orientacion.
  useEffect(() => {
    if (!isTouch) return
    const orientation = window.screen?.orientation
    if (!orientation?.lock) return
    orientation.lock('landscape').catch(() => {})
  }, [isTouch])

  const [mobileOpen, setMobileOpen] = useState(false)
  const [hoverOpen, setHoverOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const closeTimer = useRef(null)

  function clearCloseTimer() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }
  function openOnHover() {
    clearCloseTimer()
    setHoverOpen(true)
  }
  function scheduleClose() {
    clearCloseTimer()
    closeTimer.current = setTimeout(() => setHoverOpen(false), CLOSE_DELAY_MS)
  }

  // apiSync.js necesita saber a quien avisarle cuando SU solicitud se resuelve (ver Cambio 4,
  // pollOnce) -- se fija aqui porque este es el componente que ya consume la sesion real.
  useEffect(() => {
    setCurrentUserId(user?.id || null)
  }, [user?.id])

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      {/* 2026-08-27 ("rediseño del header de Centro de Trabajo", a peticion
          explicita del usuario): la barra superior global se OCULTA
          unicamente en /centro-trabajo -- esa pagina construye su propio
          header (logo+titulo+acciones+tabs, ver CentroTrabajoPage.jsx)
          reutilizando exactamente los mismos datos/handlers via
          <Outlet context={...}> mas abajo, en vez de duplicar la barra.
          El resto de rutas (Dashboard, Registro de personal, Usuarios)
          conserva la barra superior tal cual, sin ningun cambio. */}
      {!hasOwnHeader && (
        <header className="sticky top-0 z-[1100] border-b border-border bg-card text-foreground">
          <div className="flex min-h-14 items-center gap-2.5 px-3 md:px-5">
            {!hasFineHover && (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-full p-1.5 hover:bg-accent"
              >
                <MenuIcon size={20} />
              </button>
            )}
            {/* 2026-09-04 (a peticion explicita del usuario, viendo esta barra en
                vivo -- "quitame el logo de ahi, esta a la izquierda"): esta barra
                global ya no muestra ningun logo -- el sidebar (siempre visible al
                fijarlo/pasar el mouse) ya trae el logo completo, mostrarlo tambien
                aqui era redundante. */}
            <div className="flex-1" />
            <HeaderUserActions mode={mode} setMode={setMode} />
          </div>
        </header>
      )}

      {hasFineHover && (
        // Hotspot invisible: entrar aqui abre el sidebar. Una vez abierto,
        // el propio sidebar (mas ancho, mismo left:0) lo cubre por completo,
        // asi que el mouse nunca "pierde" cobertura entre los dos elementos.
        // 2026-09-01 (a peticion explicita del usuario, "no quiero el gap
        // que tiene hoy" en las rutas con barra superior global): top:0
        // SIEMPRE, no solo en /centro-trabajo -- antes era top:56 en el
        // resto de rutas para "empezar debajo" del header, pero eso dejaba
        // el sidebar mas corto (con un hueco arriba) que en /centro-trabajo.
        // El sidebar (z-[1202]) ya cubre visualmente el header (z-[1100])
        // cuando esta abierto, asi que llegar hasta arriba en todas las
        // rutas es seguro y consistente con /centro-trabajo.
        // biome-ignore lint/a11y/noStaticElementInteractions: zona de deteccion de mouse, el hamburguesa+Sheet cubre teclado/touch sin depender de este div
        <div
          onMouseEnter={openOnHover}
          className="fixed bottom-0 left-0 z-[1201]"
          style={{ top: 0, width: HOTSPOT_WIDTH }}
        />
      )}

      <Sidebar
        role={user?.role}
        open={hasFineHover ? hoverOpen : mobileOpen}
        onClose={() => setMobileOpen(false)}
        variant={hasFineHover ? 'overlay' : 'temporary'}
        pinned={pinned}
        onTogglePin={() => setPinned((p) => !p)}
        onMouseEnter={hasFineHover ? openOnHover : undefined}
        onMouseLeave={hasFineHover ? scheduleClose : undefined}
        // Mismo razonamiento que el hotspot de arriba: siempre hasta arriba,
        // en todas las rutas (antes solo en /centro-trabajo).
        topOffset={0}
      />

      {/* max-w-[1920px] (2026-09-02, a peticion explicita del usuario: "que
          [el ancho de pantalla completo de Centro de Trabajo] tambien sea
          igual en los demas modulos y en todos los modulos que haga") --
          UNIFICADO para TODAS las rutas, ya no solo /centro-trabajo (antes
          era max-w-[1600px] para el resto). Al vivir aqui en AppLayout en
          vez de en cada pagina, cualquier modulo nuevo que se agregue
          despues hereda el mismo ancho automaticamente, sin tocar nada por
          pagina. */}
      <div className="mx-auto w-full max-w-[1920px] px-3 py-4 sm:px-4 md:px-4 md:py-5">
        {/* mode/setMode + apertura del sidebar movil: SOLO los consume
            CentroTrabajoPage.jsx (via useOutletContext) para construir su
            propio header cuando la barra superior global esta oculta arriba
            -- el resto de paginas no llama useOutletContext, no les afecta. */}
        <Outlet
          context={{
            mode,
            setMode,
            onOpenMobileSidebar: () => setMobileOpen(true),
            showMobileMenuButton: !hasFineHover,
          }}
        />
      </div>
    </div>
  )
}
