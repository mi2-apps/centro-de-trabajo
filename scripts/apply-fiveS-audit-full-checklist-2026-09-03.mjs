// Aplica manualmente drizzle/0006_fiveS_audit_full_checklist.sql -- mismo motivo que los scripts
// apply-*.mjs anteriores (drizzle-kit migrate se queda colgado sin salida en este entorno).
// Reemplaza AuditEvaluation (confirmado con 0 filas reales antes de aplicar esto, verificado en
// vivo -- migracion segura) por FiveSAudit + FiveSAuditAnswer. Idempotente: si FiveSAudit ya
// existe, se detiene sin error.
import { readFileSync } from 'node:fs'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const { rows } = await pool.query(`SELECT table_name FROM information_schema.tables
  WHERE table_name = 'FiveSAudit'`)
if (rows.length > 0) {
  console.log('[SKIP] FiveSAudit ya existe -- migracion ya aplicada.')
  await pool.end()
  process.exit(0)
}

const { rows: existingRows } = await pool.query(`SELECT COUNT(*)::int AS count FROM "AuditEvaluation"`)
if (existingRows[0].count > 0) {
  console.error(
    `[ABORT] AuditEvaluation tiene ${existingRows[0].count} filas reales -- no se puede hacer DROP a ciegas. Revisar a mano.`,
  )
  await pool.end()
  process.exit(1)
}

const sql = readFileSync(
  new URL('../drizzle/0006_fiveS_audit_full_checklist.sql', import.meta.url),
  'utf8',
)
const statements = sql.split('--> statement-breakpoint').map((s) => s.trim())
for (const stmt of statements) {
  if (!stmt) continue
  await pool.query(stmt)
  console.log('[OK] Ejecutado:', stmt.slice(0, 80).replace(/\n/g, ' '), '...')
}

console.log('[DONE] FiveSAudit + FiveSAuditAnswer creadas, AuditEvaluation eliminada.')
await pool.end()
