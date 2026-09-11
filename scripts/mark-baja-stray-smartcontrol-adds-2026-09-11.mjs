// One-shot (2026-09-11, a peticion explicita del usuario, viendo "Personal sin asignar" con 9
// personas: "borra a esos tambien porfa debe estar ahi ya en 0 ok ya mañana se empieza con la
// toma de asistencia"): las 14 altas automaticas que el sync de SmartControl
// (server-lib/personnel-sync.js) aplico a las 00:42 del 2026-09-11 (folio real + WorkCenterID=49
// + actividad reciente en los ultimos 30 dias) quedaron sin area asignada (areaZona:'PRODUCCION'
// nunca mapea a un WORK_CENTER, a proposito, ver mapAreaZonaToId) -- antes de empezar la toma de
// asistencia real de mañana, se marcan BAJA (mismo mecanismo real de
// api/personnel/set-unassigned-reason.js: unassignedReason='BAJA' + active=false) para que no
// aparezcan en "Personal sin asignar". Se deja intacto a los 7 numeros de empleado protegidos.
// No se borran (a diferencia del script anterior): borrar solo haria que el proximo corrido del
// sync de SmartControl (cada ~30 min) los vuelva a crear, ya que la ALTA automatica solo se salta
// numeros de empleado que YA EXISTEN en Employee (sin importar active) -- marcarlos BAJA sí evita
// que se recreen, y tampoco los reactiva la BAJA automatica del mismo sync (nunca reactiva a
// nadie, solo desactiva).
import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { db, employee } from '../server-lib/db/client.js'

const KEEP_NUMBERS = [
  '3647',
  '2678',
  '3468',
  '2570',
  '3651',
  '2986',
  '3048',
  '3743',
  '2738',
  '4028',
]
const ROMAN_USER_ID = 'cmsyyxuia00006kldashukrjf' // empleado 3647, Administrador

async function main() {
  const candidates = await db
    .select()
    .from(employee)
    .where(and(eq(employee.active, true), isNotNull(employee.employeeNumber)))

  const toBaja = candidates.filter((e) => !KEEP_NUMBERS.includes(e.employeeNumber))
  console.log(`Marcando BAJA a ${toBaja.length} de ${candidates.length} activos con numero:`)
  for (const e of toBaja) console.log(' -', e.employeeNumber, e.fullName)

  if (toBaja.length === 0) return

  const now = new Date()
  await db
    .update(employee)
    .set({
      unassignedReason: 'BAJA',
      unassignedReasonSetAt: now,
      unassignedReasonSetByUserId: ROMAN_USER_ID,
      active: false,
      updatedAt: now,
    })
    .where(
      inArray(
        employee.id,
        toBaja.map((e) => e.id),
      ),
    )
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
