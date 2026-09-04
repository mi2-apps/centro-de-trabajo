// Aplica drizzle/0011_hourly_production_fixed_losses.sql de forma idempotente (mismo patron ya
// establecido para 0010: drizzle-kit generate cuelga con el TTY interactivo de este shell, asi
// que la migracion se escribe a mano y se aplica con este script, verificando el estado real de
// la BD antes de cada paso en vez de asumir que nunca se corrio).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { db } from '../server-lib/db/client.js'

const sql = readFileSync(
  fileURLToPath(new URL('../drizzle/0011_hourly_production_fixed_losses.sql', import.meta.url)),
  'utf8',
)

const [{ exists: sessionHasLossUnit }] = (
  await db.execute(
    `select exists (
       select 1 from information_schema.columns
       where table_name = 'HourlyProductionSession' and column_name = 'lossUnit'
     ) as exists`,
  )
).rows

if (sessionHasLossUnit) {
  console.log('Ya aplicada -- HourlyProductionSession.lossUnit ya existe. Nada que hacer.')
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

console.log('Migracion 0011 aplicada correctamente.')
process.exit(0)
