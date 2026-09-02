import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { TooltipProvider } from './components/ui/tooltip'
import AppLayout from './layout/AppLayout'
import AsistenciaPage from './pages/asistencia/AsistenciaPage'
import AuditoriaPage from './pages/auditoria/AuditoriaPage'
import ChangePasswordPage from './pages/auth/ChangePasswordPage'
import LoginPage from './pages/auth/LoginPage'
import RequestAccessPage from './pages/auth/RequestAccessPage'
import CentroTrabajoPage from './pages/centro-trabajo/CentroTrabajoPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import ChangelogPage from './pages/docs/ChangelogPage'
import DeveloperManualPage from './pages/docs/DeveloperManualPage'
import UserManualPage from './pages/docs/UserManualPage'
import EvaluacionesPage from './pages/evaluaciones/EvaluacionesPage'
import KpisPage from './pages/kpis/KpisPage'
import ProduccionFftPage from './pages/produccion-fft/ProduccionFftPage'
import RegistroPersonalPage from './pages/registro-personal/RegistroPersonalPage'
import UsuariosPage from './pages/usuarios/UsuariosPage'
import DefaultRedirect from './routing/DefaultRedirect'
import ProtectedRoute from './routing/ProtectedRoute'
import RequireModuleAccess from './routing/RequireModuleAccess'
import { AuthProvider } from './state/auth'
import { DndAssignProvider } from './state/dndAssign'
import { RoleModeProvider } from './state/roleMode'
import ToastHost from './ui/ToastHost'

export default function App() {
  const [mode, setMode] = useState('light')

  // Fase 6 (MI Stack Reference, cierre): unica fuente de modo claro/oscuro --
  // ya no convive con el ThemeProvider de MUI (removido, ver CHANGELOG),
  // solo controla la clase `dark` que usan las clases Tailwind `dark:` en
  // toda la app.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark')
  }, [mode])

  return (
    <TooltipProvider delayDuration={200}>
      <AuthProvider>
        <RoleModeProvider>
          <DndAssignProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/solicitar-acceso" element={<RequestAccessPage />} />

              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout mode={mode} setMode={setMode} />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DefaultRedirect />} />
                <Route
                  path="/dashboard"
                  element={
                    <RequireModuleAccess>
                      <DashboardPage />
                    </RequireModuleAccess>
                  }
                />
                <Route
                  path="/centro-trabajo"
                  element={
                    <RequireModuleAccess>
                      <CentroTrabajoPage />
                    </RequireModuleAccess>
                  }
                />
                <Route
                  path="/produccion-fft"
                  element={
                    <RequireModuleAccess>
                      <ProduccionFftPage />
                    </RequireModuleAccess>
                  }
                />
                <Route
                  path="/registro-personal"
                  element={
                    <RequireModuleAccess>
                      <RegistroPersonalPage />
                    </RequireModuleAccess>
                  }
                />
                <Route
                  path="/usuarios"
                  element={
                    <RequireModuleAccess>
                      <UsuariosPage />
                    </RequireModuleAccess>
                  }
                />
                <Route
                  path="/kpis"
                  element={
                    <RequireModuleAccess>
                      <KpisPage />
                    </RequireModuleAccess>
                  }
                />
                <Route
                  path="/asistencia"
                  element={
                    <RequireModuleAccess>
                      <AsistenciaPage />
                    </RequireModuleAccess>
                  }
                />
                <Route
                  path="/auditoria"
                  element={
                    <RequireModuleAccess>
                      <AuditoriaPage />
                    </RequireModuleAccess>
                  }
                />
                <Route
                  path="/evaluaciones"
                  element={
                    <RequireModuleAccess>
                      <EvaluacionesPage />
                    </RequireModuleAccess>
                  }
                />

                {/* Documentación (MI Stack Reference, secciones 14d/17a) -- accesible a
                  cualquier usuario autenticado, sin gate por módulo (no son una
                  funcionalidad de negocio, son ayuda/referencia). Developer Manual
                  es la única excepción: contenido técnico (esquema de BD,
                  arquitectura interna) sin utilidad para personal de piso, restringido
                  a ADMINISTRADOR por rol (no por módulo) -- decisión explícita del
                  usuario, 2026-08-30. */}
                <Route
                  path="/developer-manual"
                  element={
                    <ProtectedRoute roles={['ADMINISTRADOR']}>
                      <DeveloperManualPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/manual" element={<UserManualPage />} />
                <Route path="/changelog" element={<ChangelogPage />} />
              </Route>

              {/* Fuera del AppLayout (sin sidebar) pero igual protegida: se usa antes de que el
                usuario pueda ver el resto del sistema cuando mustChangePassword = true. */}
              <Route
                path="/cambiar-contrasena"
                element={
                  <ProtectedRoute>
                    <ChangePasswordPage />
                  </ProtectedRoute>
                }
              />
            </Routes>
            <ToastHost />
          </DndAssignProvider>
        </RoleModeProvider>
      </AuthProvider>
    </TooltipProvider>
  )
}
