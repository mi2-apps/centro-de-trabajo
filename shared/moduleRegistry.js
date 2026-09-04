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

// Categorias de navegacion del sidebar (2026-09-04, a peticion explicita del
// usuario -- "sistema inteligente de agrupacion", ver Sidebar.jsx/
// navigationConfig.js). Viven AQUI (junto a los modulos que agrupan) porque
// son metadata del mismo dominio -- id/label/order, igual que cada modulo.
// Un grupo nuevo no registrado aqui NO rompe nada: buildNavigationSections()
// en navigationConfig.js genera su label a partir del id (ver ese archivo)
// y lo ordena al final (antes de "otros"), esto solo sirve para fijar el
// orden/label EXACTO de los 7 grupos que el usuario definio explicitamente.
export const NAVIGATION_GROUPS = [
  { id: 'visionGeneral', labelKey: 'groupVisionGeneral', order: 10 },
  { id: 'operacionDiaria', labelKey: 'groupOperacionDiaria', order: 20 },
  { id: 'personal', labelKey: 'groupPersonal', order: 30 },
  { id: 'analisisControl', labelKey: 'groupAnalisisControl', order: 40 },
  { id: 'administracion', labelKey: 'groupAdministracion', order: 50 },
  { id: 'recursos', labelKey: 'groupRecursos', order: 60 },
  { id: 'sistema', labelKey: 'groupSistema', order: 70 },
  // Unico grupo SIN labelKey real -- "otros" es deliberadamente el ultimo
  // recurso (ver inferNavigationGroup abajo), su label sale de
  // groupOtros en navigation.json como cualquier otro grupo conocido.
  { id: 'otros', labelKey: 'groupOtros', order: 9999 },
]

// Clasificador determinista de categoria (REGLA #3 del usuario -- "NO quiero
// utilizar IA externa para esto... debe ser una clasificacion determinista y
// mantenible"): SOLO se usa como respaldo cuando un modulo no trae `group`
// explicito. Compara palabras clave (sin acentos, minusculas) contra
// name+key+description del modulo; el primer grupo cuyas palabras claven
// coincidan gana -- orden de prioridad fijo, nunca aleatorio. "otros" es el
// ultimo recurso si nada coincide.
const CLASSIFIER_KEYWORDS = [
  {
    group: 'personal',
    keywords: ['personal', 'empleado', 'asistencia', 'horario', 'nomina', 'capacitacion'],
  },
  {
    group: 'operacionDiaria',
    keywords: [
      'produccion',
      'linea',
      'centro-trabajo',
      'centro de trabajo',
      'operacion',
      'pallet',
      'fft',
    ],
  },
  {
    group: 'analisisControl',
    keywords: ['kpi', 'auditoria', 'evaluacion', 'reporte', 'calidad', 'analisis'],
  },
  {
    group: 'administracion',
    keywords: ['usuario', 'rol', 'permiso', 'configuracion'],
  },
  {
    group: 'recursos',
    keywords: ['manual', 'documentacion', 'developer', 'ayuda'],
  },
  {
    group: 'sistema',
    keywords: ['log', 'cambio', 'changelog', 'sistema'],
  },
  {
    group: 'visionGeneral',
    keywords: ['dashboard', 'home', 'inicio'],
  },
]

function stripAccents(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function inferNavigationGroup(module) {
  const haystack = stripAccents(
    [module?.name, module?.key, module?.description].filter(Boolean).join(' '),
  )
  for (const { group, keywords } of CLASSIFIER_KEYWORDS) {
    if (keywords.some((kw) => haystack.includes(kw))) return group
  }
  return 'otros'
}

export const MODULE_REGISTRY = [
  {
    key: '/dashboard',
    name: 'Dashboard',
    description: 'Vista general de KPIs y piso de producción',
    icon: 'Dashboard',
    active: true,
    permissionProtected: true,
    systemReserved: false,
    labelKey: 'dashboard',
    group: 'visionGeneral',
    order: 10,
  },
  {
    key: '/centro-trabajo',
    name: 'Centro de Trabajo',
    description: 'Líneas, estaciones, personal y áreas de trabajo',
    icon: 'Factory',
    active: true,
    permissionProtected: true,
    systemReserved: false,
    labelKey: 'centroDeTrabajo',
    group: 'operacionDiaria',
    order: 10,
  },
  {
    key: '/registro-personal',
    name: 'Registro de personal',
    description: 'Check-in y asistencia diaria',
    icon: 'PersonAddAlt1',
    active: true,
    permissionProtected: true,
    systemReserved: false,
    labelKey: 'registroDePersonal',
    group: 'personal',
    order: 10,
  },
  {
    key: '/usuarios',
    name: 'Usuarios',
    description: 'Administración de usuarios, roles y permisos',
    icon: 'Group',
    active: true,
    permissionProtected: true,
    systemReserved: false,
    labelKey: 'usuarios',
    group: 'administracion',
    order: 10,
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
    labelKey: 'kpis',
    group: 'analisisControl',
    order: 10,
  },
  {
    key: '/asistencia',
    name: 'Asistencia',
    description: 'Personal por área de trabajo y su asistencia de hoy',
    icon: 'EventAvailable',
    active: true,
    permissionProtected: true,
    systemReserved: false,
    labelKey: 'asistencia',
    group: 'personal',
    order: 20,
  },
  {
    key: '/auditoria',
    name: 'Auditoría',
    description: 'Auditoría del sistema (en desarrollo)',
    icon: 'FactCheck',
    active: true,
    permissionProtected: true,
    systemReserved: false,
    labelKey: 'auditoria',
    group: 'analisisControl',
    order: 20,
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
    labelKey: 'evaluaciones',
    group: 'analisisControl',
    order: 30,
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
    labelKey: 'produccionFft',
    group: 'operacionDiaria',
    order: 20,
  },
  // 2026-09-04 (rediseño de sidebar, a peticion explicita del usuario):
  // Manual de Usuario / Developer Manual / Cambios se incorporan al registro
  // central para que el sidebar tenga UNA sola fuente de verdad -- pero
  // `permissionProtected: false` los EXCLUYE de listPermissionProtectedModules()
  // (no aparecen en "Gestion de permisos", exactamente igual que antes, ver
  // Sidebar.jsx `configurable: false` que reemplazan) y de
  // getEffectiveModulesForUser() en permissionService.js. Su gate real sigue
  // siendo `roles` (fijo, no editable por un admin) -- mismo criterio de
  // siempre, ahora vive en el registro en vez de un array aparte en
  // Sidebar.jsx. ProtectedRoute (App.jsx) sigue siendo la proteccion real,
  // esto solo cambia de donde el sidebar lee el mismo dato.
  {
    key: '/manual',
    name: 'Manual de Usuario',
    description: 'Guía de uso para el personal operativo',
    icon: 'BookOpen',
    active: true,
    permissionProtected: false,
    systemReserved: false,
    labelKey: 'userManual',
    group: 'recursos',
    order: 10,
    roles: ['ADMINISTRADOR', 'SUPERVISOR', 'LIDER'],
  },
  {
    key: '/developer-manual',
    name: 'Developer Manual',
    description: 'Arquitectura y esquema interno del sistema',
    icon: 'Code2',
    active: true,
    permissionProtected: false,
    systemReserved: false,
    labelKey: 'developerManual',
    group: 'recursos',
    order: 20,
    roles: ['ADMINISTRADOR'],
  },
  {
    key: '/changelog',
    name: 'Cambios',
    description: 'Historial de cambios del sistema',
    icon: 'History',
    active: true,
    permissionProtected: false,
    systemReserved: false,
    labelKey: 'changelog',
    group: 'sistema',
    order: 10,
    roles: ['ADMINISTRADOR', 'SUPERVISOR', 'LIDER'],
  },
  // 2026-09-04 (a peticion explicita del usuario, "vas a crear dos modulos
  // nuevos... Demoras y Planeacion... ahi con msj de En desarrollo"): mismo
  // patron ya usado para KPI's/Asistencia/Auditoria cuando se agregaron (ver
  // nota 2026-08-28 arriba) -- SOLO navegacion, renderizan ComingSoonPage,
  // ningun dato/API/modelo nuevo todavia. permissionProtected:true igual que
  // el resto: ADMINISTRADOR los ve automatico, SUPERVISOR/LIDER necesitan
  // habilitacion manual desde "Gestion de permisos".
  {
    key: '/demoras',
    name: 'Demoras',
    description: 'Registro y análisis de demoras de línea (en desarrollo)',
    icon: 'Hourglass',
    active: true,
    permissionProtected: true,
    systemReserved: false,
    labelKey: 'demoras',
    group: 'operacionDiaria',
    order: 30,
  },
  {
    key: '/planeacion',
    name: 'Planeación',
    description: 'Planeación de producción (en desarrollo)',
    icon: 'CalendarRange',
    active: true,
    permissionProtected: true,
    systemReserved: false,
    labelKey: 'planeacion',
    group: 'operacionDiaria',
    order: 40,
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
