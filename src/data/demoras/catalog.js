/* Catálogo real de causas de demora (2026-09-04, a petición explícita del
   usuario -- lista textual completa que dio para "Calcular tiempo muerto
   por"). Config centralizada aquí (nunca hardcodeada en el componente),
   mismo criterio que src/data/production/catalog.js para WORK_CENTERS y
   src/data/audits5s/criteria.js para los criterios de auditoría -- agregar
   o renombrar una causa es un cambio de datos, no de UI.

   `tag` ('sistema'/'mtto'/null) es la anotación que el propio usuario puso
   entre paréntesis junto a algunas causas -- se usa solo como badge visual
   informativo (de qué área depende resolverla), nunca cambia el flujo de
   captura. Los labels reales viven en public/locales/{lng}/demoras.json bajo
   reasons.KEY (namespace nuevo 'demoras', registrado en src/i18n.js).

   2026-09-10 (a petición explícita del usuario, "nuevo módulo así pero con
   estas afectaciones... eso va para el área de Sorting"): Demoras de trabajo
   ahora tiene un catálogo de causas PROPIO e independiente para Sorting
   (SORTING_DOWNTIME_REASONS), tomado tal cual de su nota manuscrita
   ("Afectaciones Sorting (clasificación)") -- FFT y Sorting nunca comparten
   causas, mismo criterio de áreas independientes ya aplicado en todo el
   resto de la app. "Falta material virgen (estación)" y "Falta material
   virgen (almacén)" venían agrupadas con una llave "Fusión" en la nota y la
   segunda tachada -- se toma como una sola causa fusionada, no dos. Ninguna
   causa de Sorting trae tag (sistema/mtto): el usuario no anotó ninguna así
   en su nota, no se inventa la clasificación.

   Este archivo se importa tanto desde el cliente (DemorasPage.jsx) como
   desde el servidor (api/demoras/*.js) -- se queda sin imports a propósito
   (nunca `production/areaGroup.js` ni nada con `localStorage`), para que
   sea seguro de cargar en un entorno serverless. Cuál lista aplica según el
   toggle FFT/Sorting se decide en el cliente (useAreaGroup(), reactivo); en
   el servidor se decide por el areaId real que trae cada registro
   (SORT_* = Sorting), ver isSortingAreaId() en api/demoras/index.js. */
export const FFT_DOWNTIME_REASONS = [
  { key: 'espera', tag: null },
  { key: 'falla-sistemas', tag: 'sistema' },
  { key: 'internet', tag: 'sistema' },
  { key: 'falla-maquina', tag: 'mtto' },
  { key: 'falta-materiales', tag: null },
  { key: 'falta-accesorios', tag: null },
  { key: 'falta-cushion', tag: null },
  { key: 'falta-protector', tag: null },
  { key: 'falta-bolsas', tag: null },
  { key: 'falta-herramientas', tag: null },
  { key: 'defectos', tag: null },
  { key: 'calidad', tag: null },
  { key: 'calificaciones-distintas', tag: null },
  { key: 'duplicado', tag: null },
  { key: 'modelo', tag: null },
]

export const SORTING_DOWNTIME_REASONS = [
  { key: 'sort-falta-material-virgen', tag: null },
  { key: 'sort-falla-sistema', tag: null },
  { key: 'sort-internet-lento', tag: null },
  { key: 'sort-falta-falla-escaner', tag: null },
  { key: 'sort-falta-falla-impresora', tag: null },
  { key: 'sort-falta-rollo-etiqueta', tag: null },
  { key: 'sort-falta-lpn-virgen', tag: null },
  { key: 'sort-conveyor-saturado', tag: null },
  { key: 'sort-falta-personal', tag: null },
  { key: 'sort-juntas-platicas', tag: null },
  { key: 'sort-reclasificacion', tag: null },
  { key: 'sort-wc', tag: null },
]

export const FFT_DOWNTIME_REASON_KEYS = new Set(FFT_DOWNTIME_REASONS.map((r) => r.key))
export const SORTING_DOWNTIME_REASON_KEYS = new Set(SORTING_DOWNTIME_REASONS.map((r) => r.key))

// 2026-09-04, interpretación explícita a confirmar con el usuario ("3 min
// límite a partir de 4"): se toma como "una demora de hasta 3 minutos es
// tolerancia normal de línea, a partir del minuto 4 ya debe registrarse
// formalmente" -- este umbral es la ÚNICA fuente de esa regla, para poder
// ajustarlo en un solo lugar si la interpretación no era la correcta. Mismo
// umbral para FFT y Sorting -- el usuario no pidió uno distinto para Sorting.
export const DELAY_LOG_THRESHOLD_MINUTES = 4

export function requiresFormalLog(durationMinutes) {
  return Number(durationMinutes) >= DELAY_LOG_THRESHOLD_MINUTES
}
