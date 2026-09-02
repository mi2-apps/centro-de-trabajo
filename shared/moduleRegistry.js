// Registro central de modulos del sistema -- UNICA fuente de verdad de que
// modulos existen, sus metadatos, y si su acceso es protegido/reservado.
// Importable tanto desde src/ (Vite) como desde api//server-lib (Node, ESM
// nativo gracias a "type": "module" en package.json) -- por eso este archivo
// NO importa nada de React/MUI/Prisma, solo datos y funciones puras.
//
// `key` es exactamente el mismo string que ya se usaba como "path" en
// RoleModuleAccess.modules (/dashboard, /centro-trabajo, /registro-personal)
// -- intencional, para que la migracion de datos existentes sea trivial.
//
// NO se agregaron modulos ficticios (el mockup mostraba "Reportes"/
// "Configuracion" solo como ejemplo -- no existen paginas reales para ellos,
// asi que no se inventan aqui).
//
// 2026-08-25: Usuarios (y en su momento Layout 2D, eliminado 2026-08-27)
// dejaron de ser systemReserved -- decision explicita del usuario (advertido
// del riesgo: un rol con el modulo "Usuarios" tiene control total de gestion
// de usuarios/permisos, incluido reset de contraseñas). Los 4 modulos
// restantes son configurables por igual desde Gestion de permisos.
export const ADMIN_ROLE = 'ADMINISTRADOR'

export const MODULE_REGISTRY = [
  {
    key: '/dashboard',
    name: 'Dashboard',
    description: 'Vista general de KPIs y piso de producción',
    icon: 'Dashboard',
    active: true,
    permissionProtected: true,
    systemReserved: false,
  },
  {
    key: '/centro-trabajo',
    name: 'Centro de Trabajo',
    description: 'Líneas, estaciones, personal y áreas de trabajo',
    icon: 'Factory',
    active: true,
    permissionProtected: true,
    systemReserved: false,
  },
  {
    key: '/registro-personal',
    name: 'Registro de personal',
    description: 'Check-in y asistencia diaria',
    icon: 'PersonAddAlt1',
    active: true,
    permissionProtected: true,
    systemReserved: false,
  },
  {
    key: '/usuarios',
    name: 'Usuarios',
    description: 'Administración de usuarios, roles y permisos',
    icon: 'Group',
    active: true,
    permissionProtected: true,
    systemReserved: false,
  },
  // 2026-08-28 ("ajustes controlados", a peticion explicita del usuario):
  // 3 modulos nuevos, SOLO navegacion -- "por ahora no desarrollar el
  // contenido... solo crear los modulos/rutas necesarias para poder
  // acceder a ellos". Cada uno renderiza ComingSoonPage (src/pages/shared),
  // ningun dato/API/modelo nuevo. permissionProtected:true igual que los 4
  // modulos existentes -- ADMINISTRADOR los ve automaticamente
  // (resolveEffectiveAccess), SUPERVISOR/LIDER necesitan que un admin los
  // habilite desde "Gestion de permisos" (mismo comportamiento por defecto
  // que tuvo cualquier modulo nuevo hasta hoy, nada especial).
  {
    key: '/kpis',
    name: "KPI's",
    description: 'Indicadores clave de desempeño (en desarrollo)',
    icon: 'QueryStats',
    active: true,
    permissionProtected: true,
    systemReserved: false,
  },
  {
    key: '/asistencia',
    name: 'Asistencia',
    description: 'Personal por área de trabajo y su asistencia de hoy',
    icon: 'EventAvailable',
    active: true,
    permissionProtected: true,
    systemReserved: false,
  },
  {
    key: '/auditoria',
    name: 'Auditoría',
    description: 'Auditoría del sistema (en desarrollo)',
    icon: 'FactCheck',
    active: true,
    permissionProtected: true,
    systemReserved: false,
  },
  // 2026-09-02 (a peticion explicita del usuario): modulo nuevo, SOLO
  // lectura -- lista las calificaciones ya guardadas de auditorias 5S
  // (ver AuditEvaluation, server-lib/db/schema.js). Mismo criterio de
  // permisos que el resto de modulos nuevos: ADMINISTRADOR lo ve
  // automatico, SUPERVISOR/LIDER necesitan habilitacion manual desde
  // "Gestion de permisos".
  {
    key: '/evaluaciones',
    name: 'Evaluaciones',
    description: 'Calificaciones de auditorías 5S realizadas',
    icon: 'FactCheck',
    active: true,
    permissionProtected: true,
    systemReserved: false,
  },
  // 2026-09-02 (a peticion explicita del usuario, segunda parte del pedido de
  // Takt Time real: "agrega otro modulo asi como dices con todo lo que tiene
  // el link de la pagina" -- espejo de FFT Dashboard Production de
  // BinManager). SOLO LECTURA, misma fuente SQL directa a SmartControl que ya
  // usa Takt Time real (server-lib/binmanager-sql.js) -- el MCP de BinManager
  // no esta disponible para el servidor real, solo para esta sesion
  // interactiva. Mismo criterio de permisos que el resto de modulos nuevos.
  {
    key: '/produccion-fft',
    name: 'Producción FFT',
    description: 'Producción real en vivo del work center FFT (BinManager)',
    icon: 'Activity',
    active: true,
    permissionProtected: true,
    systemReserved: false,
  },
]

export function listAllModules() {
  return MODULE_REGISTRY.filter((m) => m.active)
}

// Modulos configurables desde "Gestion de permisos" (excluye los que no son
// permissionProtected o estan inactivos -- systemReserved ya no excluye a
// ninguno, ver nota 2026-08-25 arriba).
export function listPermissionProtectedModules() {
  return listAllModules().filter((m) => m.permissionProtected && !m.systemReserved)
}

export function getModule(key) {
  return MODULE_REGISTRY.find((m) => m.key === key && m.active) || null
}
