export function clampPercentage(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
}

export function normalizeDocument(document) {
  return {
    ...document,
    title: document?.title || 'Untitled document',
    subject: document?.subject || 'General',
    summary: document?.summary || '',
    topics: Array.isArray(document?.topics) ? document.topics : [],
    total_pages: Number(document?.total_pages) || 0,
    pct_covered: clampPercentage(document?.pct_covered),
  }
}

export function normalizeDocuments(documents = []) {
  return documents.map(normalizeDocument)
}

export function getTopicCount(document) {
  return Array.isArray(document?.topics) ? document.topics.length : 0
}

export function getCoveredTopicCount(document) {
  return Math.round(getTopicCount(document) * (clampPercentage(document?.pct_covered) / 100))
}

export function buildRoadmapTopics(document) {
  const topics = Array.isArray(document?.topics) ? document.topics : []
  const completedCount = Math.floor((clampPercentage(document?.pct_covered) / 100) * topics.length)

  return topics.map((topic, index) => {
    const status = index < completedCount
      ? 'done'
      : index === completedCount && completedCount < topics.length
        ? 'current'
        : 'pending'

    return {
      id: `${document?.id || 'doc'}-${index}`,
      title: topic?.title || `Topic ${index + 1}`,
      mins: Number(topic?.estimatedMinutes) || 30,
      score: null,
      status,
      chips: Array.isArray(topic?.subtopics) ? topic.subtopics.slice(0, 3) : [],
    }
  })
}

export function formatRelativeDate(dateString, lang = 'en') {
  if (!dateString) return lang === 'hi' ? 'अभी' : 'just now'

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return lang === 'hi' ? 'अभी' : 'just now'

  const diffMs = date.getTime() - Date.now()
  const absMs = Math.abs(diffMs)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  const week = 7 * day

  let value
  let unit

  if (absMs < hour) {
    value = Math.round(diffMs / minute)
    unit = 'minute'
  } else if (absMs < day) {
    value = Math.round(diffMs / hour)
    unit = 'hour'
  } else if (absMs < week) {
    value = Math.round(diffMs / day)
    unit = 'day'
  } else {
    value = Math.round(diffMs / week)
    unit = 'week'
  }

  const formatter = new Intl.RelativeTimeFormat(lang === 'hi' ? 'hi-IN' : 'en', { numeric: 'auto' })
  return formatter.format(value, unit)
}

export function getDisplayName(profile, user) {
  const source = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'Student'
  return source.trim().split(/\s+/)[0]
}

export function getPlanLabel(plan, lang = 'en') {
  if (plan === 'pro') return lang === 'hi' ? 'Pro प्लान' : 'Pro plan'
  if (plan === 'institute') return lang === 'hi' ? 'संस्थान प्लान' : 'Institute plan'
  return lang === 'hi' ? 'मुफ्त प्लान' : 'Free plan'
}
