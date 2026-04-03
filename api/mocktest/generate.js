// api/mocktest/generate.js
// Generates a full exam question paper from a PDF
// Types: short_answer, long_answer, numerical (maths), fill_blank
// Primary: Gemini (native PDF) → Fallback: Groq (extracted text)

import {
  checkRateLimit, ensureProfile, fail, getAdminSupabase,
  getClientIp, ok, requireAuth, sanitizeFileName, setCors,
} from '../_helpers.js'
import {
  getGeminiClient, getGeminiModelName, makeGeminiFilePart,
  runGeminiTask, shouldSkipGeminiDueToRecentQuota, uploadPdfToGemini, extractJsonFromText,
} from '../_gemini.js'
import { groqGenerateMockTest, isGroqConfigured } from '../_groq.js'
import { extractPdfText } from '../_documentText.js'

const VALID_DURATIONS = new Set([60, 90, 120, 150, 180])
const VALID_MARKS     = new Set([50, 75, 100])

// Any non-input Gemini error → try Groq
function shouldFallback(err) {
  return (err?.status || 0) !== 400
}

function buildPrompt({ title, subject, durationMinutes, totalMarks }) {
  // Scale question counts to total marks
  const isSmall = totalMarks <= 50
  const sA = isSmall ? 5  : 8    // short answer
  const lA = isSmall ? 3  : 5    // long answer
  const nm = isSmall ? 2  : 4    // numerical / maths
  const fb = isSmall ? 5  : 8    // fill in the blank

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
- "modelAnswer": detailed correct answer (used ONLY for AI marking, not shown to student)

Required distribution:
- ${sA} × short_answer questions → Section A (1-2 marks each)
- ${lA} × long_answer questions  → Section B (5-10 marks each)
- ${nm} × numerical questions    → Section C (4-6 marks each, "show your working")
- ${fb} × fill_blank questions   → Section A (1 mark each)

Rules:
1. All questions must be directly answerable from the document
2. Total marks of all questions must sum to exactly ${totalMarks}
3. Numerical questions must include units and require step-by-step working
4. Fill-in-the-blank must have a clear single correct answer
5. modelAnswer must be comprehensive — AI will use it to mark student responses

Return the JSON array now.`
}

async function generateWithGemini({ doc, pdfBuffer, durationMinutes, totalMarks }) {
  const ai         = getGeminiClient()
  const geminiFile = await uploadPdfToGemini(ai, {
    buffer:      pdfBuffer,
    displayName: sanitizeFileName(doc.title || 'exam.pdf'),
  })

  const result = await runGeminiTask(() => ai.models.generateContent({
    model:    getGeminiModelName(),
    contents: [
      { text: buildPrompt({ title: doc.title, subject: doc.subject, durationMinutes, totalMarks }) },
      makeGeminiFilePart(geminiFile),
    ],
    config: {
      responseMimeType:   'application/json',
      systemInstruction:  'Return only a valid JSON array of question objects. No markdown.',
    },
  }), { label: 'MockTest/generate' })

  const parsed = JSON.parse(extractJsonFromText(result.text || '[]'))
  if (!Array.isArray(parsed) || !parsed.length) throw new Error('No questions generated')
  return { questions: parsed, model: getGeminiModelName() }
}

async function generateWithGroq({ doc, documentText, durationMinutes, totalMarks }) {
  const prompt = buildPrompt({ title: doc.title, subject: doc.subject, durationMinutes, totalMarks })
  const questions = await groqGenerateMockTest({
    documentTitle: doc.title,
    documentText,
    prompt,
    totalMarks,
  })

  return { questions, model: 'groq-fallback' }
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return fail(res, { status: 405, message: 'Method not allowed' })

  try {
    const user = await requireAuth(req)
    checkRateLimit(`mocktest-gen:${user.id}:${getClientIp(req)}`, { limit: 5, windowMs: 60 * 60_000 })

    const { documentId, durationMinutes = 180, totalMarks = 100 } = req.body || {}
    if (!documentId) return fail(res, { status: 400, message: 'documentId is required' })

    const duration = VALID_DURATIONS.has(Number(durationMinutes)) ? Number(durationMinutes) : 180
    const marks    = VALID_MARKS.has(Number(totalMarks))          ? Number(totalMarks)       : 100

    const supabase = getAdminSupabase()
    await ensureProfile(supabase, user)

    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('id, title, subject, storage_path, mime_type, document_text')
      .eq('id', documentId).eq('user_id', user.id).single()

    if (docErr || !doc) return fail(res, { status: 404, message: 'Document not found' })
    if (doc.mime_type !== 'application/pdf') return fail(res, { status: 400, message: 'Mock tests require a PDF document.' })

    let questions = [], model = 'unknown'
    let geminiErr = null
    const canUseGroq = isGroqConfigured()
    const shouldBypassGemini = canUseGroq && shouldSkipGeminiDueToRecentQuota()

    if (shouldBypassGemini) {
      geminiErr = new Error('Mock test generation is temporarily unavailable because the Gemini API quota for this project has been exhausted. Please try again in about a minute.')
      geminiErr.status = 429
      geminiErr.geminiIssueType = 'quota'
      console.warn('[MockTest/generate] Skipping Gemini because project quota is still cooling down.')
    } else {
      // ── Try Gemini ──────────────────────────────────────────────
      try {
        const { data: fileData, error: fileErr } = await supabase.storage.from('documents').download(doc.storage_path)
        if (fileErr) throw fileErr
        const pdfBuffer = Buffer.from(await fileData.arrayBuffer())
        ;({ questions, model } = await generateWithGemini({ doc, pdfBuffer, durationMinutes: duration, totalMarks: marks }))
      } catch (error) {
        geminiErr = error
      }
    }

    if (geminiErr) {
      if (!shouldFallback(geminiErr) || !canUseGroq) throw geminiErr
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
    }

    // Recalculate actual total marks from questions
    const actualTotal = questions.reduce((s, q) => s + (Number(q.marks) || 0), 0) || marks

    const { data: mockTest, error: insertErr } = await supabase
      .from('mock_tests')
      .insert({
        user_id: user.id, document_id: documentId,
        title: `${doc.title} — Mock Test`,
        subject: doc.subject || 'General',
        duration_minutes: duration,
        total_marks: actualTotal,
        questions,
        status: 'ready',
        generated_with_model: model,
      })
      .select('id, title, subject, duration_minutes, total_marks, created_at, generated_with_model')
      .single()

    if (insertErr) throw insertErr

    // Return questions WITHOUT modelAnswer (kept server-side for marking)
    const safeQuestions = questions.map(q => ({
      id: q.id, section: q.section, type: q.type,
      question: q.question, marks: q.marks,
      expectedLength: q.expectedLength || '', hint: q.hint || '', topic: q.topic,
    }))

    return ok(res, {
      mockTest: {
        id:              mockTest.id,
        title:           mockTest.title,
        subject:         mockTest.subject,
        durationMinutes: mockTest.duration_minutes,
        totalMarks:      mockTest.total_marks,
        questionCount:   questions.length,
        createdAt:       mockTest.created_at,
        generatedWithModel: mockTest.generated_with_model,
      },
      questions: safeQuestions,
    }, 201)

  } catch (error) {
    return fail(res, error)
  }
}
