import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildRelevantExcerpt,
  extractPdfText,
  isMissingDocumentTextColumnError,
  isSupabaseNoRowsError,
  normalizeExtractedText,
  sliceDocumentTextForAi,
} from '../server/documentText.js'

test('normalizeExtractedText removes null bytes, extra blank lines, and trims the result', () => {
  const input = '  Line 1\u0000\r\n\n\nLine 2   \n\n\n\nLine 3  '
  assert.equal(normalizeExtractedText(input), 'Line 1\n\nLine 2\n\nLine 3')
})

test('extractPdfText returns an empty result instead of throwing for invalid input', async () => {
  const result = await extractPdfText(Buffer.from('not a real pdf'))
  assert.deepEqual(result, { text: '', totalPages: 0 })
})

test('sliceDocumentTextForAi samples long text instead of sending everything', () => {
  const text = `Start ${'a'.repeat(40_000)} Middle ${'b'.repeat(40_000)} End ${'c'.repeat(40_000)}`
  const excerpt = sliceDocumentTextForAi(text, 9_000)

  assert.ok(excerpt.length <= 9_010)
  assert.match(excerpt, /Start/)
  assert.match(excerpt, /b{50,}/)
  assert.match(excerpt, /c{50,}/)
})

test('buildRelevantExcerpt prefers paragraphs that match the query', () => {
  const text = [
    'Cell biology covers membranes and transport.',
    '',
    'Photosynthesis uses chlorophyll and light reactions to build glucose.',
    '',
    'Genetics explains inheritance through DNA and genes.',
  ].join('\n')

  const excerpt = buildRelevantExcerpt(text, { query: 'photosynthesis chlorophyll', maxChars: 500 })

  assert.match(excerpt, /Photosynthesis uses chlorophyll/)
  assert.doesNotMatch(excerpt, /Genetics explains inheritance/)
})

test('isMissingDocumentTextColumnError recognizes common Supabase column errors', () => {
  assert.equal(isMissingDocumentTextColumnError({ code: '42703', message: 'column documents.document_text does not exist' }), true)
  assert.equal(isMissingDocumentTextColumnError({ code: 'PGRST204', details: 'Could not find the document_text column in the schema cache' }), true)
  assert.equal(isMissingDocumentTextColumnError({ code: '23505', message: 'duplicate key value violates unique constraint' }), false)
})

test('isSupabaseNoRowsError recognizes maybeSingle no-row responses', () => {
  assert.equal(isSupabaseNoRowsError({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }), true)
  assert.equal(isSupabaseNoRowsError({ message: '0 rows returned' }), true)
  assert.equal(isSupabaseNoRowsError({ message: 'permission denied' }), false)
})
