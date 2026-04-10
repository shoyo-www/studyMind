import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildFallbackStudyPlan,
  evaluateMission,
} from '../server/studyPlan.js'

test('buildFallbackStudyPlan creates a progressive 7 to 30 day roadmap with focused days', () => {
  const document = {
    title: 'Biology Revision',
    subject: 'Biology',
    topics: [
      { title: 'Cell Basics', estimatedMinutes: 20, subtopics: ['Cell membrane', 'Cytoplasm'] },
      { title: 'Tissues', estimatedMinutes: 25, subtopics: ['Meristematic', 'Permanent'] },
      { title: 'Photosynthesis', estimatedMinutes: 40, subtopics: ['Chlorophyll', 'Light reaction', 'Calvin cycle'] },
      { title: 'Respiration', estimatedMinutes: 45, subtopics: ['Glycolysis', 'ATP'] },
      { title: 'Genetics', estimatedMinutes: 55, subtopics: ['DNA', 'Genes', 'Inheritance'] },
      { title: 'Evolution', estimatedMinutes: 60, subtopics: ['Selection', 'Variation'] },
    ],
  }

  const plan = buildFallbackStudyPlan({
    document,
    documentText: 'Cell membrane and cytoplasm are repeated ideas. ATP appears in respiration. DNA and genes appear across genetics and inheritance.',
  })

  assert.equal(plan.analysis.totalTopics, 6)
  assert.ok(plan.roadmap.totalDays >= 7)
  assert.ok(plan.roadmap.totalDays <= 30)
  assert.ok(plan.analysis.repeatedConcepts.length >= 1)
  assert.ok(plan.roadmap.days.every((day) => day.topics.length >= 1 && day.topics.length <= 3))
  assert.deepEqual(plan.roadmap.days.map((day) => day.dayNumber), Array.from({ length: plan.roadmap.days.length }, (_, index) => index + 1))
})

test('evaluateMission returns STRONG when scores are above 80 percent', () => {
  const mission = {
    focusTopics: ['Photosynthesis', 'Respiration'],
    quickQuiz: [
      { topic: 'Photosynthesis', correct: 0 },
      { topic: 'Photosynthesis', correct: 1 },
      { topic: 'Respiration', correct: 2 },
      { topic: 'Respiration', correct: 3 },
      { topic: 'Respiration', correct: 0 },
    ],
    miniTest: [
      { topic: 'Photosynthesis', correct: 0 },
      { topic: 'Respiration', correct: 1 },
      { topic: 'Respiration', correct: 2 },
    ],
  }

  const result = evaluateMission({
    mission,
    quickQuizAnswers: [0, 1, 2, 3, 0],
    miniTestAnswers: [0, 1, 2],
    nextDay: { topics: ['Genetics'] },
  })

  assert.equal(result.masteryStatus, 'STRONG')
  assert.equal(result.quickQuiz.pct, 100)
  assert.equal(result.miniTest.pct, 100)
  assert.match(result.feedback.tomorrowPreview, /Tomorrow's Mission Preview:/)
})

test('evaluateMission returns WEAK and highlights weak topics when score is below 60 percent', () => {
  const mission = {
    focusTopics: ['Genetics'],
    quickQuiz: [
      { topic: 'Genetics', correct: 1 },
      { topic: 'Genetics', correct: 2 },
      { topic: 'Inheritance', correct: 0 },
      { topic: 'Inheritance', correct: 1 },
      { topic: 'Genetics', correct: 3 },
    ],
    miniTest: [
      { topic: 'Inheritance', correct: 0 },
      { topic: 'Genetics', correct: 0 },
      { topic: 'Genetics', correct: 2 },
    ],
  }

  const result = evaluateMission({
    mission,
    quickQuizAnswers: [0, 0, 0, 0, 0],
    miniTestAnswers: [1, 1, 1],
    nextDay: { topics: ['Evolution'] },
  })

  assert.equal(result.masteryStatus, 'WEAK')
  assert.ok(result.overallScore < 60)
  assert.ok(result.feedback.weakTopics.includes('Genetics') || result.feedback.weakTopics.includes('Inheritance'))
  assert.match(result.feedback.exactNextStep, /Read the concept notes once more/i)
})
