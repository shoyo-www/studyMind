export const MAX_UPLOAD_FILE_SIZE = 50 * 1024 * 1024

const KIND_TO_MIME_TYPE = {
  pdf: 'application/pdf',
}

const MIME_TYPE_TO_KIND = new Map(
  Object.entries(KIND_TO_MIME_TYPE).map(([kind, mimeType]) => [mimeType, kind]),
)

const EXTENSION_TO_KIND = new Map([
  ['pdf', 'pdf'],
])

function getFileName(file = {}) {
  return `${file.name || file.originalFilename || ''}`.trim()
}

function getMimeType(file = {}) {
  return `${file.type || file.mimetype || ''}`.trim().toLowerCase()
}

function getFileExtension(file = {}) {
  const fileName = getFileName(file)
  const match = fileName.match(/\.([a-z0-9]+)$/i)
  return match?.[1]?.toLowerCase() || ''
}

export function getUploadFileKind(file = {}) {
  const mimeType = getMimeType(file)
  if (MIME_TYPE_TO_KIND.has(mimeType)) {
    return MIME_TYPE_TO_KIND.get(mimeType)
  }

  const extension = getFileExtension(file)
  return EXTENSION_TO_KIND.get(extension) || null
}

export function getUploadContentType(file = {}) {
  const kind = getUploadFileKind(file)
  return kind ? KIND_TO_MIME_TYPE[kind] : ''
}

export function validateUploadFile(file) {
  if (!file) {
    return 'no_file'
  }

  if (!getUploadFileKind(file)) {
    return 'invalid_type'
  }

  const size = Number(file.size || 0)
  if (!size) {
    return 'empty_file'
  }

  if (size > MAX_UPLOAD_FILE_SIZE) {
    return 'file_too_large'
  }

  return ''
}

export function getFirstUploadedFile(files) {
  const candidate = files?.file

  if (Array.isArray(candidate)) {
    return candidate[0] || null
  }

  return candidate || null
}
