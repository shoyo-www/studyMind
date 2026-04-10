import { useEffect, useState } from 'react'
import { studyPlanApi } from './api'
import { clampPercentage } from './documents'

function cleanTopic(value = '') {
  return `${value || ''}`.replace(/\s+/g, ' ').trim()
}

function uniqueTopics(topics = []) {
  const seen = new Set()

  return topics.filter((topic) => {
    const normalized = cleanTopic(topic)
    const key = normalized.toLowerCase()

    if (!normalized || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

export function buildFocusLabel(topics = []) {
  return uniqueTopics(topics).slice(0, 3).join(', ')
}

export function getDocumentFallbackTopics(document = null) {
  const topics = Array.isArray(document?.topics) ? document.topics : []

  if (topics.length) {
    const coveredCount = Math.floor((clampPercentage(document?.pct_covered) / 100) * topics.length)
    const currentIndex = Math.min(Math.max(coveredCount, 0), Math.max(topics.length - 1, 0))
    const currentTopic = cleanTopic(topics[currentIndex]?.title || '')

    if (currentTopic) {
      return [currentTopic]
    }
  }

  const fallbackLabel = cleanTopic(document?.subject || document?.title || '')
  return fallbackLabel ? [fallbackLabel] : []
}

export function getStageContext(planData = null, document = null) {
  const dayTopics = uniqueTopics(
    Array.isArray(planData?.currentDay?.topics)
      ? planData.currentDay.topics.map((topic) => cleanTopic(topic))
      : [],
  ).slice(0, 3)

  if (dayTopics.length) {
    return {
      focusTopics: dayTopics,
      focusTopic: buildFocusLabel(dayTopics),
      stageDayNumber: Number(planData?.currentDayNumber) || Number(planData?.currentDay?.dayNumber) || null,
      source: 'roadmap',
    }
  }

  const fallbackTopics = getDocumentFallbackTopics(document)

  return {
    focusTopics: fallbackTopics,
    focusTopic: buildFocusLabel(fallbackTopics),
    stageDayNumber: null,
    source: fallbackTopics.length ? 'document' : '',
  }
}

export function useResolvedStudyTopic({ document = null, studyFocus = null } = {}) {
  const explicitTopic = studyFocus?.documentId === document?.id
    ? cleanTopic(studyFocus?.topic || '')
    : ''

  const [planState, setPlanState] = useState({
    documentId: null,
    data: null,
  })

  useEffect(() => {
    let cancelled = false

    if (!document?.id || document?.mime_type !== 'application/pdf' || explicitTopic) {
      setPlanState({
        documentId: document?.id || null,
        data: null,
      })
      return () => {
        cancelled = true
      }
    }

    setPlanState({
      documentId: document.id,
      data: null,
    })

    void (async () => {
      try {
        const data = await studyPlanApi.get(document.id)

        if (!cancelled) {
          setPlanState({
            documentId: document.id,
            data,
          })
        }
      } catch {
        if (!cancelled) {
          setPlanState({
            documentId: document.id,
            data: null,
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [document?.id, document?.mime_type, explicitTopic])

  if (explicitTopic) {
    return {
      focusTopic: explicitTopic,
      focusTopics: [explicitTopic],
      stageDayNumber: null,
      source: 'manual',
      isManualFocus: true,
      isRoadmapFocus: false,
    }
  }

  const stageContext = getStageContext(
    planState.documentId === document?.id ? planState.data : null,
    document,
  )

  return {
    ...stageContext,
    isManualFocus: false,
    isRoadmapFocus: stageContext.source === 'roadmap',
  }
}
