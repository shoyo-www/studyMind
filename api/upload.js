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
} from './_helpers.js'
import {
  extractJsonFromText,
  getGeminiClient,
  getGeminiModelName,
  makeGeminiFilePart,
  runGeminiTask,
  uploadPdfToGemini,
} from './_gemini.js'

const MAX_FILE_SIZE = 50 * 1024 * 1024
const AI_SUPPORTED_MIME_TYPES = new Set(['application/pdf'])
const UPLOAD_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export const config = { api: { bodyParser: false } }

function getFallbackMetadata(file) {
  const baseTitle = (file.originalFilename || 'Untitled document').replace(/\.[^.]+$/, '')

  if (file.mimetype === 'application/pdf') {
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
  if (req.method !== 'POST') return fail(res, { status: 405, message: 'Method not allowed' })

  let uploadedTempPath = ''

  try {
    const user = await requireAuth(req)
    const rateLimitKey = `upload:${user.id}:${getClientIp(req)}`
    checkRateLimit(rateLimitKey, { limit: 10, windowMs: 60 * 60 * 1000 })

    const form = formidable({
      allowEmptyFiles: false,
      maxFileSize: MAX_FILE_SIZE,
      multiples: false,
    })

    const [, files] = await form.parse(req)
    const file = files.file?.[0]

    if (!file) {
      return fail(res, { status: 400, message: 'No file uploaded' })
    }

    uploadedTempPath = file.filepath

    if (!UPLOAD_ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return fail(res, { status: 400, message: 'Only PDF and DOCX files are allowed' })
    }

    if (!file.size || file.size > MAX_FILE_SIZE) {
      return fail(res, { status: 400, message: 'File is too large. Maximum size is 50MB.' })
    }

    const supabase = getAdminSupabase()
    const profile = await ensureProfile(supabase, user)

    const uploadLimit = profile?.plan === 'pro' ? Number.MAX_SAFE_INTEGER : 3
    if ((profile?.uploads_this_month || 0) >= uploadLimit) {
      return fail(res, {
        status: 403,
        message: `Upload limit reached. You have used ${profile.uploads_this_month}/${uploadLimit} uploads this month. Upgrade to Pro for unlimited uploads.`,
      })
    }

    const fileBuffer = fs.readFileSync(file.filepath)
    const safeFileName = sanitizeFileName(file.originalFilename)
    const storagePath = `${user.id}/${Date.now()}-${safeFileName}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: file.mimetype,
        upsert: false,
      })

    if (uploadError) throw uploadError

    let metadata = getFallbackMetadata(file)

    if (AI_SUPPORTED_MIME_TYPES.has(file.mimetype)) {
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
          userMessage: 'AI document analysis is temporarily busy. Please try again in about a minute.',
        })

        const parsed = JSON.parse(extractJsonFromText(result.text))
        metadata = {
          ...metadata,
          title: parsed.title || metadata.title,
          subject: parsed.subject || metadata.subject,
          totalPages: Number(parsed.totalPages) || metadata.totalPages,
          topics: Array.isArray(parsed.topics) ? parsed.topics : metadata.topics,
          summary: parsed.summary || metadata.summary,
        }
      } catch (error) {
        console.error('[Upload metadata extraction failed]', error)
      }
    }

    const { data: document, error: documentError } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        title: metadata.title || getFallbackMetadata(file).title,
        subject: metadata.subject || 'General',
        storage_path: storagePath,
        total_pages: metadata.totalPages || 0,
        summary: metadata.summary || '',
        topics: metadata.topics || [],
        file_size: file.size,
        mime_type: file.mimetype,
      })
      .select()
      .single()

    if (documentError) throw documentError

    await supabase
      .from('profiles')
      .update({ uploads_this_month: (profile?.uploads_this_month || 0) + 1 })
      .eq('id', user.id)

    return ok(res, {
      document,
      topics: metadata.topics || [],
      summary: metadata.summary || '',
      analysisAvailable: AI_SUPPORTED_MIME_TYPES.has(file.mimetype),
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
