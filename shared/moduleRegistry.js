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

// Categorias de navegacion del sidebar -- metodologia PQCDSM (2026-09-04, a
// peticion explicita del usuario: "quiero utilizar PQCDSM como estructura
// principal de clasificacion de los modulos OPERATIVOS de planta"). Viven
// AQUI (junto a los modulos que agrupan) porque son metadata del mismo
// dominio -- id/label/order, igual que cada modulo. Reemplaza el esquema
// anterior de 7 categorias genericas (operacionDiaria/analisisControl/
// personal fusionado) por las 6 familias reales de PQCDSM + las 3 secciones
// de SOPORTE que el usuario pidio mantener FUERA de PQCDSM (Administracion/
// Recursos/Sistema nunca reciben badge de letra, son puramente
// administrativas/de referencia, no de operacion de planta).
//
// `id` de las 6 familias PQCDSM es literalmente la LETRA (P/Q/C/D/S/M) --
// evita duplicar un campo `letter` aparte, `badgeClass` es el color
// discreto pedido (fondo tenue + texto, nunca un color solido grande).
// Un grupo nuevo no registrado aqui NO rompe nada: groupModules() en
// navigationConfig.js genera su label a partir del id y lo ordena antes de
// "otros" (REGLA #2 del usuario, "nuevas familias" -- ej. si mañana se
// agrega group:"mantenimiento", la seccion MANTENIMIENTO se crea sola).
export const NAVIGATION_GROUPS = [
  { id: 'visionGeneral', labelKey: 'groupVisionGeneral', order: 10 },
  {
    id: 'P',
    labelKey: 'groupProductividad',
    order: 20,
    badgeClass: 'bg-blue-500/[0.14] text-blue-600',
  },
  {
    id: 'Q',
    labelKey: 'groupCalidad',
    order: 30,
    badgeClass: 'bg-emerald-500/[0.14] text-emerald-600',
  },
  {
    id: 'C',
    labelKey: 'groupCostos',
    order: 40,
    badgeClass: 'bg-amber-500/[0.14] text-amber-600',
  },
  {
    id: 'D',
    labelKey: 'groupEntrega',
    order: 50,
    badgeClass: 'bg-violet-500/[0.14] text-violet-600',
  },
  {
    id: 'S',
    labelKey: 'groupSeguridad',
    order: 60,
    badgeClass: 'bg-red-500/[0.14] text-red-600',
  },
  // 2026-09-04, aclaracion (a peticion explicita del usuario -- "en PQCDSM
  // la M es Morale/People, es el lado humano, cambialo ya que es humano"):
  // el significado real de esta letra en la metodologia es Morale/People,
  // no solo "administracion de personal" -- la etiqueta visible sigue
  // siendo "Personal" (asi la pidio el usuario explicitamente para esta
  // seccion del sidebar), pero las palabras clave del clasificador (ver
  // CLASSIFIER_KEYWORDS, bucket 'M' abajo) ya cubren el lado humano
  // (moral/clima laboral/motivacion), no solo registros administrativos.
  {
    id: 'M',
    labelKey: 'groupPersonalPqcdsm',
    order: 70,
    badgeClass: 'bg-teal-500/[0.14] text-teal-600',
  },
  { id: 'administracion', labelKey: 'groupAdministracion', order: 80 },
  { id: 'recursos', labelKey: 'groupRecursos', order: 90 },
  { id: 'sistema', labelKey: 'groupSistema', order: 100 },
  // Unico grupo SIN labelKey real -- "otros" es deliberadamente el ultimo
  // recurso (ver inferNavigationGroup abajo), su label sale de
  // groupOtros en navigation.json como cualquier otro grupo conocido.
  { id: 'otros', labelKey: 'groupOtros', order: 9999 },
]

function stripAccents(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Clasificador determinista de categoria (REGLA #3 del usuario -- "NO quiero
// utilizar IA externa para esto... debe ser una clasificacion determinista y
// mantenible"): SOLO se usa como respaldo cuando un modulo no trae `group`
// explicito. Prioridad exacta (ver inferNavigationGroup abajo): group
// explicito (fuera de esta funcion) > reglas EXACTAS de id/route
// (EXACT_ID_ROUTE_RULES) > palabras clave por id/route > palabras clave por
// nombre > palabras clave por nombre+descripcion completos > "otros" -- asi
// un modulo como "Scrap" (nombre) con una descripcion que menciona
// "produccion" cae en Q por su nombre exacto, nunca en P por una palabra
// generica de la descripcion. Las palabras clave se normalizan (sin
// acentos, minusculas) una sola vez aqui -- no hace falta listar la forma
// con y sin acento del mismo termino, ambas coinciden igual.
//
// 2026-09-04 (a peticion explicita del usuario, "REGLA DE ORGANIGRAMA"):
// antes de la busqueda generica por palabras clave se revisa una tabla
// chica de coincidencias EXACTAS de id/route para casos donde el usuario
// quiere una garantia dura sin depender de que el nombre visible contenga
// la palabra clave correcta -- funciona aunque la ruta cambie ligeramente
// en el futuro (organigrama/org-chart/organization-chart/
// organizational-chart/estructura-organizacional/estructura-de-planta
// siguen firmes a visionGeneral, sin importar el nombre).
//
// 2026-09-04, correccion (a peticion explicita del usuario -- "ORGANIGRAMA
// es una vista TRANSVERSAL de toda la planta, NO pertenece a PQCDSM... ->
// VISION GENERAL"): el destino de esta regla cambia de 'M' a
// 'visionGeneral' -- unica fuente de esta clasificacion, sin dejar la
// regla vieja en paralelo en ningun otro lado.
const EXACT_ID_ROUTE_RULES = [
  {
    group: 'visionGeneral',
    patterns: [
      'organigrama',
      'org-chart',
      'organization-chart',
      'organizational-chart',
      'estructura-organizacional',
      'estructura-de-planta',
    ],
  },
]

const CLASSIFIER_KEYWORDS = [
  {
    group: 'P',
    keywords: [
      'produccion',
      'productividad',
      'linea',
      'centro-trabajo',
      'centro de trabajo',
      'workcenter',
      'fft',
      'demora',
      'demoras',
      'paro',
      'paros',
      'eficiencia',
      'oee',
      'planeacion',
      'capacidad',
      'throughput',
      'operacion',
    ],
  },
  {
    group: 'Q',
    keywords: [
      'quality',
      'calidad',
      'auditoria',
      'evaluacion',
      '5s',
      "5's",
      'defecto',
      'scrap',
      'retrabajo',
      'fpy',
      'inspeccion',
    ],
  },
  {
    group: 'C',
    keywords: [
      'costo',
      'costos',
      'cost',
      'gasto',
      'gastos',
      'presupuesto',
      'budget',
      'ahorro',
      'savings',
      'desperdicio',
      'waste-cost',
    ],
  },
  {
    group: 'D',
    keywords: [
      'delivery',
      'entrega',
      'entregas',
      'pedido',
      'pedidos',
      'cumplimiento',
      'plan-vs-real',
      'shipment',
      'shipping',
      'despacho',
      'fecha-compromiso',
    ],
  },
  {
    group: 'S',
    keywords: [
      'safety',
      'seguridad',
      'incidente',
      'incidentes',
      'accidente',
      'accidentes',
      'riesgo',
      'riesgos',
      'epp',
      'ergonomia',
    ],
  },
  {
    group: 'M',
    keywords: [
      'personal',
      'persona',
      'personas',
      'empleado',
      'empleados',
      'asistencia',
      'ausentismo',
      'capacitacion',
      'headcount',
      'turnos',
      'plantilla',
      'vacante',
      'vacantes',
      'recursos-humanos',
      'people',
      'human',
      'rrhh',
      'moral',
      'morale',
      'motivacion',
      'clima-laboral',
      'satisfaccion',
      'bienestar',
      'wellbeing',
    ],
  },
  {
    group: 'administracion',
    keywords: [
      'usuario',
      'usuarios',
      'rol',
      'roles',
      'permiso',
      'permisos',
      'configuracion',
      'accesos',
    ],
  },
  {
    group: 'recursos',
    keywords: ['manual', 'manual-usuario', 'developer', 'documentacion', 'ayuda'],
  },
  {
    group: 'sistema',
    keywords: ['cambios', 'changelog', 'log', 'sistema', 'version', 'versiones'],
  },
  {
    group: 'visionGeneral',
    keywords: [
      'dashboard',
      'home',
      'inicio',
      'organigrama',
      'org-chart',
      'organization-chart',
      'organizational-chart',
      'estructura-organizacional',
      'estructura-de-planta',
    ],
  },
]

// Busca la primera coincidencia de palabra clave dentro de un texto ya
// normalizado -- se usa dos veces con distinta especificidad (ver
// inferNavigationGroup: primero solo el nombre, luego todo lo demas), asi
// que un modulo como "Scrap" (nombre) con descripcion "...de produccion"
// cae en Q por su nombre exacto, nunca en P por una palabra generica de su
// descripcion.
function matchKeywordGroup(text) {
  for (const { group, keywords } of CLASSIFIER_KEYWORDS) {
    if (keywords.some((kw) => text.includes(stripAccents(kw)))) return group
  }
  return null
}

export function inferNavigationGroup(module) {
  const idAndRoute = stripAccents([module?.id, module?.key].filter(Boolean).join(' '))
  for (const { group, patterns } of EXACT_ID_ROUTE_RULES) {
    if (patterns.some((p) => idAndRoute.includes(p))) return group
  }

  const byId = matchKeywordGroup(idAndRoute)
  if (byId) return byId

  const byName = matchKeywordGroup(stripAccents(module?.name || ''))
  if (byName) return byName

  const haystack = stripAccents(
    [module?.id, module?.key, module?.name, module?.description].filter(Boolean).join(' '),
  )
  return matchKeywordGroup(haystack) || 'otros'
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
    group: 'P',
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
    group: 'M',
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
  // 2026-09-04, PQCDSM (a peticion explicita del usuario -- KPI's es
  // transversal, no especifico de una sola familia, "el nuevo modulo ponlo
  // en Vision General"): pasa de 'analisisControl' (grupo retirado) a
  // 'visionGeneral', justo despues de Dashboard.
  {
    key: '/kpis',
    name: "KPI's",
    description: 'Indicadores clave de desempeño (en desarrollo)',
    icon: 'QueryStats',
    active: true,
    permissionProtected: true,
    systemReserved: false,
    labelKey: 'kpis',
    group: 'visionGeneral',
    order: 30,
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
    group: 'M',
    order: 30,
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
    group: 'Q',
    order: 10,
  },
  // 2026-09-04 (a peticion explicita del usuario -- "vas a crear dos nuevos
  // modulos en calidad... Rechazo interno y PPM's interno, esos dos seran
  // unos registros o catalogo del retrabajo donde se veran reflejados en
  // los kpi's de calidad"): mismo patron minimo que Demoras/Planeacion/
  // Organigrama -- SOLO navegacion por ahora (ComingSoonPage), sin logica
  // de negocio ni tablas nuevas todavia. Conectar estos registros con los
  // KPI's reales de Calidad (PPM's INTERNOS, RETRABAJOS) es trabajo aparte,
  // no incluido aqui.
  {
    key: '/rechazo-interno',
    name: 'Rechazo Interno',
    description: 'Registro de piezas rechazadas internamente (en desarrollo)',
    icon: 'Ban',
    active: true,
    permissionProtected: true,
    systemReserved: false,
    labelKey: 'rechazoInterno',
    group: 'Q',
    order: 20,
  },
  {
    key: '/ppm-interno',
    name: "PPM's Interno",
    description:
      "Catálogo de PPM's internos (piezas rechazadas por millón fabricado, en desarrollo)",
    icon: 'Gauge',
    active: true,
    permissionProtected: true,
    systemReserved: false,
    labelKey: 'ppmInterno',
    group: 'Q',
    order: 30,
  },
  // 2026-09-02 (a peticion explicita del usuario): modulo nuevo, SOLO
  // lectura -- lista las calificaciones ya guardadas de auditorias 5S
  // (ver AuditEvaluation, server-lib/db/schema.js). Mismo criterio de
  // permisos que el resto de modulos nuevos: ADMINISTRADOR lo ve
  // automatico, SUPERVISOR/LIDER necesitan habilitacion manual desde
  // "Gestion de permisos".
  //
  // 2026-09-04, correccion (a peticion explicita del usuario -- "mueve el
  // modulo de evaluaciones a personal"): pasa de Q a M, orden:20 (el hueco
  // que dejo Organigrama al moverse a Vision General, entre Registro de
  // personal=10 y Asistencia=30).
  {
    key: '/evaluaciones',
    name: 'Evaluaciones',
    description: 'Calificaciones de auditorías 5S realizadas',
    icon: 'FactCheck',
    active: true,
    permissionProtected: true,
    systemReserved: false,
    labelKey: 'evaluaciones',
    group: 'M',
    order: 20,
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
    group: 'P',
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
    group: 'P',
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
    group: 'P',
    order: 40,
  },
  // 2026-09-04, PQCDSM (a peticion explicita del usuario -- "el objetivo
  // principal es: registrar correctamente el modulo, navegacion, permiso
  // correspondiente segun arquitectura... sin inventar funcionalidad
  // compleja"): mismo patron minimo que Demoras/Planeacion (ComingSoonPage,
  // sin logica de negocio todavia).
  //
  // 2026-09-04, MISMO DIA, correccion (a peticion explicita del usuario --
  // "ORGANIGRAMA -> VISION GENERAL... debe quedar exactamente debajo de
  // Dashboard... NO -> M PERSONAL"): pasa de M a visionGeneral, order:20
  // (Dashboard=10, Organigrama=20, KPI's=30) -- Registro de personal y
  // Asistencia se quedan tal cual en M, sin tocarse.
  {
    key: '/organigrama',
    name: 'Organigrama',
    description: 'Estructura organizacional del personal (en desarrollo)',
    icon: 'Network',
    active: true,
    permissionProtected: true,
    systemReserved: false,
    labelKey: 'organigrama',
    group: 'visionGeneral',
    order: 20,
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
