// Developer Manual -- diccionario de datos real y arquitectura (MI Stack
// Reference, sección 14d, HARD RULE). Contenido separado de la
// presentación (DeveloperManualPage.jsx) para que la migración a
// Tailwind (fase futura) solo toque el renderer, nunca este contenido.
// Fuente de verdad: server-lib/db/schema.js -- si el schema cambia, este
// archivo debe actualizarse en el mismo PR (no hay generación automática
// todavía).
//
// i18n (namespace "docs"): el texto en español visible al usuario vive en
// public/locales/*/docs.json bajo "developerManualData". ARCHITECTURE_OVERVIEW
// y AUTH_OVERVIEW se traducen directamente en DeveloperManualPage.jsx (solo
// se usan una vez cada uno, no vale la pena una constante aquí). Cada
// `purpose` de DATA_DICTIONARY se reemplaza por `purposeKey` (clave i18n
// completa) y cada descripción de API_MAP se reemplaza por su clave i18n
// completa -- el renderer resuelve ambos con t(). Las notas de `fields` se
// dejan tal cual (sin traducir en esta pasada): son las más técnicas, las
// más numerosas (~40+) y las de menor valor de traducción de este archivo.

// Cada modelo: nombre, propósito en 1 línea (clave i18n), y campos reales
// (nombre, tipo Prisma, notas). Los enums se listan aparte para no
// repetirlos por modelo.
export const DATA_DICTIONARY = [
  {
    model: 'User',
    purposeKey: 'developerManualData.dataDictionary_User_purpose',
    fields: [
      ['id', 'String (cuid)', 'PK'],
      ['employeeNumber', 'String?', 'único, uno de los dos identificadores de login'],
      ['username', 'String?', 'único, el otro identificador de login'],
      ['name', 'String', ''],
      ['passwordHash', 'String', 'bcrypt, nunca se expone al cliente (ver publicUser())'],
      ['role', 'UserRole', 'ADMINISTRADOR | SUPERVISOR | LIDER'],
      ['active', 'Boolean', 'false = login bloqueado (403)'],
      ['mustChangePassword', 'Boolean', 'fuerza cambio de contraseña en el próximo login'],
      ['lastLoginAt', 'DateTime?', ''],
      ['employeeId', 'String? (FK Employee)', 'único, opcional -- no todo User es un Employee'],
    ],
  },
  {
    model: 'Employee',
    purposeKey: 'developerManualData.dataDictionary_Employee_purpose',
    fields: [
      ['id', 'String (cuid)', 'PK'],
      ['employeeNumber', 'String?', 'único'],
      ['fullName', 'String', ''],
      ['photoUrl', 'String?', ''],
      ['active', 'Boolean', 'false = BAJA -- nunca se le puede registrar/asignar/mover'],
      ['areaZona', 'String?', 'ubicación habitual histórica del snapshot BASE, sin normalizar'],
      ['rawZona', 'String?', 'crudo, tal cual el Excel'],
      ['actividad', 'String?', 'código crudo de actividad del snapshot, sin interpretar'],
      [
        'baseAsistencia',
        'String?',
        'código crudo de asistencia del snapshot BASE (no es Attendance)',
      ],
      ['fechaIngreso', 'String?', 'tal cual "DD/MM/AAAA" de SEM 34, sin parsear'],
      [
        'baselineSuppressed',
        'Boolean',
        'true = nunca se ubica por areaZona hasta tener asignación real',
      ],
    ],
  },
  {
    model: 'ImportBatch',
    purposeKey: 'developerManualData.dataDictionary_ImportBatch_purpose',
    fields: [
      ['fileHash', 'String', 'único -- re-subir el mismo archivo nunca duplica nada'],
      ['sheet', 'String', ''],
      ['status', 'ImportBatchStatus', 'RUNNING | COMPLETED | FAILED'],
      [
        'totalRows / newEmployees / updatedEmployees / skippedRows / conflictsFound',
        'Int',
        'contadores del batch',
      ],
      ['triggeredByUserId', 'String (FK User)', ''],
    ],
  },
  {
    model: 'EmployeeImportSource',
    purposeKey: 'developerManualData.dataDictionary_EmployeeImportSource_purpose',
    fields: [
      ['sourceSheet', 'String', '"BASE" | "BAJAS"'],
      ['sourceRowNumber', 'Int', ''],
      [
        'rawZona / rawActividad / rawAsistencia / rawPrestamo',
        'String?',
        'crudos, sin interpretar',
      ],
    ],
  },
  {
    model: 'Skill',
    purposeKey: 'developerManualData.dataDictionary_Skill_purpose',
    fields: [
      ['code', 'String', 'único'],
      ['description', 'String?', 'null hasta que un admin la documente manualmente'],
      ['active', 'Boolean', ''],
    ],
  },
  {
    model: 'EmployeeSkill',
    purposeKey: 'developerManualData.dataDictionary_EmployeeSkill_purpose',
    fields: [
      ['level', 'SkillLevel?', 'PUEDE_CUBRIR | INTERMEDIO | EXPERTO'],
      ['source', 'EmployeeSkillSource', 'IMPORTED | MANUAL'],
      ['active', 'Boolean', 'false = retirada'],
      ['addedByUserId / deactivatedByUserId', 'String? (FK User)', ''],
    ],
  },
  {
    model: 'BajaConflict',
    purposeKey: 'developerManualData.dataDictionary_BajaConflict_purpose',
    fields: [
      [
        'status',
        'BajaConflictStatus',
        'PENDING | CONFIRMED_SAME_PERSON | CONFIRMED_DIFFERENT_PERSON | IGNORED',
      ],
      ['bajaFullName / bajaRowNumber', 'String / Int', 'dato crudo de la fila BAJAS'],
    ],
  },
  {
    model: 'EmployeeReconciliationCandidate',
    purposeKey: 'developerManualData.dataDictionary_EmployeeReconciliationCandidate_purpose',
    fields: [
      [
        'status',
        'EmployeeReconciliationStatus',
        'PENDING | CONFIRMED_SAME_PERSON | CONFIRMED_DIFFERENT_PERSON | IGNORED',
      ],
      ['candidateFullName / candidateEmployeeNumber', 'String', 'dato crudo de la fila candidata'],
    ],
  },
  {
    model: 'ImportedAttendanceReference',
    purposeKey: 'developerManualData.dataDictionary_ImportedAttendanceReference_purpose',
    fields: [['rawCode', 'String', '"A" | "F" | "I" | "V" tal cual']],
  },
  {
    model: 'Attendance',
    purposeKey: 'developerManualData.dataDictionary_Attendance_purpose',
    fields: [
      ['date', 'DateTime @db.Date', ''],
      ['shift', 'String', 'default "GENERAL"'],
      ['status', 'AttendanceStatus', 'PRESENTE | AUSENTE | RETARDO'],
      ['registeredByUserId', 'String (FK User)', ''],
    ],
  },
  {
    model: 'WorkArea',
    purposeKey: 'developerManualData.dataDictionary_WorkArea_purpose',
    fields: [
      ['code', 'String', 'único, ej. "L1".."L10", "PAL", "ACC"'],
      ['name', 'String', ''],
      ['displayOrder', 'Int', ''],
      ['active', 'Boolean', ''],
    ],
  },
  {
    model: 'Workstation',
    purposeKey: 'developerManualData.dataDictionary_Workstation_purpose',
    fields: [
      ['workAreaId', 'String (FK WorkArea)', ''],
      ['name', 'String', 'único por área ([workAreaId, name]) -- identidad técnica real'],
      ['capacity', 'Int', 'default 1'],
      [
        'role',
        'String?',
        'rol base sin sufijo numérico (agrupación/UI, nunca resuelve asignación)',
      ],
      [
        'category',
        'WorkstationCategory?',
        'LIDERAZGO | CALIDAD | PRODUCCION | TECNICO | SUMINISTRO | APOYO',
      ],
      [
        'active',
        'Boolean',
        'false = soft-delete, nunca se borra físico (hay FK real desde el historial)',
      ],
    ],
  },
  {
    model: 'DailyAssignment',
    purposeKey: 'developerManualData.dataDictionary_DailyAssignment_purpose',
    fields: [
      ['employeeId / workstationId', 'FK', ''],
      ['date', 'DateTime @db.Date', ''],
      ['status', 'DailyAssignmentStatus', 'ACTIVE | ENDED'],
      ['endReason', 'AssignmentEndReason?', 'MOVED | RELEASED | SHIFT_END | CORRECTION'],
      ['assignedByUserId / endedByUserId', 'FK User', ''],
    ],
  },
  {
    model: 'EmployeeMovement',
    purposeKey: 'developerManualData.dataDictionary_EmployeeMovement_purpose',
    fields: [
      ['fromWorkstationId', 'String? (FK)', 'null si es la primera asignación del día'],
      ['toWorkstationId', 'String (FK)', ''],
      ['movedByUserId', 'FK User', ''],
    ],
  },
  {
    model: 'PendingMove',
    purposeKey: 'developerManualData.dataDictionary_PendingMove_purpose',
    fields: [
      ['status', 'PendingMoveStatus', 'PENDING | APPROVED | REJECTED'],
      ['requestedByUserId / resolvedByUserId', 'FK User', ''],
    ],
  },
  {
    model: 'RoleModulePermission',
    purposeKey: 'developerManualData.dataDictionary_RoleModulePermission_purpose',
    fields: [
      ['role', 'UserRole', ''],
      ['moduleKey', 'String', 'ver shared/moduleRegistry.js'],
      ['allowed', 'Boolean', 'default true'],
    ],
  },
  {
    model: 'UserModulePermission',
    purposeKey: 'developerManualData.dataDictionary_UserModulePermission_purpose',
    fields: [
      ['userId / moduleKey', 'FK / String', 'único [userId, moduleKey]'],
      ['effect', 'UserPermissionEffect', 'ALLOW | DENY'],
    ],
  },
  {
    model: 'RoleModuleAccess',
    purposeKey: 'developerManualData.dataDictionary_RoleModuleAccess_purpose',
    fields: [
      ['role', 'UserRole', 'PK'],
      ['modules', 'String[]', ''],
    ],
  },
  {
    model: 'DowntimeRecord',
    purposeKey: 'developerManualData.dataDictionary_DowntimeRecord_purpose',
    fields: [
      ['areaId / stationName', 'String / String?', 'catálogo de código (WORK_CENTERS), no FK'],
      [
        'reasonKey',
        'String',
        'una de las 14 causas de src/data/demoras/catalog.js (DOWNTIME_REASONS)',
      ],
      ['durationMinutes', 'Int', ''],
      ['createdByUserId', 'String (FK User)', ''],
    ],
  },
  {
    model: 'EquipmentItem',
    purposeKey: 'developerManualData.dataDictionary_EquipmentItem_purpose',
    fields: [
      [
        'typeKey',
        'String',
        'uno de los 9 tipos de src/data/controlEquipo/catalog.js (EQUIPMENT_TYPES)',
      ],
      ['areaId / stationName', 'String / String?', 'catálogo de código, no FK'],
      ['code', 'String?', 'identificador físico opcional (etiqueta/serie)'],
      ['status', 'EquipmentStatus', 'OPERATIVO | DANADO | EN_REPARACION | BAJA'],
      ['createdByUserId', 'String (FK User)', ''],
    ],
  },
  {
    model: 'EquipmentAudit',
    purposeKey: 'developerManualData.dataDictionary_EquipmentAudit_purpose',
    fields: [
      ['areaId / stationName', 'String / String?', ''],
      ['auditDate', 'DateTime @db.Date', ''],
      ['totalScore', 'Int', 'suma cruda 0-18 (9 criterios x 2 pts máx), nunca normalizado'],
      ['createdByUserId', 'String (FK User)', ''],
    ],
  },
  {
    model: 'EquipmentAuditAnswer',
    purposeKey: 'developerManualData.dataDictionary_EquipmentAuditAnswer_purpose',
    fields: [
      ['auditId', 'String (FK EquipmentAudit)', ''],
      ['typeKey', 'String', 'uno de EQUIPMENT_TYPES.key'],
      ['answer', 'EquipmentAuditAnswerType', 'CUMPLE | CUMPLE_PARCIAL | NO_CUMPLE'],
      ['score', 'Int', 'puntos crudos de este criterio (0/1/2)'],
    ],
  },
  {
    model: 'HourlyProductionSession',
    purposeKey: 'developerManualData.dataDictionary_HourlyProductionSession_purpose',
    fields: [
      [
        'date / shift / areaId',
        'Date / String / String',
        'unique index -- 1 sesión por combinación',
      ],
      ['standardRate', 'Int', 'pzs/h configurado al crear la sesión'],
      [
        'lossUnit',
        'HourlyMeasurementType',
        'PIECES | MINUTES -- una sola unidad por turno, nunca mezclada por causa',
      ],
      ['status', 'HourlySessionStatus', 'ABIERTO | FINALIZADO'],
      ['createdByUserId / updatedByUserId', 'String (FK User) / String? (FK User)', ''],
    ],
  },
  {
    model: 'HourlyProductionEntry',
    purposeKey: 'developerManualData.dataDictionary_HourlyProductionEntry_purpose',
    fields: [
      ['sessionId', 'String (FK HourlyProductionSession)', 'unique con startTime'],
      ['startTime / endTime', 'String / String', '"HH:MM", generadas por buildShiftBlocks()'],
      [
        'standardQty',
        'Int',
        'snapshot del standardRate de la sesión al crear la hora -- nunca se recalcula si el rate cambia después',
      ],
      ['actualQty', 'Int?', 'null = sin captura'],
      ['observations', 'String?', 'texto libre opcional por hora'],
    ],
  },
  {
    model: 'HourlyProductionDowntimeCause',
    purposeKey: 'developerManualData.dataDictionary_HourlyProductionDowntimeCause_purpose',
    fields: [
      [
        'areaGroupKey',
        'String',
        'LINEAS | INSUMOS | ACCESORIOS | MIDEA | PALETIZADO -- escala el catálogo por área, ver resolveHourByHourAreaGroupKey() en src/data/production/catalog.js',
      ],
      [
        'name / code',
        'String / String',
        'code se autogenera (slug) y es único DENTRO de areaGroupKey (no global)',
      ],
      ['active', 'Boolean', 'soft-delete -- nunca se borra físicamente una causa con histórico'],
      ['sortOrder', 'Int', 'orden manual (flechas arriba/abajo en el admin)'],
    ],
  },
  {
    model: 'HourlyProductionIncident',
    purposeKey: 'developerManualData.dataDictionary_HourlyProductionIncident_purpose',
    fields: [
      ['entryId', 'String (FK HourlyProductionEntry)', 'unique con causeId'],
      [
        'causeId',
        'String (FK HourlyProductionDowntimeCause)',
        'debe pertenecer al areaGroupKey de la sesión (validado en el API, nunca solo por FK)',
      ],
      ['value', 'Int (default 0)', 'en la unidad de session.lossUnit -- nunca null'],
    ],
  },
  {
    model: 'SortingSession',
    purposeKey: 'developerManualData.dataDictionary_SortingSession_purpose',
    fields: [
      [
        'date / shift / areaId',
        'Date / String / String',
        'mismo esquema que HourlyProductionSession -- areaId siempre es la constante fija SORTING_AREA_ID, nunca viene de un selector',
      ],
      ['standardRate', 'Int', 'pzs/h configurado al crear la sesión'],
      ['lossUnit', 'HourlyMeasurementType', 'PIECES | MINUTES -- una sola unidad por turno'],
      ['status', 'HourlySessionStatus', 'ABIERTO | FINALIZADO'],
      ['createdByUserId / updatedByUserId', 'String (FK User) / String? (FK User)', ''],
    ],
  },
  {
    model: 'SortingEntry',
    purposeKey: 'developerManualData.dataDictionary_SortingEntry_purpose',
    fields: [
      ['sessionId', 'String (FK SortingSession)', 'unique con startTime'],
      ['startTime / endTime', 'String / String', '"HH:MM", generadas por buildShiftBlocks()'],
      ['standardQty', 'Int', 'snapshot del standardRate de la sesión al crear la hora'],
      ['actualQty', 'Int?', 'null = sin captura'],
      [
        '11 columnas fijas de pérdida por causa',
        'Int (default 0)',
        'mismas columnas y mismo significado que HourlyProductionEntry, vía src/data/shiftProduction/',
      ],
      ['observations', 'String?', 'texto libre opcional por hora'],
    ],
  },
]

export const API_MAP = [
  ['/api/auth/{login,logout,session,change-password}', 'developerManualData.apiMap_auth'],
  ['/api/personnel/*', 'developerManualData.apiMap_personnel'],
  ['/api/users/*', 'developerManualData.apiMap_users'],
  ['/api/work-areas/[code]/workstations/*', 'developerManualData.apiMap_workAreaWorkstations'],
  ['/api/role-permissions/*', 'developerManualData.apiMap_rolePermissions'],
  [
    '/api/permissions/modules/[moduleKey]/users',
    'developerManualData.apiMap_permissionModuleUsers',
  ],
  ['/api/dashboard/trends', 'developerManualData.apiMap_dashboardTrends'],
  ['/api/dashboard/plant-issues', 'developerManualData.apiMap_dashboardPlantIssues'],
  ['/api/modules', 'developerManualData.apiMap_modules'],
  ['/api/demoras', 'developerManualData.apiMap_demoras'],
  ['/api/control-equipo', 'developerManualData.apiMap_controlEquipo'],
  ['/api/equipment-audits', 'developerManualData.apiMap_equipmentAudits'],
  ['/api/hora-por-hora/*', 'developerManualData.apiMap_horaPorHora'],
  ['/api/sorting/*', 'developerManualData.apiMap_sorting'],
]
