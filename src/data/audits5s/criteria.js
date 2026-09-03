/* Checklist real de Auditoría 5S (2026-09-03, a peticion explicita del usuario -- "conviertelo
   en un sistema completo de evaluacion 5S", metodologia tomada de "Presentacion 5S's.ppt": las 5
   etapas oficiales, SIEMPRE en este orden, con sus conceptos reales:

     S1 ORGANIZAR/SEPARAR  -- "Eliminar lo que no se necesita"
     S2 ORDENAR            -- "Un lugar para todo y todo en su lugar"
     S3 LIMPIAR            -- "Mantener el area de trabajo limpia"
     S4 ESTANDARIZAR       -- "Mantener y monitorear las primeras tres S"
     S5 MANTENER           -- "Entrenamiento y disciplina"

   8 criterios reales por S (40 en total) -- ni una tabla de 70 preguntas metidas en el
   componente, ni solo 5 preguntas genericas. Cada criterio se responde CUMPLE(2pts)/
   CUMPLE_PARCIAL(1pt)/NO_CUMPLE(0pts) -- la app NUNCA deja escribir un total a mano: cada S se
   normaliza siempre a 0-20 en base al maximo real de sus criterios (ver
   scoreForCategory/CATEGORY_MAX_RAW abajo), asi que agregar/quitar un criterio en el futuro
   nunca rompe la escala final. Config centralizada aqui (nunca hardcodeada en el componente) para
   que agregar/editar un criterio sea un cambio de datos, no de UI -- mismo criterio que
   src/data/production/catalog.js para WORK_CENTERS. */

export const FIVE_S_CATEGORIES = ['s1', 's2', 's3', 's4', 's5']

export const FIVE_S_META = {
  s1: { key: 's1', titleKey: 's1Title', conceptKey: 's1Description', color: '#EF4444' },
  s2: { key: 's2', titleKey: 's2Title', conceptKey: 's2Description', color: '#F59E0B' },
  s3: { key: 's3', titleKey: 's3Title', conceptKey: 's3Description', color: '#10B981' },
  s4: { key: 's4', titleKey: 's4Title', conceptKey: 's4Description', color: '#3B82F6' },
  s5: { key: 's5', titleKey: 's5Title', conceptKey: 's5Description', color: '#8B5CF6' },
}

export const ANSWER_POINTS = {
  CUMPLE: 2,
  CUMPLE_PARCIAL: 1,
  NO_CUMPLE: 0,
}

// Puntaje maximo por criterio (2, ver ANSWER_POINTS.CUMPLE) -- nunca 0/5/10/15/20 por pregunta
// individual, la normalizacion a 0-20 ocurre SOLO al cerrar cada S completa.
const MAX_POINTS_PER_CRITERION = 2

export const FIVE_S_CRITERIA = [
  // S1 -- ORGANIZAR/SEPARAR ("Eliminar lo que no se necesita")
  {
    id: 's1_material_innecesario',
    category: 's1',
    titleKey: 's1_material_innecesario_title',
    questionKey: 's1_material_innecesario_question',
    weight: 1,
  },
  {
    id: 's1_articulos_ajenos',
    category: 's1',
    titleKey: 's1_articulos_ajenos_title',
    questionKey: 's1_articulos_ajenos_question',
    weight: 1,
  },
  {
    id: 's1_material_obsoleto_defectuoso',
    category: 's1',
    titleKey: 's1_material_obsoleto_defectuoso_title',
    questionKey: 's1_material_obsoleto_defectuoso_question',
    weight: 1,
  },
  {
    id: 's1_uso_frecuente_accesible',
    category: 's1',
    titleKey: 's1_uso_frecuente_accesible_title',
    questionKey: 's1_uso_frecuente_accesible_question',
    weight: 1,
  },
  {
    id: 's1_sin_acumulaciones',
    category: 's1',
    titleKey: 's1_sin_acumulaciones_title',
    questionKey: 's1_sin_acumulaciones_question',
    weight: 1,
  },
  {
    id: 's1_identificacion_visual',
    category: 's1',
    titleKey: 's1_identificacion_visual_title',
    questionKey: 's1_identificacion_visual_question',
    weight: 1,
  },
  {
    id: 's1_espacio_disponible',
    category: 's1',
    titleKey: 's1_espacio_disponible_title',
    questionKey: 's1_espacio_disponible_question',
    weight: 1,
  },
  {
    id: 's1_elementos_por_remover',
    category: 's1',
    titleKey: 's1_elementos_por_remover_title',
    questionKey: 's1_elementos_por_remover_question',
    weight: 1,
  },

  // S2 -- ORDENAR ("Un lugar para todo y todo en su lugar")
  {
    id: 's2_ubicacion_definida',
    category: 's2',
    titleKey: 's2_ubicacion_definida_title',
    questionKey: 's2_ubicacion_definida_question',
    weight: 1,
  },
  {
    id: 's2_identificacion_ubicaciones',
    category: 's2',
    titleKey: 's2_identificacion_ubicaciones_title',
    questionKey: 's2_identificacion_ubicaciones_question',
    weight: 1,
  },
  {
    id: 's2_herramientas_acomodadas',
    category: 's2',
    titleKey: 's2_herramientas_acomodadas_title',
    questionKey: 's2_herramientas_acomodadas_question',
    weight: 1,
  },
  {
    id: 's2_punto_de_uso',
    category: 's2',
    titleKey: 's2_punto_de_uso_title',
    questionKey: 's2_punto_de_uso_question',
    weight: 1,
  },
  {
    id: 's2_senalizacion',
    category: 's2',
    titleKey: 's2_senalizacion_title',
    questionKey: 's2_senalizacion_question',
    weight: 1,
  },
  {
    id: 's2_articulos_juntos',
    category: 's2',
    titleKey: 's2_articulos_juntos_title',
    questionKey: 's2_articulos_juntos_question',
    weight: 1,
  },
  {
    id: 's2_facilidad_encontrar_devolver',
    category: 's2',
    titleKey: 's2_facilidad_encontrar_devolver_title',
    questionKey: 's2_facilidad_encontrar_devolver_question',
    weight: 1,
  },
  {
    id: 's2_sin_objetos_fuera_de_lugar',
    category: 's2',
    titleKey: 's2_sin_objetos_fuera_de_lugar_title',
    questionKey: 's2_sin_objetos_fuera_de_lugar_question',
    weight: 1,
  },

  // S3 -- LIMPIAR ("Mantener el área de trabajo limpia y mantenerla")
  {
    id: 's3_limpieza_general',
    category: 's3',
    titleKey: 's3_limpieza_general_title',
    questionKey: 's3_limpieza_general_question',
    weight: 1,
  },
  {
    id: 's3_equipos_estaciones_limpios',
    category: 's3',
    titleKey: 's3_equipos_estaciones_limpios_title',
    questionKey: 's3_equipos_estaciones_limpios_question',
    weight: 1,
  },
  {
    id: 's3_sin_residuos',
    category: 's3',
    titleKey: 's3_sin_residuos_title',
    questionKey: 's3_sin_residuos_question',
    weight: 1,
  },
  {
    id: 's3_sin_polvo_suciedad',
    category: 's3',
    titleKey: 's3_sin_polvo_suciedad_title',
    questionKey: 's3_sin_polvo_suciedad_question',
    weight: 1,
  },
  {
    id: 's3_sin_contaminantes',
    category: 's3',
    titleKey: 's3_sin_contaminantes_title',
    questionKey: 's3_sin_contaminantes_question',
    weight: 1,
  },
  {
    id: 's3_pasillos_despejados',
    category: 's3',
    titleKey: 's3_pasillos_despejados_title',
    questionKey: 's3_pasillos_despejados_question',
    weight: 1,
  },
  {
    id: 's3_condiciones_anormales',
    category: 's3',
    titleKey: 's3_condiciones_anormales_title',
    questionKey: 's3_condiciones_anormales_question',
    weight: 1,
  },
  {
    id: 's3_responsabilidad_limpieza',
    category: 's3',
    titleKey: 's3_responsabilidad_limpieza_title',
    questionKey: 's3_responsabilidad_limpieza_question',
    weight: 1,
  },

  // S4 -- ESTANDARIZAR ("Mantener y monitorear las primeras tres S")
  {
    id: 's4_estandares_visuales',
    category: 's4',
    titleKey: 's4_estandares_visuales_title',
    questionKey: 's4_estandares_visuales_question',
    weight: 1,
  },
  {
    id: 's4_responsabilidades_asignadas',
    category: 's4',
    titleKey: 's4_responsabilidades_asignadas_title',
    questionKey: 's4_responsabilidades_asignadas_question',
    weight: 1,
  },
  {
    id: 's4_senalizacion_estandarizada',
    category: 's4',
    titleKey: 's4_senalizacion_estandarizada_title',
    questionKey: 's4_senalizacion_estandarizada_question',
    weight: 1,
  },
  {
    id: 's4_instrucciones_visibles',
    category: 's4',
    titleKey: 's4_instrucciones_visibles_title',
    questionKey: 's4_instrucciones_visibles_question',
    weight: 1,
  },
  {
    id: 's4_checklist_seguimiento',
    category: 's4',
    titleKey: 's4_checklist_seguimiento_title',
    questionKey: 's4_checklist_seguimiento_question',
    weight: 1,
  },
  {
    id: 's4_identificacion_consistente',
    category: 's4',
    titleKey: 's4_identificacion_consistente_title',
    questionKey: 's4_identificacion_consistente_question',
    weight: 1,
  },
  {
    id: 's4_mantenimiento_123',
    category: 's4',
    titleKey: 's4_mantenimiento_123_title',
    questionKey: 's4_mantenimiento_123_question',
    weight: 1,
  },
  {
    id: 's4_estandares_faciles',
    category: 's4',
    titleKey: 's4_estandares_faciles_title',
    questionKey: 's4_estandares_faciles_question',
    weight: 1,
  },

  // S5 -- MANTENER (entrenamiento y disciplina)
  {
    id: 's5_cumplimiento_continuo',
    category: 's5',
    titleKey: 's5_cumplimiento_continuo_title',
    questionKey: 's5_cumplimiento_continuo_question',
    weight: 1,
  },
  {
    id: 's5_disciplina',
    category: 's5',
    titleKey: 's5_disciplina_title',
    questionKey: 's5_disciplina_question',
    weight: 1,
  },
  {
    id: 's5_participacion_empleados',
    category: 's5',
    titleKey: 's5_participacion_empleados_title',
    questionKey: 's5_participacion_empleados_question',
    weight: 1,
  },
  {
    id: 's5_entrenamiento',
    category: 's5',
    titleKey: 's5_entrenamiento_title',
    questionKey: 's5_entrenamiento_question',
    weight: 1,
  },
  {
    id: 's5_habitos_5s',
    category: 's5',
    titleKey: 's5_habitos_5s_title',
    questionKey: 's5_habitos_5s_question',
    weight: 1,
  },
  {
    id: 's5_soporte_liderazgo',
    category: 's5',
    titleKey: 's5_soporte_liderazgo_title',
    questionKey: 's5_soporte_liderazgo_question',
    weight: 1,
  },
  {
    id: 's5_seguimiento_auditorias_anteriores',
    category: 's5',
    titleKey: 's5_seguimiento_auditorias_anteriores_title',
    questionKey: 's5_seguimiento_auditorias_anteriores_question',
    weight: 1,
  },
  {
    id: 's5_sostenimiento_mejoras',
    category: 's5',
    titleKey: 's5_sostenimiento_mejoras_title',
    questionKey: 's5_sostenimiento_mejoras_question',
    weight: 1,
  },
]

export function criteriaForCategory(category) {
  return FIVE_S_CRITERIA.filter((c) => c.category === category)
}

// Maximo real de puntos crudos para una categoria (suma de weight*MAX_POINTS_PER_CRITERION de
// sus criterios) -- NUNCA hardcodeado a 16: si mañana se agrega/quita un criterio a una S, este
// numero cambia solo y la normalizacion a 0-20 sigue siendo matematicamente correcta.
export function maxRawScoreForCategory(category) {
  return criteriaForCategory(category).reduce(
    (sum, c) => sum + c.weight * MAX_POINTS_PER_CRITERION,
    0,
  )
}

// Normaliza el puntaje crudo de una S (suma de ANSWER_POINTS*weight de sus respuestas) a 0-20 --
// UNICO lugar donde ocurre esta cuenta, tanto en el frontend (vista previa en vivo) como en el
// backend (fuente real que se persiste) para que nunca puedan desincronizarse.
export function normalizeCategoryScore(rawScore, category) {
  const max = maxRawScoreForCategory(category)
  if (max <= 0) return 0
  return Math.round((rawScore / max) * 20)
}

// Escala final del radar (2026-09-03, tal cual la pide el usuario/la presentacion 5S original):
// 0 Inicio / 5 Pobre / 10 Satisfactorio / 15 Bueno / 20 Excelente. bandFor(score) hace el
// bucketing por rango (nunca busca coincidencia exacta -- un 18 real debe caer en "Excelente",
// no quedarse sin banda porque no es exactamente 20).
export const FIVE_S_SCALE = [
  { value: 0, labelKey: 'scaleInicio' },
  { value: 5, labelKey: 'scalePobre' },
  { value: 10, labelKey: 'scaleSatisfactorio' },
  { value: 15, labelKey: 'scaleBueno' },
  { value: 20, labelKey: 'scaleExcelente' },
]

export function bandForScore(score) {
  if (score >= 20) return FIVE_S_SCALE[4]
  if (score >= 15) return FIVE_S_SCALE[3]
  if (score >= 10) return FIVE_S_SCALE[2]
  if (score >= 5) return FIVE_S_SCALE[1]
  return FIVE_S_SCALE[0]
}
