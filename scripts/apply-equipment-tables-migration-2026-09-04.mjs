// Aplica manualmente drizzle/0009_add_equipment_tables.sql -- drizzle-kit generate pide
// confirmacion interactiva (TTY) que nunca llega en este shell, mismo problema ya documentado en
// apply-audit-evaluation-migration-2026-09-02.mjs / apply-downtime-record-migration-2026-09-04.mjs.
// Idempotente: verifica que la tabla no exista antes de crearla, seguro de re-correr.
import { readFileSync } from 'node:fs'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const { rows } = await pool.query(`SELECT to_regclass('public."EquipmentItem"') as exists`)
if (rows[0].exists) {
  console.log('[SKIP] La tabla EquipmentItem ya existe.')
  await pool.end()
  process.exit(0)
}

const sql = readFileSync(
  new URL('../drizzle/0009_add_equipment_tables.sql', import.meta.url),
  'utf8',
)
const statements = sql.split('--> statement-breakpoint').map((s) => s.trim())
for (const stmt of statements) {
  if (!stmt) continue
  await pool.query(stmt)
  console.log('[OK] Ejecutado:', stmt.slice(0, 70).replace(/\n/g, ' '), '...')
}

console.log('[DONE] Migracion de tablas de equipo aplicada.')
await pool.end()
