// Montaje de rutas /api compartido entre dev-server.js (desarrollo local) y
// prod-server.js (Coolify) -- una sola fuente de verdad para que ambos
// entornos expongan exactamente los mismos endpoints con la misma logica,
// nunca dos copias que se puedan desincronizar. En Vercel real, cada archivo
// de /api se despliega como su propia Serverless Function con este mismo
// codigo (sin pasar por Express en absoluto).

import accessRequestDecideHandler from '../api/access-requests/[id]/decide.js'
import accessRequestsIndexHandler from '../api/access-requests/index.js'
import changePasswordHandler from '../api/auth/change-password.js'
import loginHandler from '../api/auth/login.js'
import logoutHandler from '../api/auth/logout.js'
import oidcCallbackHandler from '../api/auth/oidc/callback.js'
import oidcPendingHandler from '../api/auth/oidc/pending.js'
import oidcRequestAccessHandler from '../api/auth/oidc/request-access.js'
import oidcStartHandler from '../api/auth/oidc/start.js'
import oidcStatusHandler from '../api/auth/oidc/status.js'
import sessionHandler from '../api/auth/session.js'
import dashboardTrendsHandler from '../api/dashboard/trends.js'
import evaluacionesIndexHandler from '../api/evaluaciones/index.js'
import modulesIndexHandler from '../api/modules/index.js'
import moduleEffectiveUsersHandler from '../api/permissions/modules/[moduleKey]/users.js'
import personnelApproveMoveHandler from '../api/personnel/approve-move.js'
import personnelAreaHistoryHandler from '../api/personnel/area-history.js'
import personnelCheckinHandler from '../api/personnel/checkin.js'
import personnelEmployeesHandler from '../api/personnel/employees.js'
import personnelMoveHandler from '../api/personnel/move.js'
import personnelMovementsTodayHandler from '../api/personnel/movements-today.js'
import personnelRejectMoveHandler from '../api/personnel/reject-move.js'
import personnelReleaseHandler from '../api/personnel/release.js'
import personnelRequestMoveHandler from '../api/personnel/request-move.js'
import personnelRestoreBaselineHandler from '../api/personnel/restore-baseline.js'
import personnelRosterHandler from '../api/personnel/roster.js'
import personnelSetUnassignedReasonHandler from '../api/personnel/set-unassigned-reason.js'
import personnelSuppressBaselineHandler from '../api/personnel/suppress-baseline.js'
import personnelSwapHandler from '../api/personnel/swap.js'
import productionFftSummaryHandler from '../api/production/fft-summary.js'
import productionTaktRealHandler from '../api/production/takt-real.js'
import rolePermissionByRoleHandler from '../api/role-permissions/[role].js'
import rolePermissionsIndexHandler from '../api/role-permissions/index.js'
import userDeactivateHandler from '../api/users/[id]/deactivate.js'
import userPermissionByModuleHandler from '../api/users/[id]/permissions/[moduleKey].js'
import userPermissionsIndexHandler from '../api/users/[id]/permissions/index.js'
import userResetPasswordHandler from '../api/users/[id]/reset-password.js'
import userByIdHandler from '../api/users/[id].js'
import usersIndexHandler from '../api/users/index.js'
import workAreaWorkstationByIdHandler from '../api/work-areas/[code]/workstations/[id].js'
import workAreaWorkstationsIndexHandler from '../api/work-areas/[code]/workstations/index.js'
import workAreaWorkstationsReorderHandler from '../api/work-areas/[code]/workstations/reorder.js'

// Vercel inyecta los segmentos dinamicos de ruta ([id]) dentro de req.query. Express 5 expone
// req.query como getter (sin setter, reparsea desde la URL en cada acceso), asi que no se puede
// copiar req.params ahi como en Express 4 — cada handler de ruta dinamica lee
// `req.query.id ?? req.params?.id` para funcionar igual en ambos entornos.
function withDynamicParams(handler) {
  return wrapAsync(handler)
}

function wrapAsync(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res)).catch(next)
}

export function mountApiRoutes(app) {
  app.post('/api/auth/login', wrapAsync(loginHandler))
  app.post('/api/auth/logout', wrapAsync(logoutHandler))
  app.get('/api/auth/session', wrapAsync(sessionHandler))
  app.post('/api/auth/change-password', wrapAsync(changePasswordHandler))
  app.get('/api/auth/oidc/start', wrapAsync(oidcStartHandler))
  app.get('/api/auth/oidc/callback', wrapAsync(oidcCallbackHandler))
  app.get('/api/auth/oidc/status', wrapAsync(oidcStatusHandler))
  app.get('/api/auth/oidc/pending', wrapAsync(oidcPendingHandler))
  app.post('/api/auth/oidc/request-access', wrapAsync(oidcRequestAccessHandler))

  app.get('/api/access-requests', wrapAsync(accessRequestsIndexHandler))
  app.post('/api/access-requests/:id/decide', withDynamicParams(accessRequestDecideHandler))

  app.get('/api/users', wrapAsync(usersIndexHandler))
  app.post('/api/users', wrapAsync(usersIndexHandler))
  app.patch('/api/users/:id', withDynamicParams(userByIdHandler))
  app.post('/api/users/:id/deactivate', withDynamicParams(userDeactivateHandler))
  app.post('/api/users/:id/reset-password', withDynamicParams(userResetPasswordHandler))
  app.get('/api/users/:id/permissions', withDynamicParams(userPermissionsIndexHandler))
  app.patch(
    '/api/users/:id/permissions/:moduleKey',
    withDynamicParams(userPermissionByModuleHandler),
  )

  app.get('/api/modules', wrapAsync(modulesIndexHandler))
  app.get('/api/role-permissions', wrapAsync(rolePermissionsIndexHandler))
  app.patch('/api/role-permissions/:role', withDynamicParams(rolePermissionByRoleHandler))
  app.get(
    '/api/permissions/modules/:moduleKey/users',
    withDynamicParams(moduleEffectiveUsersHandler),
  )

  app.get('/api/personnel/employees', wrapAsync(personnelEmployeesHandler))
  app.get('/api/personnel/roster', wrapAsync(personnelRosterHandler))
  app.post('/api/personnel/checkin', wrapAsync(personnelCheckinHandler))
  app.post('/api/personnel/move', wrapAsync(personnelMoveHandler))
  app.post('/api/personnel/swap', wrapAsync(personnelSwapHandler))
  app.post('/api/personnel/release', wrapAsync(personnelReleaseHandler))
  app.post('/api/personnel/request-move', wrapAsync(personnelRequestMoveHandler))
  app.post('/api/personnel/approve-move', wrapAsync(personnelApproveMoveHandler))
  app.post('/api/personnel/reject-move', wrapAsync(personnelRejectMoveHandler))
  app.post('/api/personnel/suppress-baseline', wrapAsync(personnelSuppressBaselineHandler))
  app.post('/api/personnel/set-unassigned-reason', wrapAsync(personnelSetUnassignedReasonHandler))
  app.post('/api/personnel/restore-baseline', wrapAsync(personnelRestoreBaselineHandler))
  app.get('/api/personnel/area-history', wrapAsync(personnelAreaHistoryHandler))
  app.get('/api/personnel/movements-today', wrapAsync(personnelMovementsTodayHandler))
  app.get('/api/production/takt-real', wrapAsync(productionTaktRealHandler))
  app.get('/api/production/fft-summary', wrapAsync(productionFftSummaryHandler))

  app.get('/api/dashboard/trends', wrapAsync(dashboardTrendsHandler))

  app.get('/api/evaluaciones', wrapAsync(evaluacionesIndexHandler))
  app.post('/api/evaluaciones', wrapAsync(evaluacionesIndexHandler))

  app.get('/api/work-areas/:code/workstations', withDynamicParams(workAreaWorkstationsIndexHandler))
  app.post(
    '/api/work-areas/:code/workstations',
    withDynamicParams(workAreaWorkstationsIndexHandler),
  )
  app.patch(
    '/api/work-areas/:code/workstations/reorder',
    withDynamicParams(workAreaWorkstationsReorderHandler),
  )
  app.patch(
    '/api/work-areas/:code/workstations/:id',
    withDynamicParams(workAreaWorkstationByIdHandler),
  )

  app.use((err, req, res, _next) => {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  })
}
