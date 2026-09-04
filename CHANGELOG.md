# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
versionado [semver](https://semver.org/lang/es/) (`package.json`).

## [Unreleased] — migración a MI Stack Reference

Cumplimiento real (no tokenístico) con el estándar interno de la empresa
para poder desplegar en el servidor privado (Coolify). Ver
`src/pages/docs/DeveloperManualPage.jsx` para el detalle de arquitectura.

### Added
- pnpm pinneado (`packageManager: pnpm@11.22.0`), reemplaza npm.
- Biome como linter/formateador (2 espacios, ancho 100, preset "recommended").
- `tsconfig.json` permisivo (`allowJs`) — código nuevo se escribe en TypeScript
  real desde ahora; el `.jsx` existente se convierte de forma oportunista.
- Observabilidad Sentry (frontend + backend), inactiva hasta recibir un DSN real.
- Developer Manual (`/developer-manual`, solo ADMINISTRADOR) y Manual de
  Usuario (`/manual`), ambos enlazados desde el menú de navegación.
- Este `CHANGELOG.md`, ahora también visible dentro de la app en `/changelog`.
- **Migración completa Prisma → Drizzle ORM.** Schema (`server-lib/db/schema.ts`
  + `relations.ts`) generado por introspección directa contra la base real
  (18 tablas/12 enums, cero riesgo de definición divergente). Los 25 archivos
  `api/*`/`server-lib/*` y los 11 scripts de mantenimiento que usaban Prisma
  fueron portados uno por uno, mismo comportamiento verificado (transacciones
  con `FOR UPDATE`, claves compuestas, upserts, joins anidados). `@prisma/*`
  y `prisma` eliminados de las dependencias; `prisma/`, `prisma.config.js`,
  `server-lib/prisma.js` y `generated/` eliminados del repo.
- **i18n real (react-i18next).** Framework completo más extracción de TODO
  el texto visible de la app (Centro de Trabajo, dashboard, usuarios,
  registro de personal, docs, y la capa de lógica de negocio/catálogos
  compartidos) a claves de traducción, con contenido REAL (no placeholders)
  en español, inglés y chino simplificado en los 13 namespaces. Selector de
  idioma persistente (localStorage), español como idioma por defecto.
- **Migración completa MUI → Tailwind CSS + shadcn/ui.** Los 88 archivos del
  frontend convertidos uno por uno; MUI eliminado por completo de las
  dependencias del proyecto.
- **Despliegue a Coolify (Fase 7).** `ecosystem.config.cjs` (PM2 en modo
  `pm2-runtime`) + `server-lib/prod-server.js` (Express, bind a `0.0.0.0`,
  puerto desde `process.env.PORT`) como entrypoint real fuera de Vercel.
  Repo espejo `mi2-apps/centro-de-trabajo` corriendo en vivo en
  `https://centro-de-trabajo.mi2.com.mx` desde el 2026-09-01 (fix de
  `NIXPACKS_START_CMD` para que la fase `start` use la ruta completa de
  pnpm, mismo problema que ya afectaba a `build`).
- **Sincronización automática de personal.** `server-lib/personnel-sync.js`
  corre cada 30 minutos en producción: altas y bajas reales de SmartControl
  se reflejan solas en el catálogo de Empleados, sin captura manual.
- **Manuales de proceso reales.** Extraídos con imágenes del manual oficial
  y embebidos directamente en "Hoja de Proceso" (Centro de Trabajo) para
  Prueba eléctrica, Limpieza de TV, Empaque y Etiquetado.
- **Auditoría de 5'S completa.** Checklist real de 40 criterios (5
  categorías), radar de resultados, historial y evolución mensual por área
  (`FiveSAudit`/`FiveSAuditAnswer`).
- **Auditoría de Proceso.** Checklist real de 28 criterios para el puesto de
  Etiquetado (tomado del formato de Calidad), empleado autocompletado desde
  quien está asignado a esa estación hoy, puntaje por categoría calculado en
  servidor (`ProcessAudit`/`ProcessAuditAnswer`).
- Manual de proceso real (SOP oficial de Calidad,
  `SOP-MTY-FFT-QA-001_v1.0.0.pdf`) embebido en "Hoja de Proceso" para el
  puesto de Calidad en todas las WC LINEA.
- Dos módulos nuevos en el menú — Demoras y Planeación — marcados "En
  desarrollo", solo navegación por ahora (mismo patrón que KPI's/
  Asistencia/Auditoría cuando se agregaron).

### Changed
- Formato de código en todo el repo (Biome), sin cambios de comportamiento.
- Rediseño compacto de las cards "Estado general del día"/"Directorio
  rápido de personal"/"Alertas y pendientes" en el módulo de Personal.
- La Auditoría 5'S vuelve a ser "por área" (sin puesto/empleado), con un
  campo Auditor visible que muestra el usuario de la sesión real.
- Líneas sin personal asignado ahora se ven en amarillo (antes gris/rojo),
  tanto en la pestaña Líneas como en el tablero Área operando.
- **Sidebar reorganizado por categorías.** El menú lateral (Visión general/
  Operación diaria/Personal/Análisis y control/Administración/Recursos/
  Sistema) ahora se genera dinámicamente desde `shared/moduleRegistry.js`
  (`src/layout/navigationConfig.js`) en vez de una lista fija en el
  componente — agregar un módulo nuevo con su `group`/`order` ya no requiere
  tocar el JSX del sidebar.
- "Personal por área" (Asistencia) ya no muestra Calidad, WC Gerente de FFT
  ni WC Supervisor como tarjetas propias.

### Fixed
- **Modo oscuro.** `body` nunca definía un `color` base (solo
  `font-family`), así que cualquier texto sin clase de color explícita
  (`text-2xl font-extrabold` sin `text-foreground`, ~40 casos reales
  encontrados en donas del Dashboard, KPI's de Centro de Trabajo,
  resultados de Auditoría, etc.) heredaba el negro por defecto del
  navegador — invisible sobre fondo oscuro, aunque se veía bien por
  accidente en modo claro. Se agrega `color: hsl(var(--foreground))` a
  `body` (`src/index.css`) para que todo texto sin color propio herede el
  token correcto de cada tema automáticamente. Además, 3 tooltips de
  gráficas (Recharts) sin estilo propio mostraban su fondo blanco fijo por
  defecto en modo oscuro — se les agregó `contentStyle` con los mismos
  tokens de popover que ya usa el resto de la app. Modo claro sin cambios.
- **Inconsistencia del total general de personal.** Dashboard y el tablero
  "Área operando" no excluían ninguna área de apoyo, mientras que "Resumen
  por área" (Centro de Trabajo) excluía Calidad/Entrenador y Asistencia
  excluía Calidad/Gerente FFT/Supervisor — el mismo personal real producía
  un total distinto según la pantalla. Se unifica en
  `EXCLUDED_FROM_PLANT_TOTAL_AREA_IDS` (`src/data/production/catalog.js`,
  única fuente de verdad): Calidad/Gerente FFT/Supervisor/Entrenador nunca
  cuentan en el total general de personal, en ninguna vista.

### Pending (bloqueado en credenciales externas — ver checklist entregado al usuario)
- SSO real de Nextcloud (OIDC), reemplaza el login propio.

## [1.0.0]

Estado de producción antes de iniciar la migración de stack. Gestión
completa de personal de piso: asignación diaria por estación, movimientos
con aprobación (LIDER → SUPERVISOR/ADMINISTRADOR), asistencia, catálogo de
personal importado desde Excel (con colas de revisión para conflictos de
baja/duplicados), permisos por rol y por usuario, y un plano operativo 2D
del piso (WC Líneas 0-10, Paletizado, Accesorios, Insumos, Midea/High
Value, Conveyor). Desplegado en Vercel con integración automática de
GitHub (`desarrollo-personal` → Preview, `main` → Producción).
