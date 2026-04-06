import { normalizeExtractedText } from './_documentText.js'

const MAX_TOPICS = 8

function cleanCandidate(value = '') {
  return `${value || ''}`
    .replace(/^[\s\d).:_-]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[;:,.-]+$/, '')
}

function hasLetters(value) {
  return /\p{L}/u.test(value)
}

function isLikelyTopic(value) {
  if (!value || value.length < 5 || value.length > 90) return false
  if (!hasLetters(value)) return false
  if (/^https?:\/\//i.test(value)) return false
  if (/^(page|figure|table)\b/i.test(value)) return false

  const words = value.split(/\s+/).filter(Boolean)
  if (!words.length || words.length > 12) return false

  const digits = (value.match(/\d/g) || []).length
  if (digits / value.length > 0.35) return false

  return true
}

function createTopic(title, index) {
  return {
    title,
    estimatedMinutes: 25 + Math.min(index, 4) * 10,
    subtopics: [],
  }
}

export function buildRoadmapTopicsFromText(documentText = '') {
  const normalized = normalizeExtractedText(documentText)
  if (!normalized) return []

  const topics = []
  const seen = new Set()

  const addTopic = (rawTitle) => {
    const title = cleanCandidate(rawTitle)
    const key = title.toLowerCase()

    if (!isLikelyTopic(title) || seen.has(key)) {
      return false
    }

    seen.add(key)
    topics.push(createTopic(title, topics.length))
    return topics.length >= MAX_TOPICS
  }

  for (const line of normalized.split('\n')) {
    if (addTopic(line)) {
      return topics
    }
  }

  for (const paragraph of normalized.split(/\n{2,}/)) {
    const firstSentence = cleanCandidate(paragraph.split(/(?<=[.!?])\s+/)[0] || '')
    const shortenedSentence = cleanCandidate(firstSentence.split(/\s+/).slice(0, 8).join(' '))

    if (addTopic(shortenedSentence)) {
      return topics
    }
  }

  return topics
}
