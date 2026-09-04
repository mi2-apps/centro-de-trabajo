/* Catálogo real de tipos de equipo físico (2026-09-04, a petición explícita del usuario --
   "vas hacer otro modulo Control de equipo, #fisicas Impresora/Pistola de calor/Pistola para
   cushion/Tablet/Radio/scaner/Maquina de cinta cafe/Flejadora/Patin"). Config centralizada aquí
   (nunca hardcodeada en el componente), mismo criterio que src/data/demoras/catalog.js.

   Cada registro real (EquipmentItem) es una OBSERVACION/EVENTO de estado de un equipo concreto
   (mismo patron "registro append-only" que DowntimeRecord) -- no un maestro editable de
   inventario. El checklist formal periodico ("Levantamiento de equipos") vive dentro del modulo
   Auditoria como un 3er tipo de auditoria (src/data/auditsEquipo/criteria.js), a peticion
   explicita del usuario ("en el modulo de auditoria se debe hacer el check list"). */
export const EQUIPMENT_TYPES = [
  { key: 'impresora' },
  { key: 'pistola-calor' },
  { key: 'pistola-cushion' },
  { key: 'tablet' },
  { key: 'radio' },
  { key: 'escaner' },
  { key: 'cinta-cafe' },
  { key: 'flejadora' },
  { key: 'patin' },
]

export const EQUIPMENT_TYPE_KEYS = new Set(EQUIPMENT_TYPES.map((e) => e.key))

export const EQUIPMENT_STATUSES = ['OPERATIVO', 'DANADO', 'EN_REPARACION', 'BAJA']
