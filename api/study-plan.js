import {
  checkRateLimit,
  fail,
  getAdminSupabase,
  getClientIp,
  ok,
  requireAuth,
  setCors,
} from '../server/helpers.js'
import {
  extractPdfText,
  isMissingDocumentTextColumnError,
} from '../server/documentText.js'
import {
  buildMission,
  buildStudyPlan,
  evaluateMission,
  getCarryoverTopics,
  getCurrentDayContext,
} from '../server/studyPlan.js'

function normalizePlanRow(plan) {
  if (!plan) return null

  return {
    ...plan,
    analysis: typeof plan.analysis === 'object' && plan.analysis ? plan.analysis : {},
    roadmap: typeof plan.roadmap === 'object' && plan.roadmap ? plan.roadmap : { totalDays: 0, days: [] },
  }
}

function normalizeSessionRow(session) {
  if (!session) return null

  return {
    ...session,
    mission_topics: Array.isArray(session.mission_topics) ? session.mission_topics : [],
    mission: typeof session.mission === 'object' && session.mission ? session.mission : null,
    answers: typeof session.answers === 'object' && session.answers ? session.answers : {},
    feedback: typeof session.feedback === 'object' && session.feedback ? session.feedback : {},
  }
}

async function loadDocumentWithTextFallback(supabase, userId, documentId) {
  let supportsDocumentText = true
  let query = supabase
    .from('documents')
    .select('id, user_id, title, subject, summary, topics, mime_type, storage_path, total_pages, pct_covered, document_text')
    .eq('id', documentId)
    .eq('user_id', userId)
    .maybeSingle()

  let { data: document, error } = await query

  if (error && isMissingDocumentTextColumnError(error)) {
    supportsDocumentText = false
    ;({ data: document, error } = await supabase
      .from('documents')
      .select('id, user_id, title, subject, summary, topics, mime_type, storage_path, total_pages, pct_covered')
      .eq('id', documentId)
      .eq('user_id', userId)
      .maybeSingle())
  }

  if (error) throw error
  if (!document) {
    const notFoundError = new Error('We could not find that document. Please refresh and try again.')
    notFoundError.status = 404
    throw notFoundError
  }

  let documentText = document.document_text || ''
  let totalPages = Number(document.total_pages) || 0

  if (!documentText.trim() && document.mime_type === 'application/pdf' && document.storage_path) {
    const { data: fileData, error: fileError } = await supabase.storage
      .from('documents')
      .download(document.storage_path)

    if (fileError) throw fileError

    const extracted = await extractPdfText(Buffer.from(await fileData.arrayBuffer()))
    documentText = extracted.text || ''
    totalPages = extracted.totalPages || totalPages

    if (supportsDocumentText && documentText) {
      await supabase
        .from('documents')
        .update({ document_text: documentText, total_pages: totalPages })
        .eq('id', document.id)
        .eq('user_id', userId)
    }
  }

  return {
    document: {
      ...document,
      total_pages: totalPages,
    },
    documentText,
  }
}

async function loadPlan(supabase, userId, documentId) {
  const { data, error } = await supabase
    .from('study_plans')
    .select('id, user_id, document_id, analysis, roadmap, created_at, updated_at')
    .eq('user_id', userId)
    .eq('document_id', documentId)
    .maybeSingle()

  if (error) throw error
  return normalizePlanRow(data)
}

async function loadSessions(supabase, userId, studyPlanId) {
  if (!studyPlanId) return []

  const { data, error } = await supabase
    .from('study_sessions')
    .select('id, study_plan_id, document_id, day_number, mission_topics, mission, answers, quick_quiz_score, mini_test_score, overall_score, mastery_status, feedback, completed_at, created_at, updated_at')
    .eq('user_id', userId)
    .eq('study_plan_id', studyPlanId)
    .order('day_number', { ascending: true })

  if (error) throw error
  return (data || []).map(normalizeSessionRow)
}

function buildStudyPlanResponse(plan, sessions) {
  const currentContext = getCurrentDayContext(plan, sessions)
  return {
    plan,
    sessions,
    currentDayNumber: currentContext.currentDayNumber,
    currentDay: currentContext.currentDay,
    nextDay: currentContext.nextDay,
    currentSession: normalizeSessionRow(currentContext.openSession),
    completedDays: currentContext.completedSessions.length,
  }
}

async function handleGet(req, res) {
  const user = await requireAuth(req)
  checkRateLimit(`study-plan:${user.id}:${getClientIp(req)}`, { limit: 60, windowMs: 60_000 })

  const documentId = req.query?.documentId
  if (!documentId) {
    return fail(res, { status: 400, message: 'Please choose a document first.' })
  }

  const supabase = getAdminSupabase()
  await loadDocumentWithTextFallback(supabase, user.id, documentId)

  const plan = await loadPlan(supabase, user.id, documentId)
  if (!plan) {
    return ok(res, {
      plan: null,
      sessions: [],
      currentDayNumber: 1,
      currentDay: null,
      nextDay: null,
      currentSession: null,
      completedDays: 0,
    })
  }

  const sessions = await loadSessions(supabase, user.id, plan.id)
  return ok(res, buildStudyPlanResponse(plan, sessions))
}

async function handleGeneratePlan(req, res, user, supabase) {
  const documentId = req.body?.documentId
  if (!documentId) {
    return fail(res, { status: 400, message: 'Please choose a document first.' })
  }

  const { document, documentText } = await loadDocumentWithTextFallback(supabase, user.id, documentId)
  if (document.mime_type !== 'application/pdf') {
    return fail(res, { status: 400, message: 'Study plans work with PDF documents right now. Please choose a PDF to continue.' })
  }

  const existingPlan = await loadPlan(supabase, user.id, documentId)
  if (existingPlan && !req.body?.force) {
    const existingSessions = await loadSessions(supabase, user.id, existingPlan.id)
    return ok(res, buildStudyPlanResponse(existingPlan, existingSessions))
  }

  const planPayload = await buildStudyPlan({ document, documentText })
  const now = new Date().toISOString()
  const { data: storedPlan, error } = await supabase
    .from('study_plans')
    .upsert({
      user_id: user.id,
      document_id: documentId,
      analysis: planPayload.analysis,
      roadmap: planPayload.roadmap,
      updated_at: now,
    }, {
      onConflict: 'user_id,document_id',
    })
    .select('id, user_id, document_id, analysis, roadmap, created_at, updated_at')
    .single()

  if (error) throw error

  const normalizedPlan = normalizePlanRow(storedPlan)

  if (existingPlan?.id && existingPlan.id === normalizedPlan.id && req.body?.force) {
    await supabase
      .from('study_sessions')
      .delete()
      .eq('study_plan_id', normalizedPlan.id)
      .eq('user_id', user.id)

    await supabase
      .from('documents')
      .update({ pct_covered: 0 })
      .eq('id', documentId)
      .eq('user_id', user.id)
  }

  return ok(res, buildStudyPlanResponse(normalizedPlan, []))
}

async function handleGenerateMission(req, res, user, supabase) {
  const documentId = req.body?.documentId
  if (!documentId) {
    return fail(res, { status: 400, message: 'Please choose a document first.' })
  }

  const plan = await loadPlan(supabase, user.id, documentId)
  if (!plan) {
    return fail(res, { status: 404, message: 'Generate a study plan first so we can create your daily mission.' })
  }

  const sessions = await loadSessions(supabase, user.id, plan.id)
  const currentContext = getCurrentDayContext(plan, sessions)
  if (!currentContext.currentDay) {
    return fail(res, { status: 422, message: 'We could not find the next day in this study plan.' })
  }

  if (currentContext.openSession?.mission) {
    return ok(res, {
      ...buildStudyPlanResponse(plan, sessions),
      currentSession: currentContext.openSession,
      mission: currentContext.openSession.mission,
    })
  }

  const { document, documentText } = await loadDocumentWithTextFallback(supabase, user.id, documentId)
  const mission = await buildMission({
    document,
    documentText,
    plan,
    currentDay: currentContext.currentDay,
    nextDay: currentContext.nextDay,
    carryoverTopics: getCarryoverTopics(sessions, 2),
  })

  const { data: storedSession, error } = await supabase
    .from('study_sessions')
    .upsert({
      user_id: user.id,
      study_plan_id: plan.id,
      document_id: documentId,
      day_number: currentContext.currentDay.dayNumber,
      mission_topics: mission.focusTopics,
      mission,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'study_plan_id,day_number',
    })
    .select('id, study_plan_id, document_id, day_number, mission_topics, mission, answers, quick_quiz_score, mini_test_score, overall_score, mastery_status, feedback, completed_at, created_at, updated_at')
    .single()

  if (error) throw error

  const nextSessions = await loadSessions(supabase, user.id, plan.id)
  return ok(res, {
    ...buildStudyPlanResponse(plan, nextSessions),
    currentSession: normalizeSessionRow(storedSession),
    mission,
  })
}

async function handleSubmitMission(req, res, user, supabase) {
  const sessionId = req.body?.sessionId
  const quickQuizAnswers = Array.isArray(req.body?.quickQuizAnswers) ? req.body.quickQuizAnswers : []
  const miniTestAnswers = Array.isArray(req.body?.miniTestAnswers) ? req.body.miniTestAnswers : []

  if (!sessionId) {
    return fail(res, { status: 400, message: 'We could not find that mission. Please refresh and try again.' })
  }

  const { data: session, error: sessionError } = await supabase
    .from('study_sessions')
    .select('id, user_id, study_plan_id, document_id, day_number, mission, completed_at')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (sessionError || !session) {
    return fail(res, { status: 404, message: 'We could not find that mission. Please refresh and try again.' })
  }

  const plan = await loadPlan(supabase, user.id, session.document_id)
  if (!plan) {
    return fail(res, { status: 404, message: 'We could not find the study plan for this mission anymore.' })
  }

  const nextDay = (plan.roadmap?.days || []).find((day) => day.dayNumber === Number(session.day_number) + 1) || null
  const evaluation = evaluateMission({
    mission: session.mission,
    quickQuizAnswers,
    miniTestAnswers,
    nextDay,
  })

  const { data: updatedSession, error: updateError } = await supabase
    .from('study_sessions')
    .update({
      answers: {
        quickQuiz: quickQuizAnswers,
        miniTest: miniTestAnswers,
      },
      quick_quiz_score: evaluation.quickQuiz.pct,
      mini_test_score: evaluation.miniTest.pct,
      overall_score: evaluation.overallScore,
      mastery_status: evaluation.masteryStatus,
      feedback: evaluation.feedback,
      completed_at: session.completed_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .select('id, study_plan_id, document_id, day_number, mission_topics, mission, answers, quick_quiz_score, mini_test_score, overall_score, mastery_status, feedback, completed_at, created_at, updated_at')
    .single()

  if (updateError) throw updateError

  const sessions = await loadSessions(supabase, user.id, plan.id)
  const completedCount = sessions.filter((item) => item.completed_at).length
  const totalDays = Math.max(1, Number(plan.roadmap?.totalDays) || (plan.roadmap?.days || []).length || 1)
  const pctCovered = Math.round((completedCount / totalDays) * 100)

  await supabase
    .from('documents')
    .update({ pct_covered: pctCovered })
    .eq('id', session.document_id)
    .eq('user_id', user.id)

  return ok(res, {
    session: normalizeSessionRow(updatedSession),
    evaluation,
    ...buildStudyPlanResponse(plan, sessions),
  })
}

async function handlePost(req, res) {
  const user = await requireAuth(req)
  const action = req.body?.action || 'generatePlan'
  checkRateLimit(`study-plan:${action}:${user.id}:${getClientIp(req)}`, { limit: 20, windowMs: 60 * 60 * 1000 })
  const supabase = getAdminSupabase()

  if (action === 'generatePlan') {
    return handleGeneratePlan(req, res, user, supabase)
  }

  if (action === 'generateMission') {
    return handleGenerateMission(req, res, user, supabase)
  }

  return fail(res, { status: 400, message: 'That study-plan action is not available here.' })
}

async function handlePatch(req, res) {
  const user = await requireAuth(req)
  checkRateLimit(`study-plan-submit:${user.id}:${getClientIp(req)}`, { limit: 60, windowMs: 60 * 60 * 1000 })
  const supabase = getAdminSupabase()

  if (req.body?.action === 'submitMission') {
    return handleSubmitMission(req, res, user, supabase)
  }

  return fail(res, { status: 400, message: 'That study-plan update is not available here.' })
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    if (req.method === 'GET') {
      return handleGet(req, res)
    }

    if (req.method === 'POST') {
      return handlePost(req, res)
    }

    if (req.method === 'PATCH') {
      return handlePatch(req, res)
    }

    return fail(res, { status: 405, message: 'That action is not available here.' })
  } catch (error) {
    return fail(res, error)
  }
}
