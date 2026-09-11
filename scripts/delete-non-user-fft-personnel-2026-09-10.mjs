// One-shot (2026-09-10, a peticion explicita del usuario, "quitar a toda la gente que tenemos
// en fft toda menos a los que estan en usuarios... ya los demas los eliminas" -- confirmado via
// AskUserQuestion: alcance "limpieza total antes de mañana" + metodo "borrado permanente de la
// DB", con advertencia explicita de que esto borra tambien el historial real asociado
// (asistencias/asignaciones/movimientos) y es irreversible, aceptada por el usuario).
//
// Deja en Employee SOLO a los 10 numeros de empleado que corresponden a cuentas reales de User
// (7 de ellos tienen ficha de Employee hoy; los otros 3 -- 3647/3468/3651 -- son solo cuentas
// de sistema sin ficha de personal). Borra TODO lo demas de FFT (Sorting no se toca: 0
// empleados con asignacion activa ahi hoy, confirmado antes de correr esto).
//
// Orden de borrado (children antes que Employee, por los 8 FKs con onDelete RESTRICT
// confirmados via information_schema contra la DB real):
//   Attendance, DailyAssignment, EmployeeImportSource, EmployeeMovement,
//   EmployeeReconciliationCandidate, EmployeeSkill, ImportedAttendanceReference, PendingMove
// Los 4 FKs con onDelete SET NULL (BajaConflict, FiveSAudit, ProcessAudit, User) no requieren
// limpieza manual -- Postgres los pone a NULL solo, preservando esos registros.
// Todo en una sola transaccion: o se aplica completo, o no se aplica nada.
import { inArray, sql } from 'drizzle-orm'
import {
  attendance,
  dailyAssignment,
  db,
  employee,
  employeeImportSource,
  employeeMovement,
  employeeReconciliationCandidate,
  employeeSkill,
  importedAttendanceReference,
  pendingMove,
} from '../server-lib/db/client.js'

// Los 10 numeros de las cuentas User reales (7 tienen ficha Employee hoy; 3647/3468/3651 no
// tienen ficha Employee -- se incluyen igual por seguridad, a peticion explicita del usuario
// ("debes de dejar a christopher y a mi 3647"), asi nunca se borran si llegaran a existir.
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

async function main() {
  await db.transaction(async (tx) => {
    const toDelete = await tx
      .select({
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        fullName: employee.fullName,
      })
      .from(employee)
      .where(
        sql`${employee.employeeNumber} IS NULL OR ${employee.employeeNumber} NOT IN ${KEEP_NUMBERS}`,
      )

    const ids = toDelete.map((e) => e.id)
    console.log(
      `Empleados a borrar: ${ids.length} (de ${ids.length + KEEP_NUMBERS.length} totales esperados a conservar: ${KEEP_NUMBERS.length})`,
    )

    if (ids.length === 0) {
      console.log('Nada que borrar.')
      return
    }

    const att = await tx
      .delete(attendance)
      .where(inArray(attendance.employeeId, ids))
      .returning({ id: attendance.id })
    console.log('Attendance borrados:', att.length)

    const da = await tx
      .delete(dailyAssignment)
      .where(inArray(dailyAssignment.employeeId, ids))
      .returning({ id: dailyAssignment.id })
    console.log('DailyAssignment borrados:', da.length)

    const eis = await tx
      .delete(employeeImportSource)
      .where(inArray(employeeImportSource.employeeId, ids))
      .returning({ id: employeeImportSource.id })
    console.log('EmployeeImportSource borrados:', eis.length)

    const em = await tx
      .delete(employeeMovement)
      .where(inArray(employeeMovement.employeeId, ids))
      .returning({ id: employeeMovement.id })
    console.log('EmployeeMovement borrados:', em.length)

    const erc = await tx
      .delete(employeeReconciliationCandidate)
      .where(inArray(employeeReconciliationCandidate.existingEmployeeId, ids))
      .returning({ id: employeeReconciliationCandidate.id })
    console.log('EmployeeReconciliationCandidate borrados:', erc.length)

    const es = await tx
      .delete(employeeSkill)
      .where(inArray(employeeSkill.employeeId, ids))
      .returning({ id: employeeSkill.id })
    console.log('EmployeeSkill borrados:', es.length)

    const iar = await tx
      .delete(importedAttendanceReference)
      .where(inArray(importedAttendanceReference.employeeId, ids))
      .returning({ id: importedAttendanceReference.id })
    console.log('ImportedAttendanceReference borrados:', iar.length)

    const pm = await tx
      .delete(pendingMove)
      .where(inArray(pendingMove.employeeId, ids))
      .returning({ id: pendingMove.id })
    console.log('PendingMove borrados:', pm.length)

    const emp = await tx
      .delete(employee)
      .where(inArray(employee.id, ids))
      .returning({ id: employee.id })
    console.log('Employee borrados:', emp.length)
  })

  const remaining = await db.select().from(employee)
  console.log(`\nEmployee restantes: ${remaining.length}`)
  for (const e of remaining) console.log(' -', e.employeeNumber, e.fullName)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('ERROR -- transaccion revertida, nada se borro:', e)
    process.exit(1)
  })
