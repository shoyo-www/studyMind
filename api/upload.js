import formidable from 'formidable'
import fs from 'fs'
import {
  checkRateLimit,
  ensureProfile,
  fail,
  getAdminSupabase,
  getClientIp,
  ok,
  requireAuth,
  sanitizeFileName,
  setCors,
} from '../server/helpers.js'
import {
  extractPdfText,
  isMissingDocumentTextColumnError,
} from '../server/documentText.js'
import { buildRoadmapTopicsFromText } from '../server/roadmapTopics.js'
import {
  MAX_UPLOAD_FILE_SIZE,
  getFirstUploadedFile,
  getUploadContentType,
  validateUploadFile,
} from '../shared/uploadValidation.js'
import {
  extractJsonFromText,
  getGeminiClient,
  getGeminiModelName,
  makeGeminiFilePart,
  runGeminiTask,
  shouldSkipGeminiDueToRecentQuota,
  uploadPdfToGemini,
} from '../server/gemini.js'

const AI_SUPPORTED_MIME_TYPES = new Set(['application/pdf'])

export const config = { api: { bodyParser: false } }

function getFallbackMetadata(file, mimeType = getUploadContentType(file)) {
  const baseTitle = (file.originalFilename || 'Untitled document').replace(/\.[^.]+$/, '')

  if (mimeType === 'application/pdf') {
    return {
      title: baseTitle,
      subject: 'General',
      totalPages: 0,
      topics: [],
      summary: '',
    }
  }

  return {
    title: baseTitle,
    subject: 'General',
    totalPages: 0,
    topics: [],
    summary: 'Upload saved successfully. AI analysis is currently available for PDF documents.',
  }
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return fail(res, { status: 405, message: 'That upload action is not available here.' })

  let uploadedTempPath = ''

  try {
    const user = await requireAuth(req)
    const rateLimitKey = `upload:${user.id}:${getClientIp(req)}`
    checkRateLimit(rateLimitKey, { limit: 10, windowMs: 60 * 60 * 1000 })

    const form = formidable({
      allowEmptyFiles: false,
      maxFileSize: MAX_UPLOAD_FILE_SIZE,
      multiples: false,
    })

    const [, files] = await form.parse(req)
    const file = getFirstUploadedFile(files)

    const validationError = validateUploadFile(file)
    if (validationError === 'no_file') return fail(res, { status: 400, message: 'Please choose a file to upload.' })
    if (validationError === 'empty_file') return fail(res, { status: 400, message: 'That file looks empty. Please choose another one.' })
    if (validationError === 'invalid_type') return fail(res, { status: 400, message: 'Please upload a PDF or DOCX file.' })
    if (validationError === 'file_too_large') return fail(res, { status: 400, message: 'That file is too large. Please keep it under 50MB.' })

    uploadedTempPath = file.filepath

    const supabase = getAdminSupabase()
    const profile = await ensureProfile(supabase, user)

    const uploadLimit = profile?.plan === 'pro' ? Number.MAX_SAFE_INTEGER : 3
    if ((profile?.uploads_this_month || 0) >= uploadLimit) {
      return fail(res, {
        status: 403,
        message: `You've used ${profile.uploads_this_month}/${uploadLimit} uploads this month. Upgrade to Pro for unlimited uploads.`,
      })
    }

    const fileBuffer = fs.readFileSync(file.filepath)
    const safeFileName = sanitizeFileName(file.originalFilename)
    const contentType = getUploadContentType(file)
    const storagePath = `${user.id}/${Date.now()}-${safeFileName}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: false,
      })

    if (uploadError) throw uploadError

    let metadata = getFallbackMetadata(file, contentType)
    let documentText = ''

    if (AI_SUPPORTED_MIME_TYPES.has(contentType)) {
      try {
        const extractedPdf = await extractPdfText(fileBuffer)
        documentText = extractedPdf.text || ''
        if (extractedPdf.totalPages) {
          metadata = {
            ...metadata,
            totalPages: extractedPdf.totalPages,
          }
        }
        if (!metadata.topics.length && documentText) {
          metadata = {
            ...metadata,
            topics: buildRoadmapTopicsFromText(documentText),
          }
        }
      } catch (error) {
        console.warn('[Upload text extraction skipped]', error?.message || error)
      }

      const canAttemptGeminiAnalysis = Boolean(process.env.GEMINI_API_KEY) && !shouldSkipGeminiDueToRecentQuota()

      if (!canAttemptGeminiAnalysis) {
        const reason = process.env.GEMINI_API_KEY
          ? 'Gemini analysis is cooling down after a recent quota response.'
          : 'GEMINI_API_KEY is not configured.'
        console.info(`[Upload metadata extraction skipped] ${reason}`)
      } else {
        try {
          const ai = getGeminiClient()
          const geminiFile = await uploadPdfToGemini(ai, {
            buffer: fileBuffer,
            displayName: safeFileName,
          })

          const result = await runGeminiTask(() => ai.models.generateContent({
            model: getGeminiModelName(),
            contents: [
              { text: 'Analyse this document and return a JSON object with title, subject, totalPages, topics, and summary.' },
              makeGeminiFilePart(geminiFile),
            ],
            config: {
              responseMimeType: 'application/json',
              systemInstruction: 'Return only valid JSON. topics must be an array of objects with title, estimatedMinutes, and subtopics.',
            },
          }), {
            label: 'Gemini upload analysis',
            userMessage: 'Document analysis is a little busy right now. Please try again in about a minute.',
            quotaUserMessage: 'Document analysis is temporarily unavailable right now. Please try again a little later.',
          })

          const parsed = JSON.parse(extractJsonFromText(result.text))
          metadata = {
            ...metadata,
            title: parsed.title || metadata.title,
            subject: parsed.subject || metadata.subject,
            totalPages: Number(parsed.totalPages) || metadata.totalPages,
            topics: Array.isArray(parsed.topics) && parsed.topics.length ? parsed.topics : metadata.topics,
            summary: parsed.summary || metadata.summary,
          }
        } catch (error) {
          if (error?.geminiIssueType) {
            console.warn(`[Upload metadata extraction skipped] ${error.message}`)
          } else {
            console.error('[Upload metadata extraction failed]', error)
          }
        }
      }
    }

    const documentInsertPayload = {
      user_id: user.id,
      title: metadata.title || getFallbackMetadata(file).title,
      subject: metadata.subject || 'General',
      storage_path: storagePath,
      total_pages: metadata.totalPages || 0,
      summary: metadata.summary || '',
      document_text: documentText || null,
      topics: metadata.topics || [],
      file_size: file.size,
      mime_type: contentType,
    }

    let { data: document, error: documentError } = await supabase
      .from('documents')
      .insert(documentInsertPayload)
      .select()
      .single()

    if (documentError && isMissingDocumentTextColumnError(documentError)) {
      console.warn('[Upload document_text skipped] documents.document_text column is not available yet.')
      const { document_text, ...legacyInsertPayload } = documentInsertPayload
      ;({ data: document, error: documentError } = await supabase
        .from('documents')
        .insert(legacyInsertPayload)
        .select()
        .single())
    }

    if (documentError) throw documentError

    await supabase
      .from('profiles')
      .update({ uploads_this_month: (profile?.uploads_this_month || 0) + 1 })
      .eq('id', user.id)

    return ok(res, {
      document,
      topics: metadata.topics || [],
      summary: metadata.summary || '',
      analysisAvailable: AI_SUPPORTED_MIME_TYPES.has(contentType),
      roadmapReady: Array.isArray(metadata.topics) && metadata.topics.length > 0,
    }, 201)
  } catch (error) {
    return fail(res, error)
  } finally {
    if (uploadedTempPath) {
      try {
        fs.unlinkSync(uploadedTempPath)
      } catch {
        // Ignore temp-file cleanup failures.
      }
    }
  }
}
