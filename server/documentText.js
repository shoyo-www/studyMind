// api/_documentText.js
// PDF text extraction using a version-tolerant pdf-parse loader.

const MAX_DOCUMENT_TEXT_LENGTH = 250_000
let pdfTextExtractorPromise = null

async function loadPdfTextExtractor() {
  if (!pdfTextExtractorPromise) {
    pdfTextExtractorPromise = import('pdf-parse').then((module) => {
      if (typeof module?.PDFParse === 'function') {
        return async (fileBuffer) => {
          const parser = new module.PDFParse({ data: fileBuffer })

          try {
            const result = await parser.getText()
            return {
              text: result?.text || '',
              numpages: Number(result?.total || 0),
            }
          } finally {
            await parser.destroy().catch(() => {})
          }
        }
      }

      if (typeof module?.default === 'function') {
        return module.default
      }

      throw new Error('Unsupported pdf-parse export shape')
    })
  }

  return pdfTextExtractorPromise
}

export function normalizeExtractedText(text = '') {
  return `${text || ''}`
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_DOCUMENT_TEXT_LENGTH)
}

export function sliceDocumentTextForAi(text = '', maxChars = 60_000) {
  const normalized = normalizeExtractedText(text)
  const safeMaxChars = Math.max(1_000, Math.floor(Number(maxChars) || 60_000))

  if (normalized.length <= safeMaxChars) {
    return normalized
  }

  const separator = '\n...\n'
  const sliceLength = Math.max(200, Math.floor((safeMaxChars - (separator.length * 2)) / 3))
  const middleStart = Math.max(0, Math.floor((normalized.length / 2) - (sliceLength / 2)))

  return [
    normalized.slice(0, sliceLength),
    normalized.slice(middleStart, middleStart + sliceLength),
    normalized.slice(-sliceLength),
  ].join(separator)
}

export function buildRelevantExcerpt(text = '', options = {}) {
  const {
    query = '',
    maxChars = 60_000,
    maxParagraphs = 8,
  } = options

  const normalized = normalizeExtractedText(text)
  if (!normalized) return ''

  const normalizedQuery = `${query || ''}`.trim().toLowerCase()
  if (!normalizedQuery) {
    return sliceDocumentTextForAi(normalized, maxChars)
  }

  const keywords = normalizedQuery
    .split(/[^a-z0-9\u00c0-\u024f\u0900-\u097f]+/i)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3)

  if (!keywords.length) {
    return sliceDocumentTextForAi(normalized, maxChars)
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph, index) => ({ paragraph: paragraph.trim(), index }))
    .filter((entry) => entry.paragraph)

  const ranked = paragraphs
    .map((entry) => {
      const lower = entry.paragraph.toLowerCase()
      const score = keywords.reduce((sum, keyword) => sum + (lower.includes(keyword) ? 1 : 0), 0)
      return { ...entry, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(1, maxParagraphs))
    .sort((a, b) => a.index - b.index)

  if (!ranked.length) {
    return sliceDocumentTextForAi(normalized, maxChars)
  }

  return sliceDocumentTextForAi(ranked.map((entry) => entry.paragraph).join('\n\n'), maxChars)
}

export async function extractPdfText(fileBuffer) {
  try {
    const pdfTextExtractor = await loadPdfTextExtractor()
    const result = await pdfTextExtractor(fileBuffer)
    return {
      text:       normalizeExtractedText(result?.text || ''),
      totalPages: Number(result?.numpages || result?.total || 0),
    }
  } catch (err) {
    console.error('[extractPdfText] pdf-parse failed:', err?.message)
    return { text: '', totalPages: 0 }
  }
}

export function isMissingDocumentTextColumnError(error) {
  const details = [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean).join(' ').toLowerCase()
  return (
    details.includes('document_text')
    && (details.includes('column') || details.includes('schema cache') || details.includes('pgrst204') || details.includes('42703'))
  )
}

export function isSupabaseNoRowsError(error) {
  const details = [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean).join(' ').toLowerCase()
  return (
    error?.code === 'PGRST116'
    || details.includes('0 rows')
    || details.includes('no rows')
    || details.includes('json object requested, multiple (or no) rows returned')
  )
}
