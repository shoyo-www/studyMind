function cleanValue(value = '') {
  return `${value || ''}`.replace(/\s+/g, ' ').trim()
}

export function buildMockTestTitle(documentTitle = '', options = {}) {
  const safeDocumentTitle = cleanValue(documentTitle) || 'Untitled document'
  const focusTopic = cleanValue(options?.focusTopic || '')
  const stageDayNumber = Number(options?.stageDayNumber)

  if (focusTopic && Number.isFinite(stageDayNumber) && stageDayNumber > 0) {
    return `${safeDocumentTitle} — Day ${stageDayNumber}: ${focusTopic} Mock Test`
  }

  if (focusTopic) {
    return `${safeDocumentTitle} — ${focusTopic} Mock Test`
  }

  return `${safeDocumentTitle} — Mock Test`
}

export function parseMockTestTitle(title = '') {
  const safeTitle = cleanValue(title)
  const stageMatch = safeTitle.match(/ — Day (\d+): (.+) Mock Test$/)

  if (stageMatch) {
    return {
      stageDayNumber: Number(stageMatch[1]) || null,
      focusTopic: cleanValue(stageMatch[2]),
    }
  }

  const focusMatch = safeTitle.match(/ — (.+) Mock Test$/)
  if (focusMatch && focusMatch[1]?.toLowerCase() !== 'mock') {
    return {
      stageDayNumber: null,
      focusTopic: cleanValue(focusMatch[1]),
    }
  }

  return {
    stageDayNumber: null,
    focusTopic: '',
  }
}
