import { EQUIPMENT_TYPES } from '../controlEquipo/catalog.js'

/* Checklist real de "Levantamiento de equipos" (2026-09-04, a peticion explicita del usuario --
   "en el modulo de auditoria se debe hacer el check list [de Control de equipo]"). Un criterio
   por cada tipo de equipo fisico real (EQUIPMENT_TYPES, src/data/controlEquipo/catalog.js --
   UNICA fuente de los tipos, nunca duplicados aqui), respondido CUMPLE(2pts)/
   CUMPLE_PARCIAL(1pt)/NO_CUMPLE(0pts) -- mismo criterio de puntaje que 5S. El titulo de cada
   criterio reutiliza el label real de Control de Equipo (namespace 'controlEquipo', clave
   `types.<key>`) en vez de duplicar 9 etiquetas nuevas en auditoria.json. */
export const EQUIPMENT_AUDIT_ANSWER_POINTS = {
  CUMPLE: 2,
  CUMPLE_PARCIAL: 1,
  NO_CUMPLE: 0,
}

export const EQUIPMENT_AUDIT_CRITERIA = EQUIPMENT_TYPES.map((e) => ({
  id: e.key,
  titleKey: `controlEquipo:types.${e.key}`,
  questionKey: 'equipoEstadoQuestion',
}))

export const EQUIPMENT_AUDIT_MAX_SCORE = EQUIPMENT_AUDIT_CRITERIA.length * 2
