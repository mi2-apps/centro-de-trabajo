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
- Módulo nuevo Organigrama (`/organigrama`, M · Personal) — solo navegación
  por ahora, marcado "En desarrollo" (mismo patrón mínimo que Demoras/
  Planeación).
- **Demoras — registro real de tiempo muerto.** Deja de ser "En desarrollo":
  catálogo real de 14 causas (Espera, Falla de sistemas/Internet, Falla en
  máquina, Falta de materiales/accesorios/cushion/protector/bolsas/
  herramientas, Defectos, Calificaciones distintas, Duplicado, Modelo, ver
  `src/data/demoras/catalog.js`), formulario de registro (área/línea →
  estación → causa → duración → turno → nota) e historial con badge
  "Reportable" para demoras de 4 minutos o más. Tabla nueva `DowntimeRecord`
  (migración `drizzle/0008_add_downtime_record.sql`) + `GET`/`POST
  /api/demoras`. Fuera de alcance (confirmado explícitamente): no existe un
  bloqueo técnico de "no clasificar la siguiente TV" — esa acción vive en
  SmartControl/BinManager, sistema externo de solo lectura desde este repo;
  la regla queda como política de proceso del supervisor.
- **Módulo nuevo Control de Equipo.** Registro real de estado de equipo
  físico (impresoras, pistolas de calor/cushion, tablets, radios, escáner,
  máquina de cinta café, flejadora, patín — ver
  `src/data/controlEquipo/catalog.js`), formulario (tipo → área/línea →
  estación → identificador → estado → nota) e historial con badge de
  estado (Operativo/Dañado/En reparación/De baja). Tabla nueva
  `EquipmentItem` (migración `drizzle/0009_add_equipment_tables.sql`) +
  `GET`/`POST /api/control-equipo`.
- **"Levantamiento de Equipo" en Auditoría.** Tercer tipo de auditoría
  (junto a 5'S y Auditoría de Proceso): checklist real de los 9 tipos de
  equipo físico de Control de Equipo, respondido Cumple/Cumple
  parcial/No cumple por equipo, con resultado inmediato (puntaje sobre
  18). Tablas nuevas `EquipmentAudit`/`EquipmentAuditAnswer` + `GET`/`POST
  /api/equipment-audits`.
- **Widget "Problemas en planta" en el Dashboard.** Al fondo del Dashboard,
  resume en vivo los datos de hoy de Demoras y Control de Equipo — tiempo
  muerto total, demoras reportables (4+ min), demoras por falta de
  material/accesorios/herramientas, y equipo con problema reportado.
  "Línea saturada" no se incluye — no existe todavía una métrica real de
  capacidad/utilización en el sistema, no se inventa.
- **Módulo nuevo Hora por Hora** (reescrito 2026-09-04 para reproducir
  EXACTAMENTE el formato del Excel real de control de producción entregado
  por el usuario, "Hora_por_Hora_FFT_7a5.xlsx"). Digitaliza el formato
  físico "Hora por Hora": estándar vs. real por bloque de una hora (turno
  reutilizado de `OFFICIAL_SHIFTS`, incluyendo turnos que cruzan
  medianoche), GAP y cumplimiento calculados siempre por el sistema, estado
  por hora con resaltado sutil de la hora activa ("En proceso"). Captura
  tipo hoja de cálculo directamente en la tabla (clic, escribir, Enter pasa
  a la hora siguiente, Tab avanza de columna) con guardado automático por
  campo (debounce, sin botón "Guardar"), pérdidas por causa + Observaciones
  en una sola unidad Piezas o Minutos por turno (nunca mezcladas), con
  Total pérdidas y fila TOTAL TURNO automáticos. Columnas Hora/Estándar/
  Real/GAP/Cumplimiento fijas (sticky) al hacer scroll horizontal en
  tablet. KPIs y gráfica de acumulado muestran progreso hasta la hora en
  curso (nunca el turno completo mientras aún faltan horas); "Resumen del
  turno" y el Excel sí muestran el turno completo. Gráfica de pérdidas por
  causa, histórico de turnos con detalle hora por hora de solo lectura,
  exportación a Excel (2 hojas: Hora por Hora/Resumen, mismo layout que el
  Excel original), y "Finalizar turno"/"Reabrir turno" con confirmación
  (nunca automático). El rate estándar se congela por hora al capturar —
  cambiarlo después nunca altera el histórico.
  **Causas de pérdida por área** (2026-09-04 v2, a petición explícita del
  usuario -- "cada área tiene sus paros, no todas las áreas son iguales...
  yo pongo el catálogo de cada área"): el catálogo de causas ya NO es un
  set fijo de 11 columnas para todas las áreas -- cada grupo de área
  (Líneas de producción/Insumos/Accesorios/Midea/Paletizado) tiene su
  propio catálogo independiente, editable por un ADMINISTRADOR desde
  "•••" → "Configurar causas" (crear, renombrar, activar/desactivar,
  reordenar -- nunca eliminar físicamente una causa con histórico). Líneas
  de producción se sembró con las mismas 11 causas de la versión anterior
  para no cambiar su comportamiento por defecto; Insumos/Accesorios/Midea/
  Paletizado empiezan sin causas -- el administrador define las suyas
  (p. ej. Insumos/Accesorios no son producción, entregan materiales/
  accesorios a las líneas, así que sus paros reales son distintos). Tablas
  `HourlyProductionSession`/`HourlyProductionEntry` + `HourlyProductionDowntimeCause`/
  `HourlyProductionIncident` (migraciones
  `drizzle/0010_add_hourly_production.sql`,
  `drizzle/0011_hourly_production_fixed_losses.sql` y
  `drizzle/0013_hourly_dynamic_causes.sql`) + endpoints bajo
  `/api/hora-por-hora/*`.
- **Módulo nuevo Sorting** (mismo formato exacto que Hora por Hora, a
  petición explícita del usuario — "es un módulo distinto", no una vista
  alterna del mismo). Mismas fórmulas/lógica de captura (compartidas vía
  `src/data/shiftProduction/`), pero identidad, tablas
  (`SortingSession`/`SortingEntry`, migración `drizzle/0012_add_sorting.sql`),
  ruta (`/sorting`) y permiso completamente separados de Hora por Hora —
  cero acceso automático para ningún rol hasta que un ADMINISTRADOR lo
  otorgue explícitamente, igual que cualquier módulo nuevo. A diferencia de
  Hora por Hora (que aplica a cualquier área/línea del catálogo de
  producción), Sorting **no tiene selector de área/línea**: es una sola área
  fija, a petición explícita del usuario ("Sorting es un área") — sin
  filtro de área en el histórico ni columna de área en la tabla o el Excel.

### Changed
- Formato de código en todo el repo (Biome), sin cambios de comportamiento.
- Rediseño compacto de las cards "Estado general del día"/"Directorio
  rápido de personal"/"Alertas y pendientes" en el módulo de Personal.
- La Auditoría 5'S vuelve a ser "por área" (sin puesto/empleado), con un
  campo Auditor visible que muestra el usuario de la sesión real.
- Líneas sin personal asignado ahora se ven en amarillo (antes gris/rojo),
  tanto en la pestaña Líneas como en el tablero Área operando.
- **Sidebar reorganizado por categorías.** El menú lateral ahora se genera
  dinámicamente desde `shared/moduleRegistry.js`
  (`src/layout/navigationConfig.js`) en vez de una lista fija en el
  componente — agregar un módulo nuevo con su `group`/`order` ya no requiere
  tocar el JSX del sidebar.
- **Metodología PQCDSM.** El menú lateral reagrupa los módulos operativos de
  planta en las 6 familias de PQCDSM — Productividad/Calidad/Costos/
  Entrega/Seguridad/Personal —, cada una con una insignia chica de letra y
  color propio (azul/verde/ámbar/morado/rojo/turquesa) junto al título;
  Administración/Recursos/Sistema se quedan como secciones de soporte, sin
  insignia. Una categoría PQCDSM sin módulos reales asignados (hoy Costos/
  Entrega/Seguridad) simplemente no aparece — se activa sola en cuanto se
  registre el primer módulo de esa familia, sin tocar el sidebar. El
  clasificador automático (`inferNavigationGroup`, usado solo cuando un
  módulo no trae `group` explícito) se reescribió con palabras clave por
  familia y una regla exacta dedicada para variantes de "organigrama".
- **Organigrama se mueve a Visión General.** Al ser una vista transversal
  de toda la planta (no una familia PQCDSM), Organigrama pasa de M ·
  Personal a Visión General, justo debajo de Dashboard — Registro de
  personal y Asistencia se quedan sin cambios en M · Personal. La regla
  exacta y las palabras clave de "organigrama"/variantes en el
  clasificador automático apuntan ahora a Visión General.
- **Evaluaciones se mueve a M · Personal.** Pasa de Q · Calidad a M ·
  Personal, en el hueco que dejó Organigrama al moverse a Visión General.
- Dos módulos nuevos en Q · Calidad — Rechazo Interno y PPM's Interno —
  marcados "En desarrollo", solo navegación por ahora (mismo patrón que
  Demoras/Planeación/Organigrama). Serán registros/catálogo de retrabajo
  reflejados a futuro en los KPI's de Calidad (PPM's INTERNOS,
  RETRABAJOS); esa integración con los KPI's reales es trabajo aparte, no
  incluido en esta entrega.
- **Demoras — vista por rol.** El rol LIDER ahora solo ve el formulario
  "Registrar demora", sin el historial de "Registros recientes" (ni se
  pide al servidor para ese rol). ADMINISTRADOR/SUPERVISOR sin cambios.
- **Logo real por tema (light/dark).** `BrandLogo.jsx` usa dos assets
  oficiales reales por variante (`centro-control-full.png`/
  `-full-dark.png`, `centro-control-icon.png`/`-icon-dark.png`),
  mostrados/ocultados con las mismas clases `dark:` de Tailwind que ya usa
  toda la app — nunca un filtro CSS (invert/brightness) sobre el logo
  claro. El asset dark se preparó quitándole su fondo sólido horneado (no
  traía canal alfa) para dejarlo transparente de verdad, mismo criterio
  con que ya se recortó el icono actual de la imagen oficial. El parche
  anterior que pintaba de blanco toda la franja del header del sidebar en
  modo oscuro ya no hace falta -- se retira.
- Se quita el logo de marca general del header propio de Centro de Trabajo
  -- el sidebar ya lo trae siempre disponible, mostrarlo también ahí era
  redundante. El módulo sigue llamándose "Centro de Trabajo", sin cambios.
- "Personal por área" (Asistencia) ya no muestra Calidad, WC Gerente de FFT
  ni WC Supervisor como tarjetas propias.
- **Logo real definitivo.** Se usa la imagen oficial COMPLETA (icono +
  "Centro de Control" + "CONTROL OPERATIVO", todo dibujado dentro de la
  imagen) como un solo asset en login, sidebar y encabezado propio de
  Centro de Trabajo — nunca icono + texto HTML por separado
  (`public/branding/centro-control-full.png`). El favicon usa solo el
  isotipo, recortado de la misma imagen oficial
  (`centro-control-icon.png`). Se quita el logo redundante de la barra
  superior compacta (el sidebar, siempre visible al fijarlo/pasar el
  mouse, ya lo trae). En modo oscuro, el header del sidebar se pinta como
  una franja blanca completa (logo + botón de expandir) en vez de una
  caja ajustada solo a la imagen — el logo está diseñado para fondo
  blanco, esta franja lo trata como marca propia en vez de forzarle un
  fondo oscuro que no es el suyo.

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
- **Menú "•••" de Hora por Hora no abría (renderizaba fuera de pantalla).**
  El disparador usaba el componente compartido `Button` dentro de
  `DropdownMenuTrigger asChild` — pero `Button` (`src/components/ui/
  button.jsx`) no está envuelto en `React.forwardRef`, así que Radix nunca
  recibía una referencia real al elemento y su cálculo de posición (Popper)
  se quedaba en el valor placeholder de "sin medir" (el menú se abría, pero
  204px arriba del viewport). Los otros 5 usos de `DropdownMenuTrigger
  asChild` en el repo ya envuelven un `<button>` nativo en vez de `Button`
  — se alinea Hora por Hora al mismo patrón en vez de tocar `Button`
  globalmente (cambio no relacionado y de mayor alcance).
- **Hora activa nunca se detectaba y KPIs mostraban el turno completo desde
  la primera hora.** `buildShiftBlocks()` (`src/data/horaPorHora/
  shiftBlocks.js`) recibía `session.date` tal como lo manda el API — un ISO
  string ("2026-09-04T00:00:00.000Z") — y lo reconstruía con `new
  Date(`${dateLike}T00:00:00`)`, produciendo una fecha inválida; el
  histórico (`HourlyHistoryView.jsx`) y el Excel tenían el mismo problema
  vía `dayjs(session.date)`, mostrando el día anterior en zonas horarias
  detrás de UTC. Se corrige leyendo la fecha de calendario directo del
  string (nunca reinterpretándola con `new Date()`/`dayjs()` sin recortar).
  Adicionalmente, los 4 KPIs principales usaban `computeShiftSummary()`
  (turno completo) en vez de la función ya existente
  `computeCumulativeTotals()` (hasta la hora en curso) — quedó sin conectar
  en la primera versión; ahora los KPIs sí cortan en la hora activa y
  "Resumen del turno"/Excel siguen mostrando el turno completo, como se
  pidió.

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
