import test from 'node:test'
import assert from 'node:assert/strict'

import {
  extractPdfText,
  isMissingDocumentTextColumnError,
  isSupabaseNoRowsError,
  normalizeExtractedText,
} from '../api/_documentText.js'

test('normalizeExtractedText removes null bytes, extra blank lines, and trims the result', () => {
  const input = '  Line 1\u0000\r\n\n\nLine 2   \n\n\n\nLine 3  '
  assert.equal(normalizeExtractedText(input), 'Line 1\n\nLine 2\n\nLine 3')
})

test('extractPdfText returns an empty result instead of throwing for invalid input', async () => {
  const result = await extractPdfText(Buffer.from('not a real pdf'))
  assert.deepEqual(result, { text: '', totalPages: 0 })
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
