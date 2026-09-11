// One-shot (2026-09-11, a peticion explicita del usuario: "agrega a lizbeth porfa ella es lider
// y tiene usario en la pagina asi que la puedes agregar porfa sin problema"): crea la ficha de
// personal (Employee) que le faltaba -- ella ya es LIDER real con cuenta de Usuario (empleado
// 3651, "Lizbeth Monsiva", creada 2026-09-08) pero, a diferencia de los otros 6 lideres +
// gerente, nunca tuvo una fila Employee -- por eso no aparecio entre los 7 conservados en la
// limpieza de personal FFT de esta sesion. Mismo patron que los demas: solo employeeNumber +
// fullName + active=true, sin vincular User.employeeId (ninguno de los otros 7 lo tiene
// vinculado tampoco).
import { eq } from 'drizzle-orm'
import { db, employee } from '../server-lib/db/client.js'

async function main() {
  const [existing] = await db
    .select()
    .from(employee)
    .where(eq(employee.employeeNumber, '3651'))
    .limit(1)
  if (existing) {
    console.log('Ya existe, no se duplica:', existing.id, existing.fullName)
    return
  }
  const [created] = await db
    .insert(employee)
    .values({
      employeeNumber: '3651',
      fullName: 'Lizbeth Monsiva',
      active: true,
      updatedAt: new Date(),
    })
    .returning()
  console.log('Creado:', created.id, created.employeeNumber, created.fullName)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
