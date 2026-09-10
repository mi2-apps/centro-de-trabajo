// One-shot (2026-09-10, a peticion explicita del usuario viendo el plano de Sorting en vivo --
// "las lineas en vertical son del 2 al 8... y agregas una nueva linea la 1 que es en horizontal,
// la pones a lado derecho de la linea 8"):
//
// 1) Renombra WorkArea.name/Workstation.name de SORT_LINEA1..7 (ids SIN cambiar, para no perder
//    su historial real de asignaciones/demoras ya capturado) de "Línea de Sorting 1..7" a
//    "Línea de Sorting 2..8" -- mismo shift que ya se hizo en catalogSorting.js.
// 2) Sube la capacidad real de SORT_LINEA7 (ahora "Línea de Sorting 8") de 4 a 5 -- confirmado
//    explicitamente por el usuario, no un valor inventado.
// 3) Crea SORT_LINEA8 (WorkArea + Workstation nuevos, capacity 4) -- la nueva "Línea de Sorting
//    1", horizontal, que no existia antes.
//
// Idempotente: si un WorkArea ya tiene el nombre nuevo, se omite; si SORT_LINEA8 ya existe, no se
// duplica.
import { desc, eq } from 'drizzle-orm'
import { db, workArea, workstation } from '../server-lib/db/client.js'

const RENAMES = [
  { code: 'SORT_LINEA1', name: 'Línea de Sorting 2' },
  { code: 'SORT_LINEA2', name: 'Línea de Sorting 3' },
  { code: 'SORT_LINEA3', name: 'Línea de Sorting 4' },
  { code: 'SORT_LINEA4', name: 'Línea de Sorting 5' },
  { code: 'SORT_LINEA5', name: 'Línea de Sorting 6' },
  { code: 'SORT_LINEA6', name: 'Línea de Sorting 7' },
  { code: 'SORT_LINEA7', name: 'Línea de Sorting 8', capacity: 5 },
]

async function main() {
  for (const { code, name, capacity } of RENAMES) {
    const [area] = await db.select().from(workArea).where(eq(workArea.code, code)).limit(1)
    if (!area) {
      console.log(`${code}: WorkArea no encontrada -- se omite (¿ya migrado o entorno distinto?)`)
      continue
    }
    if (area.name !== name) {
      await db.update(workArea).set({ name }).where(eq(workArea.id, area.id))
      console.log(`${code}: WorkArea renombrada a "${name}"`)
    } else {
      console.log(`${code}: WorkArea ya tenia el nombre "${name}"`)
    }

    const stationValues = { name }
    if (capacity != null) stationValues.capacity = capacity
    const stations = await db.select().from(workstation).where(eq(workstation.workAreaId, area.id))
    for (const station of stations) {
      const needsNameUpdate = station.name !== name
      const needsCapacityUpdate = capacity != null && station.capacity !== capacity
      if (needsNameUpdate || needsCapacityUpdate) {
        await db.update(workstation).set(stationValues).where(eq(workstation.id, station.id))
        console.log(
          `  Workstation ${station.id}: actualizada (name="${name}"${capacity != null ? `, capacity=${capacity}` : ''})`,
        )
      }
    }
  }

  const [existingNew] = await db
    .select()
    .from(workArea)
    .where(eq(workArea.code, 'SORT_LINEA8'))
    .limit(1)
  if (existingNew) {
    console.log('SORT_LINEA8: ya existe, se omite la creacion.')
  } else {
    const [maxOrder] = await db
      .select({ displayOrder: workArea.displayOrder })
      .from(workArea)
      .orderBy(desc(workArea.displayOrder))
      .limit(1)
    const order = (maxOrder?.displayOrder ?? 0) + 1
    const [createdWorkArea] = await db
      .insert(workArea)
      .values({
        code: 'SORT_LINEA8',
        name: 'Línea de Sorting 1',
        displayOrder: order,
        active: true,
      })
      .returning()
    const [createdWorkstation] = await db
      .insert(workstation)
      .values({
        workAreaId: createdWorkArea.id,
        name: 'Línea de Sorting 1',
        capacity: 4,
        displayOrder: 1,
        active: true,
      })
      .returning()
    console.log(
      `SORT_LINEA8: creado WorkArea ${createdWorkArea.id} + Workstation ${createdWorkstation.id}`,
    )
  }

  await db.$client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
