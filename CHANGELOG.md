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
- **Eliminar usuario permanentemente (solo empleado 3647).** Nueva acción
  "Eliminar" en Usuarios del sistema (`api/users/[id].js`, método DELETE,
  ruta registrada en `server-lib/api-routes.js`): borra la fila real de
  la tabla `User` en la base de datos, no una desactivación. Autorización
  hardcodeada -- únicamente `req.user.employeeNumber === '3647'` puede
  llamarlo, sin importar el rol de quien más sea ADMINISTRADOR después (a
  petición explícita del usuario, "solo yo 3647 pueda eliminar usuarios").
  No se puede eliminar la propia cuenta. En el cliente
  (`UsuariosPage.jsx`) el botón solo aparece para ese mismo usuario, y el
  diálogo de confirmación exige escribir el número de empleado (o
  username) exacto antes de habilitar "Eliminar definitivamente" — la
  autorización real vive en el servidor, ocultar el botón es solo UX.
  Si el usuario tiene registros históricos con `onDelete:'restrict'`
  (auditorías, demoras, equipo, etc.) el borrado se rechaza con un error
  claro (409) en vez de perder ese historial o intentar un cascade
  automático. Probado en vivo con un usuario descartable (creado y
  eliminado de punta a punta, confirmado con recarga completa que ya no
  existe en la base de datos).
- **Vincular a cuenta existente (Solicitudes de acceso SSO).** Nueva
  acción en `AccessRequestsCard.jsx`/`api/access-requests/[id]/decide.js`
  (`action='link'`): cuando alguien con cuenta local de siempre (creada
  antes de tener SSO configurado) inicia sesión por primera vez con
  Nextcloud, cae en "Solicitar acceso" como si fuera nuevo porque su
  cuenta nunca tuvo `oidcSub` -- "Aprobar" SIEMPRE creaba un `User`
  nuevo, dejando una cuenta duplicada para la misma persona. Ahora se
  puede elegir "Vincular a cuenta existente" y seleccionar de un
  desplegable de usuarios reales: hace `UPDATE` de `oidcSub` sobre ESE
  usuario en vez de insertar uno nuevo (rechaza con 409 si esa identidad
  ya está vinculada a otra cuenta, vía `pgError()`). Encontrado y resuelto
  a partir del caso real del propio administrador (Roman, cuenta 3647).
  Verificado en vivo de punta a punta con datos de prueba desechables, y
  usado de inmediato para vincular la cuenta real.
- **Solicitudes de acceso SSO en la campana de notificaciones.** A
  petición explícita del usuario ("si alguien quiere iniciar sesión me
  va a aparecer ahí para aceptar o rechazar?"): antes SOLO vivían en
  Usuarios > Solicitudes de acceso SSO, invisibles hasta entrar a esa
  pantalla -- la campana (`NotificationBell.jsx`) solo avisaba
  Movimientos de área. Ahora agrega una segunda sección con el mismo
  aprobar/vincular/rechazar completo, en una fila apilada verticalmente
  para el ancho angosto del popover (320px). La fila real
  (`AccessRequestDecideRow.jsx`) se extrajo de `AccessRequestsCard.jsx`
  para que ambos la compartan tal cual -- nunca dos copias de esa
  lógica que se puedan desincronizar. Consulta cada 30s (`/api/access-
  requests?status=PENDING`, sin sync en vivo como Movimientos de área,
  que sí necesita esa latencia para el piso de producción -- un login
  SSO nuevo es raro, no urgente). Visible solo para quien tenga acceso
  efectivo al módulo Usuarios (mismo gate que ya exige el servidor en
  `decide.js`, no solo el rol) -- a petición explícita del usuario,
  "que esas notificaciones solo me lleguen a mí". Verificado en vivo con
  una solicitud de prueba: aparece en la campana, se puede rechazar
  desde ahí, y el contador se actualiza solo.
- **Solicitud de acceso LOCAL (segundo origen, alterno a SSO).** A
  petición explícita del usuario ("que salte un mensaje de que no estás
  registrado... botón de mandar solicitud... me llegue el número de
  empleado en automático"): si alguien intenta el login local (número de
  empleado/contraseña) con un número que no tiene cuenta todavía,
  `api/auth/login.js` ya no devuelve un error muerto -- responde
  `404 {error, code:'NOT_REGISTERED'}` (tradeoff de seguridad conocido y
  aceptado explícitamente: revela que el número no existe, aceptable
  porque es un identificador interno, no un email de terceros).
  `LoginPage.jsx` ofrece ahí mismo "Enviar solicitud de acceso" ->
  `api/auth/request-access.js` (nuevo, sin sesión, re-valida en el
  servidor). Llega a Usuarios > Solicitudes de acceso Y a la campana de
  notificaciones, con el número de empleado ya listo -- el admin solo
  agrega nombre, rol y una contraseña real al aprobar
  (`mustChangePassword=true`, nunca la contraseña aleatoria que sí usan
  las cuentas SSO). Requirió migración real (`drizzle/0014_access_
  request_local_signup.sql`, aditiva): `AccessRequest.oidcSub`/`email`
  pasan a nullable, nueva columna `AccessRequest.employeeNumber`.
  `decide.js`/`AccessRequestDecideRow.jsx` distinguen el origen LOCAL vs
  SSO por cuál de los dos campos viene lleno (nunca un campo `source`
  aparte) -- oculta "Vincular a cuenta existente" para solicitudes
  locales (no hay nada que vincular, es alguien nuevo de verdad).
  Verificado en vivo de punta a punta con datos de prueba desechables:
  login real con el número/contraseña nuevos, redirigido correctamente a
  cambiar contraseña; ambos registros de prueba limpiados por completo
  al terminar.
- **Catálogo de causas de demora administrable por ADMINISTRADOR.** A
  petición explícita del usuario ("solo yo pueda agregar mas demoras...
  para no estar diciendo así como ahorita que agregues"): nueva tabla
  `DowntimeReason` (migración `drizzle/0015_downtime_reason.sql`, mismo
  patrón ya usado para `HourlyProductionDowntimeCause` en Hora por Hora)
  como complemento dinámico de las 15 causas estáticas de
  `src/data/demoras/catalog.js`, que NO se tocan. Nueva pantalla
  "Configurar causas" (botón visible solo para ADMINISTRADOR en
  `/demoras`, `DemorasCausesAdmin.jsx`): agregar, renombrar, reordenar
  (flechas) y desactivar (soft-delete, nunca borra el histórico ya
  guardado con ese `reasonKey`) -- mismo componente/UX que
  `HourlyCausesAdmin.jsx`, sin agrupación por área (un solo catálogo
  global). `GET/POST /api/demoras/reasons` + `PATCH /api/demoras/
  reasons/:id`, creación restringida a ADMINISTRADOR en el servidor
  (nunca solo en el frontend). Las causas nuevas se guardan como texto
  real (nunca una clave de traducción) -- se muestran igual en los 3
  idiomas, mismo criterio que los nombres de Workstation/WorkArea.
  Probado de punta a punta contra la base real (create/list/deactivate/
  delete vía script desechable, limpiado por completo al terminar).
- **Toggle global FFT / Sorting.** A petición explícita del usuario
  ("todo lo que hay en mi layout de fft... el dashboard, registro de
  personal y el modulo de asistencias ahorita es de FFT... si le doy
  click a sorting todo esos modulos ponga lo de sorting"): nuevo botón
  FFT/Sorting en el header compartido (`AreaGroupToggle.jsx`, dentro de
  `HeaderUserActions.jsx` -- visible en Dashboard, Centro de Trabajo,
  Registro de personal y Asistencia). `src/data/production/
  catalogSorting.js` (nuevo) define las 7 áreas reales de Sorting (RCY,
  FRM, KITS, PNP, DMR/DML, DMA/DMT y "Línea de Sorting" -- 7 puestos
  dobles, capacidad 2 c/u, del layout que el usuario dibujó a mano) con
  el mismo *shape* que `WORK_CENTERS` de `catalog.js` (FFT), que NO se
  toca en su contenido. `src/data/production/areaGroup.js` (nuevo,
  mismo patrón pub/sub que `personnel/store.js`) guarda el grupo activo
  en localStorage; `catalog.js` reasigna `WORK_CENTERS` y sus derivados
  (`LINES_ONLY`, `LINE_FAMILY_AREA_IDS`, etc. -- ahora `let`, no
  `const`) cuando cambia el grupo -- como un export de ES module es un
  binding vivo, los ~30 archivos que ya importaban `WORK_CENTERS` siguen
  funcionando sin tocarse. `key={areaGroup}` en el `<Outlet>` de
  `AppLayout.jsx` fuerza a remontar la página activa al cambiar de
  grupo (un cambio de binding no dispara re-render por sí solo).
  `scripts/seed-sorting-work-areas-2026-09-08.mjs` sembró las 7
  `WorkArea`/`Workstation` reales en la base de datos (mismo patrón que
  `add-real-work-areas-for-hidden-personnel.mjs`) -- arranca vacío, sin
  snapshot de personal (a diferencia de FFT/LAYOUT FFT.xlsx). Alcance
  real confirmado en vivo: Dashboard, Asistencia, Registro de personal
  y la vista "Áreas de trabajo" de Centro de Trabajo siguen el toggle
  correctamente; las pestañas "Líneas" y "Estaciones" (mockups
  curados a mano, exclusivos de FFT) muestran un aviso de "vista
  pendiente" en vez de datos incorrectos o un crash real que se
  encontró y corrigió durante la prueba (`EstacionesTab.jsx`, división
  con `idealHeadcount: null`). "Personal"/"Sin asignar"/"Bajas" siguen
  siendo vistas globales de personal (no cambian con el toggle, es
  comportamiento correcto: no son vistas "por área").
- **Auto-migración de schema al arrancar** (`server-lib/db/runMigrations.js`,
  llamado desde `prod-server.js` antes de `app.listen`). Aplica los 16
  archivos SQL versionados de `drizzle/` vía `drizzle-orm`'s `migrate()`
  contra `DATABASE_URL` en cada boot del contenedor -- idempotente (tabla
  `__drizzle_migrations`), así que en un DB ya al día es un no-op. Corre
  siempre desde dentro de Coolify, nunca desde afuera, así que llega a la
  Postgres interna del proyecto sin depender de que el puerto externo esté
  abierto. Habilitó el corte de Neon a la Postgres provisionada por Coolify
  sin necesitar `drizzle-kit push` manual ni acceso de red externo al
  servidor.
- **Bootstrap del primer administrador via env vars** (`server-lib/db/
  bootstrapAdmin.js`, mismo patrón `BOOTSTRAP_ADMIN_*` que ya usa cubicaje).
  Corre después de `runMigrations()`, dentro del contenedor -- crea un
  `User` con rol `ADMINISTRADOR` si `BOOTSTRAP_ADMIN_USERNAME` +
  `BOOTSTRAP_ADMIN_PASSWORD` están seteadas y ese username no existe
  todavía. Idempotente (no-op si ya existe o si las env vars faltan).
- **"Indicadores FFT" (Dashboard) conectado a datos reales**, a petición explícita del usuario
  tras revisar la tarjeta en vivo y confirmar exactamente qué debía mostrar cada uno (los 4
  llevaban desde el 2026-08-26 con "Sin fuente de datos configurada" a propósito, nunca un
  porcentaje inventado -- ver `FFT_INDICATORS`/`FftIndicatorsCard.jsx`):
  - **Demoras**: minutos totales de Demoras de trabajo capturados HOY, solo áreas FFT (excluye
    Sorting -- son áreas independientes).
  - **Producción** y **Eficiencia**: suma de `standardQty` (meta)/`actualQty` (real) de TODAS
    las sesiones de Hora por Hora de HOY en áreas FFT. La meta nunca es un número fijo -- es la
    suma real de lo que cada línea tenga configurado ese día; si nadie ha capturado hoy, muestra
    "Sin captura hoy" en vez de un falso "0/0". Nuevo hook `useFftIndicators.js`.
  - **Cumplimiento de programas** se deja intencionalmente sin conectar: ni el propio usuario
    tenía claro qué debía representar al revisarlo, así que no se inventa un cálculo para él.
- **Demoras de trabajo ahora también funciona para Sorting**, a petición explícita del usuario
  ("nuevo módulo así pero con estas afectaciones... eso va para el área de Sorting"), con su
  propia lista de áreas (Conveyor, Líneas de Sorting, RCY, FRM, KITS, PNP, DMR/DML, DMA/DMT) y su
  propio catálogo de 12 causas -- tomado tal cual de la nota manuscrita del usuario
  ("Afectaciones Sorting (clasificación)"): Falta material virgen (estación) -- fusiona la
  variante "(almacén)" que venía tachada en la nota, no son 2 causas--, Falla del sistema,
  Internet lento, Falta/falla escáner, Falta/falla impresora, Falta de rollo (etiqueta), Falta de
  LPN virgen, Conveyor saturado, Falta personal, Juntas/Pláticas, Reclasificación, WC. FFT y
  Sorting nunca comparten catálogo de causas ni historial -- mismo criterio de áreas
  independientes de toda la app (`useAreaGroup()`), reactivo al toggle FFT/Sorting sin necesitar
  refrescar la página. Las causas dinámicas que un ADMINISTRADOR agregue después ("Configurar
  causas") también quedan fijas a un área (`DowntimeReason.areaGroup`, migración 0016) -- antes
  ese catálogo era global y una causa nueva se habría visto en las 2 áreas por error.

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
- **Demoras renombrado a "Demoras de trabajo".** Cambia el nombre visible
  en el menú lateral, el título de la página y el registro de módulos
  (`shared/moduleRegistry.js`) — la ruta (`/demoras`) y todo lo demás no
  cambian.
- **Demoras — se quita el campo Estación.** El formulario de "Registrar
  demora" ya no pide Estación en ninguna de las 5 áreas; el campo se
  elimina de la UI y del payload enviado al servidor (`stationName` sigue
  existiendo como columna opcional en la base de datos, para no perder los
  registros históricos que sí la tenían).
- **Selector de Línea — orden ascendente 0 a 10.** El dropdown "Línea" que
  comparten Demoras, Hora por Hora, Auditoría y Control de Equipo ahora
  muestra WC LINEA 0, 1, 2... 10 en vez de 1..10 seguido de 0 al final
  (nuevo export `LINE_FAMILY_WORK_CENTERS` en
  `src/data/production/catalog.js`, ya ordenado, para no repetir el mismo
  sort en cada pantalla).
- **Demoras — Turno automático.** El campo Turno del formulario ya no
  parte de un valor fijo (`CURRENT_SHIFT='Matutino'` de siempre) -- se
  autocalcula con `getCurrentShift()`/`OFFICIAL_SHIFTS`, la misma
  detección real por hora que ya usan Hora por Hora y Sorting (Matutino
  07:00-17:10, Tiempo extra 17:11-22:00, Noche 22:01-07:00). Sigue siendo
  un select editable por si se registra una demora fuera de su horario
  real. Se guarda como `shift.id` (MATUTINO/TIEMPO_EXTRA/NOCHE); el
  historial muestra tanto los registros nuevos como los antiguos
  (literal legacy Matutino/Vespertino/Nocturno) con su nombre correcto.
- **Demoras — se quita también la columna Estación del historial.** El
  "Registros recientes" ya no muestra la columna Estación (el dato ya no
  se captura desde el formulario, ver entrada anterior de este mismo
  Changelog).
- **Modo claro/oscuro persiste entre sesiones.** Antes `App.jsx` siempre
  arrancaba en `mode='light'` sin importar lo último elegido. Ahora se
  guarda en `localStorage` (`fft_theme`, mismo patrón que `fft_language`
  en `i18n.js`) y se restaura solo al volver a entrar -- igual que ChatGPT
  o Facebook. Un script inline en `index.html` aplica la clase `dark` ANTES
  de que cargue React, para evitar el parpadeo de un instante en claro.
  El idioma ya persistía desde antes (`i18n.js`, sección 10 del MI Stack
  Reference) -- no se tocó, solo se confirmó que sigue funcionando.
- **Centro de Trabajo — Estaciones y Líneas ahora coinciden.** Se
  quitaron las tarjetas "WC Calidad" y "WC Entrenador" de la pestaña
  Estaciones (`EstacionesTab.jsx`) -- ninguna de las dos vive en el
  plano físico (`layoutZones.js`/`OperatingFloorPlan`), así que no
  debían aparecer ahí. La pestaña Líneas (`LineasTab.jsx`) ya no filtra
  con el `hasLineStations()` de siempre (que excluía PROYECTO/WC LINEA
  0) -- ahora usa `LINE_FAMILY_WORK_CENTERS` (catalog.js), la misma
  fuente ya ordenada 0..10 que usan Demoras/Hora por Hora/Auditoría/
  Control de Equipo para su selector de "Línea": son 11 líneas, no 10.
  El badge "Líneas 1 - 10" de la tarjeta FFT en Estaciones cambia a
  "Líneas 0 - 10" para que coincida. Verificado en vivo: ambas pestañas
  ahora muestran los mismos totales (43/92 personal, 46.7% cobertura).
- **Estaciones — "WC Coordinador de Almacén" pasa a "WC GERENTE DE
  FFT".** Renombre visual únicamente (`estacionesTab.areaGerenteName`
  en centroTrabajo.json, id interno `GERENTE` sin cambios). El resto de
  la app ya mostraba "WC GERENTE DE FFT" desde el 2026-09-01 (ver
  `wcCoordinadorAlmacen` en catalog.json/nameKey de `GERENTE` en
  catalog.js) -- solo el texto propio y curado de esta pestaña
  (`buildAreaSlots()`, independiente del catálogo) se había quedado con
  el nombre anterior.
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
- **Login local y Nextcloud ahora conviven, en vez de que uno reemplace
  al otro.** Revierte la decisión anterior del 2026-09-02 ("Nextcloud
  reemplaza el login local, así es en Cubicaje") -- a petición explícita
  del usuario, viendo el caso real de agregar gente de planta que nunca
  tendrá cuenta de Nextcloud. `LoginPage.jsx`: el formulario de número de
  empleado/contraseña se pinta siempre de inmediato (ya no espera la
  respuesta de `/api/auth/oidc/status`); si el servidor confirma las 4
  credenciales reales, se agrega debajo un divisor ("o") + el botón
  "Iniciar sesión con Nextcloud". Número de empleado = producción,
  Nextcloud = oficina/sistemas/supervisores. Verificado visualmente en
  vivo en ambos modos (solo local, y local + Nextcloud).
- **Vercel redirige todo su tráfico a Coolify.** Con los dos métodos de
  login conviviendo en la misma página (ver entrada anterior), ya no
  hace falta que nadie use el deploy de Vercel directo -- Coolify cubre
  100% de los casos (planta y oficina). `vercel.json`: nuevo `redirects`
  que manda cualquier ruta al dominio real
  (`https://centro-de-trabajo.mi2.com.mx/$1`), `permanent: false` (307,
  reversible fácil si algún día hace falta usar Vercel de respaldo).
  Motivo real: las sesiones de login son por dominio aunque ambos
  deploys compartan la misma base de datos -- sin este redirect, alguien
  podía terminar logueado en Vercel sin sesión en Coolify (o viceversa),
  justo la confusión que el usuario quería evitar al agregar gente
  nueva.
- **Nextcloud vuelve a ser el método principal/visible del login.** A
  petición explícita del usuario, revierte (parcialmente) la entrada de
  ayer: ya NO reemplaza al login local (eso sigue igual, corregido el
  2026-09-07), pero tampoco se muestran los dos siempre juntos --
  `LoginPage.jsx` muestra el botón de Nextcloud como principal y esconde
  el número de empleado/contraseña detrás de un link secundario
  ("Iniciar sesión con número de empleado") que lo revela con un clic.
  Verificado visualmente en vivo, ambos modos.
- **Nueva causa de demora "Calidad".** A petición explícita del usuario,
  se agrega al catálogo de `src/data/demoras/catalog.js`
  (`DOWNTIME_REASONS`) entre "Defectos" y "Calificaciones distintas" --
  el catálogo pasa de 14 a 15 opciones. `reasonKey` en `DowntimeRecord`
  es texto libre (sin enum en la base de datos), así que no requiere
  migración.
- **Longitud mínima de contraseña: de 8 a 6 caracteres.** A petición
  explícita del usuario ("mas rapido"). Cambiado en las 4 validaciones
  reales del servidor (`api/auth/change-password.js`, `api/users/
  index.js`, `api/users/[id]/reset-password.js`, `api/access-requests/
  [id]/decide.js` para el alta local) y en su espejo del frontend
  (`ChangePasswordPage.jsx`, `CreateUserDialog.jsx`, `UsuariosPage.jsx`,
  `AccessRequestDecideRow.jsx`), más los 2 scripts de consola
  (`create-initial-admin.mjs`, `reset-user-password.mjs`) y todos los
  textos/hints de los 3 idiomas que mencionaban el mínimo anterior.
- **Módulo Organigrama, ya con contenido real** (a petición explícita del usuario):
  reemplaza el "En desarrollo" que tenía esta ruta desde que se creó. Muestra la
  primera hoja de `Estructura organizacional.docx` (organigrama real, con fotos y
  nombres reales) exportada a imagen -- el resto del documento no se incluye, a
  petición explícita del usuario ("solo la primera hoja"). `OrganigramaPage.jsx`
  nuevo, reemplaza el `ComingSoonPage` solo en esta ruta (las demás rutas
  "En desarrollo" quedan sin cambio). Actualizar el organigrama en el futuro es
  reemplazar `public/organigrama/estructura-organizacional.png`, sin tocar código.
- **Demoras de trabajo: filtro por fechas + historial reorganizado**, a petición
  explícita del usuario ("filtro por fechas... organiza bien el historial...
  estructúralo bien"). `/api/demoras` (GET) acepta `dateFrom`/`dateTo`
  (`YYYY-MM-DD`, mismo `parseDateOnly` que ya usa `personnel.js`); el frontend
  agrega selectores Desde/Hasta (default: últimos 7 días, mismo rango default que
  ya usa el histórico de Sorting) y agrupa los registros por día calendario con un
  encabezado por grupo, en vez de una tabla plana con fecha repetida en cada fila.
  De paso se corrige que el badge "Reportable" se encimaba con el texto de causas
  largas (ej. "Falta de herramientas...") cuando envolvía a 2 líneas -- ahora fluye
  junto al texto en vez de en una fila `flex` aparte.
- **Demoras de trabajo: exportar a Excel**, a petición explícita del usuario ("boton
  de exportar excel... de tal fecha a tal fecha... grafica de pareto... que yo pueda
  manipular el excel, por hora, dia, semana, mes y turno... cual fue la demora que
  mas pusieron, que linea estuvo mas tiempo muerto... full completo pero bien
  organizado... que no invente informacion"). `exportDemorasToExcel()`
  (`src/data/demoras/exportExcel.js`) exporta siempre el mismo rango Desde/Hasta que
  ya está en pantalla (nunca vuelve a pedirle otro rango al servidor). Reescrito dos
  veces el mismo día tras probarlo en Excel real:
  1) Primera versión con `xlsx` (SheetJS edición community) sin estilos ni gráfica
     -- "muy feo, muy basico, sin diseño, sin grafica". Migrado a `exceljs`, que sí
     escribe estilos reales al generar el archivo (encabezados con color y negritas,
     bordes, zebra striping, celdas "Reportable" resaltadas en rojo).
  2) Esa segunda versión repartía el reporte en 9 hojas (Resumen, Datos, Pareto,
     y desgloses por línea/área, turno, día, semana, mes, hora) y usaba
     `views: [{state:'frozen', ySplit: N}]` para inmovilizar encabezados -- al
     probarla, las hojas de 1-2 filas se sentían como "muchos apartados para solo
     una linea o dos", y la hoja Resumen se veía con el banner y el encabezado
     duplicados: bug real de ExcelJS/Excel al usar `frozen` sin `topLeftCell` (el
     panel congelado y el panel con scroll se renderizan superpuestos). Versión
     final: **todo consolidado en una sola hoja**, sin freeze panes en ningún lado
     (se verificó que el bug desaparece así), con las secciones apiladas
     verticalmente -- KPIs, Pareto (gráfica + tabla completa) y los 6 desgloses
     breves uno debajo del otro, terminando con el detalle completo "Datos" (única
     sección con autofiltro; Excel solo permite uno por hoja).
  Ninguna librería de Excel sin costo escribe gráficas nativas/editables -- se
  investigó a fondo antes de prometer una que no existe de verdad -- así que la
  gráfica de Pareto (barras de minutos + línea de % acumulado + referencia 80%) se
  dibuja con Canvas 2D nativo del navegador y se incrusta como imagen PNG junto a
  la tabla de Pareto: se ve la gráfica al abrir el archivo, pero es una imagen, no
  un objeto de gráfica editable de Excel -- se le explica esto mismo al usuario, no
  se le oculta. `exceljs` agrega ~270 kB (gzip) al bundle, así que se carga con
  `import()` dinámico solo al dar clic en "Exportar Excel", sin afectar el bundle
  inicial de toda la app. `GET /api/demoras` sube su límite de 500 a 20000
  registros para no truncar un reporte de un rango de meses sin avisar. De paso, el
  filtro de fechas por default ahora solo muestra HOY en vez de los últimos 7 días,
  a petición explícita del usuario ("que la fecha este en automatico, osea como hoy
  que es 9 que nomas salga de este dia, ya si quiero ver lo de ayer solo cambio de
  fecha").
- **Organigrama actualizado**, a petición explícita del usuario, reemplazando
  `public/organigrama/estructura-organizacional.png` por la nueva versión de
  "Estructura organizacional.docx" (agrega la rama Ingeniería con Roman Herrera
  y Cristopher, renombra "Líderes de Áreas Especializadas" a "Líderes de
  Áreas", etc.). De paso, dos ajustes visuales pedidos explícitamente:
  1) Grosor de conectores/círculos aumentado (~60% más pixeles azules vía
     dilatación de imagen sobre una máscara de color ajustada al tono exacto
     de la marca -- `distancia euclidiana < 40` respecto a `(46,132,211)` --
     para no tocar por accidente los textos ni las fotos de perfil, que un
     primer intento con un umbral de color más laxo sí alteraba visiblemente).
  2) La etiqueta "Ingeniería" tenía una forma de listón con bordes diagonales
     que se afilaban hacia la palabra (a diferencia de "Liderazgo Operativo"
     y "Líderes de Áreas", que cortan la línea en recto) -- de ahí que se
     viera "como si se estuviera pegando la palabra". Se rehízo ese corte en
     recto, igual que las demás etiquetas del mismo organigrama.
- **Organigrama, segunda pasada** a petición explícita del usuario:
  1) La etiqueta "Ingeniería" ahora flota completa arriba de una línea azul
     continua (sin cortes), en vez de sentarse encima de un hueco en la
     línea como las demás etiquetas -- estilo distinto, elegido explícitamente
     por el usuario entre 2 opciones antes de tocar la imagen.
  2) La primera persona (círculo superior, sin nombre hasta ahora) ya
     muestra "Juan Sillas", en el mismo estilo (Georgia Bold, mismo tamaño
     medido en píxeles contra "Juan Bocanegra") y posición que los demás
     nombres a la izquierda de su círculo.
- **Líneas de Sorting: 8 en vez de 7**, a petición explícita del usuario viendo el plano en vivo
  ("las líneas en vertical son del 2 al 8... la número 8 es de 5 personas... agregas una nueva
  línea la 1 que es en horizontal, la pones a lado derecho de la línea 8"): las 7 "V" que ya
  existían (`SORT_LINEA1..7`, ids sin cambiar para no perder su historial real de asignaciones/
  demoras ya capturado) se renumeraron de "1-7" a "2-8" -- solo el nombre/número mostrado, nunca
  el id. La que ahora se llama "Línea de Sorting 8" tiene 5 personas reales en vez de 4 (única
  entre las 8, confirmado explícitamente por el usuario); `VLineStation`
  (`SortingFloorPlan.jsx`) ya reparte arriba/abajo según la capacidad real de cada línea (2/2 o
  3/2) en vez de asumir siempre 4. Se agrega `SORT_LINEA8`, la nueva "Línea de Sorting 1": misma
  info real (personal asignado, capacidad 4) que las demás pero horizontal, no una V -- nuevo
  componente `HorizontalLineStation`, colocado a la derecha de la línea 8 en el mismo plano.
  Migración de datos real aplicada a producción
  (`scripts/rename-sorting-lines-add-linea1-2026-09-10.mjs`): renombra los `WorkArea`/
  `Workstation` ya existentes y crea los nuevos para la línea 1.
- **Catálogo de personal FFT limpiado antes de la primera toma de asistencia real** (a petición
  explícita del usuario, "quitar a toda la gente que tenemos en FFT toda menos a los que están
  en usuarios... eliminan la db para que ya mañana ahora sí se guarden los verdaderos"): de 141
  `Employee` reales (datos heredados de un import de Excel, ya no confiables), se conservan solo
  los 7 que corresponden a cuentas `User` reales activas hoy (Badillo, Kely Morales, Marco
  Andrade, Yessica Luna, Evelin Bautista, Juan Godínez, Bocanegra) y se borran las otras 134,
  junto con su historial asociado (117 `Attendance`, 208 `DailyAssignment`, 207
  `EmployeeMovement`) para no dejar registros huérfanos -- borrado permanente, no baja lógica,
  a petición explícita tras advertir que era irreversible. Sorting no se tocó (0 empleados reales
  ahí). Migración real aplicada a producción
  (`scripts/delete-non-user-fft-personnel-2026-09-10.mjs`), en una sola transacción.
- **14 altas automáticas del sync de SmartControl marcadas BAJA antes de la primera toma de
  asistencia real** (a petición explícita del usuario viendo "Personal sin asignar" con 9
  personas, "borra a esos también porfa debe estar ahí ya en 0"): el sync periódico
  (`server-lib/personnel-sync.js`) había agregado 14 `Employee` reales (folio real + actividad
  reciente en SmartControl) sin área asignada (`areaZona: 'PRODUCCION'`, nunca mapea a un
  WORK_CENTER) justo antes de esta limpieza. Se marcan con el mismo mecanismo real de "Baja"
  (`unassignedReason: 'BAJA'`, `active: false`) en vez de borrarlos: borrarlos los habría dejado
  expuestos a que el propio sync (cada ~30 min) los vuelva a crear, ya que su alta automática solo
  se salta números de empleado que YA EXISTEN en `Employee` sin importar si están activos.
  Migración real aplicada a producción
  (`scripts/mark-baja-stray-smartcontrol-adds-2026-09-11.mjs`).
- **Apartado "Bajas" vaciado de ruido antes de la primera toma de asistencia real**, a petición
  explícita del usuario ("vacíalo porfa... no quiero que choquen... pa un futuro ponga ahí en
  baja ya sea gente que yo sé que de verdad están de baja"): dos correcciones sobre lo de arriba.
  1) Las 103 entradas de `realPersonnelSnapshot.js` marcadas `status: 'BAJA'` en la limpieza
  anterior se revierten a solo `areaZona: null` (sin el status) -- eso ya bastaba para ocultarlas
  del plano/layout, y así no aparecen en "Bajas" mezcladas con las 10 que sí eran de baja
  confirmada desde antes de esta sesión. 2) Los 14 `Employee` marcados BAJA por el punto anterior
  se borran por completo en vez de dejarlos inactivos: como son gente real con folio de
  SmartControl que pudo seguir trabajando, dejarlos con `active=false` los habría bloqueado de
  verdad (`INACTIVE_EMPLOYEE`) si alguno se presenta mañana con su número real -- justo el
  choque que el usuario quería evitar. Migración real aplicada a producción
  (`scripts/delete-stray-smartcontrol-adds-2026-09-11.mjs`).
- **Contador general de planta no contaba al Gerente de FFT**, a petición explícita del usuario
  ("veo un 6/161 pero hay 7 en el layout, 6 en línea y 1 en gerente de FFT... ahí los que salgan
  en el layout deben de salir en el contador"): `GERENTE` se quita de
  `EXCLUDED_FROM_PLANT_TOTAL_AREA_IDS` (`catalog.js`) -- decisión puntual solo para ese rol;
  CALIDAD/SUPERVISOR/ENTRENADOR se quedan excluidos igual que antes (decisión unificada
  2026-09-04, sin tocar).
- **Sync automático con SmartControl pausado temporalmente** (a petición explícita del usuario,
  tras ver que los 14 `Employee` del punto anterior volvieron a aparecer solos en "Personal sin
  asignar"): no era un bug -- el sync (cada 30 min, `server-lib/personnel-sync.js`) vuelve a dar
  de alta a cualquier folio real de SmartControl con actividad reciente que no exista ya en
  `Employee`, así que cada borrado manual se deshacía solo en el siguiente ciclo. El usuario
  prefirió pausar el sync (`PERSONNEL_SYNC_PAUSED = true` en `server-lib/prod-server.js`) mientras
  arranca la primera toma de asistencia real de mañana, para que nada aparezca solo mientras
  tanto -- se reactiva con un solo cambio (`PERSONNEL_SYNC_PAUSED = false`) cuando el usuario lo
  pida.

### Fixed
- **El store local (localStorage) nunca "se enteraba" cuando un `Employee` se borraba/desactivaba
  en el servidor** -- bug real encontrado en vivo esta sesión (borrar a alguien de la DB, o
  incluso borrarlo y que el sync de SmartControl lo recreara y se volviera a borrar, no cambiaba
  nada visualmente hasta borrar `localStorage` a mano: "ni se borran"). `pollOnce()`
  (`src/data/personnel/apiSync.js`) solo agregaba/actualizaba con lo que traía `/api/personnel/
  roster` en cada sondeo, nunca quitaba una asignación/movimiento/vínculo local cuyo empleado ya
  no aparece ahí (el roster solo devuelve `Employee.active=true`, así que su ausencia SIEMPRE
  significa borrado o dado de baja). Ahora, en cada poll, cualquier `localId` con un vínculo YA
  CONOCIDO (`serverIdByLocalId`, persistido) cuyo `serverId` ya no está en el roster de ese
  momento se limpia de verdad (asignación, movimiento, vínculo, supresión de baseline) -- nunca
  toca a alguien recién creado en este dispositivo que todavía no tiene vínculo. Corrige de raíz
  la necesidad de borrar `localStorage` a mano cada vez que se corrige algo del lado del servidor.
- **"Bajas" vaciado por completo a petición explícita del usuario** ("no se borran esos... pa un
  futuro ponga ahí en baja ya sea gente que yo sé que de verdad están de baja"): se quita
  `status: 'BAJA'` de las últimas 9 entradas del snapshot que quedaban de antes de esta sesión
  (Rosa María Rodríguez Cruz, Miguel Ángel Ortega Martínez, Ramiro Aguilar Rubio, Daniela, Valentín
  Cruz Martínez, Juan Eduardo Cuéllar Ruiz, Kevin Alejandro Cira Ramírez, Olga Lidia Lara Dávila,
  Diego Julián Marín Zamudio, Jose Gustavo Aguilar Corpus, Javier Aguilar De Dios) -- "Bajas" queda
  en 0 en vez de conservar bajas históricas del Excel; de aquí en adelante se marca baja solo
  cuando el usuario lo confirme desde la propia UI.
- **Cuenta duplicada `roman.herrera@miglobal.com.mx` reaparecía sola** (a petición explícita del
  usuario, "la elimino y vuelve a aparecer"): `runBootstrapAdmin()` (`server-lib/prod-server.js`)
  corría en cada arranque del servidor (cada deploy) y recreaba esa cuenta si no existía, mientras
  `BOOTSTRAP_ADMIN_USERNAME`/`BOOTSTRAP_ADMIN_PASSWORD` siguieran puestas en Coolify -- confirmado
  vía logs en vivo (`[bootstrap-admin] "roman.herrera@miglobal.com.mx" ya existe, no se toca`) en
  cada arranque. El usuario no pudo editar/borrar esas variables desde el panel de Coolify, así
  que se quita la llamada (y el archivo `server-lib/db/bootstrapAdmin.js`, ya sin uso) del
  servidor directamente: esa lógica solo servía para sembrar el primer ADMINISTRADOR (empleado
  3647), que ya existe, así que no hace falta que siga corriendo.
- **La limpieza de personal FFT (arriba, "Changed") no quitó a nadie de la vista visual** -- el
  plano/lista de Centro de Trabajo no lee la tabla `Employee` directamente para el personal
  "esperado" de cada área: lee `REAL_PERSONNEL_SNAPSHOT`
  (`src/data/production/realPersonnelSnapshot.js`), un snapshot estático del Excel original
  incrustado en el bundle del frontend, independiente de la base de datos (`getPeopleByArea()` en
  `personnelByArea.js` itera ese arreglo, no una consulta a `Employee`). Por eso, tras borrar los
  134 `Employee` de producción, el usuario seguía viendo "toda la gente" igual. Corregido en el
  lugar correcto: se marca `areaZona: null` + `status: 'BAJA'` en las 103 entradas de ese snapshot
  que no correspondían a los 10 números de empleado protegidos (mismo patrón exacto ya usado antes
  para las 8 personas de baja anteriores -- nunca se borra texto/fotos/historial documentado del
  archivo, solo se oculta del plano visual, igual que "Vaciar layout" hace vía
  `Employee.baselineSuppressed` para quien sí tiene ficha viva).
- **Bug real en `drizzle/0000_aberrant_mariko_yashida.sql`**: varios índices
  tenían operator classes de btree emparejadas con la columna equivocada
  (ej. `"employeeId" date_ops` cuando `employeeId` es `text`, no `date`) --
  nunca se había detectado porque esa migración (generada por introspección
  contra Neon, que ya tenía las tablas) jamás se había ejecutado de verdad.
  Al correr por primera vez contra una Postgres vacía (corte Neon → Coolify),
  el `CREATE UNIQUE INDEX "Attendance_employeeId_date_shift_key"` fallaba y,
  al correr cada migración dentro de una transacción, se revertía el archivo
  completo -- ni siquiera `User` quedaba creada, y todo login daba 500. Se
  quitaron las anotaciones de operator class explícitas en los 16 archivos
  de `drizzle/` (son opcionales; Postgres infiere la correcta por el tipo
  real de cada columna), eliminando el bug de raíz.

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
- **Errores de Postgres nunca hacían match (500 genérico en vez del
  mensaje claro).** Encontrado en vivo probando "Eliminar usuario": un
  intento de borrar un usuario con registros históricos (auditorías,
  demoras, equipo, etc.) daba un 500 genérico en vez del 409 con mensaje
  claro que el propio código ya devolvía. Causa raíz: drizzle-orm 0.45
  envuelve TODO error de query en su propia clase `DrizzleQueryError`
  (`node_modules/drizzle-orm/pg-core/session.js`, `queryWithCache`) — el
  error real de Postgres (con `.code`/`.constraint`, ej. `23503`
  foreign_key_violation o `23505` unique_violation) queda en `.cause`,
  nunca en el objeto atrapado directamente. Los `catch (e) { if (e.code
  === '23505') ... }` que ya existían en varios endpoints nunca hacían
  match por lo mismo — bug preexistente a esta sesión, recién
  descubierto. Nuevo helper `pgError(e)` (`server-lib/db/pgError.js`,
  devuelve `e.cause` si trae `.code`, si no el propio `e`) aplicado en
  los 5 endpoints afectados: `api/users/index.js`, `api/users/[id].js`
  (los dos casos, PATCH y el nuevo DELETE), `api/access-requests/[id]/
  decide.js`, `api/personnel/checkin.js`,
  `api/personnel/set-unassigned-reason.js`. Verificado en vivo de punta
  a punta: usuario y demora de prueba creados, confirmado el 409 con
  mensaje claro, ambos registros de prueba limpiados por completo al
  terminar.
- **SSO de Nextcloud — el callback real no coincidía con la ruta
  registrada.** Amir (TI/Coolify ops) confirmó las 4 credenciales OIDC ya
  inyectadas en Coolify, con `OIDC_REDIRECT_URI` =
  `https://centro-de-trabajo.mi2.com.mx/auth/callback` (SIN el prefijo
  `/api/auth/oidc` que usa el resto de este módulo desde que se
  implementó, ver `server-lib/oidc.js`). `openid-client` deriva el
  `redirect_uri` real que manda en el intercambio de token de la URL
  exacta de la request (`authorizationCodeGrant` -> `stripParams(
  currentUrl)`, no del valor de la variable de entorno) -- si Nextcloud
  redirige el navegador a `/auth/callback` y el servidor solo escucha en
  `/api/auth/oidc/callback`, el login nunca se completa. Se agregan 2
  alias de ruta reales al mismo handler existente (nunca una copia de la
  lógica) en `server-lib/api-routes.js` (Coolify/dev) y `vercel.json`
  (Vercel): `GET /auth/callback` -> mismo `oidcCallbackHandler`, `GET
  /auth/login` -> mismo `oidcStartHandler` (este último no lo llama
  Nextcloud, solo por la misma convención que describió Amir).
  Verificado localmente que ambas rutas nuevas llegan al handler real
  (responden su propio JSON `{"error":"SSO no configurado"}` en vez del
  404 de Express o el HTML de la SPA). Confirmado en vivo (ver entradas
  siguientes): esta parte funcionó, pero destapó 2 bugs mas en el mismo
  flujo real.
- **SSO de Nextcloud — segundo bug real, encontrado al probar el login
  en vivo tras el fix anterior ("oidcErrorGeneric").** Las cookies de
  tránsito PKCE (`oidc_txn`) y de identidad pendiente (`oidc_pending`,
  `server-lib/oidc.js`) siempre tuvieron `Path=/api/auth/oidc` -- un
  cookie con ese `Path` NUNCA viaja en una request a `/auth/callback`
  (no es un subpath del cookie), así que `readTxnCookie(req)` devolvía
  `null` justo después de agregar el alias externo real de la entrada
  anterior, y el callback redirigía a `txn_expired` (mismo mensaje
  genérico en pantalla que `exchange_failed`, `login.jsx` no distingue
  entre las dos). Se corrige a `Path=/` en los 4 builders de cookie
  (`buildTxnCookie`/`buildClearTxnCookie`/`buildPendingCookie`/
  `buildClearPendingCookie`) -- cubre cualquier ruta del mismo origen,
  `/api/auth/oidc/*` y `/auth/*` por igual, en vez de acotar a un solo
  alias y dejar el otro roto. **Confirmado en vivo: el login real con
  Nextcloud ya funciona** -- Roman lo probó y llegó correctamente hasta
  la identidad real (nombre/email), aunque cayó en "Solicitar acceso"
  porque su cuenta local de siempre nunca tuvo `oidcSub` (ver las 2
  entradas siguientes, encontradas resolviendo justo ese caso).
- **SSO de Nextcloud — tercer bug real, encontrado al intentar vincular
  la cuenta local de siempre de Roman a su identidad de Nextcloud.**
  `api/access-requests/[id]/decide.js` era el ÚNICO endpoint dinámico de
  toda la API que leía `const { id } = req.query` sin el fallback
  `?? req.params?.id` que usa cualquier otro `api/**/[id].js` (ver el
  comentario real en `server-lib/api-routes.js`) -- funcionaba en Vercel
  (que inyecta el segmento dinámico en `req.query`) pero NUNCA en
  Coolify/dev (Express real, sin ese comportamiento): Aprobar/Rechazar
  solicitudes de acceso nunca había funcionado ahí, solo en Vercel.
  Corregido a la misma convención del resto de la API. Encontrado y
  verificado en vivo probando el nuevo `action='link'` (ver "Added"
  arriba) con datos de prueba desechables (creados y limpiados por
  completo al terminar).
- **Botón "Iniciar sesión con Nextcloud" descentrado.** `LoginPage.jsx`:
  el `<Button asChild>` era hijo directo de un Fragment (`<>...</>`),
  sin ningún contenedor que lo centrara -- quedaba pegado a la izquierda
  de la tarjeta de login en vez de alineado con el resto. Se envuelve en
  un `<div className="flex flex-col items-center gap-4">` con el botón
  (y la alerta de error, si la hay) a `w-full`, mismo ancho que el resto
  de la tarjeta. Verificado visualmente en vivo.
- **Mover personal se revertía solo a los ~15s.** `moveEmployee`
  (`src/data/personnel/repository.js`) escribía el store local de
  inmediato y mandaba `syncMove` al servidor en segundo plano
  (fire-and-forget, solo `console.error` si fallaba); si el POST real
  fallaba u omitía (estación llena de verdad, empleado dado de baja
  mientras tanto, puesto renombrado, o red intermitente en una
  tablet), el siguiente sondeo de `apiSync.js` (cada 2s, tras la
  ventana de gracia de 15s) restauraba la posición real del servidor
  sin ningún error visible -- exactamente el mismo tipo de bug ya
  corregido para el intercambio/swap (2026-09-02). `syncMove` ahora es
  `async` y `moveEmployee` espera la confirmación real del servidor
  ANTES de tocar el store local (mismo patrón que
  `setEmployeeUnassignedReason`): si el servidor rechaza el
  movimiento, el error real se muestra de inmediato en el diálogo, en
  vez de un estado optimista que se revierte solo. El auto-relleno en
  bloque (`reconcileLineAssignments`) sigue siendo fire-and-forget a
  propósito (no es una acción explícita del usuario).
- **Desplegables (`Select`) se abrían hacia arriba en pantallas chicas.**
  Reportado con capturas reales de un escáner/celular en "Registrar
  demora" (Área, Causa de la demora): Radix, con `avoidCollisions`
  activo (su default), voltea el contenido del `Select` arriba del
  trigger cuando detecta poco espacio debajo -- en esas pantallas
  recortadas, el desplegable de causas terminaba tapando la opción que
  el usuario quería tocar, imposible darle click. `src/components/ui/
  select.jsx` (componente compartido por TODA la app, no solo Demoras)
  ahora fija `side="bottom"` + `avoidCollisions={false}` por defecto --
  siempre abre hacia abajo, igual que la referencia que dio el usuario.
- **Toggle FFT/Sorting -- seguimiento real tras probarlo en vivo.** A petición explícita del
  usuario, viendo el toggle recién agregado:
  - **Layout visual real de Sorting.** `SortingFloorPlan.jsx` (nuevo) reemplaza el aviso de
    "plano pendiente" -- RCY y FRM con su entrada, "Línea de Sorting" con sus 7 puestos dobles
    reales (capacity 2 c/u, mismo mecanismo de `fetchLineStationConfig` que ya usa
    `LineDetailDrawer.jsx` para traer la config real de la BD en vez del generador JS
    genérico), y KITS/PNP/DMR-DML/DMA-DMT -- tal cual el pizarrón que dio el usuario. Mismo
    click→detalle que el resto de "Áreas de trabajo".
  - **"Personal" (`PersonalDeHoyTab.jsx`) mezclaba gente de FFT viendo Sorting.**
    `getEffectiveTodayRoster()` trae TODO el personal asignado hoy sin importar el área; ahora
    se filtra por los ids del catálogo activo (`WORK_CENTERS`, binding vivo) antes de calcular
    "Personal presente hoy"/"Directorio rápido"/etc. "Sin asignar"/"Bajas" siguen siendo vistas
    globales de personal a propósito (alguien sin área no "pertenece" a ninguna de las dos).
    Movimientos/Actividad reciente (Personal y Dashboard) siguen sin filtrar -- pendiente.
  - **LIDER podía ver el nombre de cualquier persona al escribir en Registro de personal.**
    `EmployeeSearchField.jsx` gana `restrictToExactMatch` (activo solo para LIDER en
    `RegisterPersonnelForm.jsx`): nunca abre el desplegable de sugerencias -- cada tecleo
    resuelve en silencio si el texto ya es un número de empleado exacto, o lo deja como texto
    libre (mismo camino de "número nuevo, pide nombre" que ya existía). SUPERVISOR/
    ADMINISTRADOR sin cambios.
  - **Duplicados reales al registrar personal sin número de empleado.** Antes, cada check-in
    con el checkbox "No tiene número" creaba un `Employee` NUEVO siempre, aunque ya existiera
    exactamente la misma persona de un registro anterior. `findOrCreateNoNumberEmployee()`
    (repository.js) busca primero por nombre completo exacto entre los que ya comparten
    número placeholder (PROYECTO/PENDIENTE) y reusa ese mismo empleado si existe -- el check-in
    de siempre decide solo si es una simple asistencia o un cambio real de área.
  - Registro de personal (con estos 3 arreglos) queda compartido tal cual entre FFT y Sorting,
    sin duplicar el componente -- exactamente lo que pidió el usuario ("sera solo uno para FFT
    y Sorting").
- **Toggle FFT/Sorting -- segunda ronda tras probarlo en vivo (FFT y Sorting SÍ deben ser
  independientes en personal diario).** El usuario aclaró que la decisión anterior ("Sin
  asignar"/"Directorio" globales a propósito) era incorrecta: FFT y Sorting no deben compartir
  personal en ninguna vista operativa del día, aunque la IDENTIDAD del empleado siga siendo
  única y compartida (nunca duplicados, ver arriba).
  - **Nuevo `getEmployeeAreaGroup()`/`employeeBelongsToActiveGroup()`** (`personnelByArea.js`):
    deriva a qué grupo "pertenece" un empleado por su asignación real más reciente (hoy, o si no
    la última histórica vía `getAssignmentHistory`) -- sin ninguna asignación real jamás se
    asume FFT, único origen de personal hasta que alguien reciba su primera asignación real en
    un área Sorting (ids `SORT_*`). `getAvailablePersonnelToday()` ahora filtra por esto, así que
    "Sin asignar" y cualquier candidato de arrastrar-y-soltar dejan de mezclar áreas.
  - **"Directorio completo" de Personal** (`directoryAll`, `PersonalDeHoyTab.jsx`) y sus alertas
    de "Personal sin asignar"/"Empleados sin estación" ahora también se filtran por el grupo
    activo -- antes mostraban TODO el personal sin importar el toggle. Verificado en vivo:
    Sorting muestra 0/0 en las 4 tarjetas y "Todo el personal está asignado" en "Sin asignar";
    FFT no perdió ningún dato (99 personas, 26 sin asignar, igual que antes).
  - **Pestaña "Líneas" decía "FFT" en modo Sorting.** Nueva clave `lineasTab.titleSorting`
    ("Líneas Sorting ({{count}})"), elegida según `useAreaGroup()` en vez del texto fijo.
  - **`SortingFloorPlan.jsx` más grande**, a petición explícita del usuario ("el layout esta
    super bien solo haz mas grande que se parezca mas a la imagen que te pase") -- mismo
    contenido/estructura, solo tipografía/paddings/alto mínimo de cada caja aumentados.
  - Pendiente sin resolver (mencionado, no silenciado): Movimientos del día/Actividad reciente
    (Personal y Dashboard) siguen sin filtrar por grupo; texto del panel de detalle de área
    ("Sin personal en el Excel...") sigue con sabor FFT/Excel aunque se abra desde Sorting.
- **Toggle FFT/Sorting -- tercera ronda: independencia total de datos entre áreas, Asistencia,
  y 2 áreas nuevas en el layout.**
  - **Movimientos hoy/Actividad reciente ya NO se mezclan entre FFT y Sorting** (prioridad
    explícita del usuario: "en el area de sorting no debe salir datos de FFT y en FFT no debe
    salir datos de sorting"). Nuevo `areaIdBelongsToActiveGroup()` (personnelByArea.js) filtra
    por el área DESTINO de cada movimiento real (`toAreaId`/`toAreaCode`, nunca por el empleado):
    el KPI "Movimientos hoy" y las tablas "Movimientos del día"/"Movimientos recientes" de
    Centro de Trabajo, y "Movimientos del día"/"Actividades recientes" del Dashboard
    (`getDailyMovementsBreakdown`/`getRecentActivity`, dashboardMetrics.js), ahora respetan el
    grupo activo. Verificado en vivo: Sorting muestra 0, FFT mantiene sus 77 reales.
  - **Asistencia ya muestra las áreas de Sorting aunque tengan 0 personas.** Antes se ocultaba
    cualquier área sin gente (`g.people.length > 0`) y además todo el bloque de tarjetas se
    reemplazaba por un estado vacío genérico si `totalPeople === 0` -- como Sorting arranca sin
    snapshot, las 9 áreas reales (RCY, FRM, Línea de Sorting, KITS, Patines, DMR/DML, PNP,
    Gerente de Sorting, DMA/DMT) nunca aparecían. En modo Sorting ambas condiciones ahora
    respetan el catálogo activo completo; FFT no cambia su comportamiento ya validado.
  - **2 áreas nuevas en el layout de Sorting, a petición explícita del usuario viendo el layout
    en vivo:** "Patines" (mediano) y "Gerente de Sorting" (área de apoyo, cuadro chico) --
    `catalogSorting.js` + `scripts/seed-sorting-patines-gerente-2026-09-08.mjs` (WorkArea/
    Workstation reales, mismo patrón que las 7 áreas originales). Posición final ajustada dos
    veces en vivo hasta calzar con una foto real del pizarrón que el usuario mandó para esta
    sección: KITS y DMR/DML arriba (grandes, como siempre), PNP abajo a la izquierda (grande),
    DMA/DMT abajo a la derecha (grande, más alto -- ocupa el hueco de la franja central) y
    Patines+Gerente de Sorting comparten una franja angosta entre KITS/PNP, del lado izquierdo
    -- armado con `grid-template-areas` (`SortingFloorPlan.jsx`) en vez de una cuadrícula
    uniforme, porque el dibujo real no era un grid parejo de 3x2.
  - **Corrección real de capacidad de "Línea de Sorting": 4 personas por línea, no 2.** El
    usuario aclaró viendo el pizarrón con más detalle que cada una de las 7 líneas es una "V"
    con 2 personas en un extremo y 2 en el otro (28 en total, antes 14) --
    `scripts/update-sort-linea-capacity-2026-09-08.mjs` actualiza las 7 Workstation reales de
    capacity 2 a 4; `idealHeadcount` en `catalogSorting.js` pasa de 14 a 28.
  - **Rediseño visual de "Línea de Sorting"** (a petición explícita del usuario, imagen de
    referencia): cada puesto ahora muestra su propio pallet (ícono, uno por línea, ya no una
    fila compartida arriba) y una figura de "V (abre arriba) → tramo vertical → V invertida
    parada (abre abajo)" en vez de un solo chevron simple, con 2 personas mostradas a cada lado.
    Iterado 2 veces en vivo hasta que el usuario confirmó que se parecía al pizarrón.
  - **Reestructuración completa del layout, a petición explícita del usuario ("quiero que el
    layout de FFT y Sorting se vea como en la empresa real... que hagan match"), con foto de
    referencia:** el "conveyor" (Línea de Sorting) termina hasta PNP, así que PNP y DMA/DMT
    ahora comparten fila con la Línea de Sorting y crecen para quedar nivelados con ella (CSS
    Grid `items-stretch`, sin alturas fijas a mano); Patines/Gerente de Sorting quedan como una
    franja angosta bajo PNP; RCY/Entrada/FRM/KITS/DMR-DML bajan a una segunda fila de tamaño
    normal. Verificado en vivo contra la foto que mandó el usuario.
  - **Espejo horizontal del layout, a petición explícita del usuario** ("donde está el
    conveyor... que el conveyor siga por donde está el conveyor de paletizado"): el conveyor de
    FFT (WC Paletizado) está del lado derecho en el plano de FFT -- Línea de Sorting se mueve al
    lado derecho para calzar con eso, el cluster PNP/Patines/Gerente de Sorting/DMA-DMT pasa al
    izquierdo, y en la fila de abajo KITS/DMR-DML pasan a la izquierda con RCY/Entrada/FRM a la
    derecha (mismo cambio de lugar que pidió el usuario, "cambia estos 3 [+ entrada] adonde
    están los otros 6, y los otros 6 adonde están esos 3").
  - **Nuevo "Conveyor de Sorting" (`SORT_CONVEYOR`), a petición explícita del usuario** ("no veo
    el conveyor aquí... debe ser el conveyor del mismo grosor que el de FFT"): confirmado vía
    pregunta directa que debe ser un área REAL con su propia gente asignable, mismo criterio que
    "WC Conveyor General" (CONVEYOR_PRINCIPAL, FFT) -- 2 posiciones reales (WorkArea +
    2 Workstation, `scripts/seed-sorting-conveyor-2026-09-08.mjs`), franja delgada
    (`border-t-[3px]`, mismo "grosor" visual que la de FFT) posicionada arriba de "Línea de
    Sorting", dentro de la misma columna que ya se estira para quedar nivelada con
    PNP/DMA-DMT del otro lado.
  - **Nuevo "Supervisor" (`SORT_SUPERVISOR`), a petición explícita del usuario** ("donde dice
    entrada es un lugar donde va el supervisor y tiene ahí una compu"): reemplaza el marcador
    decorativo "Entrada" -- área real de apoyo, mismo criterio que "WC Supervisor" en catalog.js
    (FFT), `scripts/seed-sorting-supervisor-2026-09-08.mjs`.
  - **"Patines" ya no muestra conteo de personal, a petición explícita del usuario** ("ahí no va
    personal, solo los patines del área"): nueva bandera `equipment: true` en
    `SortingFloorPlan.jsx` -- la tarjeta muestra "Patines del área" en vez de "N persona(s)".
    Además cambia de tamaño/posición con Gerente de Sorting (Patines pasa a la ranura chica,
    Gerente de Sorting a la ancha).
  - **Pestaña "Estaciones" ya no muestra el mensaje "pendiente" en modo Sorting** (a petición
    explícita del usuario, "actualiza los otros apartados de mi módulo de centro de trabajo"):
    nueva `buildSortingAreaSlots()` (mismo componente `AreaCard`/vista de lista que FFT, catálogo
    propio de Sorting) -- las 11 áreas reales (Conveyor, Línea, RCY, FRM, KITS, PNP, DMR/DML,
    DMA/DMT, Patines, Gerente de Sorting, Supervisor) aparecen con su real/ideal y estado, igual
    que en FFT.
  - **"Resumen por área" ya no incluye Patines, a petición explícita del usuario** ("que solo
    salga las áreas de trabajo donde sí va personal, son todas menos patines"): se agrega
    `SORT_PATINES` a `EXCLUDED_FROM_PLANT_TOTAL_AREA_IDS` (catalog.js, el mismo criterio unificado
    que ya excluye CALIDAD/GERENTE/SUPERVISOR/ENTRENADOR de FFT) -- Gerente de Sorting y
    Supervisor SÍ se quedan (el usuario los quiere ahí, a diferencia de sus equivalentes en FFT).
  - **Pestaña "Líneas" ahora muestra las 7 líneas de Sorting, 4 personas c/u, a petición
    explícita del usuario** ("ahí en líneas hay 7 ok cada línea debe de llevar 4 personas"):
    antes mostraba "(0)" porque SORT_LINEA es UNA sola área con 7 puestos reales adentro (a
    diferencia de LINEA1..10 de FFT, que son 10 áreas de catálogo separadas) -- ahora
    `LineasTab.jsx` lee esas 7 estaciones reales directo (mismo dato que `SortingFloorPlan.jsx`)
    y las muestra como si fueran 7 líneas independientes ("Línea de Sorting 1..7"), cada una
    0/4.
  - **Rediseño de las estaciones de "Línea de Sorting", a petición explícita del usuario**
    ("cada punto de extremo a extremo lleva una persona... el dibujo del pallet en vez de que
    esté ahí arriba es abajo"): las 4 personas ahora se muestran una por cada punta real del
    dibujo (2 arriba, en la V; 2 abajo, en la V invertida) en vez de 2 columnas de 2 nombres; el
    ícono del pallet se mueve al final de la tarjeta (antes arriba de todo).
  - **Octava ronda: las 7 líneas de Sorting pasan a ser 7 áreas de catálogo REALMENTE
    independientes, a petición explícita del usuario** ("ahí te falta poner que las líneas sean
    por separado, son 7 líneas independientes, no solo una"): antes eran 1 sola área
    (`SORT_LINEA`) con 7 puestos adentro -- un click en cualquiera de las 7 abría el mismo
    detalle compartido de 28 personas. Ahora son `SORT_LINEA1`..`SORT_LINEA7`, 7 áreas de
    catálogo reales (`kind:'linea'`, igual que `LINEA1`..`LINEA10` de FFT), cada una con su
    propia Workstation real (capacity 4) en la BD (`scripts/split-sort-linea-2026-09-08.mjs`,
    migró los datos existentes sin perder nada real -- Sorting seguía en 0 asignaciones).
    `LineasTab.jsx` vuelve a su mecanismo genérico de siempre (`LINE_FAMILY_WORK_CENTERS`), sin
    ningún caso especial para Sorting; `EstacionesTab.jsx` las agrupa en una sola tarjeta
    sintética "Líneas de Sorting" (mismo patrón que la tarjeta "FFT" ya usaba para sus 11
    líneas).
  - **"Bajas" ahora se filtra por el grupo de área activo, a petición explícita del usuario**
    ("esos son bajas de FFT, en Sorting aún no hay bajas, no sé por qué hay gente de FFT en
    Sorting"): se agrega el mismo filtro `employeeBelongsToActiveGroup()` ya usado en
    Personal/Movimientos -- una baja de alguien que trabajó en FFT nunca aparece viendo Sorting,
    y viceversa.
  - **Demoras de trabajo: la línea elegida ahora se recuerda todo el turno, a petición explícita
    del usuario** ("que si ponen una línea que ya se guarde en automático todo el turno... ya
    solo llenaría los minutos y la causa"): Área/Línea se guardan en `localStorage` por
    usuario+turno (expira solo al cruzar a un turno nuevo) -- después de registrar una demora,
    Causa/Duración/Nota se limpian pero Área/Línea NO, así la siguiente demora del mismo turno
    solo pide esos 2 campos. Investigado el reporte de "a mí no me sale el escoger la línea":
    no es un bug de rol -- el campo Línea siempre aparece igual para cualquier rol en cuanto se
    elige "Líneas de producción" en el campo Área (verificado en vivo con una cuenta
    ADMINISTRADOR de prueba); si no aparecía era porque ese primer paso no se había hecho
    todavía.

- **Bug real: "Asignar a estación" fallaba con "El empleado no tiene una asignación activa
  hoy"** para gente listada en "Personal sin estación" que nunca se había registrado en el día
  (solo aparecía por su zona histórica de snapshot, `source: 'SNAPSHOT'` en
  `getEffectiveTodayRoster`). El botón abría el diálogo de mover (`MoveConfirmDialog`), que
  siempre llama a `moveEmployee()` -- una función que exige una `DailyAssignment` real de hoy
  para "moverla desde ahí" y por diseño rechaza a cualquiera sin una. `MoveConfirmDialog` ahora
  detecta `currentAssignment.source === 'SNAPSHOT'` y en ese caso llama a `checkInEmployee()`
  (primer registro del día) en vez de `moveEmployee()` -- mismo patrón que ya usaba
  `handleAssignSuggested` en `LineDetailDrawer.jsx` para candidatos sugeridos sin asignación.

- **El buscador de Usuarios se autocompletaba con el número de empleado de quien tenía la
  sesión abierta.** El campo de número de empleado del login usa `autoComplete="username"` a
  propósito (para que el navegador pueda ofrecer guardar la sesión) -- el navegador terminaba
  reutilizando ese mismo valor guardado en el buscador de `UsuariosPage.jsx`, que no declaraba
  ningún `autoComplete` propio. Se agrega `autoComplete="off"` explícito a ese campo.

- **`autoComplete="off"` (fix anterior) no fue suficiente** -- a petición explícita del usuario,
  que seguía viendo su número de empleado autocompletado solo en ese buscador tras un refresh.
  Chrome ignora "off" a propósito en campos que su heurística interna cree que son de login
  (comportamiento documentado del navegador, no un descuido del fix anterior). Se cambia a
  `autoComplete="new-password"` -- token que Chrome sí respeta de verdad y nunca rellena con un
  valor guardado, aunque el campo no sea una contraseña -- más un `name` propio
  (`usuarios-filtro-busqueda`) para que tampoco lo asocie por nombre con el campo del login, y
  `data-1p-ignore`/`data-lpignore` para gestores de contraseñas de terceros (1Password, LastPass).

- **El personal podía moverse/asignarse "solo", sin acción explícita de un ADMINISTRADOR o
  SUPERVISOR, a petición explícita del usuario ("no quiero que se muevan solos, solo yo u otro
  administrador o supervisor pueden moverlo").** Auditoría completa de todos los caminos que
  escriben una ubicación de personal; se encontraron y corrigieron 2 bugs reales:
  1. `reconcileLineAssignments()` (`repository.js`) escribía asignaciones REALES (auto check-in,
     auto-move a la siguiente estación libre) con solo **abrir** cualquier vista de área/línea
     (WC LINEA, Midea, Paletizado, Accesorios, Insumos), para cualquier rol — se quitó el
     auto-run de los 3 `useEffect` que lo disparaban (`LineDetailDrawer.jsx`,
     `LineLikeAreaDetail.jsx`, `OperationalAreaDetail.jsx`). Quien necesita estación se sigue
     viendo en "Personal sin estación" y se corrige con la acción explícita "Asignar a estación".
  2. Los endpoints `/api/personnel/move`, `/release` y `/swap` solo exigían `requireAuth`
     (cualquier rol autenticado), sin `requireRole` — un LIDER podía mover/quitar/intercambiar
     personal pegándole al endpoint directo, saltándose por completo el flujo de aprobación
     (`request-move`/`approve-move`) que el propio código ya documentaba como regla de negocio
     pero solo aplicaba del lado del cliente. Ahora los 3 exigen
     `requireRole(['SUPERVISOR', 'ADMINISTRADOR'])`, igual que ya hacían `approve-move.js`/
     `reject-move.js`. El drag&drop (`dndAssign.jsx`) ahora también avisa con un mensaje claro
     en vez de un error crudo si un LIDER intenta swap/release directo. `checkin.js` se deja sin
     cambio (`requireAuth`) — el primer registro del día nunca fue "mover". Confirmado que esto
     aplica igual para FFT y Sorting (y cualquier área futura): `repository.js` y las rutas
     `api/personnel/*` son agnósticas de catálogo, nunca importan `catalogSorting.js` ni
     `WORK_CENTERS` directo. Deploy/build revisado también: ningún script de `scripts/*.mjs`
     está enganchado a un hook automático (`postinstall`/`prestart`), todos son one-offs
     manuales.

- **Dashboard: 2 métricas más seguían mezclando FFT y Sorting** (a petición explícita del
  usuario, "en el área de sorting me sale esos datos pero esos datos son de FFT... son dos
  áreas independientes"), el mismo tipo de bug que `getDailyMovementsBreakdown`/
  `getRecentActivity` ya tenían corregido desde el 2026-09-08 pero que no se había replicado en
  todas las métricas del Dashboard:
  - `getShiftDistribution()` (donut "Distribución por turno") contaba TODAS las asignaciones con
    turno oficial sin filtrar por `areaIdBelongsToActiveGroup`, así que el donut de Sorting
    mostraba el total real de FFT (78 personas en Matutino, aunque Sorting no tuviera nadie
    asignado).
  - `movementsToday`/`pendingMovesCount` (hallazgo "N movimientos registrados hoy" y aprobaciones
    pendientes) usaban `getMovesCountForDate()`/`getPendingMoves()` sin el mismo filtro.
  Los 3 ya usan `areaIdBelongsToActiveGroup` sobre el área de destino, igual que el resto del
  Dashboard.
- **Estaciones: "Patines" ya no aparece** en el catálogo de estaciones de Sorting -- a petición
  explícita del usuario ("ahí no va personal así que no debe de estar en estaciones"). Ya estaba
  documentado en el código como equipo físico sin personal (`SORT_PATINES equipment: true`,
  catalogSorting.js) pero seguía listado como una tarjeta más en `EstacionesTab.jsx`; se quita
  esa entrada (sigue existiendo en el catálogo/plano de planta para otros usos, solo se retira de
  la vista de Estaciones). Baja el conteo de "Áreas totales" de 11 a 10, correctamente.
- **5 registros de prueba de Demoras + 1 evaluación 5S de prueba, borrados de producción** a
  petición explícita del usuario ("son mías y las hice para probar el módulo... ya no quiero que
  salgan aquí por motivos de producción"). Ninguno de los 2 módulos tenía una función de borrado
  (ni en la API ni en la UI) -- verificado antes con una consulta de solo lectura que eran
  EXACTAMENTE esos registros (mismo usuario, mismo contenido que las capturas de pantalla que
  dio como referencia), y se borraron con un script de un solo uso
  (`scripts/delete-test-demoras-and-evaluacion-2026-09-10.mjs`, mismo patrón que los demás
  scripts de mantenimiento de este repo) por sus ids específicos, no por un filtro amplio.
  `FiveSAuditAnswer` se borró solo vía `onDelete: cascade`.
- **La barra lateral empujaba la página al hacer scroll hasta su límite**, a petición explícita
  del usuario ("si le doy hasta abajo y llega al límite que mi página la que está atrás no se
  mueva hacia abajo... la barra ya no se mueve para abajo porque ya llegó hasta el último módulo
  pero la página sí se va para abajo"): scroll chaining del navegador -- al agotar el scroll
  interno del `<nav>` de `Sidebar.jsx`, el evento de rueda se propagaba al contenedor de la
  página. Se agrega `overscroll-behavior-y: contain` (clase `overscroll-y-contain`) a ese `<nav>`
  para que el scroll se quede contenido ahí.
- **Favicon con fondo blanco visible en la pestaña del navegador**, a petición explícita del
  usuario ("quitar el fondo blanco de atrás que quede como los otros dos"): `centro-control-
  icon.png` (usado en `index.html` para `<link rel="icon">`) era una imagen RGB opaca, sin canal
  alfa -- se volvió transparente el fondo casi-blanco (`centro-control-icon-dark.png`, la versión
  para fondo oscuro del sidebar, ya era transparente desde antes). `apple-touch-icon` se separa a
  su propio archivo (`centro-control-icon-apple.png`, misma imagen pero opaca) a propósito: iOS
  no maneja bien la transparencia en el ícono de "Agregar a inicio", la rellena de negro.
- **"Línea de Sorting 1" se veía vertical, no horizontal** (a petición explícita del usuario tras
  ver el plano en vivo, "la línea 1 no está en horizontal está en vertical"): el contenedor de
  las 8 líneas es un grid de 8 columnas, y CSS Grid estira por default todos los elementos de una
  fila a la misma altura -- la línea 1 quedaba tan alta como las 7 "V" aunque su contenido fuera
  corto. Se rehace con el mismo estilo de franja delgada que "Conveyor de Sorting" (personas en
  una sola fila, no en una tarjeta) y `self-start` para que no se estire a la altura de las V.
- **"Línea de Sorting 1" seguía viéndose vertical** tras el fix anterior, a petición explícita del
  usuario ("sigue en vertical... debes de poner una que está en vertical a horizontal"): el fix
  de altura (`self-start`) no bastaba porque el ancho seguía siendo el mismo de una sola columna
  (1/8 del grid) -- con tan poco ancho, las 4 personas igual se apilaban en 4 líneas, angosto y
  con varias líneas, así que seguía leyéndose vertical sin importar la altura. El fix real es de
  ancho: el grid pasa de 8 a 9 columnas (`sm:grid-cols-9`), las 7 "V" siguen ocupando 1 columna
  cada una y esta franja ahora ocupa 2 (`sm:col-span-2`) -- el doble de ancho, suficiente para
  que las 4 personas quepan en una fila de verdad.
- **"Línea de Sorting 1" ya horizontal, pero con diseño distinto a las otras 7 y pegada arriba**
  (a petición explícita del usuario tras confirmar que el fix de ancho funcionó, "ya está en
  horizontal pero no tiene el diseño como las otras 7, quiero el mismo diseño y que la card esté
  en medio, ahorita está muy arriba"): se reemplaza el estilo de franja delgada (heredado de
  "Conveyor de Sorting") por el mismo diseño exacto de las 7 "V" (tarjeta `border-2 rounded-xl`,
  mismo fondo según si tiene gente asignada, mismo ícono de tarima abajo) -- la única diferencia
  real ahora es que las 4 personas se acomodan en una fila en vez de una V. Se cambia también
  `self-start` por `self-center` para que quede centrada verticalmente en su celda del grid en
  vez de pegada arriba.

### Pending (bloqueado en credenciales externas — ver checklist entregado al usuario)
- Ninguno -- SSO de Nextcloud confirmado funcionando en vivo (ver Fixed
  arriba: 3 bugs reales encontrados y corregidos en el camino -- ruta de
  callback, Path de cookies, y extracción de id en decide.js).

## [1.0.0]

Estado de producción antes de iniciar la migración de stack. Gestión
completa de personal de piso: asignación diaria por estación, movimientos
con aprobación (LIDER → SUPERVISOR/ADMINISTRADOR), asistencia, catálogo de
personal importado desde Excel (con colas de revisión para conflictos de
baja/duplicados), permisos por rol y por usuario, y un plano operativo 2D
del piso (WC Líneas 0-10, Paletizado, Accesorios, Insumos, Midea/High
Value, Conveyor). Desplegado en Vercel con integración automática de
GitHub (`desarrollo-personal` → Preview, `main` → Producción).
