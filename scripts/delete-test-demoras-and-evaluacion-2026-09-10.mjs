// Borra datos de PRUEBA reales que el propio usuario (empleado #3647, Roman Herrera De Leon)
// capturo el 2026-09-07/03 para probar los modulos de Demoras y Evaluaciones, y que pidio
// eliminar explicitamente el 2026-09-10 "por motivos de produccion" ("son mias y las hice para
// probar el modulo pero ya no quiero que salgan aqui"). Verificado antes de escribir este script
// (consulta de solo lectura) que son EXACTAMENTE 5 DowntimeRecord + 1 FiveSAudit, ambos creados
// por el mismo usuario, y que su contenido coincide con las capturas de pantalla que dio como
// referencia. FiveSAuditAnswer se borra solo (onDelete: cascade, ver schema.js) al borrar la
// fila de FiveSAudit. Corre una sola vez; los ids son especificos, no un filtro amplio.
import { inArray } from 'drizzle-orm'
import { db, downtimeRecord, fiveSAudit } from '../server-lib/db/client.js'

const DOWNTIME_RECORD_IDS = [
  'cmtrhwt8o000004l51h32gxka', // LINEA1 falta-materiales 2min
  'cmtrj1ct5000004juh6388f3l', // PROYECTO calificaciones-distintas 7min
  'cmtrjnty2000004jjgbjt0f8n', // LINEA4 falta-cushion 2min
  'cmtrjo6xo000104jj8r9ean2d', // LINEA2 falta-materiales 9min
  'cmtrsnve700011but7g6z6k5l', // LINEA1 falta-bolsas 7min
]
const FIVE_S_AUDIT_ID = 'cmtm1lrtn00001btfgb4q91q0' // INSUMOS, 2026-09-03, 77/100

const deletedRecords = await db
  .delete(downtimeRecord)
  .where(inArray(downtimeRecord.id, DOWNTIME_RECORD_IDS))
  .returning({ id: downtimeRecord.id })
console.log(
  `DowntimeRecord borrados: ${deletedRecords.length} de ${DOWNTIME_RECORD_IDS.length} esperados`,
)

const deletedAudits = await db
  .delete(fiveSAudit)
  .where(inArray(fiveSAudit.id, [FIVE_S_AUDIT_ID]))
  .returning({ id: fiveSAudit.id })
console.log(`FiveSAudit borrados: ${deletedAudits.length} de 1 esperado`)

process.exit(0)
