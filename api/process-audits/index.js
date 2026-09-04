// Modulo Auditoria de Proceso (2026-09-03, a peticion explicita del usuario -- primer checklist
// real tomado de "AUDITORIA ETIQUETADOR- SEMANA 36.xlsx", ver src/data/auditsProceso/criteria.js,
// UNICA fuente de verdad de los criterios tanto para el frontend como para este endpoint. GET lo
// consume EvaluacionesPage.jsx (modulo "/evaluaciones"); POST lo consume AuditoriaPage.jsx al
// terminar una auditoria de proceso completa (modulo "/auditoria") -- mismos 2 module keys que ya
// usa Evaluaciones 5S, sin inventar uno nuevo.
//
// A diferencia de FiveSAudit (siempre por AREA), esta auditoria SI evalua a una persona real en
// un puesto real -- areaId/role/stationName/employeeId son obligatorios (nunca null). El puntaje
// SIEMPRE se calcula aqui, nunca se confia en un total que mande el cliente.
import { and, desc, eq } from 'drizzle-orm'
import { requireAuth } from '../../server-lib/auth.js'
import { db, employee, processAudit, processAuditAnswer, user } from '../../server-lib/db/client.js'
import { canUserAccessModule } from '../../server-lib/permissionService.js'
import {
  categoryPercentFromRaw,
  criteriaForRole,
  PROCESS_AUDIT_ANSWER_POINTS,
} from '../../src/data/auditsProceso/criteria.js'

const VALID_ANSWERS = new Set(Object.keys(PROCESS_AUDIT_ANSWER_POINTS))

async function handleGet(req, res) {
  const { areaId, stationName } = req.query || {}
  const conditions = []
  if (areaId) conditions.push(eq(processAudit.areaId, areaId))
  if (stationName) conditions.push(eq(processAudit.stationName, stationName))
  const rows = await db
    .select({
      id: processAudit.id,
      areaId: processAudit.areaId,
      role: processAudit.role,
      stationName: processAudit.stationName,
      employeeId: processAudit.employeeId,
      employeeNumber: processAudit.employeeNumber,
      employeeName: processAudit.employeeName,
      shift: processAudit.shift,
      auditDate: processAudit.auditDate,
      category1Score: processAudit.category1Score,
      category2Score: processAudit.category2Score,
      category3Score: processAudit.category3Score,
      category4Score: processAudit.category4Score,
      category5Score: processAudit.category5Score,
      category6Score: processAudit.category6Score,
      category7Score: processAudit.category7Score,
      totalScore: processAudit.totalScore,
      notes: processAudit.notes,
      createdAt: processAudit.createdAt,
      auditorName: user.name,
    })
    .from(processAudit)
    .leftJoin(user, eq(processAudit.createdByUserId, user.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(processAudit.auditDate), desc(processAudit.createdAt))
  return res.status(200).json({ audits: rows })
}

async function handlePost(req, res) {
  const { areaId, role, stationName, employeeId, shift, notes, answers } = req.body || {}
  if (!areaId || typeof areaId !== 'string') {
    return res.status(400).json({ error: 'Falta areaId.' })
  }
  if (!role || typeof role !== 'string') {
    return res.status(400).json({ error: 'Falta el puesto (role) a auditar.' })
  }
  if (!stationName || typeof stationName !== 'string') {
    return res.status(400).json({ error: 'Falta stationName.' })
  }
  if (!employeeId || typeof employeeId !== 'string') {
    return res.status(400).json({ error: 'Falta el empleado a auditar.' })
  }
  const criteria = criteriaForRole(role)
  if (criteria.length === 0) {
    return res
      .status(400)
      .json({ error: `Todavia no hay checklist real para el puesto "${role}".` })
  }
  if (!Array.isArray(answers)) {
    return res.status(400).json({ error: 'Faltan las respuestas del checklist.' })
  }

  const answerByCriterionId = new Map(answers.map((a) => [a.criterionId, a.answer]))
  const missing = criteria.filter((c) => !answerByCriterionId.has(c.id))
  if (missing.length > 0) {
    return res.status(400).json({
      error: `Faltan ${missing.length} criterio(s) por evaluar.`,
      missingCriterionIds: missing.map((c) => c.id),
    })
  }
  const invalid = answers.filter(
    (a) => !VALID_ANSWERS.has(a.answer) || !criteria.some((c) => c.id === a.criterionId),
  )
  if (invalid.length > 0) {
    return res.status(400).json({ error: 'Hay respuestas invalidas en el checklist.' })
  }

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

  // Puntaje % por categoria (suma de puntos / (criterios*10)) -- unico lugar donde ocurre esta
  // cuenta, ver src/data/auditsProceso/criteria.js. Nunca se recibe ni se confia en un total
  // mandado por el cliente.
  const categoryIds = [...new Set(criteria.map((c) => c.category))].sort((a, b) => a - b)
  const rawByCategory = Object.fromEntries(categoryIds.map((c) => [c, 0]))
  const answerRows = criteria.map((c) => {
    const answer = answerByCriterionId.get(c.id)
    const score = PROCESS_AUDIT_ANSWER_POINTS[answer]
    rawByCategory[c.category] += score
    return { category: c.category, criterionId: c.id, answer, score }
  })
  const categoryPercents = Object.fromEntries(
    categoryIds.map((c) => [
      c,
      categoryPercentFromRaw(rawByCategory[c], criteria.filter((x) => x.category === c).length),
    ]),
  )
  const totalScore = Math.round(
    categoryIds.reduce((sum, c) => sum + categoryPercents[c], 0) / categoryIds.length,
  )

  const now = new Date()
  const [createdAudit] = await db
    .insert(processAudit)
    .values({
      areaId,
      role,
      stationName,
      employeeId,
      employeeNumber: emp.employeeNumber,
      employeeName: emp.fullName,
      shift: shift || null,
      auditDate: now,
      category1Score: categoryPercents[1] ?? null,
      category2Score: categoryPercents[2] ?? null,
      category3Score: categoryPercents[3] ?? null,
      category4Score: categoryPercents[4] ?? null,
      category5Score: categoryPercents[5] ?? null,
      category6Score: categoryPercents[6] ?? null,
      category7Score: categoryPercents[7] ?? null,
      totalScore,
      notes: notes || null,
      createdByUserId: req.user.id,
      updatedAt: now,
    })
    .returning()

  await db.insert(processAuditAnswer).values(
    answerRows.map((a) => ({
      auditId: createdAudit.id,
      category: a.category,
      criterionId: a.criterionId,
      answer: a.answer,
      score: a.score,
      observation: answers.find((x) => x.criterionId === a.criterionId)?.observation || null,
    })),
  )

  return res.status(201).json({ audit: { ...createdAudit, auditorName: req.user.name } })
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
