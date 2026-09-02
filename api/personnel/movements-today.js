// Historial REAL de movimientos de HOY, para toda la planta -- mismo patron exacto que
// area-history.js (2026-08-25), solo que filtra por fecha en vez de por area. Lee
// EmployeeMovement directamente (append-only, nunca se edita/borra): es la UNICA fuente real
// de "quien" hizo cada movimiento -- el store local (repository.js) nunca lo sabe, siempre
// guarda movedBy: null ahi (ver comentario de area-history.js), pero el servidor SI lo tiene
// (EmployeeMovement.movedByUserId es obligatorio). Nunca se inventa un autor: si por alguna
// razon el usuario ya no existe, byName queda null (leftJoin) y la UI debe mostrar "—", no un
// nombre falso.
import { desc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import {
  db,
  employeeMovement,
  employee,
  user,
  workstation,
  workArea,
} from '../../server-lib/db/client.js'
import { requireAuth } from '../../server-lib/auth.js'
import { todayDateOnly } from '../../server-lib/personnel.js'

// fromWorkstation/toWorkstation son ambas FKs a la MISMA tabla Workstation (y cada una necesita
// su propia WorkArea) -- mismos alias que area-history.js.
const fromWorkstation = alias(workstation, 'fromWorkstation')
const fromWorkArea = alias(workArea, 'fromWorkArea')
const toWorkstation = alias(workstation, 'toWorkstation')
const toWorkArea = alias(workArea, 'toWorkArea')

export default requireAuth(async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const limit = Math.min(Number(req.query.limit) || 200, 200)

  const movements = await db
    .select({
      id: employeeMovement.id,
      movedAt: employeeMovement.movedAt,
      fromWorkstationId: employeeMovement.fromWorkstationId,
      employeeFullName: employee.fullName,
      employeeNumber: employee.employeeNumber,
      movedByName: user.name,
      movedByRole: user.role,
      fromAreaCode: fromWorkArea.code,
      fromAreaName: fromWorkArea.name,
      toAreaCode: toWorkArea.code,
      toAreaName: toWorkArea.name,
    })
    .from(employeeMovement)
    .innerJoin(employee, eq(employeeMovement.employeeId, employee.id))
    .leftJoin(user, eq(employeeMovement.movedByUserId, user.id))
    .leftJoin(fromWorkstation, eq(employeeMovement.fromWorkstationId, fromWorkstation.id))
    .leftJoin(fromWorkArea, eq(fromWorkstation.workAreaId, fromWorkArea.id))
    .innerJoin(toWorkstation, eq(employeeMovement.toWorkstationId, toWorkstation.id))
    .innerJoin(toWorkArea, eq(toWorkstation.workAreaId, toWorkArea.id))
    .where(eq(employeeMovement.date, todayDateOnly()))
    .orderBy(desc(employeeMovement.movedAt))
    .limit(limit)

  return res.status(200).json({
    movements: movements.map((m) => ({
      id: m.id,
      employeeName: m.employeeFullName,
      employeeNumber: m.employeeNumber,
      byName: m.movedByName || null,
      byRole: m.movedByRole || null,
      movedAt: m.movedAt.toISOString(),
      action: m.fromWorkstationId ? 'MOVED' : 'ASSIGNED',
      fromAreaCode: m.fromAreaCode || null,
      fromAreaName: m.fromAreaName || null,
      toAreaCode: m.toAreaCode,
      toAreaName: m.toAreaName,
    })),
  })
})
