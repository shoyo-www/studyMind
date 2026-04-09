// api/mocktest/generate.js
// Generates a full exam question paper from a PDF
// KEY BEHAVIOURS:
//   1. Each uploaded PDF gets one generated mock test
//   2. If a test already exists for the PDF, return it instead of creating another
//   3. Gemini primary → Groq fallback

import {
  checkRateLimit, ensureProfile, fail, getAdminSupabase,
  getClientIp, ok, requireAuth, sanitizeFileName, setCors,
} from '../../server/helpers.js'
import {
  getGeminiClient, getGeminiModelName, makeGeminiFilePart,
  runGeminiTask, shouldSkipGeminiDueToRecentQuota, uploadPdfToGemini, extractJsonFromText,
} from '../../server/gemini.js'
import { groqGenerateMockTest, isGroqConfigured } from '../../server/groq.js'
import { extractPdfText } from '../../server/documentText.js'

const DEFAULT_DURATION_MINUTES = 180
const DEFAULT_TOTAL_MARKS = 100

function shouldFallback(err) { return (err?.status || 0) !== 400 }

// ── Check if a test already exists for this PDF ──────────────────────
async function findExistingTest(supabase, userId, documentId) {
  const { data: tests } = await supabase
    .from('mock_tests')
    .select(`
      id, title, subject, duration_minutes, total_marks, questions, created_at,
      mock_test_submissions ( id )
    `)
    .eq('user_id', userId)
    .eq('document_id', documentId)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(1)

  if (!tests?.length) return null
  return tests[0]
}

function buildPrompt({ title, subject, durationMinutes, totalMarks }) {
  const isSmall = totalMarks <= 50
  const sA = isSmall ? 5 : 8
  const lA = isSmall ? 3 : 5
  const nm = isSmall ? 2 : 4
  const fb = isSmall ? 5 : 8

  return `You are an expert exam paper setter for "${subject || title}".
Generate a complete, realistic exam paper from the document content ONLY.
Duration: ${durationMinutes} minutes. Total marks: ${totalMarks}.

Return ONLY a valid JSON array — absolutely no markdown, no text before or after.

Each element must have these exact fields:
- "id": number starting at 1
- "section": "Section A" | "Section B" | "Section C"
- "type": "short_answer" | "long_answer" | "numerical" | "fill_blank"
- "question": the full question text
- "marks": integer marks for this question
- "expectedLength": e.g. "2-3 sentences" / "1 page" / "show working"
- "hint": brief hint string, empty string if none
- "topic": which topic/chapter this covers
- "modelAnswer": detailed correct answer (for AI marking only, never shown to student)

Required distribution:
- ${sA} × short_answer questions → Section A (1-2 marks each)
- ${lA} × long_answer questions  → Section B (5-10 marks each)
- ${nm} × numerical questions    → Section C (4-6 marks each, "show your working")
- ${fb} × fill_blank questions   → Section A (1 mark each)

Rules:
1. All questions must be directly answerable from the document
2. Total marks of all questions must sum to exactly ${totalMarks}
3. Numerical questions must include units and require step-by-step working
4. Fill-in-the-blank must have a single clear correct answer
5. modelAnswer must be comprehensive — used for AI marking

Return the JSON array now.`
}

async function generateWithGemini({ doc, pdfBuffer, durationMinutes, totalMarks }) {
  const ai         = getGeminiClient()
  const geminiFile = await uploadPdfToGemini(ai, { buffer: pdfBuffer, displayName: sanitizeFileName(doc.title || 'exam.pdf') })

  const result = await runGeminiTask(() => ai.models.generateContent({
    model:    getGeminiModelName(),
    contents: [
      { text: buildPrompt({ title: doc.title, subject: doc.subject, durationMinutes, totalMarks }) },
      makeGeminiFilePart(geminiFile),
    ],
    config: { responseMimeType: 'application/json', systemInstruction: 'Return only a valid JSON array of question objects. No markdown.' },
  }), { label: 'MockTest/generate' })

  const parsed = JSON.parse(extractJsonFromText(result.text || '[]'))
  if (!Array.isArray(parsed) || !parsed.length) throw new Error('No questions generated')
  return { questions: parsed, model: getGeminiModelName() }
}

async function generateWithGroq({ doc, documentText, durationMinutes, totalMarks }) {
  const prompt = buildPrompt({ title: doc.title, subject: doc.subject, durationMinutes, totalMarks })
  const raw    = await groqGenerateMockTest({ documentTitle: doc.title, documentText: documentText.slice(0, 50_000), prompt, totalMarks })
  if (!Array.isArray(raw) || !raw.length) throw new Error('Groq returned no questions')
  return { questions: raw, model: 'groq-fallback' }
}

function safeQuestions(questions) {
  return questions.map(q => ({
    id:             q.id,
    section:        q.section,
    type:           q.type,
    question:       q.question,
    marks:          q.marks,
    expectedLength: q.expectedLength || '',
    hint:           q.hint || '',
    topic:          q.topic,
    // modelAnswer intentionally omitted — server-side only
  }))
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return fail(res, { status: 405, message: 'That action is not available here.' })

  try {
    const user = await requireAuth(req)
    // In-memory rate limit (burst protection — 10/min)
    checkRateLimit(`mocktest-gen:${user.id}:${getClientIp(req)}`, { limit: 10, windowMs: 60_000 })

    const { documentId } = req.body || {}
    if (!documentId) return fail(res, { status: 400, message: 'Please choose a document first.' })

    const duration = DEFAULT_DURATION_MINUTES
    const marks = DEFAULT_TOTAL_MARKS

    const supabase = getAdminSupabase()
    await ensureProfile(supabase, user)

    // ── 1. Return the existing test for this PDF if one already exists ──
    const existing = await findExistingTest(supabase, user.id, documentId)
    if (existing) {
      console.log(`[MockTest/generate] Returning existing test ${existing.id} for user ${user.id}`)
      return ok(res, {
        mockTest: {
          id:              existing.id,
          documentId,
          title:           existing.title,
          subject:         existing.subject,
          durationMinutes: existing.duration_minutes,
          totalMarks:      existing.total_marks,
          questionCount:   Array.isArray(existing.questions) ? existing.questions.length : 0,
          createdAt:       existing.created_at,
          isExisting:      true,
        },
        questions:  safeQuestions(Array.isArray(existing.questions) ? existing.questions : []),
        isExisting: true,
      })
    }

    // ── 2. Fetch document ─────────────────────────────────────────────────
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('id, title, subject, storage_path, mime_type, document_text')
      .eq('id', documentId).eq('user_id', user.id).single()

    if (docErr || !doc) return fail(res, { status: 404, message: 'We could not find that document. Please refresh and try again.' })
    if (doc.mime_type !== 'application/pdf') return fail(res, { status: 400, message: 'Mock tests work with PDF documents right now. Please choose a PDF to continue.' })

    // ── 3. Generate questions ─────────────────────────────────────────────
    let questions = [], model = 'unknown'

    try {
      if (!process.env.GEMINI_API_KEY || shouldSkipGeminiDueToRecentQuota()) throw new Error('Gemini unavailable')
      const { data: fileData, error: fileErr } = await supabase.storage.from('documents').download(doc.storage_path)
      if (fileErr) throw fileErr
      const pdfBuffer = Buffer.from(await fileData.arrayBuffer())
      ;({ questions, model } = await generateWithGemini({ doc, pdfBuffer, durationMinutes: duration, totalMarks: marks }))
    } catch (geminiErr) {
      if (shouldFallback(geminiErr) && isGroqConfigured()) {
        console.warn('[MockTest/generate] Gemini failed → Groq:', geminiErr.message)
        let documentText = doc.document_text || ''
        if (!documentText.trim()) {
          const { data: fd } = await supabase.storage.from('documents').download(doc.storage_path)
          if (fd) {
            const { text } = await extractPdfText(Buffer.from(await fd.arrayBuffer()))
            documentText = text || ''
            if (documentText) supabase.from('documents').update({ document_text: documentText }).eq('id', doc.id).catch(() => {})
          }
        }
        ;({ questions, model } = await generateWithGroq({ doc, documentText, durationMinutes: duration, totalMarks: marks }))
      } else {
        throw geminiErr
      }
    }

    const actualTotal = questions.reduce((s, q) => s + (Number(q.marks) || 0), 0) || marks

    // ── 4. Save to DB ─────────────────────────────────────────────────────
    const { data: mockTest, error: insertErr } = await supabase
      .from('mock_tests')
      .insert({
        user_id: user.id, document_id: documentId,
        title:   `${doc.title} — Mock Test`,
        subject: doc.subject || 'General',
        duration_minutes:     duration,
        total_marks:          actualTotal,
        questions,
        status:               'ready',
        generated_with_model: model,
      })
      .select('id, title, subject, duration_minutes, total_marks, created_at')
      .single()

    if (insertErr) throw insertErr

    return ok(res, {
      mockTest: {
        id:              mockTest.id,
        documentId,
        title:           mockTest.title,
        subject:         mockTest.subject,
        durationMinutes: mockTest.duration_minutes,
        totalMarks:      mockTest.total_marks,
        questionCount:   questions.length,
        createdAt:       mockTest.created_at,
        isExisting:      false,
      },
      questions:  safeQuestions(questions),
      isExisting: false,
    }, 201)

  } catch (error) {
    return fail(res, error)
  }
}
