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
