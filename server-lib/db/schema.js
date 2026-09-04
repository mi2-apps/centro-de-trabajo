// Fase 3 (MI Stack Reference, Prisma -> Drizzle): generado por
// `drizzle-kit introspect` contra la base Neon REAL en producción (nunca
// escrito a mano) -- garantiza que coincide exactamente con lo que Prisma
// ya creó, cero riesgo de definicion divergente. `_prisma_migrations` se
// excluye a proposito (ver tablesFilter en drizzle.config.ts) -- es
// bookkeeping interno de Prisma, no una tabla de dominio.
//
// UNICO cambio manual sobre la salida cruda de introspect: todas las
// columnas `date`/`timestamp` usan `{ mode: 'date' }` (introspect las deja
// en modo string por defecto) -- Prisma siempre devolvia objetos Date de
// JS para estos campos, y varios call-sites (todayDateOnly/parseDateOnly
// en server-lib/personnel.js, entre otros) construyen/comparan Date
// directamente. Mantener el mismo tipo evita cambios de comportamiento
// silenciosos al portar cada archivo.
//
// server-lib/db/client.js es el punto de entrada real (equivalente de
// server-lib/prisma.js) -- este archivo nunca se importa directo fuera de
// ahi. relations.ts (mismo directorio) tiene el mismo origen/regla.
//
// SEGUNDO cambio manual: cada `id` agrega `.$defaultFn(() => cuid())`.
// `@default(cuid())` en el schema Prisma original NUNCA fue un default de
// Postgres (confirmado con un insert de prueba real que fallo con "null
// value in column id") -- Prisma generaba el id en su propio cliente
// antes de mandar el INSERT. `cuid` (paquete original v1, NO cuid2) es el
// que produce el mismo formato exacto que los ids ya existentes en la
// base real (25 caracteres, empieza con "c" -- verificado generando ids
// de prueba y comparandolos contra filas reales). Sin este default,
// CUALQUIER insert nuevo via Drizzle fallaria igual que el de prueba.

import cuid from 'cuid'
import { sql } from 'drizzle-orm'
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
export const assignmentEndReason = pgEnum('AssignmentEndReason', [
  'MOVED',
  'RELEASED',
  'SHIFT_END',
  'CORRECTION',
])
export const attendanceStatus = pgEnum('AttendanceStatus', ['PRESENTE', 'AUSENTE', 'RETARDO'])
export const bajaConflictStatus = pgEnum('BajaConflictStatus', [
  'PENDING',
  'CONFIRMED_SAME_PERSON',
  'CONFIRMED_DIFFERENT_PERSON',
  'IGNORED',
])
export const dailyAssignmentStatus = pgEnum('DailyAssignmentStatus', ['ACTIVE', 'ENDED'])
export const employeeReconciliationStatus = pgEnum('EmployeeReconciliationStatus', [
  'PENDING',
  'CONFIRMED_SAME_PERSON',
  'CONFIRMED_DIFFERENT_PERSON',
  'IGNORED',
])
// 2026-09-02 (OIDC corregido segun apps.mi2.com.mx/stack -- flujo "Solicitar acceso" en vez
// del error muerto no_local_account, ver AccessRequest abajo).
export const accessRequestStatus = pgEnum('AccessRequestStatus', ['PENDING', 'APPROVED', 'DENIED'])
export const employeeSkillSource = pgEnum('EmployeeSkillSource', ['IMPORTED', 'MANUAL'])
export const importBatchStatus = pgEnum('ImportBatchStatus', ['RUNNING', 'COMPLETED', 'FAILED'])
export const pendingMoveStatus = pgEnum('PendingMoveStatus', ['PENDING', 'APPROVED', 'REJECTED'])
export const skillLevel = pgEnum('SkillLevel', ['PUEDE_CUBRIR', 'INTERMEDIO', 'EXPERTO'])
// 2026-09-02 (a peticion explicita del usuario -- "personal sin asignar... poner si ya es baja
// o cambio de turno o si fue por falta"): motivo real y persistente por el que alguien aparece
// en "Personal sin asignar". BAJA ademas desactiva al empleado (Employee.active=false, mismo
// mecanismo real que ya bloqueaba checkin/move -- ver placeEmployee, server-lib/personnel.js);
// TURNO/FALTA son solo una etiqueta informativa, el empleado se queda activo.
export const unassignedReason = pgEnum('UnassignedReason', ['BAJA', 'TURNO', 'FALTA'])
export const userPermissionEffect = pgEnum('UserPermissionEffect', ['ALLOW', 'DENY'])
export const userRole = pgEnum('UserRole', ['ADMINISTRADOR', 'SUPERVISOR', 'LIDER'])
export const workstationCategory = pgEnum('WorkstationCategory', [
  'LIDERAZGO',
  'CALIDAD',
  'PRODUCCION',
  'TECNICO',
  'SUMINISTRO',
  'APOYO',
])
export const user = pgTable(
  'User',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    employeeNumber: text(),
    username: text(),
    name: text().notNull(),
    passwordHash: text().notNull(),
    role: userRole().notNull(),
    active: boolean().default(true).notNull(),
    mustChangePassword: boolean().default(false).notNull(),
    lastLoginAt: timestamp({ precision: 3, mode: 'date' }),
    createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
    employeeId: text(),
    // 2026-09-02 (OIDC corregido segun apps.mi2.com.mx/stack): identidad estable de
    // Nextcloud es claims.sub, NUNCA preferred_username (que ni siquiera se manda). Match
    // real del login SSO -- ver api/auth/oidc/callback.js. Nullable: los 4 usuarios reales
    // ya existentes no tienen sub todavia (nunca entraron por SSO); se llena solo cuando
    // una solicitud de acceso via SSO se aprueba (api/access-requests/[id]/decide.js).
    oidcSub: text(),
  },
  (table) => [
    uniqueIndex('User_employeeId_key').using(
      'btree',
      table.employeeId.asc().nullsLast().op('text_ops'),
    ),
    uniqueIndex('User_employeeNumber_key').using(
      'btree',
      table.employeeNumber.asc().nullsLast().op('text_ops'),
    ),
    uniqueIndex('User_oidcSub_key').using('btree', table.oidcSub.asc().nullsLast().op('text_ops')),
    index('User_role_idx').using('btree', table.role.asc().nullsLast().op('enum_ops')),
    uniqueIndex('User_username_key').using(
      'btree',
      table.username.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.employeeId],
      foreignColumns: [employee.id],
      name: 'User_employeeId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
)
// Solicitud de acceso via SSO (2026-09-02, apps.mi2.com.mx/stack seccion 7c -- adaptado, no
// el scaffold de GAC literal: aqui "aprobar" simplemente crea un User real con el rol que
// el admin elija, en vez de un sistema de scopes paralelo -- ver api/access-requests/*.js).
// Se crea cuando alguien entra por SSO (claims.sub resuelto, ID valido) pero ningun User
// local tiene ese oidcSub todavia.
export const accessRequest = pgTable(
  'AccessRequest',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    oidcSub: text().notNull(),
    email: text().notNull(),
    name: text(),
    note: text(),
    status: accessRequestStatus().default('PENDING').notNull(),
    decidedByUserId: text(),
    decidedAt: timestamp({ precision: 3, mode: 'date' }),
    requestedAt: timestamp({ precision: 3, mode: 'date' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index('AccessRequest_oidcSub_idx').using(
      'btree',
      table.oidcSub.asc().nullsLast().op('text_ops'),
    ),
    index('AccessRequest_status_idx').using('btree', table.status.asc().nullsLast().op('enum_ops')),
  ],
)
export const importedAttendanceReference = pgTable(
  'ImportedAttendanceReference',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    employeeId: text().notNull(),
    employeeImportSourceId: text().notNull(),
    rawCode: text().notNull(),
    importedAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    index('ImportedAttendanceReference_employeeId_idx').using(
      'btree',
      table.employeeId.asc().nullsLast().op('text_ops'),
    ),
    uniqueIndex('ImportedAttendanceReference_employeeImportSourceId_key').using(
      'btree',
      table.employeeImportSourceId.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.employeeId],
      foreignColumns: [employee.id],
      name: 'ImportedAttendanceReference_employeeId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.employeeImportSourceId],
      foreignColumns: [employeeImportSource.id],
      name: 'ImportedAttendanceReference_employeeImportSourceId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
)
export const roleModuleAccess = pgTable('RoleModuleAccess', {
  role: userRole().primaryKey().notNull(),
  modules: text().array(),
})
export const workstation = pgTable(
  'Workstation',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    workAreaId: text().notNull(),
    name: text().notNull(),
    requiredSkillId: text(),
    capacity: integer().default(1).notNull(),
    displayOrder: integer().default(0).notNull(),
    active: boolean().default(true).notNull(),
    category: workstationCategory(),
    requiredRoleLabel: text(),
    role: text(),
  },
  (table) => [
    uniqueIndex('Workstation_workAreaId_name_key').using(
      'btree',
      table.workAreaId.asc().nullsLast().op('text_ops'),
      table.name.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.workAreaId],
      foreignColumns: [workArea.id],
      name: 'Workstation_workAreaId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.requiredSkillId],
      foreignColumns: [skill.id],
      name: 'Workstation_requiredSkillId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
)
export const importBatch = pgTable(
  'ImportBatch',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    fileName: text().notNull(),
    fileHash: text().notNull(),
    sheet: text().notNull(),
    startedAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    finishedAt: timestamp({ precision: 3, mode: 'date' }),
    totalRows: integer().default(0).notNull(),
    newEmployees: integer().default(0).notNull(),
    updatedEmployees: integer().default(0).notNull(),
    skippedRows: integer().default(0).notNull(),
    conflictsFound: integer().default(0).notNull(),
    status: importBatchStatus().default('RUNNING').notNull(),
    triggeredByUserId: text().notNull(),
  },
  (table) => [
    uniqueIndex('ImportBatch_fileHash_key').using(
      'btree',
      table.fileHash.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.triggeredByUserId],
      foreignColumns: [user.id],
      name: 'ImportBatch_triggeredByUserId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
)
export const employeeImportSource = pgTable(
  'EmployeeImportSource',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    employeeId: text().notNull(),
    importBatchId: text().notNull(),
    sourceSheet: text().notNull(),
    sourceRowNumber: integer().notNull(),
    rawZona: text(),
    rawActividad: text(),
    rawAsistencia: text(),
    rawPrestamo: text(),
    importedAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    index('EmployeeImportSource_employeeId_idx').using(
      'btree',
      table.employeeId.asc().nullsLast().op('text_ops'),
    ),
    index('EmployeeImportSource_importBatchId_idx').using(
      'btree',
      table.importBatchId.asc().nullsLast().op('text_ops'),
    ),
    uniqueIndex('EmployeeImportSource_importBatchId_sourceSheet_sourceRowNum_key').using(
      'btree',
      table.importBatchId.asc().nullsLast().op('int4_ops'),
      table.sourceSheet.asc().nullsLast().op('text_ops'),
      table.sourceRowNumber.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.employeeId],
      foreignColumns: [employee.id],
      name: 'EmployeeImportSource_employeeId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.importBatchId],
      foreignColumns: [importBatch.id],
      name: 'EmployeeImportSource_importBatchId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
)
export const employeeSkill = pgTable(
  'EmployeeSkill',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    employeeId: text().notNull(),
    skillId: text().notNull(),
    level: skillLevel(),
    source: employeeSkillSource().default('IMPORTED').notNull(),
    active: boolean().default(true).notNull(),
    addedByUserId: text(),
    deactivatedAt: timestamp({ precision: 3, mode: 'date' }),
    deactivatedByUserId: text(),
    createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    uniqueIndex('EmployeeSkill_employeeId_skillId_key').using(
      'btree',
      table.employeeId.asc().nullsLast().op('text_ops'),
      table.skillId.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.employeeId],
      foreignColumns: [employee.id],
      name: 'EmployeeSkill_employeeId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.skillId],
      foreignColumns: [skill.id],
      name: 'EmployeeSkill_skillId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.addedByUserId],
      foreignColumns: [user.id],
      name: 'EmployeeSkill_addedByUserId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
    foreignKey({
      columns: [table.deactivatedByUserId],
      foreignColumns: [user.id],
      name: 'EmployeeSkill_deactivatedByUserId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
)
export const bajaConflict = pgTable(
  'BajaConflict',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    employeeId: text(),
    bajaFullName: text().notNull(),
    bajaRowNumber: integer().notNull(),
    importBatchId: text().notNull(),
    status: bajaConflictStatus().default('PENDING').notNull(),
    resolvedByUserId: text(),
    resolvedAt: timestamp({ precision: 3, mode: 'date' }),
    notes: text(),
    createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    index('BajaConflict_importBatchId_idx').using(
      'btree',
      table.importBatchId.asc().nullsLast().op('text_ops'),
    ),
    index('BajaConflict_status_idx').using('btree', table.status.asc().nullsLast().op('enum_ops')),
    foreignKey({
      columns: [table.employeeId],
      foreignColumns: [employee.id],
      name: 'BajaConflict_employeeId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
    foreignKey({
      columns: [table.importBatchId],
      foreignColumns: [importBatch.id],
      name: 'BajaConflict_importBatchId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.resolvedByUserId],
      foreignColumns: [user.id],
      name: 'BajaConflict_resolvedByUserId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
)
export const skill = pgTable(
  'Skill',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    code: text().notNull(),
    description: text(),
    active: boolean().default(true).notNull(),
    createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    uniqueIndex('Skill_code_key').using('btree', table.code.asc().nullsLast().op('text_ops')),
  ],
)
export const employeeReconciliationCandidate = pgTable(
  'EmployeeReconciliationCandidate',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    existingEmployeeId: text().notNull(),
    importBatchId: text().notNull(),
    candidateSourceRowNumber: integer().notNull(),
    candidateFullName: text().notNull(),
    candidateEmployeeNumber: text(),
    candidateRawZona: text(),
    candidateRawActividad: text(),
    candidateRawAsistencia: text(),
    candidateRawPrestamo: text(),
    status: employeeReconciliationStatus().default('PENDING').notNull(),
    resolvedByUserId: text(),
    resolvedAt: timestamp({ precision: 3, mode: 'date' }),
    notes: text(),
    createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    index('EmployeeReconciliationCandidate_existingEmployeeId_idx').using(
      'btree',
      table.existingEmployeeId.asc().nullsLast().op('text_ops'),
    ),
    index('EmployeeReconciliationCandidate_importBatchId_idx').using(
      'btree',
      table.importBatchId.asc().nullsLast().op('text_ops'),
    ),
    index('EmployeeReconciliationCandidate_status_idx').using(
      'btree',
      table.status.asc().nullsLast().op('enum_ops'),
    ),
    foreignKey({
      columns: [table.existingEmployeeId],
      foreignColumns: [employee.id],
      name: 'EmployeeReconciliationCandidate_existingEmployeeId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.importBatchId],
      foreignColumns: [importBatch.id],
      name: 'EmployeeReconciliationCandidate_importBatchId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.resolvedByUserId],
      foreignColumns: [user.id],
      name: 'EmployeeReconciliationCandidate_resolvedByUserId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
)
export const workArea = pgTable(
  'WorkArea',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    code: text().notNull(),
    name: text().notNull(),
    displayOrder: integer().default(0).notNull(),
    active: boolean().default(true).notNull(),
    createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    uniqueIndex('WorkArea_code_key').using('btree', table.code.asc().nullsLast().op('text_ops')),
  ],
)
export const dailyAssignment = pgTable(
  'DailyAssignment',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    employeeId: text().notNull(),
    date: date({ mode: 'date' }).notNull(),
    shift: text().default('GENERAL').notNull(),
    workstationId: text().notNull(),
    status: dailyAssignmentStatus().default('ACTIVE').notNull(),
    assignedAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    assignedByUserId: text().notNull(),
    endedAt: timestamp({ precision: 3, mode: 'date' }),
    endedByUserId: text(),
    endReason: assignmentEndReason(),
    createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
  },
  (table) => [
    index('DailyAssignment_employeeId_date_idx').using(
      'btree',
      table.employeeId.asc().nullsLast().op('date_ops'),
      table.date.asc().nullsLast().op('text_ops'),
    ),
    uniqueIndex('DailyAssignment_employeeId_date_key')
      .using(
        'btree',
        table.employeeId.asc().nullsLast().op('date_ops'),
        table.date.asc().nullsLast().op('date_ops'),
      )
      .where(sql`(status = 'ACTIVE'::"DailyAssignmentStatus")`),
    index('DailyAssignment_workstationId_date_idx').using(
      'btree',
      table.workstationId.asc().nullsLast().op('date_ops'),
      table.date.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.employeeId],
      foreignColumns: [employee.id],
      name: 'DailyAssignment_employeeId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.workstationId],
      foreignColumns: [workstation.id],
      name: 'DailyAssignment_workstationId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.assignedByUserId],
      foreignColumns: [user.id],
      name: 'DailyAssignment_assignedByUserId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.endedByUserId],
      foreignColumns: [user.id],
      name: 'DailyAssignment_endedByUserId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
)
export const employeeMovement = pgTable(
  'EmployeeMovement',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    employeeId: text().notNull(),
    date: date({ mode: 'date' }).notNull(),
    fromWorkstationId: text(),
    toWorkstationId: text().notNull(),
    movedAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    movedByUserId: text().notNull(),
  },
  (table) => [
    index('EmployeeMovement_employeeId_date_idx').using(
      'btree',
      table.employeeId.asc().nullsLast().op('date_ops'),
      table.date.asc().nullsLast().op('date_ops'),
    ),
    index('EmployeeMovement_toWorkstationId_date_idx').using(
      'btree',
      table.toWorkstationId.asc().nullsLast().op('text_ops'),
      table.date.asc().nullsLast().op('date_ops'),
    ),
    foreignKey({
      columns: [table.employeeId],
      foreignColumns: [employee.id],
      name: 'EmployeeMovement_employeeId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.fromWorkstationId],
      foreignColumns: [workstation.id],
      name: 'EmployeeMovement_fromWorkstationId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
    foreignKey({
      columns: [table.toWorkstationId],
      foreignColumns: [workstation.id],
      name: 'EmployeeMovement_toWorkstationId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.movedByUserId],
      foreignColumns: [user.id],
      name: 'EmployeeMovement_movedByUserId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
)
export const attendance = pgTable(
  'Attendance',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    employeeId: text().notNull(),
    date: date({ mode: 'date' }).notNull(),
    shift: text().default('GENERAL').notNull(),
    checkInAt: timestamp({ precision: 3, mode: 'date' }),
    status: attendanceStatus().notNull(),
    registeredByUserId: text().notNull(),
    createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    index('Attendance_date_idx').using('btree', table.date.asc().nullsLast().op('date_ops')),
    uniqueIndex('Attendance_employeeId_date_shift_key').using(
      'btree',
      table.employeeId.asc().nullsLast().op('date_ops'),
      table.date.asc().nullsLast().op('date_ops'),
      table.shift.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.employeeId],
      foreignColumns: [employee.id],
      name: 'Attendance_employeeId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.registeredByUserId],
      foreignColumns: [user.id],
      name: 'Attendance_registeredByUserId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
)
export const employee = pgTable(
  'Employee',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    employeeNumber: text(),
    fullName: text().notNull(),
    photoUrl: text(),
    active: boolean().default(true).notNull(),
    createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
    actividad: text(),
    areaZona: text(),
    baseAsistencia: text(),
    baselineSuppressed: boolean().default(false).notNull(),
    fechaIngreso: text(),
    rawZona: text(),
    unassignedReason: unassignedReason(),
    unassignedReasonSetAt: timestamp({ precision: 3, mode: 'date' }),
    unassignedReasonSetByUserId: text(),
    // Ultima vez que el sync automatico con SmartControl (server-lib/personnel-sync.js) toco esta
    // fila (alta o baja automatica) -- null = nunca tocada por el sync, sigue siendo 100% manual.
    smartControlSyncedAt: timestamp({ precision: 3, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('Employee_employeeNumber_key').using(
      'btree',
      table.employeeNumber.asc().nullsLast().op('text_ops'),
    ),
    index('Employee_fullName_idx').using('btree', table.fullName.asc().nullsLast().op('text_ops')),
  ],
)
export const pendingMove = pgTable(
  'PendingMove',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    employeeId: text().notNull(),
    date: date({ mode: 'date' }).notNull(),
    fromWorkstationId: text(),
    toWorkstationId: text().notNull(),
    shift: text().default('GENERAL').notNull(),
    requestedByUserId: text().notNull(),
    requestedAt: timestamp({ precision: 3, mode: 'date' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    status: pendingMoveStatus().default('PENDING').notNull(),
    resolvedByUserId: text(),
    resolvedAt: timestamp({ precision: 3, mode: 'date' }),
  },
  (table) => [
    index('PendingMove_employeeId_date_idx').using(
      'btree',
      table.employeeId.asc().nullsLast().op('date_ops'),
      table.date.asc().nullsLast().op('date_ops'),
    ),
    index('PendingMove_status_date_idx').using(
      'btree',
      table.status.asc().nullsLast().op('enum_ops'),
      table.date.asc().nullsLast().op('date_ops'),
    ),
    foreignKey({
      columns: [table.employeeId],
      foreignColumns: [employee.id],
      name: 'PendingMove_employeeId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.fromWorkstationId],
      foreignColumns: [workstation.id],
      name: 'PendingMove_fromWorkstationId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
    foreignKey({
      columns: [table.toWorkstationId],
      foreignColumns: [workstation.id],
      name: 'PendingMove_toWorkstationId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.requestedByUserId],
      foreignColumns: [user.id],
      name: 'PendingMove_requestedByUserId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.resolvedByUserId],
      foreignColumns: [user.id],
      name: 'PendingMove_resolvedByUserId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
)
export const roleModulePermission = pgTable(
  'RoleModulePermission',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    role: userRole().notNull(),
    moduleKey: text().notNull(),
    allowed: boolean().default(true).notNull(),
    updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
    updatedByUserId: text(),
  },
  (table) => [
    uniqueIndex('RoleModulePermission_role_moduleKey_key').using(
      'btree',
      table.role.asc().nullsLast().op('text_ops'),
      table.moduleKey.asc().nullsLast().op('text_ops'),
    ),
  ],
)
export const userModulePermission = pgTable(
  'UserModulePermission',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    userId: text().notNull(),
    moduleKey: text().notNull(),
    effect: userPermissionEffect().notNull(),
    updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
    updatedByUserId: text(),
  },
  (table) => [
    uniqueIndex('UserModulePermission_userId_moduleKey_key').using(
      'btree',
      table.userId.asc().nullsLast().op('text_ops'),
      table.moduleKey.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'UserModulePermission_userId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
  ],
)

// Fase "Evaluaciones" (2026-09-02, a peticion explicita del usuario):
// resultado real de una auditoria 5S ya completada -- antes el modulo
// Auditoria era solo interfaz, sin guardar nada (decision explicita
// original). areaId es snapshot de TEXTO (no FK a Workstation): el
// picker de Auditoria apunta a cualquiera de los 5 grupos globales del
// catalogo, y el resultado debe seguir siendo historicamente correcto
// aunque esa area cambie de nombre despues.
//
// 2026-09-02: primera version de la auditoria 5S guardaba solo 1 clasificacion por S, por AREA
// (se quito employeeId/stationName ese mismo dia -- "quita eso de puesto de trabajo").
// 2026-09-03 (a peticion explicita del usuario, checklist completo por criterio + Puesto/
// Empleado/Turno reales, mockup de resultado con radar): AuditEvaluation ya no alcanza --
// reemplazada por FiveSAudit (cabecera, 1 fila por auditoria completa, puntaje 0-20 normalizado
// por S en vez de una sola clasificacion) + FiveSAuditAnswer (1 fila por criterio real
// respondido, ver src/data/audits5s/criteria.js). Tabla vieja confirmada vacia (0 filas reales,
// verificado en vivo) antes de reemplazarla -- migracion segura, sin perdida de datos.
// fiveSClassification se conserva tal cual (mismo significado real: como se clasifico un
// criterio individual), ahora usado por FiveSAuditAnswer.answer en vez de AuditEvaluation.sN.
export const fiveSClassification = pgEnum('FiveSClassification', [
  'CUMPLE',
  'CUMPLE_PARCIAL',
  'NO_CUMPLE',
])
export const fiveSAudit = pgTable(
  'FiveSAudit',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    areaId: text().notNull(),
    // Puesto real (Workstation.name del catalogo de la linea/area, ver
    // src/data/personnel/workstations.js) -- opcional: no todas las areas auditadas tienen
    // desglose por puesto (ej. Insumos/Accesorios/Paletizado como area completa).
    stationName: text(),
    // employeeId real (FK nullable, onDelete set null -- la auditoria historica se conserva
    // aunque el empleado ya no exista) + snapshot de numero/nombre AL MOMENTO de la auditoria
    // (mismo criterio ya usado en DailyAssignment/EmployeeMovement de este mismo schema: el
    // historial nunca debe cambiar si despues se corrige/renombra al empleado en Employee).
    employeeId: text(),
    employeeNumber: text(),
    employeeName: text(),
    shift: text(),
    auditDate: date({ mode: 'date' }).notNull(),
    s1Score: integer().notNull(),
    s2Score: integer().notNull(),
    s3Score: integer().notNull(),
    s4Score: integer().notNull(),
    s5Score: integer().notNull(),
    totalScore: integer().notNull(),
    notes: text(),
    createdByUserId: text().notNull(),
    createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    index('FiveSAudit_areaId_auditDate_idx').using(
      'btree',
      table.areaId.asc().nullsLast().op('text_ops'),
      table.auditDate.asc().nullsLast().op('date_ops'),
    ),
    index('FiveSAudit_areaId_stationName_idx').using(
      'btree',
      table.areaId.asc().nullsLast().op('text_ops'),
      table.stationName.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.createdByUserId],
      foreignColumns: [user.id],
      name: 'FiveSAudit_createdByUserId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.employeeId],
      foreignColumns: [employee.id],
      name: 'FiveSAudit_employeeId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
)
// 1 fila por criterio real respondido -- nunca se recalcula desde la config actual de criterios
// (src/data/audits5s/criteria.js puede evolucionar; el historial guarda la respuesta/puntaje TAL
// CUAL se dieron ese dia, ver comentario grande en api/evaluaciones/[id].js sobre "reconstruir
// exactamente, nunca recalcular").
export const fiveSAuditAnswer = pgTable(
  'FiveSAuditAnswer',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    auditId: text().notNull(),
    category: text().notNull(), // 's1'..'s5'
    criterionId: text().notNull(),
    answer: fiveSClassification().notNull(),
    score: integer().notNull(), // puntos crudos de este criterio (antes de normalizar la S a 0-20)
    observation: text(),
    createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    index('FiveSAuditAnswer_auditId_idx').using(
      'btree',
      table.auditId.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.auditId],
      foreignColumns: [fiveSAudit.id],
      name: 'FiveSAuditAnswer_auditId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
  ],
)

// Auditoria de Proceso (2026-09-03, a peticion explicita del usuario -- primer checklist real
// tomado de "AUDITORIA ETIQUETADOR- SEMANA 36.xlsx", 7 categorias / 28 criterios reales para el
// puesto de Etiquetado, ver src/data/auditsProceso/criteria.js, unica fuente de verdad tanto para
// el frontend como para este schema). A diferencia de FiveSAudit (siempre por AREA, nunca por
// persona), esta auditoria SI evalua a una persona especifica en un puesto especifico -- role/
// stationName nunca son null aqui (ver validacion en api/process-audits/index.js). Cada
// categoryNScore es el % (0-100) de esa categoria segun el checklist REAL usado ese dia, tal cual
// se calculo entonces (mismo criterio de "nunca recalcular" ya usado en FiveSAudit) -- hasta 7
// columnas porque es el maximo real del unico checklist que existe hoy (Etiquetado); todas
// nullable porque un futuro rol con menos categorias simplemente no las llena.
export const processAuditAnswerType = pgEnum('ProcessAuditAnswerType', [
  'CUMPLE_COMPLETO',
  'CUMPLE_PARCIAL',
  'CUMPLE_MINIMO',
  'NO_CUMPLE',
])
export const processAudit = pgTable(
  'ProcessAudit',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    areaId: text().notNull(),
    role: text().notNull(), // que checklist se uso (src/data/auditsProceso/criteria.js), ej. 'Etiquetado'
    stationName: text().notNull(), // Workstation.name real (ej. "Etiquetado 2")
    employeeId: text(),
    employeeNumber: text(),
    employeeName: text(),
    shift: text(),
    auditDate: date({ mode: 'date' }).notNull(),
    category1Score: integer(),
    category2Score: integer(),
    category3Score: integer(),
    category4Score: integer(),
    category5Score: integer(),
    category6Score: integer(),
    category7Score: integer(),
    totalScore: integer().notNull(),
    notes: text(),
    createdByUserId: text().notNull(),
    createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    index('ProcessAudit_areaId_auditDate_idx').using(
      'btree',
      table.areaId.asc().nullsLast().op('text_ops'),
      table.auditDate.asc().nullsLast().op('date_ops'),
    ),
    foreignKey({
      columns: [table.createdByUserId],
      foreignColumns: [user.id],
      name: 'ProcessAudit_createdByUserId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.employeeId],
      foreignColumns: [employee.id],
      name: 'ProcessAudit_employeeId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
)
// 1 fila por criterio real respondido -- mismo criterio que FiveSAuditAnswer ("nunca se
// recalcula desde la config actual de criterios").
export const processAuditAnswer = pgTable(
  'ProcessAuditAnswer',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => cuid()),
    auditId: text().notNull(),
    category: integer().notNull(), // 1..7
    criterionId: text().notNull(),
    answer: processAuditAnswerType().notNull(),
    score: integer().notNull(), // puntos crudos 0/3/5/10 de este criterio
    observation: text(),
    createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    index('ProcessAuditAnswer_auditId_idx').using(
      'btree',
      table.auditId.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.auditId],
      foreignColumns: [processAudit.id],
      name: 'ProcessAuditAnswer_auditId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
  ],
)
