// One-shot (2026-09-11, a peticion explicita del usuario: "en el apartado de bajas vacialo
// porfa por que si mañana tomo asistencia no quiero que choquen ok eliminalos porfa"): revierte
// la marca BAJA que se les puso hace un momento (scripts/mark-baja-stray-smartcontrol-adds-
// 2026-09-11.mjs) a los 14 Employee agregados por el sync automatico de SmartControl -- el
// usuario aclaro que quiere el apartado de "Bajas" completamente vacio (reservado a futuro solo
// para gente que el confirme personalmente como baja real), y que marcarlos BAJA los habria
// bloqueado de verdad (Employee.active=false) si alguno de ellos SI se presenta mañana con su
// numero real -- "no quiero que choquen". Se borran por completo en vez de reactivarlos: si son
// gente real que sigue trabajando, se recrean solos (SmartControl sync o check-in real de
// mañana); si no vuelven a aparecer, es evidencia de que ya no aplica el alta automatica.
import { inArray } from 'drizzle-orm'
import { db, employee } from '../server-lib/db/client.js'

const NUMBERS_TO_DELETE = [
  '2573',
  '2657',
  '2701',
  '2831',
  '3077',
  '3085',
  '3175',
  '3276',
  '3402',
  '3479',
  '3555',
  '3595',
  '3650',
  '3912',
]

async function main() {
  const rows = await db
    .select()
    .from(employee)
    .where(inArray(employee.employeeNumber, NUMBERS_TO_DELETE))
  console.log(`Borrando ${rows.length} de ${NUMBERS_TO_DELETE.length} esperados:`)
  for (const e of rows) console.log(' -', e.employeeNumber, e.fullName)

  if (rows.length === 0) return
  const deleted = await db
    .delete(employee)
    .where(
      inArray(
        employee.id,
        rows.map((e) => e.id),
      ),
    )
    .returning({ id: employee.id })
  console.log('Borrados:', deleted.length)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
