import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMockTestTitle, parseMockTestTitle } from '../server/mockTestStage.js'

test('buildMockTestTitle and parseMockTestTitle preserve stage topic metadata', () => {
  const title = buildMockTestTitle('Biology Notes', {
    focusTopic: 'Cell Structure',
    stageDayNumber: 2,
  })

  assert.equal(title, 'Biology Notes — Day 2: Cell Structure Mock Test')
  assert.deepEqual(parseMockTestTitle(title), {
    stageDayNumber: 2,
    focusTopic: 'Cell Structure',
  })
})

test('parseMockTestTitle leaves legacy document-wide mock test titles unfocused', () => {
  assert.deepEqual(parseMockTestTitle('Physics — Mock Test'), {
    stageDayNumber: null,
    focusTopic: '',
  })
})
