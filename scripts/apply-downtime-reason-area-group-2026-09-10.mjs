// Aplica drizzle/0016_downtime_reason_area_group.sql de forma idempotente -- mismo patron
// establecido en apply-downtime-reason-2026-09-08.mjs (drizzle-kit generate cuelga con el TTY
// interactivo de este shell). Agrega DowntimeReason.areaGroup ('FFT'/'SORTING', default 'FFT')
// para que las causas dinamicas de Demoras tambien respeten la separacion FFT/Sorting, a
// peticion explicita del usuario (2026-09-10, "nuevo modulo asi... eso va para el area de
// sorting" -- Demoras nunca debio compartir catalogo de causas entre las 2 areas).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { db } from '../server-lib/db/client.js'

const sql = readFileSync(
  fileURLToPath(new URL('../drizzle/0016_downtime_reason_area_group.sql', import.meta.url)),
  'utf8',
)

const [{ exists: alreadyApplied }] = (
  await db.execute(`
    select exists (
      select 1 from information_schema.columns
      where table_name = 'DowntimeReason' and column_name = 'areaGroup'
    ) as exists
  `)
).rows

if (alreadyApplied) {
  console.log('Ya aplicada -- DowntimeReason.areaGroup ya existe. Nada que hacer.')
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

console.log('Migracion 0016 aplicada correctamente.')
process.exit(0)
