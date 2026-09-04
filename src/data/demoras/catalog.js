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
   reasons.KEY (namespace nuevo 'demoras', registrado en src/i18n.js). */
export const DOWNTIME_REASONS = [
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
  { key: 'calificaciones-distintas', tag: null },
  { key: 'duplicado', tag: null },
  { key: 'modelo', tag: null },
]

export const DOWNTIME_REASON_KEYS = new Set(DOWNTIME_REASONS.map((r) => r.key))

// 2026-09-04, interpretación explícita a confirmar con el usuario ("3 min
// límite a partir de 4"): se toma como "una demora de hasta 3 minutos es
// tolerancia normal de línea, a partir del minuto 4 ya debe registrarse
// formalmente" -- este umbral es la ÚNICA fuente de esa regla, para poder
// ajustarlo en un solo lugar si la interpretación no era la correcta.
export const DELAY_LOG_THRESHOLD_MINUTES = 4

export function requiresFormalLog(durationMinutes) {
  return Number(durationMinutes) >= DELAY_LOG_THRESHOLD_MINUTES
}
