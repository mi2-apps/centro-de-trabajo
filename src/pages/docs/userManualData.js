// User Manual -- ayuda real para usuarios finales (MI Stack Reference,
// sección 17a, HARD RULE). Contenido separado de la presentación
// (UserManualPage.jsx). Refleja el estado REAL de cada módulo -- se
// actualiza en cada cambio real (2026-09-04, a peticion explicita del
// usuario: "ve actualizando esas 3 cada vez que se actualice algo... deben
// estar a la mano con la pagina web"), nunca se inventa funcionalidad que
// todavia no existe. KPI's/Asistencia/Auditoría/Evaluaciones YA estan
// disponibles (dejaron de ser ComingSoonPage hace varias sesiones) -- antes
// este archivo seguia diciendo "próximamente"/"en construcción" para los 3
// primeros, y Evaluaciones ni siquiera aparecia en la lista.
//
// Textos traducibles movidos a public/locales/*/docs.json (namespace
// "docs", sub-objeto "userManualData") -- este archivo solo guarda
// estructura/IDs estables (nameKey/statusLabelKey/bodyKey). `status` sigue
// siendo un literal 'disponible' / 'próximamente' SIN traducir -- es un
// código interno de lógica que UserManualPage.jsx compara para elegir el
// variant del Badge (`mod.status === 'disponible' ? 'success' : 'outline'`).
// Como ese mismo valor también se muestra como texto del Badge,
// `statusLabelKey` aparte resuelve la etiqueta visible traducible sin tocar
// el literal de lógica. `nameKey` referencia claves YA existentes en
// public/locales/*/navigation.json (mismo texto exacto, ya extraído ahí).

export const MODULES = [
  {
    nameKey: 'dashboard',
    status: 'disponible',
    statusLabelKey: 'statusDisponible',
    bodyKey: 'dashboardBody',
  },
  {
    nameKey: 'centroDeTrabajo',
    status: 'disponible',
    statusLabelKey: 'statusDisponible',
    bodyKey: 'centroTrabajoBody',
  },
  {
    nameKey: 'usuarios',
    status: 'disponible',
    statusLabelKey: 'statusDisponible',
    bodyKey: 'usuariosBody',
  },
  {
    nameKey: 'registroDePersonal',
    status: 'disponible',
    statusLabelKey: 'statusDisponible',
    bodyKey: 'registroPersonalBody',
  },
  {
    nameKey: 'kpis',
    status: 'disponible',
    statusLabelKey: 'statusDisponible',
    bodyKey: 'kpisBody',
  },
  {
    nameKey: 'asistencia',
    status: 'disponible',
    statusLabelKey: 'statusDisponible',
    bodyKey: 'asistenciaBody',
  },
  {
    nameKey: 'auditoria',
    status: 'disponible',
    statusLabelKey: 'statusDisponible',
    bodyKey: 'auditoriaBody',
  },
  {
    nameKey: 'evaluaciones',
    status: 'disponible',
    statusLabelKey: 'statusDisponible',
    bodyKey: 'evaluacionesBody',
  },
  {
    nameKey: 'demoras',
    status: 'disponible',
    statusLabelKey: 'statusDisponible',
    bodyKey: 'demorasBody',
  },
  {
    nameKey: 'controlEquipo',
    status: 'disponible',
    statusLabelKey: 'statusDisponible',
    bodyKey: 'controlEquipoBody',
  },
  {
    nameKey: 'horaPorHora',
    status: 'disponible',
    statusLabelKey: 'statusDisponible',
    bodyKey: 'horaPorHoraBody',
  },
  {
    nameKey: 'sorting',
    status: 'disponible',
    statusLabelKey: 'statusDisponible',
    bodyKey: 'sortingBody',
  },
  {
    nameKey: 'organigrama',
    status: 'proximamente',
    statusLabelKey: 'statusProximamente',
    bodyKey: 'organigramaBody',
  },
  {
    nameKey: 'planeacion',
    status: 'proximamente',
    statusLabelKey: 'statusProximamente',
    bodyKey: 'planeacionBody',
  },
  {
    nameKey: 'rechazoInterno',
    status: 'proximamente',
    statusLabelKey: 'statusProximamente',
    bodyKey: 'rechazoInternoBody',
  },
  {
    nameKey: 'ppmInterno',
    status: 'proximamente',
    statusLabelKey: 'statusProximamente',
    bodyKey: 'ppmInternoBody',
  },
]

export const FAQ = [
  { questionKey: 'faq1Question', answerKey: 'faq1Answer' },
  { questionKey: 'faq2Question', answerKey: 'faq2Answer' },
  { questionKey: 'faq3Question', answerKey: 'faq3Answer' },
]
