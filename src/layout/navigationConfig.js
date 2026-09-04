// Agrupacion dinamica del sidebar (2026-09-04, a peticion explicita del
// usuario -- "sistema inteligente de agrupacion, arquitectura tipo
// navigationGroups/modules/moduleRegistry/navigationConfig"). Toma modulos
// YA FILTRADOS POR PERMISOS (ver Sidebar.jsx -- el pipeline real es
// usuario -> permisos -> modulos visibles -> categorias -> sidebar, NUNCA al
// reves) y los agrupa por `group` (o inferNavigationGroup() si el modulo no
// trae uno explicito, ver shared/moduleRegistry.js) para que Sidebar.jsx
// nunca tenga que hardcodear una seccion nueva a mano.
//
// REGLA #2 del usuario ("si agrego un modulo con un group que no existia
// todavia, el sidebar debe crear automaticamente esa seccion"): un grupo que
// no este en NAVIGATION_GROUPS simplemente no tiene label/order fijos --
// aqui se le genera un label legible a partir de su id (humanizeGroupId) y
// se ordena despues de los grupos conocidos, antes de "otros" (que es el
// verdadero ultimo recurso de inferNavigationGroup, siempre al final).
//
// 2026-09-04, PQCDSM (a peticion explicita del usuario -- "quiero
// reorganizar el sidebar usando la metodologia PQCDSM"): las 6 familias
// operativas de planta (P/Q/C/D/S/M, ver NAVIGATION_GROUPS en
// shared/moduleRegistry.js) llevan ademas un `badgeClass` -- una insignia
// chica de letra+color junto al titulo, solo para esas 6. Las secciones de
// soporte (Vision general/Administracion/Recursos/Sistema/Otros) NUNCA
// llevan badge, se quedan exactamente como se veian antes de PQCDSM.
//
// REGLA #4 (secciones vacias nunca aparecen): es automatico por construccion
// -- esta funcion solo crea una entrada de Map por cada modulo VISIBLE que
// recibe, nunca itera sobre categorias "posibles" vacias.

import { inferNavigationGroup, NAVIGATION_GROUPS } from '../../shared/moduleRegistry'
import { getModuleIcon } from '../pages/usuarios/permissions/moduleIcons'

const KNOWN_GROUPS_BY_ID = new Map(NAVIGATION_GROUPS.map((g) => [g.id, g]))

// Evaluaciones usaba el icono Star en el sidebar de siempre, distinto del
// icono 'FactCheck' que MODULE_REGISTRY le asigna para "Gestion de
// permisos" (mismo icono que Auditoria alli, decision previa sin relacion
// con esto). Al leer el icono del registro para el sidebar (2026-09-04,
// rediseño), ese icono especifico de sidebar se hubiera perdido -- este mapa
// SOLO aplica aqui, nunca toca el icono que ve "Gestion de permisos".
const SIDEBAR_ICON_OVERRIDES = {
  '/evaluaciones': 'Star',
}

export function iconKeyFor(module) {
  return SIDEBAR_ICON_OVERRIDES[module.key] || module.icon
}

// Orden para un grupo real pero no registrado en NAVIGATION_GROUPS (REGLA
// #2) -- despues de los 7 grupos conocidos, antes de "otros" (order: 9999,
// el unico grupo que es deliberadamente un cajon de sastre).
const UNKNOWN_GROUP_ORDER = 500

// "mantenimiento" -> "Mantenimiento", "quality_control" -> "Quality Control"
// (ver "Metadata de categorias" del usuario) -- determinista, sin diccionario
// externo: separa por _/-/mayuscula-tras-minuscula y capitaliza cada palabra.
function humanizeGroupId(id) {
  const words = id
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

export function resolveModuleGroup(module) {
  return module.group || inferNavigationGroup(module)
}

/**
 * Agrupa modulos ya filtrados por permiso en secciones ordenadas, listas
 * para renderizar. No filtra nada -- eso ya debe haber pasado ANTES (ver
 * Sidebar.jsx), por eso una categoria sin modulos visibles jamas aparece.
 */
export function groupModules(visibleModules) {
  const byGroup = new Map()
  for (const module of visibleModules) {
    const groupId = resolveModuleGroup(module)
    if (!byGroup.has(groupId)) byGroup.set(groupId, [])
    byGroup.get(groupId).push(module)
  }

  const sections = [...byGroup.entries()].map(([id, items]) => {
    const known = KNOWN_GROUPS_BY_ID.get(id)
    return {
      id,
      labelKey: known?.labelKey || null,
      fallbackLabel: humanizeGroupId(id),
      order: known?.order ?? UNKNOWN_GROUP_ORDER,
      badgeClass: known?.badgeClass || null,
      items: [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    }
  })

  return sections.sort((a, b) => a.order - b.order)
}

export { getModuleIcon }
