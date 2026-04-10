import test from 'node:test'
import assert from 'node:assert/strict'

import { buildRoadmapTopicsFromText } from '../server/roadmapTopics.js'

test('buildRoadmapTopicsFromText extracts ordered topics from headings', () => {
  const text = [
    '1. Cell Structure',
    '2. Photosynthesis',
    '3. Respiration in Plants',
  ].join('\n')

  assert.deepEqual(buildRoadmapTopicsFromText(text), [
    { title: 'Cell Structure', estimatedMinutes: 25, subtopics: [] },
    { title: 'Photosynthesis', estimatedMinutes: 35, subtopics: [] },
    { title: 'Respiration in Plants', estimatedMinutes: 45, subtopics: [] },
  ])
})

test('buildRoadmapTopicsFromText de-duplicates repeated headings and caps the list', () => {
  const text = [
    'Algebra Basics',
    'Algebra Basics',
    'Linear Equations',
    'Quadratic Equations',
    'Polynomials',
    'Sequences and Series',
    'Probability',
    'Statistics',
    'Coordinate Geometry',
    'Matrices',
  ].join('\n')

  const topics = buildRoadmapTopicsFromText(text)
  assert.equal(topics.length, 8)
  assert.deepEqual(topics.map((topic) => topic.title), [
    'Algebra Basics',
    'Linear Equations',
    'Quadratic Equations',
    'Polynomials',
    'Sequences and Series',
    'Probability',
    'Statistics',
    'Coordinate Geometry',
  ])
})

test('buildRoadmapTopicsFromText falls back to the first sentence of each paragraph', () => {
  const text = [
    'Cells are the structural and functional unit of life. They carry out essential activities.',
    '',
    'Tissues are groups of cells working together for a common function. They form organs.',
  ].join('\n')

  assert.deepEqual(buildRoadmapTopicsFromText(text), [
    { title: 'Cells are the structural and functional unit of', estimatedMinutes: 25, subtopics: [] },
    { title: 'Tissues are groups of cells working together for', estimatedMinutes: 35, subtopics: [] },
  ])
})

test('buildRoadmapTopicsFromText ignores obvious noise', () => {
  const text = [
    'Page 1',
    'https://example.com',
    '2024 2025 2026 2027',
    'Figure 4.2',
  ].join('\n')

  assert.deepEqual(buildRoadmapTopicsFromText(text), [])
})
