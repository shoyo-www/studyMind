import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_UPLOAD_FILE_SIZE,
  getFirstUploadedFile,
  getUploadContentType,
  getUploadFileKind,
  validateUploadFile,
} from '../shared/uploadValidation.js'

test('getUploadFileKind accepts supported MIME types', () => {
  assert.equal(getUploadFileKind({ type: 'application/pdf', name: 'notes.bin' }), 'pdf')
  assert.equal(
    getUploadFileKind({ type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', name: 'notes.bin' }),
    'docx',
  )
})

test('getUploadFileKind falls back to filename extension when MIME type is blank', () => {
  assert.equal(getUploadFileKind({ type: '', name: 'Biology Notes.PDF' }), 'pdf')
  assert.equal(getUploadFileKind({ mimetype: '', originalFilename: 'chapter-1.docx' }), 'docx')
})

test('getUploadFileKind rejects unsupported file types', () => {
  assert.equal(getUploadFileKind({ type: 'application/octet-stream', name: 'slides.pptx' }), null)
  assert.equal(getUploadFileKind({ type: 'image/png', name: 'scan.png' }), null)
})

test('getUploadContentType normalizes the MIME type for supported uploads', () => {
  assert.equal(getUploadContentType({ type: '', name: 'physics.pdf' }), 'application/pdf')
  assert.equal(
    getUploadContentType({ mimetype: '', originalFilename: 'worksheet.docx' }),
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )
})

test('validateUploadFile handles common upload edge cases', () => {
  assert.equal(validateUploadFile(null), 'no_file')
  assert.equal(validateUploadFile({ type: '', name: 'notes.txt', size: 32 }), 'invalid_type')
  assert.equal(validateUploadFile({ type: 'application/pdf', name: 'notes.pdf', size: 0 }), 'empty_file')
  assert.equal(
    validateUploadFile({ type: 'application/pdf', name: 'notes.pdf', size: MAX_UPLOAD_FILE_SIZE + 1 }),
    'file_too_large',
  )
  assert.equal(validateUploadFile({ type: '', name: 'notes.pdf', size: 1024 }), '')
})

test('getFirstUploadedFile supports both formidable array and object shapes', () => {
  const file = { originalFilename: 'notes.pdf' }
  assert.equal(getFirstUploadedFile({ file: [file] }), file)
  assert.equal(getFirstUploadedFile({ file }), file)
  assert.equal(getFirstUploadedFile({ file: [] }), null)
  assert.equal(getFirstUploadedFile({}), null)
})
