/* Checklist real de "Auditoría de Proceso" (2026-09-03, a peticion explicita del usuario --
   "AUDITORIA ETIQUETADOR- SEMANA 36.xlsx", mismas preguntas tal cual las usa Calidad hoy en Excel,
   semana 36/2026). A diferencia de 5S (siempre por AREA), esta auditoria evalua a una persona
   real en un puesto real -- ver ProcessAudit/ProcessAuditAnswer en server-lib/db/schema.js.

   Cada criterio se responde con la MISMA escala 4 que ya trae el Excel original ("EVALUACIÓN
   INICIAL SEGÚN REQUISITO: 10 cumple completamente, 5 cumple parcialmente, 3 cumple con el minimo
   del criterio, 0 no cumple") -- la app NUNCA deja escribir un puntaje a mano. El % de cada
   categoria = suma de puntos / (numero de criterios * 10), redondeado -- formula verificada
   contra los 5 casos reales del Excel (MARCO/YESICA/LIZBETH/JUAN/EVELYN). El total = promedio de
   los % de categoria, redondeado (igual, verificado contra el "Resultado global" real del Excel).

   Checklist por ROLE real (Workstation.role, ver src/data/personnel/workstations.js) -- hoy SOLO
   Etiquetado tiene checklist real. Un rol sin entrada aqui simplemente no tiene Auditoria de
   Proceso disponible todavia -- nunca se inventa un checklist generico para otro puesto. Config
   centralizada aqui (nunca hardcodeada en el componente), mismo criterio que
   src/data/audits5s/criteria.js. */

export const PROCESS_AUDIT_ANSWER_POINTS = {
  CUMPLE_COMPLETO: 10,
  CUMPLE_PARCIAL: 5,
  CUMPLE_MINIMO: 3,
  NO_CUMPLE: 0,
}

export const PROCESS_AUDIT_ANSWER_OPTIONS = [
  'CUMPLE_COMPLETO',
  'CUMPLE_PARCIAL',
  'CUMPLE_MINIMO',
  'NO_CUMPLE',
]

// Categorias reales por rol -- orden fijo (N° de la norma del Excel original).
export const PROCESS_AUDIT_CATEGORIES = {
  Etiquetado: [
    { id: 1, titleKey: 'etiquetadoCategory1Title' },
    { id: 2, titleKey: 'etiquetadoCategory2Title' },
    { id: 3, titleKey: 'etiquetadoCategory3Title' },
    { id: 4, titleKey: 'etiquetadoCategory4Title' },
    { id: 5, titleKey: 'etiquetadoCategory5Title' },
    { id: 6, titleKey: 'etiquetadoCategory6Title' },
    { id: 7, titleKey: 'etiquetadoCategory7Title' },
  ],
}

// 28 criterios reales -- id = "c{categoria}-{indice}".
export const PROCESS_AUDIT_CRITERIA = {
  Etiquetado: [
    // 1. Clasificación del producto
    { id: 'c1-1', category: 1, questionKey: 'etiquetadoC1_1' },
    { id: 'c1-2', category: 1, questionKey: 'etiquetadoC1_2' },
    { id: 'c1-3', category: 1, questionKey: 'etiquetadoC1_3' },
    { id: 'c1-4', category: 1, questionKey: 'etiquetadoC1_4' },
    // 2. Verificación de accesorios
    { id: 'c2-1', category: 2, questionKey: 'etiquetadoC2_1' },
    { id: 'c2-2', category: 2, questionKey: 'etiquetadoC2_2' },
    { id: 'c2-3', category: 2, questionKey: 'etiquetadoC2_3' },
    // 3. Revisión de cajas
    { id: 'c3-1', category: 3, questionKey: 'etiquetadoC3_1' },
    // 4. Proceso de etiquetado
    { id: 'c4-1', category: 4, questionKey: 'etiquetadoC4_1' },
    { id: 'c4-2', category: 4, questionKey: 'etiquetadoC4_2' },
    { id: 'c4-3', category: 4, questionKey: 'etiquetadoC4_3' },
    { id: 'c4-4', category: 4, questionKey: 'etiquetadoC4_4' },
    { id: 'c4-5', category: 4, questionKey: 'etiquetadoC4_5' },
    { id: 'c4-6', category: 4, questionKey: 'etiquetadoC4_6' },
    { id: 'c4-7', category: 4, questionKey: 'etiquetadoC4_7' },
    { id: 'c4-8', category: 4, questionKey: 'etiquetadoC4_8' },
    // 5. Etiquetas e impresión
    { id: 'c5-1', category: 5, questionKey: 'etiquetadoC5_1' },
    { id: 'c5-2', category: 5, questionKey: 'etiquetadoC5_2' },
    { id: 'c5-3', category: 5, questionKey: 'etiquetadoC5_3' },
    { id: 'c5-4', category: 5, questionKey: 'etiquetadoC5_4' },
    // 6. Identificación de defectos
    { id: 'c6-1', category: 6, questionKey: 'etiquetadoC6_1' },
    { id: 'c6-2', category: 6, questionKey: 'etiquetadoC6_2' },
    { id: 'c6-3', category: 6, questionKey: 'etiquetadoC6_3' },
    { id: 'c6-4', category: 6, questionKey: 'etiquetadoC6_4' },
    { id: 'c6-5', category: 6, questionKey: 'etiquetadoC6_5' },
    // 7. Actitud y cumplimiento del procedimiento
    { id: 'c7-1', category: 7, questionKey: 'etiquetadoC7_1' },
    { id: 'c7-2', category: 7, questionKey: 'etiquetadoC7_2' },
    { id: 'c7-3', category: 7, questionKey: 'etiquetadoC7_3' },
  ],
}

export function processAuditRolesAvailable() {
  return Object.keys(PROCESS_AUDIT_CRITERIA)
}

export function categoriesForRole(role) {
  return PROCESS_AUDIT_CATEGORIES[role] || []
}

export function criteriaForRole(role) {
  return PROCESS_AUDIT_CRITERIA[role] || []
}

export function criteriaForRoleCategory(role, categoryId) {
  return criteriaForRole(role).filter((c) => c.category === categoryId)
}

// % de una categoria = suma de puntos / (numero de criterios * 10) -- unico lugar donde ocurre
// esta cuenta, tanto en el frontend (vista previa) como en el backend (fuente real persistida).
export function categoryPercentFromRaw(rawScore, criterionCount) {
  if (criterionCount <= 0) return 0
  return Math.round((rawScore / (criterionCount * 10)) * 100)
}

// Escala final (tal cual la trae el Excel original): 0-25 Critico/Capacitacion, 26-50 Bajo/
// Retroalimentacion, 51-79 Medio/Mejorar, 80-100 Alto/Mantener.
export const PROCESS_AUDIT_SCALE = [
  { min: 0, max: 25, labelKey: 'scaleCritico', actionKey: 'actionCapacitacion' },
  { min: 26, max: 50, labelKey: 'scaleBajo', actionKey: 'actionRetroalimentacion' },
  { min: 51, max: 79, labelKey: 'scaleMedio', actionKey: 'actionMejorar' },
  { min: 80, max: 100, labelKey: 'scaleAlto', actionKey: 'actionMantener' },
]

export function bandForProcessScore(score) {
  return PROCESS_AUDIT_SCALE.find((b) => score >= b.min && score <= b.max) || PROCESS_AUDIT_SCALE[0]
}

// Accion sugerida POR CATEGORIA (distinta a la banda global de arriba) -- regla simple ya usada
// en el Excel original: >=80% Mantener, si no Mejorar.
export function categoryActionKey(pct) {
  return pct >= 80 ? 'actionMantener' : 'actionMejorar'
}
