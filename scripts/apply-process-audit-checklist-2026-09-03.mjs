// Aplica manualmente drizzle/0007_process_audit_checklist.sql -- mismo motivo que los scripts
// apply-*.mjs anteriores (drizzle-kit migrate se queda colgado sin salida en este entorno).
// Migracion 100% aditiva (crea ProcessAudit + ProcessAuditAnswer, no toca nada existente).
// Idempotente: si ProcessAudit ya existe, se detiene sin error.
import { readFileSync } from 'node:fs'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const { rows } = await pool.query(`SELECT table_name FROM information_schema.tables
  WHERE table_name = 'ProcessAudit'`)
if (rows.length > 0) {
  console.log('[SKIP] ProcessAudit ya existe -- migracion ya aplicada.')
  await pool.end()
  process.exit(0)
}

const sql = readFileSync(
  new URL('../drizzle/0007_process_audit_checklist.sql', import.meta.url),
  'utf8',
)
const statements = sql.split('--> statement-breakpoint').map((s) => s.trim())
for (const stmt of statements) {
  if (!stmt) continue
  await pool.query(stmt)
  console.log('[OK] Ejecutado:', stmt.slice(0, 80).replace(/\n/g, ' '), '...')
}

console.log('[DONE] ProcessAudit + ProcessAuditAnswer creadas.')
await pool.end()
