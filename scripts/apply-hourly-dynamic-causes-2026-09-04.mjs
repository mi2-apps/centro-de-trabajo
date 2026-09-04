// Aplica drizzle/0013_hourly_dynamic_causes.sql de forma idempotente (mismo patron ya
// establecido: drizzle-kit generate cuelga con el TTY interactivo de este shell). Ademas de la
// migracion DDL, siembra el catalogo de causas de LINEAS con las mismas 11 causas que ya existian
// como columnas fijas (2026-09-04 v1) -- para que ese grupo de area siga funcionando exactamente
// igual por defecto, ahora editable por el admin en vez de fijo en codigo.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { db, hourlyProductionDowntimeCause } from '../server-lib/db/client.js'

const sql = readFileSync(
  fileURLToPath(new URL('../drizzle/0013_hourly_dynamic_causes.sql', import.meta.url)),
  'utf8',
)

const [{ exists: tableExists }] = (
  await db.execute(
    `select exists (
       select 1 from information_schema.tables
       where table_name = 'HourlyProductionDowntimeCause'
     ) as exists`,
  )
).rows

if (!tableExists) {
  const statements = sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const statement of statements) {
    console.log('Ejecutando:', statement.slice(0, 80).replace(/\s+/g, ' '), '...')
    await db.execute(statement)
  }
  console.log('Migracion 0013 aplicada correctamente.')
} else {
  console.log('Ya aplicada -- HourlyProductionDowntimeCause ya existe. Se salta el DDL.')
}

const LINEAS_CAUSES = [
  'Material virgen',
  'Material de almacén',
  'Sistema',
  'Internet',
  'Escáner',
  'Impresora',
  'Etiquetas',
  'LPN / Pallet',
  'Falta de personal',
  'Calidad',
  'Otra',
]

function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const [{ count: existingCount }] = (
  await db.execute(
    `select count(*)::int as count from "HourlyProductionDowntimeCause" where "areaGroupKey" = 'LINEAS'`,
  )
).rows

if (existingCount > 0) {
  console.log(`Ya sembrado -- LINEAS ya tiene ${existingCount} causa(s). Se salta el seed.`)
} else {
  await db.insert(hourlyProductionDowntimeCause).values(
    LINEAS_CAUSES.map((name, i) => ({
      areaGroupKey: 'LINEAS',
      name,
      code: slugify(name),
      sortOrder: (i + 1) * 10,
    })),
  )
  console.log(`Sembradas ${LINEAS_CAUSES.length} causas para LINEAS.`)
}

process.exit(0)
