// Aplica drizzle/0012_add_sorting.sql de forma idempotente (mismo patron ya establecido: verifica
// el estado real de la BD antes de cada paso en vez de asumir que nunca se corrio).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { db } from '../server-lib/db/client.js'

const sql = readFileSync(
  fileURLToPath(new URL('../drizzle/0012_add_sorting.sql', import.meta.url)),
  'utf8',
)

const [{ exists: alreadyApplied }] = (
  await db.execute(`select (to_regclass('public."SortingSession"') is not null) as exists`)
).rows

if (alreadyApplied) {
  console.log('Ya aplicada -- SortingSession ya existe. Nada que hacer.')
  process.exit(0)
}

const statements = sql
  .split('--> statement-breakpoint')
  .map((s) => s.trim())
  .filter(Boolean)

for (const statement of statements) {
  console.log('Ejecutando:', statement.slice(0, 80).replace(/\s+/g, ' '), '...')
  await db.execute(statement)
}

console.log('Migracion 0012 (Sorting) aplicada correctamente.')
process.exit(0)
