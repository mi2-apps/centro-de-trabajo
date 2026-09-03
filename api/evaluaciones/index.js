// Modulo Evaluaciones -- Auditoria 5S completa (2026-09-03, a peticion explicita del usuario:
// "conviertelo en un sistema completo de evaluacion 5S", checklist real de 40 criterios/5
// categorias, ver src/data/audits5s/criteria.js -- UNICA fuente de verdad de los criterios,
// tanto para el frontend como para este endpoint, para que la puntuacion nunca pueda
// desincronizarse entre lo que el usuario ve y lo que el servidor calcula).
//
// Reemplaza la primera version (2026-09-02, 1 sola clasificacion por S, area-only) -- ver
// FiveSAudit/FiveSAuditAnswer en server-lib/db/schema.js, migracion
// drizzle/0006_fiveS_audit_full_checklist.sql. GET lo consume EvaluacionesPage.jsx (modulo
// "/evaluaciones"); POST lo consume AuditoriaPage.jsx al terminar una auditoria 5S completa
// (modulo "/auditoria") -- mismos 2 module keys que ya existian, sin inventar uno nuevo.
//
// El puntaje SIEMPRE se calcula aqui, nunca se confia en un total que mande el cliente (a
// peticion explicita: "la aplicacion debe calcular todo, NO permitir que el usuario escriba
// manualmente el resultado total") -- el cliente solo manda las respuestas crudas por criterio.
//
// employeeId (2026-09-03, reintroducido a peticion explicita del usuario tras confirmar que
// revierte la simplificacion "area-only" del 2026-09-02): si se manda, se resuelve el
// nombre/numero REAL de Employee en este momento y se guarda como snapshot (employeeNumber/
// employeeName en FiveSAudit) -- el historial nunca debe cambiar si despues se renombra/corrige
// a ese empleado (mismo criterio ya usado en DailyAssignment/EmployeeMovement).
import { and, desc, eq } from 'drizzle-orm'
import { requireAuth } from '../../server-lib/auth.js'
import { db, employee, fiveSAudit, fiveSAuditAnswer, user } from '../../server-lib/db/client.js'
import { canUserAccessModule } from '../../server-lib/permissionService.js'
import {
  ANSWER_POINTS,
  FIVE_S_CATEGORIES,
  FIVE_S_CRITERIA,
  normalizeCategoryScore,
} from '../../src/data/audits5s/criteria.js'

const VALID_ANSWERS = new Set(['CUMPLE', 'CUMPLE_PARCIAL', 'NO_CUMPLE'])
const CRITERIA_BY_ID = new Map(FIVE_S_CRITERIA.map((c) => [c.id, c]))

async function handleGet(req, res) {
  const { areaId, stationName } = req.query || {}
  const conditions = []
  if (areaId) conditions.push(eq(fiveSAudit.areaId, areaId))
  if (stationName) conditions.push(eq(fiveSAudit.stationName, stationName))
  const rows = await db
    .select({
      id: fiveSAudit.id,
      areaId: fiveSAudit.areaId,
      stationName: fiveSAudit.stationName,
      employeeId: fiveSAudit.employeeId,
      employeeNumber: fiveSAudit.employeeNumber,
      employeeName: fiveSAudit.employeeName,
      shift: fiveSAudit.shift,
      auditDate: fiveSAudit.auditDate,
      s1Score: fiveSAudit.s1Score,
      s2Score: fiveSAudit.s2Score,
      s3Score: fiveSAudit.s3Score,
      s4Score: fiveSAudit.s4Score,
      s5Score: fiveSAudit.s5Score,
      totalScore: fiveSAudit.totalScore,
      notes: fiveSAudit.notes,
      createdAt: fiveSAudit.createdAt,
      auditorName: user.name,
    })
    .from(fiveSAudit)
    .leftJoin(user, eq(fiveSAudit.createdByUserId, user.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(fiveSAudit.auditDate), desc(fiveSAudit.createdAt))
  return res.status(200).json({ evaluations: rows })
}

async function handlePost(req, res) {
  const { areaId, stationName, employeeId, shift, notes, answers } = req.body || {}
  if (!areaId || typeof areaId !== 'string') {
    return res.status(400).json({ error: 'Falta areaId.' })
  }
  if (!Array.isArray(answers)) {
    return res.status(400).json({ error: 'Faltan las respuestas del checklist.' })
  }

  const answerByCriterionId = new Map(answers.map((a) => [a.criterionId, a.answer]))
  const missing = FIVE_S_CRITERIA.filter((c) => !answerByCriterionId.has(c.id))
  if (missing.length > 0) {
    return res.status(400).json({
      error: `Faltan ${missing.length} criterio(s) por evaluar.`,
      missingCriterionIds: missing.map((c) => c.id),
    })
  }
  const invalid = answers.filter(
    (a) => !VALID_ANSWERS.has(a.answer) || !CRITERIA_BY_ID.has(a.criterionId),
  )
  if (invalid.length > 0) {
    return res.status(400).json({ error: 'Hay respuestas invalidas en el checklist.' })
  }

  let employeeSnapshot = { employeeNumber: null, employeeName: null }
  if (employeeId) {
    const [emp] = await db
      .select({
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        fullName: employee.fullName,
      })
      .from(employee)
      .where(eq(employee.id, employeeId))
      .limit(1)
    if (!emp) return res.status(400).json({ error: 'El empleado seleccionado ya no existe.' })
    employeeSnapshot = { employeeNumber: emp.employeeNumber, employeeName: emp.fullName }
  }

  // Puntaje crudo por categoria -> normalizado a 0-20 (ver criteria.js, unico lugar donde vive
  // esta formula) -- nunca se recibe ni se confia en un total mandado por el cliente.
  const rawByCategory = Object.fromEntries(FIVE_S_CATEGORIES.map((c) => [c, 0]))
  const answerRows = FIVE_S_CRITERIA.map((c) => {
    const answer = answerByCriterionId.get(c.id)
    const score = ANSWER_POINTS[answer] * c.weight
    rawByCategory[c.category] += score
    return { category: c.category, criterionId: c.id, answer, score }
  })
  const categoryScores = Object.fromEntries(
    FIVE_S_CATEGORIES.map((c) => [c, normalizeCategoryScore(rawByCategory[c], c)]),
  )
  const totalScore = FIVE_S_CATEGORIES.reduce((sum, c) => sum + categoryScores[c], 0)

  const now = new Date()
  const [createdAudit] = await db
    .insert(fiveSAudit)
    .values({
      areaId,
      stationName: stationName || null,
      employeeId: employeeId || null,
      employeeNumber: employeeSnapshot.employeeNumber,
      employeeName: employeeSnapshot.employeeName,
      shift: shift || null,
      auditDate: now,
      s1Score: categoryScores.s1,
      s2Score: categoryScores.s2,
      s3Score: categoryScores.s3,
      s4Score: categoryScores.s4,
      s5Score: categoryScores.s5,
      totalScore,
      notes: notes || null,
      createdByUserId: req.user.id,
      updatedAt: now,
    })
    .returning()

  await db.insert(fiveSAuditAnswer).values(
    answerRows.map((a) => ({
      auditId: createdAudit.id,
      category: a.category,
      criterionId: a.criterionId,
      answer: a.answer,
      score: a.score,
      observation: answers.find((x) => x.criterionId === a.criterionId)?.observation || null,
    })),
  )

  return res.status(201).json({ evaluation: { ...createdAudit, auditorName: req.user.name } })
}

export default requireAuth(async (req, res) => {
  if (req.method === 'POST') {
    const allowed = await canUserAccessModule({
      userId: req.user.id,
      role: req.user.role,
      moduleKey: '/auditoria',
    })
    if (!allowed) return res.status(403).json({ error: 'No autorizado para este modulo' })
    return handlePost(req, res)
  }
  if (req.method === 'GET') {
    const allowed = await canUserAccessModule({
      userId: req.user.id,
      role: req.user.role,
      moduleKey: '/evaluaciones',
    })
    if (!allowed) return res.status(403).json({ error: 'No autorizado para este modulo' })
    return handleGet(req, res)
  }
  return res.status(405).json({ error: 'Method not allowed' })
})
