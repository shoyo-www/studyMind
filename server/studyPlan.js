import {
  extractJsonFromText,
  getGeminiClient,
  getGeminiModelName,
  runGeminiTask,
  shouldSkipGeminiDueToRecentQuota,
} from './gemini.js'
import { normalizeExtractedText } from './documentText.js'

const MIN_PLAN_DAYS = 7
const MAX_PLAN_DAYS = 30
const QUICK_QUIZ_COUNT = 5
const MINI_TEST_COUNT = 3
const MAX_AI_TEXT_LENGTH = 80_000
const STOP_WORDS = new Set([
  'about', 'after', 'again', 'against', 'also', 'among', 'an', 'and', 'any', 'are', 'because', 'before',
  'between', 'both', 'but', 'can', 'chapter', 'concept', 'could', 'day', 'does', 'during', 'each', 'exam',
  'first', 'from', 'general', 'have', 'important', 'into', 'its', 'more', 'most', 'notes', 'not', 'only',
  'other', 'out', 'over', 'part', 'should', 'some', 'study', 'than', 'that', 'the', 'their', 'them', 'there',
  'these', 'they', 'this', 'those', 'through', 'topic', 'topics', 'under', 'very', 'what', 'when', 'which',
  'while', 'with', 'your',
])

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function slugify(value = '') {
  return `${value || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function cleanText(value = '') {
  return `${value || ''}`.replace(/\s+/g, ' ').trim()
}

function titleCase(value = '') {
  return cleanText(value)
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ')
}

function tokenize(value = '') {
  return cleanText(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word))
}

function uniqueStrings(values = []) {
  const seen = new Set()
  return values.filter((value) => {
    const key = cleanText(value).toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sanitizeTopic(rawTopic = {}, index = 0) {
  const title = cleanText(rawTopic?.title) || `Topic ${index + 1}`
  const subtopics = uniqueStrings(
    Array.isArray(rawTopic?.subtopics)
      ? rawTopic.subtopics.map((subtopic) => cleanText(subtopic))
      : [],
  ).slice(0, 5)
  const estimatedMinutes = clamp(Number(rawTopic?.estimatedMinutes) || 25 + (index * 5), 15, 90)

  return {
    id: rawTopic?.id || `${slugify(title) || `topic-${index + 1}`}-${index + 1}`,
    title,
    subtopics,
    estimatedMinutes,
  }
}

function getTopicDifficulty(topic, index, totalTopics) {
  const positionRatio = totalTopics > 1 ? index / (totalTopics - 1) : 0
  const complexityScore = topic.estimatedMinutes + (topic.subtopics.length * 4) + Math.round(positionRatio * 20)

  if (complexityScore >= 60 || positionRatio > 0.68) return 'hard'
  if (complexityScore >= 40 || positionRatio > 0.32) return 'medium'
  return 'easy'
}

function extractRepeatedConcepts(documentText = '', topics = []) {
  const normalizedText = normalizeExtractedText(documentText).toLowerCase()
  const candidates = new Map()

  topics.forEach((topic) => {
    tokenize(topic.title).forEach((token) => {
      candidates.set(token, candidates.get(token) || 0)
    })
    topic.subtopics.forEach((subtopic) => {
      tokenize(subtopic).forEach((token) => {
        candidates.set(token, candidates.get(token) || 0)
      })
    })
  })

  const repeatedConcepts = [...candidates.keys()]
    .map((token) => {
      const matches = normalizedText.match(new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'))
      return {
        term: titleCase(token),
        count: matches?.length || 0,
      }
    })
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, 8)

  return repeatedConcepts
}

function getTopicImportance(topic, repeatedConcepts = []) {
  const searchText = `${topic.title} ${topic.subtopics.join(' ')}`.toLowerCase()
  const matchedConcepts = repeatedConcepts.filter((concept) => searchText.includes(concept.term.toLowerCase()))

  if (matchedConcepts.length >= 2 || repeatedConcepts.slice(0, 3).some((concept) => searchText.includes(concept.term.toLowerCase()))) {
    return 'high'
  }
  if (matchedConcepts.length >= 1 || topic.subtopics.length >= 3) {
    return 'medium'
  }
  return 'low'
}

function difficultyWeight(difficulty = 'medium') {
  if (difficulty === 'easy') return 0
  if (difficulty === 'hard') return 2
  return 1
}

function buildPlanDaysFromTopics(topics = []) {
  if (!topics.length) {
    return []
  }

  const topicsPerDay = topics.length <= 10 ? 1 : topics.length <= 20 ? 2 : 3
  const contentDays = []
  let index = 0

  while (index < topics.length) {
    contentDays.push(topics.slice(index, index + topicsPerDay))
    index += topicsPerDay
  }

  const reviewDays = Math.min(6, Math.floor(contentDays.length / 3))
  const totalDays = clamp(contentDays.length + reviewDays, MIN_PLAN_DAYS, MAX_PLAN_DAYS)
  const days = []
  let reviewInserted = 0

  contentDays.forEach((dayTopics, dayIndex) => {
    const difficulty = dayTopics.reduce((hardest, topic) => (
      difficultyWeight(topic.difficulty) > difficultyWeight(hardest) ? topic.difficulty : hardest
    ), 'easy')
    const conceptCount = dayTopics.reduce((sum, topic) => sum + topic.subtopics.length, 0)

    days.push({
      dayNumber: days.length + 1,
      type: 'learn',
      difficulty,
      minutes: 20,
      topics: dayTopics.map((topic) => topic.title),
      summary: dayTopics.length === 1
        ? `Build confidence on ${dayTopics[0].title} with a quick learn-practice cycle.`
        : `Connect ${dayTopics.map((topic) => topic.title).join(', ')} in one focused sitting.`,
      focusReason: difficulty === 'easy'
        ? 'Starting with the most accessible concepts first.'
        : difficulty === 'medium'
          ? 'This day links fundamentals with exam-style understanding.'
          : 'This is a stretch day, so keep the pace calm and focused.',
      keyConcepts: uniqueStrings(dayTopics.flatMap((topic) => topic.subtopics)).slice(0, 4),
      objective: conceptCount
        ? `Understand the core idea and ${Math.min(3, conceptCount)} supporting concepts.`
        : 'Understand the core idea and test it immediately.',
    })

    const shouldInsertReview = reviewInserted < reviewDays && (dayIndex + 1) % 3 === 0
    if (shouldInsertReview) {
      const reviewTopics = uniqueStrings(
        contentDays
          .slice(Math.max(0, dayIndex - 2), dayIndex + 1)
          .flat()
          .sort((a, b) => difficultyWeight(b.difficulty) - difficultyWeight(a.difficulty))
          .map((topic) => topic.title),
      ).slice(0, 3)

      days.push({
        dayNumber: days.length + 1,
        type: 'review',
        difficulty: 'medium',
        minutes: 20,
        topics: reviewTopics,
        summary: `Revision sprint on ${reviewTopics.join(', ')} so the early learning sticks.`,
        focusReason: 'Built-in review day to stop forgetting before it starts.',
        keyConcepts: [],
        objective: 'Reinforce weak spots with retrieval and short checks.',
      })
      reviewInserted += 1
    }
  })

  while (days.length < totalDays) {
    const previousTopics = uniqueStrings(days.flatMap((day) => day.topics)).slice(-3)
    days.push({
      dayNumber: days.length + 1,
      type: 'review',
      difficulty: 'medium',
      minutes: 20,
      topics: previousTopics.length ? previousTopics : [topics[topics.length - 1]?.title || 'Revision'],
      summary: 'Short consolidation day to tighten understanding before the next push.',
      focusReason: 'Spacing the revision helps move ideas into long-term memory.',
      keyConcepts: [],
      objective: 'Review, self-test, and close gaps.',
    })
  }

  return days.slice(0, MAX_PLAN_DAYS).map((day, dayIndex) => ({ ...day, dayNumber: dayIndex + 1 }))
}

function getTopicExcerpt(documentText = '', topic = '') {
  const normalized = normalizeExtractedText(documentText)
  if (!normalized || !topic) return ''

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => cleanText(paragraph))
    .filter(Boolean)

  const keywords = tokenize(topic)

  const bestParagraph = paragraphs
    .map((paragraph) => ({
      paragraph,
      score: keywords.reduce((sum, keyword) => sum + (paragraph.toLowerCase().includes(keyword) ? 1 : 0), 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.paragraph.length - b.paragraph.length)[0]

  return bestParagraph?.paragraph?.slice(0, 260) || ''
}

function buildFallbackMissionQuestions(topics = [], documentText = '', count = QUICK_QUIZ_COUNT, level = 'quick') {
  const topicLabels = uniqueStrings(topics.map((topic) => topic.title))
  const fallbackTopics = topicLabels.length ? topicLabels : ['General concept']

  return Array.from({ length: count }, (_, index) => {
    const topic = topics[index % topics.length] || topics[0] || { title: fallbackTopics[0], subtopics: [] }
    const otherTopic = topics[(index + 1) % topics.length] || topic
    const excerpt = getTopicExcerpt(documentText, topic.title)
    const keyPoint = excerpt
      ? excerpt.split(/(?<=[.!?])\s+/)[0]?.slice(0, 120)
      : `${topic.title} is one of the focus areas for this mission.`

    const options = uniqueStrings([
      cleanText(keyPoint),
      `${otherTopic.title} is the only concept that matters here.`,
      `${topic.title} should be memorized without understanding its use.`,
      `This mission skips ${topic.title} and focuses on unrelated revision.`,
    ]).slice(0, 4)

    while (options.length < 4) {
      options.push(`Study statement ${options.length + 1}`)
    }

    return {
      id: `${level}-${slugify(topic.title) || 'topic'}-${index + 1}`,
      topic: topic.title,
      type: level === 'quick' && index % 2 === 0 ? 'conceptual' : 'application',
      difficulty: level === 'quick' ? 'medium' : 'hard',
      question: level === 'quick'
        ? `Which statement best matches your notes on ${topic.title}?`
        : `Which option shows the strongest understanding of ${topic.title}?`,
      options,
      correct: 0,
      explanation: `Use the mission notes for ${topic.title} and look for the idea that is specific and accurate, not vague.`,
    }
  })
}

function buildFallbackConceptLearning(topics = [], documentText = '') {
  return topics.map((topic) => {
    const excerpt = getTopicExcerpt(documentText, topic.title)
    const subtopicHint = topic.subtopics.length
      ? `Focus on ${topic.subtopics.slice(0, 3).join(', ')}.`
      : 'Focus on the main definition, why it matters, and one example.'

    return {
      topic: topic.title,
      simpleExplanation: excerpt
        ? `${excerpt} ${subtopicHint}`.trim()
        : `${topic.title} is one of the key ideas in this document. ${subtopicHint}`,
      memoryHook: topic.subtopics[0]
        ? `Anchor it to: ${topic.subtopics[0]}.`
        : `Anchor it to the core idea of ${topic.title}.`,
      nextAction: `Read the explanation for ${topic.title}, then answer the quick quiz without scrolling back up.`,
    }
  })
}

function normalizeMissionQuestion(rawQuestion = {}, index = 0, fallbackTopic = 'General', fallbackDifficulty = 'medium') {
  const options = Array.isArray(rawQuestion?.options)
    ? rawQuestion.options.map((option) => cleanText(option)).filter(Boolean).slice(0, 4)
    : []

  while (options.length < 4) {
    options.push(`Option ${options.length + 1}`)
  }

  const correct = Number(rawQuestion?.correct)

  return {
    id: rawQuestion?.id || `question-${index + 1}`,
    topic: cleanText(rawQuestion?.topic) || fallbackTopic,
    type: cleanText(rawQuestion?.type) || 'conceptual',
    difficulty: cleanText(rawQuestion?.difficulty) || fallbackDifficulty,
    question: cleanText(rawQuestion?.question) || `Question ${index + 1}`,
    options,
    correct: Number.isInteger(correct) && correct >= 0 && correct < options.length ? correct : 0,
    explanation: cleanText(rawQuestion?.explanation) || 'Review the concept note and retry this idea once more.',
  }
}

function normalizeMission(rawMission = {}, fallbackTopics = [], documentText = '', nextDay = null) {
  const focusTopics = uniqueStrings(
    Array.isArray(rawMission?.focusTopics)
      ? rawMission.focusTopics.map((topic) => cleanText(topic))
      : fallbackTopics.map((topic) => topic.title),
  ).slice(0, 3)

  const conceptLearning = Array.isArray(rawMission?.conceptLearning) && rawMission.conceptLearning.length
    ? rawMission.conceptLearning.map((item, index) => ({
        topic: cleanText(item?.topic) || focusTopics[index] || fallbackTopics[index]?.title || `Topic ${index + 1}`,
        simpleExplanation: cleanText(item?.simpleExplanation) || `Learn the key idea behind ${focusTopics[index] || fallbackTopics[index]?.title || `Topic ${index + 1}`}.`,
        memoryHook: cleanText(item?.memoryHook) || 'Create one tiny memory cue before moving on.',
        nextAction: cleanText(item?.nextAction) || 'Read once, say it aloud, then test yourself.',
      }))
    : buildFallbackConceptLearning(fallbackTopics, documentText)

  const quickQuiz = Array.isArray(rawMission?.quickQuiz) && rawMission.quickQuiz.length
    ? rawMission.quickQuiz.slice(0, QUICK_QUIZ_COUNT).map((question, index) => (
        normalizeMissionQuestion(question, index, focusTopics[index % Math.max(focusTopics.length, 1)] || 'General', 'medium')
      ))
    : buildFallbackMissionQuestions(fallbackTopics, documentText, QUICK_QUIZ_COUNT, 'quick')

  const miniTest = Array.isArray(rawMission?.miniTest) && rawMission.miniTest.length
    ? rawMission.miniTest.slice(0, 5).map((question, index) => (
        normalizeMissionQuestion(question, index, focusTopics[index % Math.max(focusTopics.length, 1)] || 'General', 'hard')
      ))
    : buildFallbackMissionQuestions(fallbackTopics, documentText, MINI_TEST_COUNT, 'mini')

  return {
    missionTitle: cleanText(rawMission?.missionTitle) || `20-minute mission: ${focusTopics.join(', ') || 'Focused revision'}`,
    missionSummary: cleanText(rawMission?.missionSummary) || 'Learn the idea, answer the fast checks, then finish with a tougher mini test.',
    focusTopics,
    conceptLearning,
    quickQuiz,
    miniTest,
    tomorrowPreview: cleanText(rawMission?.tomorrowPreview) || (
      nextDay?.topics?.length
        ? `Tomorrow you will move into ${nextDay.topics.join(', ')}.`
        : 'Tomorrow will build on today with one more short, focused mission.'
    ),
    exactNextStep: cleanText(rawMission?.exactNextStep) || 'Start with the concept cards above, then do the quick quiz in one sitting.',
  }
}

function scoreAnswers(questions = [], answers = []) {
  const safeAnswers = Array.isArray(answers) ? answers : []
  const total = questions.length
  const correct = questions.reduce((sum, question, index) => (
    safeAnswers[index] === question.correct ? sum + 1 : sum
  ), 0)
  const pct = total ? Math.round((correct / total) * 100) : 0

  return {
    correct,
    total,
    pct,
  }
}

function getMasteryStatus(score = 0) {
  if (score < 60) return 'WEAK'
  if (score <= 80) return 'IMPROVING'
  return 'STRONG'
}

function getTopicPerformance(questions = [], answers = []) {
  const topicMap = new Map()

  questions.forEach((question, index) => {
    const key = cleanText(question?.topic) || 'General'
    const current = topicMap.get(key) || { topic: key, total: 0, correct: 0 }
    current.total += 1
    if (answers[index] === question.correct) {
      current.correct += 1
    }
    topicMap.set(key, current)
  })

  return [...topicMap.values()]
    .map((entry) => ({
      ...entry,
      pct: entry.total ? Math.round((entry.correct / entry.total) * 100) : 0,
    }))
    .sort((a, b) => a.pct - b.pct || a.topic.localeCompare(b.topic))
}

export function buildFallbackStudyPlan({ document, documentText = '' }) {
  const topics = (Array.isArray(document?.topics) ? document.topics : [])
    .map((topic, index) => sanitizeTopic(topic, index))
  const repeatedConcepts = extractRepeatedConcepts(documentText, topics)
  const enrichedTopics = topics.map((topic, index) => ({
    ...topic,
    difficulty: getTopicDifficulty(topic, index, topics.length),
    importance: getTopicImportance(topic, repeatedConcepts),
  }))

  const orderedTopics = [...enrichedTopics].sort((a, b) => {
    const difficultyDelta = difficultyWeight(a.difficulty) - difficultyWeight(b.difficulty)
    if (difficultyDelta !== 0) return difficultyDelta
    if (a.importance !== b.importance) {
      const importanceScore = { high: 0, medium: 1, low: 2 }
      return importanceScore[a.importance] - importanceScore[b.importance]
    }
    return a.title.localeCompare(b.title)
  })

  const days = buildPlanDaysFromTopics(orderedTopics)

  return {
    analysis: {
      documentTitle: document?.title || 'Untitled document',
      subject: document?.subject || 'General',
      totalTopics: orderedTopics.length,
      difficultyBreakdown: {
        easy: orderedTopics.filter((topic) => topic.difficulty === 'easy').length,
        medium: orderedTopics.filter((topic) => topic.difficulty === 'medium').length,
        hard: orderedTopics.filter((topic) => topic.difficulty === 'hard').length,
      },
      repeatedConcepts,
      topics: orderedTopics.map((topic) => ({
        title: topic.title,
        subtopics: topic.subtopics,
        difficulty: topic.difficulty,
        importance: topic.importance,
        estimatedMinutes: topic.estimatedMinutes,
      })),
    },
    roadmap: {
      totalDays: days.length,
      days,
    },
  }
}

export async function buildStudyPlan({ document, documentText = '' }) {
  const fallbackPlan = buildFallbackStudyPlan({ document, documentText })
  const geminiApiKey = process.env.STUDY_PLAN_GEMINI_API_KEY || process.env.GEMINI_API_KEY

  if (!geminiApiKey || shouldSkipGeminiDueToRecentQuota()) {
    return fallbackPlan
  }

  try {
    const ai = getGeminiClient(geminiApiKey)
    const trimmedText = normalizeExtractedText(documentText).slice(0, MAX_AI_TEXT_LENGTH)
    const topicPayload = fallbackPlan.analysis.topics.map((topic) => ({
      title: topic.title,
      subtopics: topic.subtopics,
      estimatedMinutes: topic.estimatedMinutes,
    }))

    const result = await runGeminiTask(() => ai.models.generateContent({
      model: getGeminiModelName(process.env.STUDY_PLAN_GEMINI_MODEL),
      contents: [{
        text: [
          'Create a personalized study plan from this study material.',
          'Return only valid JSON with keys: analysis and roadmap.',
          'analysis.topics must include title, subtopics, difficulty (easy|medium|hard), importance (high|medium|low).',
          'analysis.repeatedConcepts must be an array of { term, count }.',
          'roadmap.totalDays must be between 7 and 30.',
          'roadmap.days must be an array where each day has dayNumber, type, difficulty, minutes, topics, summary, focusReason, keyConcepts, objective.',
          'Each day must contain only 1 to 3 focused topics.',
          'Order the roadmap from easy to hard with revision days mixed in.',
          `Document title: ${document?.title || 'Untitled document'}`,
          `Subject: ${document?.subject || 'General'}`,
          `Existing extracted topics JSON: ${JSON.stringify(topicPayload)}`,
          `Document summary: ${document?.summary || ''}`,
          `Document text excerpt: ${trimmedText}`,
        ].join('\n'),
      }],
      config: {
        responseMimeType: 'application/json',
      },
    }), {
      label: 'Study plan generation',
      userMessage: 'Study-plan generation is temporarily busy right now. Please try again in about a minute.',
      quotaUserMessage: 'Study-plan generation is temporarily unavailable right now. Please try again a little later.',
    })

    const parsed = JSON.parse(extractJsonFromText(result.text))
    const analysisTopics = Array.isArray(parsed?.analysis?.topics) && parsed.analysis.topics.length
      ? parsed.analysis.topics.map((topic, index) => {
          const sanitized = sanitizeTopic(topic, index)
          return {
            ...sanitized,
            difficulty: ['easy', 'medium', 'hard'].includes(topic?.difficulty) ? topic.difficulty : fallbackPlan.analysis.topics[index]?.difficulty || 'medium',
            importance: ['high', 'medium', 'low'].includes(topic?.importance) ? topic.importance : fallbackPlan.analysis.topics[index]?.importance || 'medium',
          }
        })
      : fallbackPlan.analysis.topics

    const roadmapDays = Array.isArray(parsed?.roadmap?.days) && parsed.roadmap.days.length
      ? parsed.roadmap.days
          .map((day, index) => ({
            dayNumber: index + 1,
            type: cleanText(day?.type) || (index % 4 === 3 ? 'review' : 'learn'),
            difficulty: ['easy', 'medium', 'hard'].includes(day?.difficulty) ? day.difficulty : 'medium',
            minutes: clamp(Number(day?.minutes) || 20, 20, 25),
            topics: uniqueStrings(Array.isArray(day?.topics) ? day.topics.map((topic) => cleanText(topic)) : []).slice(0, 3),
            summary: cleanText(day?.summary) || fallbackPlan.roadmap.days[index]?.summary || 'Focused study day.',
            focusReason: cleanText(day?.focusReason) || fallbackPlan.roadmap.days[index]?.focusReason || 'This day keeps the plan moving without overload.',
            keyConcepts: uniqueStrings(Array.isArray(day?.keyConcepts) ? day.keyConcepts.map((value) => cleanText(value)) : []).slice(0, 4),
            objective: cleanText(day?.objective) || fallbackPlan.roadmap.days[index]?.objective || 'Learn the concept and test it immediately.',
          }))
          .filter((day) => day.topics.length >= 1 && day.topics.length <= 3)
          .slice(0, MAX_PLAN_DAYS)
      : fallbackPlan.roadmap.days

    return {
      analysis: {
        documentTitle: document?.title || fallbackPlan.analysis.documentTitle,
        subject: document?.subject || fallbackPlan.analysis.subject,
        totalTopics: analysisTopics.length,
        difficultyBreakdown: {
          easy: analysisTopics.filter((topic) => topic.difficulty === 'easy').length,
          medium: analysisTopics.filter((topic) => topic.difficulty === 'medium').length,
          hard: analysisTopics.filter((topic) => topic.difficulty === 'hard').length,
        },
        repeatedConcepts: Array.isArray(parsed?.analysis?.repeatedConcepts) && parsed.analysis.repeatedConcepts.length
          ? parsed.analysis.repeatedConcepts
              .map((concept) => ({
                term: titleCase(concept?.term || ''),
                count: Math.max(1, Number(concept?.count) || 1),
              }))
              .filter((concept) => concept.term)
              .slice(0, 8)
          : fallbackPlan.analysis.repeatedConcepts,
        topics: analysisTopics,
      },
      roadmap: {
        totalDays: clamp(Number(parsed?.roadmap?.totalDays) || roadmapDays.length, MIN_PLAN_DAYS, MAX_PLAN_DAYS),
        days: roadmapDays.length ? roadmapDays : fallbackPlan.roadmap.days,
      },
    }
  } catch (error) {
    console.warn('[Study plan] Falling back to local plan builder.', error?.message || error)
    return fallbackPlan
  }
}

export function getCurrentDayContext(plan = null, sessions = []) {
  const days = Array.isArray(plan?.roadmap?.days) ? plan.roadmap.days : []
  const completedSessions = sessions.filter((session) => session?.completed_at)
  const completedDayNumbers = new Set(completedSessions.map((session) => Number(session.day_number) || 0))
  const openSession = sessions.find((session) => !session?.completed_at)

  if (openSession) {
    const day = days.find((entry) => entry.dayNumber === Number(openSession.day_number)) || days[0] || null
    return {
      currentDayNumber: day?.dayNumber || 1,
      currentDay: day,
      nextDay: days.find((entry) => entry.dayNumber === (day?.dayNumber || 0) + 1) || null,
      openSession,
      completedSessions,
      completedDayNumbers,
    }
  }

  const currentDay = days.find((day) => !completedDayNumbers.has(day.dayNumber)) || days[days.length - 1] || null
  return {
    currentDayNumber: currentDay?.dayNumber || 1,
    currentDay,
    nextDay: days.find((entry) => entry.dayNumber === (currentDay?.dayNumber || 0) + 1) || null,
    openSession: null,
    completedSessions,
    completedDayNumbers,
  }
}

export function getCarryoverTopics(sessions = [], limit = 2) {
  const carryoverTopics = []
  const seen = new Set()

  ;[...sessions]
    .filter((session) => session?.completed_at)
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
    .forEach((session) => {
      const weakTopics = Array.isArray(session?.feedback?.weakTopics)
        ? session.feedback.weakTopics
        : []

      if ((session?.mastery_status || '').toUpperCase() === 'STRONG') {
        return
      }

      weakTopics.forEach((topic) => {
        const normalized = cleanText(topic)
        const key = normalized.toLowerCase()
        if (!normalized || seen.has(key) || carryoverTopics.length >= limit) return
        seen.add(key)
        carryoverTopics.push(normalized)
      })
    })

  return carryoverTopics
}

export async function buildMission({
  document,
  documentText = '',
  plan,
  currentDay,
  nextDay = null,
  carryoverTopics = [],
}) {
  const planTopics = Array.isArray(plan?.analysis?.topics) ? plan.analysis.topics : []
  const missionTopicLabels = uniqueStrings([...(carryoverTopics || []), ...(currentDay?.topics || [])]).slice(0, 3)
  const missionTopics = missionTopicLabels.map((topicLabel) => (
    planTopics.find((topic) => topic.title.toLowerCase() === topicLabel.toLowerCase()) || {
      title: topicLabel,
      subtopics: [],
      estimatedMinutes: 20,
    }
  ))

  const fallbackMission = normalizeMission({}, missionTopics, documentText, nextDay)
  const geminiApiKey = process.env.STUDY_PLAN_GEMINI_API_KEY || process.env.GEMINI_API_KEY

  if (!geminiApiKey || shouldSkipGeminiDueToRecentQuota()) {
    return fallbackMission
  }

  try {
    const ai = getGeminiClient(geminiApiKey)
    const topicExcerpts = missionTopics.map((topic) => ({
      topic: topic.title,
      excerpt: getTopicExcerpt(documentText, topic.title),
      subtopics: topic.subtopics,
    }))
    const result = await runGeminiTask(() => ai.models.generateContent({
      model: getGeminiModelName(process.env.STUDY_PLAN_GEMINI_MODEL),
      contents: [{
        text: [
          'Create one friendly 20-minute study mission for a student.',
          'Return only valid JSON with keys: missionTitle, missionSummary, focusTopics, conceptLearning, quickQuiz, miniTest, tomorrowPreview, exactNextStep.',
          `Use exactly ${QUICK_QUIZ_COUNT} quickQuiz questions and exactly ${MINI_TEST_COUNT} miniTest questions.`,
          'Every question must be multiple choice with exactly 4 options and a zero-based correct answer index.',
          'quickQuiz should mix conceptual and simple application checks.',
          'miniTest should be slightly harder than quickQuiz.',
          'Tone should feel supportive, short, and not academic.',
          `Document title: ${document?.title || 'Untitled document'}`,
          `Document subject: ${document?.subject || 'General'}`,
          `Current day: ${currentDay?.dayNumber || 1}`,
          `Day summary: ${currentDay?.summary || ''}`,
          `Focus topics JSON: ${JSON.stringify(topicExcerpts)}`,
          `Tomorrow preview topics: ${JSON.stringify(nextDay?.topics || [])}`,
        ].join('\n'),
      }],
      config: {
        responseMimeType: 'application/json',
      },
    }), {
      label: 'Study mission generation',
      userMessage: 'Daily mission generation is temporarily busy right now. Please try again in about a minute.',
      quotaUserMessage: 'Daily mission generation is temporarily unavailable right now. Please try again a little later.',
    })

    const parsed = JSON.parse(extractJsonFromText(result.text))
    return normalizeMission(parsed, missionTopics, documentText, nextDay)
  } catch (error) {
    console.warn('[Study mission] Falling back to local mission builder.', error?.message || error)
    return fallbackMission
  }
}

export function evaluateMission({
  mission,
  quickQuizAnswers = [],
  miniTestAnswers = [],
  nextDay = null,
}) {
  const quickQuizResult = scoreAnswers(mission?.quickQuiz || [], quickQuizAnswers)
  const miniTestResult = scoreAnswers(mission?.miniTest || [], miniTestAnswers)
  const overallScore = Math.round((quickQuizResult.pct * 0.45) + (miniTestResult.pct * 0.55))
  const masteryStatus = getMasteryStatus(overallScore)
  const topicPerformance = getTopicPerformance(
    [...(mission?.quickQuiz || []), ...(mission?.miniTest || [])],
    [...(Array.isArray(quickQuizAnswers) ? quickQuizAnswers : []), ...(Array.isArray(miniTestAnswers) ? miniTestAnswers : [])],
  )
  const weakTopics = topicPerformance.filter((topic) => topic.pct < 60).map((topic) => topic.topic)
  const strongTopics = topicPerformance.filter((topic) => topic.pct >= 80).map((topic) => topic.topic)

  const whatWentWell = masteryStatus === 'STRONG'
    ? `You stayed steady across the mission and showed strong recall on ${strongTopics[0] || mission?.focusTopics?.[0] || 'today’s concepts'}.`
    : masteryStatus === 'IMPROVING'
      ? `You are building momentum. The quick quiz went better than the harder checks, which means the base idea is landing.`
      : `You still showed effort by finishing the mission, which matters more than getting everything right on day one.`

  const needsImprovement = weakTopics.length
    ? `Spend one more short pass on ${weakTopics.join(', ')} before trying another harder set.`
    : `Keep tightening your explanations so the ideas come out faster under pressure.`

  const focusNext = weakTopics.length
    ? `Next, revisit ${weakTopics.join(', ')} with variation before adding brand-new load.`
    : nextDay?.topics?.length
      ? `Next, move into ${nextDay.topics.join(', ')} while today is still fresh.`
      : 'Next, keep the rhythm going with one more short mission tomorrow.'

  const tomorrowPreview = nextDay?.topics?.length
    ? `Tomorrow's Mission Preview: ${nextDay.topics.join(', ')} in another short 20-minute sprint.`
    : `Tomorrow's Mission Preview: one more short revision mission to lock in today’s work.`

  const exactNextStep = masteryStatus === 'WEAK'
    ? `Read the concept notes once more, then retry the flashiest weak topic first: ${weakTopics[0] || mission?.focusTopics?.[0] || 'today’s main topic'}.`
    : masteryStatus === 'IMPROVING'
      ? `Review the explanations for the questions you missed, then come back tomorrow ready for the next mission.`
      : `Close this session by saying the key idea out loud once, then come back tomorrow for the next mission.`

  return {
    quickQuiz: quickQuizResult,
    miniTest: miniTestResult,
    overallScore,
    masteryStatus,
    topicPerformance,
    feedback: {
      headline: masteryStatus === 'STRONG'
        ? 'Strong session'
        : masteryStatus === 'IMPROVING'
          ? 'Nice progress'
          : 'Good start, keep going',
      whatWentWell,
      needsImprovement,
      focusNext,
      tomorrowPreview,
      exactNextStep,
      weakTopics,
      strongTopics,
    },
  }
}
