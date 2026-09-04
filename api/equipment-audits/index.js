// "Levantamiento de equipos" -- 3er tipo de auditoria dentro del modulo Auditoria (2026-09-04, a
// peticion explicita del usuario: "en el modulo de auditoria se debe hacer el check list"). Ver
// src/data/auditsEquipo/criteria.js, UNICA fuente de verdad de los criterios (uno por tipo de
// equipo real, src/data/controlEquipo/catalog.js). GET/POST gateados con los mismos 2 module
// keys que ya usan FiveSAudit/ProcessAudit (mismo criterio, sin inventar uno nuevo): POST
// "/auditoria", GET "/evaluaciones". El puntaje SIEMPRE se calcula aqui, nunca se confia en un
// total que mande el cliente.
import { and, desc, eq } from 'drizzle-orm'
import { requireAuth } from '../../server-lib/auth.js'
import { db, equipmentAudit, equipmentAuditAnswer, user } from '../../server-lib/db/client.js'
import { canUserAccessModule } from '../../server-lib/permissionService.js'
import {
  EQUIPMENT_AUDIT_ANSWER_POINTS,
  EQUIPMENT_AUDIT_CRITERIA,
} from '../../src/data/auditsEquipo/criteria.js'

const VALID_ANSWERS = new Set(Object.keys(EQUIPMENT_AUDIT_ANSWER_POINTS))

async function handleGet(req, res) {
  const { areaId, stationName } = req.query || {}
  const conditions = []
  if (areaId) conditions.push(eq(equipmentAudit.areaId, areaId))
  if (stationName) conditions.push(eq(equipmentAudit.stationName, stationName))
  const rows = await db
    .select({
      id: equipmentAudit.id,
      areaId: equipmentAudit.areaId,
      stationName: equipmentAudit.stationName,
      auditDate: equipmentAudit.auditDate,
      totalScore: equipmentAudit.totalScore,
      notes: equipmentAudit.notes,
      createdAt: equipmentAudit.createdAt,
      auditorName: user.name,
    })
    .from(equipmentAudit)
    .leftJoin(user, eq(equipmentAudit.createdByUserId, user.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(equipmentAudit.auditDate), desc(equipmentAudit.createdAt))
  return res.status(200).json({ audits: rows })
}

async function handlePost(req, res) {
  const { areaId, stationName, notes, answers } = req.body || {}
  if (!areaId || typeof areaId !== 'string') {
    return res.status(400).json({ error: 'Falta areaId.' })
  }
  if (!Array.isArray(answers)) {
    return res.status(400).json({ error: 'Faltan las respuestas del checklist.' })
  }

  const answerByCriterionId = new Map(answers.map((a) => [a.criterionId, a.answer]))
  const missing = EQUIPMENT_AUDIT_CRITERIA.filter((c) => !answerByCriterionId.has(c.id))
  if (missing.length > 0) {
    return res.status(400).json({
      error: `Faltan ${missing.length} equipo(s) por revisar.`,
      missingCriterionIds: missing.map((c) => c.id),
    })
  }
  const invalid = answers.filter(
    (a) =>
      !VALID_ANSWERS.has(a.answer) || !EQUIPMENT_AUDIT_CRITERIA.some((c) => c.id === a.criterionId),
  )
  if (invalid.length > 0) {
    return res.status(400).json({ error: 'Hay respuestas invalidas en el checklist.' })
  }

  const answerRows = EQUIPMENT_AUDIT_CRITERIA.map((c) => {
    const answer = answerByCriterionId.get(c.id)
    return { criterionId: c.id, answer, score: EQUIPMENT_AUDIT_ANSWER_POINTS[answer] }
  })
  const totalScore = answerRows.reduce((sum, a) => sum + a.score, 0)

  const now = new Date()
  const [createdAudit] = await db
    .insert(equipmentAudit)
    .values({
      areaId,
      stationName: stationName || null,
      auditDate: now,
      totalScore,
      notes: notes || null,
      createdByUserId: req.user.id,
      updatedAt: now,
    })
    .returning()

  await db.insert(equipmentAuditAnswer).values(
    answerRows.map((a) => ({
      auditId: createdAudit.id,
      typeKey: a.criterionId,
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
