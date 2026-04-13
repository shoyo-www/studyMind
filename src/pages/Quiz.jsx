import { useEffect, useRef, useState } from 'react'
import AppLoader from '../components/AppLoader'
import TopBar from '../components/TopBar'
import { useT } from '../i18n'
import { quizApi } from '../lib/api'
import { useResolvedStudyTopic } from '../lib/studyStage'

const LABELS = ['A', 'B', 'C', 'D']
const QUIZ_QUESTION_COUNT = 20

function getQuizLanguageDefaults(lang = 'en') {
  return {
    untitledQuestion: lang === 'hi' ? 'बिना शीर्षक का प्रश्न' : 'Untitled question',
    generalTopic: lang === 'hi' ? 'सामान्य' : 'General',
    mediumDifficulty: lang === 'hi' ? 'मध्यम' : 'medium',
    trueLabel: lang === 'hi' ? 'सही' : 'True',
    falseLabel: lang === 'hi' ? 'गलत' : 'False',
  }
}

function normalizeQuestions(questions = [], lang = 'en') {
  const defaults = getQuizLanguageDefaults(lang)

  return questions.map((question) => {
    const options = Array.isArray(question?.options) ? question.options : [defaults.trueLabel, defaults.falseLabel]

    return {
      q: question?.question || question?.front || defaults.untitledQuestion,
      opts: options,
      topic: question?.topic || defaults.generalTopic,
      difficulty: question?.difficulty || defaults.mediumDifficulty,
      correct: Number.isInteger(question?.correct)
        ? question.correct
        : question?.correct === true
          ? 0
          : 1,
      exp: question?.explanation || question?.back || '',
    }
  })
}

function getScore(questions, answers) {
  return answers.reduce((total, answer, index) => (
    answer === questions[index]?.correct ? total + 1 : total
  ), 0)
}

function normalizeSavedAnswers(savedAnswers = [], totalQuestions = 0) {
  return Array.from({ length: totalQuestions }, (_, index) => {
    const answer = savedAnswers[index]
    return Number.isInteger(answer) && answer >= 0 ? answer : null
  })
}

function getRecommendedReviewTopic(questions = [], answers = [], lang = 'en') {
  const wrongTopicCounts = new Map()
  const defaults = getQuizLanguageDefaults(lang)

  questions.forEach((question, index) => {
    const answer = answers[index]
    const topic = `${question?.topic || ''}`.trim()

    if (!topic || topic === defaults.generalTopic || topic === 'General' || answer === null || answer === undefined) {
      return
    }

    if (answer !== question.correct) {
      wrongTopicCounts.set(topic, (wrongTopicCounts.get(topic) || 0) + 1)
    }
  })

  return [...wrongTopicCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || ''
}

export default function Quiz({
  onOpenSidebar,
  documents,
  activeDocument,
  setSelectedDocumentId,
  refreshAppData,
  studyFocus,
  openStudyFocus,
  clearStudyFocus,
  setScreen,
}) {
  const { t, lang } = useT()
  const [quiz, setQuiz] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState([])
  const [qIdx, setQIdx] = useState(0)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const [checkingExisting, setCheckingExisting] = useState(false)
  const [error, setError] = useState('')
  const saveTimeoutRef = useRef(null)

  const activeDocumentId = activeDocument?.id || null
  const {
    focusTopic: focusedTopic,
    isManualFocus,
    isRoadmapFocus,
    stageDayNumber,
  } = useResolvedStudyTopic({
    document: activeDocument,
    studyFocus,
  })
  const currentQuestion = questions[qIdx]
  const selected = answers[qIdx] ?? null
  const score = getScore(questions, answers)
  const recommendedReviewTopic = getRecommendedReviewTopic(questions, answers, lang) || focusedTopic
  const answeredCount = answers.filter((answer) => answer !== null && answer !== undefined).length
  const pct = questions.length ? Math.round(((qIdx + 1) / questions.length) * 100) : 0
  const activeDocumentIsPdf = activeDocument?.mime_type === 'application/pdf'
  const showLoader = loading
  const loaderSubtitle = pending
    ? t('quiz.checkingTitle')
    : questions.length
      ? t('quiz.checkingTitle')
      : t('quiz.preparingSub', {
          topicPrefix: focusedTopic ? `${focusedTopic} ` : '',
          count: QUIZ_QUESTION_COUNT,
        })

  function clearQuizState({ keepError = false } = {}) {
    setQuiz(null)
    setQuestions([])
    setAnswers([])
    setQIdx(0)
    setDone(false)
    setPending(false)
    if (!keepError) {
      setError('')
    }
  }

  function applyReadyQuiz(result, options = {}) {
    const { restoreProgress = false } = options
    const nextQuiz = result?.quiz || null
    const nextQuestions = normalizeQuestions(result?.questions || nextQuiz?.questions || [], lang)
    const nextAnswers = restoreProgress
      ? normalizeSavedAnswers(nextQuiz?.answers || [], nextQuestions.length)
      : Array(nextQuestions.length).fill(null)
    const nextIndex = restoreProgress
      ? Math.min(Math.max(0, Number(nextQuiz?.current_index) || 0), Math.max(nextQuestions.length - 1, 0))
      : 0

    setQuiz(nextQuiz)
    setQuestions(nextQuestions)
    setAnswers(nextAnswers)
    setQIdx(nextIndex)
    setDone(false)
    setLoading(false)
    setPending(false)
    setError('')
  }

  async function loadSavedQuizProgress(documentId) {
    if (!documentId) return

    try {
      const result = await quizApi.getLatest(documentId, { type: 'mcq', topic: focusedTopic || undefined, lang, resumeOnly: true })
      if (result?.quiz && (result?.questions?.length || result?.quiz?.questions?.length)) {
        applyReadyQuiz(result, { restoreProgress: true })
        return true
      }
    } catch {
      // Keep the quiz page usable even if resume lookup fails.
    }

    return false
  }

  async function loadLatestQuiz(documentId, options = {}) {
    const { silent = false } = options

    if (!documentId) return

    if (!silent) {
      setLoading(true)
    }

    try {
      const result = await quizApi.getLatest(documentId, { type: 'mcq', topic: focusedTopic || undefined, lang })
      const status = result?.status || result?.quiz?.status || 'missing'

      if (status === 'ready' && (result?.questions?.length || result?.quiz?.questions?.length)) {
        applyReadyQuiz(result)
        return
      }

      clearQuizState({ keepError: true })
      setQuiz(result?.quiz || null)

      if (status === 'pending') {
        setPending(true)
        setError('')
        return
      }

      if (status === 'failed') {
        setError(result?.quiz?.error_message || t('quiz.failed'))
        return
      }

      setError('')
    } catch (quizError) {
      if (!silent) {
        setError(quizError.message || t('errors.generic'))
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  async function generateQuiz() {
    if (!activeDocument) return

    if (!activeDocumentIsPdf) {
      clearQuizState({ keepError: true })
      setError(t('quiz.pdfOnly'))
      return
    }

    setLoading(true)
    clearQuizState({ keepError: true })
    setError('')

    try {
      const result = await quizApi.generate(activeDocument.id, {
        count: QUIZ_QUESTION_COUNT,
        type: 'mcq',
        topic: focusedTopic || null,
        lang,
      })

      if ((result?.status || result?.quiz?.status) === 'pending') {
        setQuiz(result.quiz || null)
        setPending(true)
      } else {
        applyReadyQuiz(result)
      }
    } catch (quizError) {
      setError(quizError.message || t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  function pick(index) {
    if (!currentQuestion || selected !== null || done) return

    setAnswers((current) => {
      const next = [...current]
      next[qIdx] = index
      return next
    })
  }

  function prev() {
    if (qIdx === 0) return
    setQIdx((current) => current - 1)
  }

  async function next() {
    if (selected === null) return

      if (qIdx + 1 >= questions.length) {
      const finalScore = getScore(questions, answers)
      setDone(true)

      if (quiz?.id) {
        try {
          await quizApi.saveScore(quiz.id, finalScore, answers, qIdx)
          await refreshAppData?.()
        } catch {
          // Keep the result view even if score persistence fails.
        }
      }

      return
    }

    setQIdx((current) => current + 1)
  }

  function jumpTo(index) {
    if (index > answeredCount) return
    setQIdx(index)
  }

  function optionStyle(index) {
    const base = 'flex items-center gap-3 w-full text-left px-4 py-3 border rounded-xl text-sm transition-all duration-150'
    if (selected === null) return `${base} border-[rgba(130,147,183,0.16)] text-[var(--pp-text)] hover:border-[rgba(102,247,226,0.28)] hover:bg-white/5 cursor-pointer`
    if (index === currentQuestion.correct) return `${base} border-[rgba(102,247,226,0.22)] bg-[rgba(102,247,226,0.08)] text-[var(--pp-cyan)] cursor-default`
    if (index === selected) return `${base} border-[rgba(255,118,105,0.22)] bg-[rgba(255,118,105,0.08)] text-[#ffd6cf] cursor-default`
    return `${base} border-[rgba(130,147,183,0.16)] text-[var(--pp-text-muted)] cursor-default`
  }

  useEffect(() => {
    let cancelled = false

    clearQuizState()
    setCheckingExisting(false)

    if (!activeDocumentId || !activeDocumentIsPdf) {
      if (activeDocument && !activeDocumentIsPdf) {
        setError(t('quiz.pdfOnly'))
      }
      return
    }

    setCheckingExisting(true)

    void (async () => {
      const restored = await loadSavedQuizProgress(activeDocumentId)

      if (!restored) {
        await loadLatestQuiz(activeDocumentId, { silent: true })
      }

      if (!cancelled) {
        setCheckingExisting(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeDocumentId, activeDocument?.mime_type, focusedTopic, lang])

  useEffect(() => {
    if (!pending || !activeDocumentId) return

    const intervalId = setInterval(() => {
      void loadLatestQuiz(activeDocumentId, { silent: true })
    }, 5000)

    return () => clearInterval(intervalId)
  }, [pending, activeDocumentId, lang])

  useEffect(() => () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!quiz?.id || pending || done || !questions.length) return

    const hasTouchedQuiz = qIdx > 0 || answers.some((answer) => answer !== null && answer !== undefined)
    if (!hasTouchedQuiz) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      void quizApi.saveProgress(quiz.id, answers, qIdx).catch(() => {})
    }, 400)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [quiz?.id, answers, qIdx, done, pending, questions.length])

  return (
    <div className="relative flex flex-col flex-1 min-h-0">
      <TopBar
        title={activeDocument ? `${t('quiz.title')} — ${activeDocument.title}` : t('quiz.title')}
        subtitle={activeDocument ? (focusedTopic ? `${t('quiz.subtitle')} · ${t('quiz.focusedOn')}: ${focusedTopic}` : t('quiz.subtitle')) : t('quiz.selectDocument')}
        action={(
          <button
            onClick={pending ? () => loadLatestQuiz(activeDocumentId) : generateQuiz}
            disabled={!activeDocument || loading || checkingExisting || (!activeDocumentIsPdf && !pending)}
            className="text-xs px-3.5 py-2 border pp-app-border rounded-xl pp-app-subtle hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {pending ? t('quiz.checkStatus') : t('quiz.generateCta', { count: QUIZ_QUESTION_COUNT })}
          </button>
        )}
      />
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-7 max-w-2xl w-full mx-auto">
        {focusedTopic && (
          <div className="mb-4 rounded-2xl border border-[rgba(255,118,105,0.2)] bg-[rgba(255,118,105,0.08)] px-4 py-3 text-sm text-[#ffd6cf]">
            <div className="font-semibold mb-1">
              {isRoadmapFocus && stageDayNumber ? `Current roadmap stage · Day ${stageDayNumber}` : t('quiz.focusedOn')}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>{focusedTopic}</span>
              {isManualFocus && (
                <button
                  onClick={clearStudyFocus}
                  className="text-xs px-2.5 py-1 rounded-full border pp-app-border bg-white/5 text-[var(--pp-cyan)] hover:bg-white/10 transition-colors"
                >
                  {t('quiz.clearFocus')}
                </button>
              )}
            </div>
          </div>
        )}

        {!!documents.length && (
          <div className="flex flex-wrap gap-2 mb-6">
            {documents.map((document) => (
              <button
                key={document.id}
                onClick={() => {
                  setSelectedDocumentId(document.id)
                  if (document.id !== activeDocumentId) {
                    clearStudyFocus?.()
                  }
                }}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${activeDocument?.id === document.id ? 'border-[rgba(255,118,105,0.2)] bg-[rgba(255,118,105,0.12)] text-white' : 'border-[rgba(130,147,183,0.16)] bg-white/5 text-[var(--pp-text-soft)] hover:border-[rgba(102,247,226,0.28)] hover:text-[var(--pp-cyan)]'}`}
              >
                {document.title}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-[rgba(255,118,105,0.2)] bg-[rgba(255,118,105,0.08)] px-4 py-3 text-sm text-[#ffd6cf]">
            {error}
          </div>
        )}

        {!documents.length ? (
          <div className="rounded-2xl pp-app-card px-6 py-10 text-sm pp-app-subtle">
            {t('quiz.uploadFirst')}
          </div>
        ) : !activeDocumentIsPdf ? (
          <div className="rounded-2xl pp-app-card px-6 py-10 text-sm pp-app-subtle">
            {t('quiz.pdfOnly')}
          </div>
        ) : checkingExisting ? (
          <div className="rounded-2xl pp-app-card px-6 py-10 text-center">
            <div className="w-11 h-11 rounded-full border-4 border-white/8 border-t-[var(--pp-coral)] animate-spin mx-auto mb-4" />
            <div className="text-base font-medium text-white mb-2">{t('quiz.checkingTitle')}</div>
            <p className="text-sm pp-app-subtle leading-relaxed">
              {t('quiz.checkingSub')}
            </p>
          </div>
        ) : pending ? (
          <div className="rounded-2xl pp-app-card px-6 py-10 text-center">
            <div className="w-11 h-11 rounded-full border-4 border-white/8 border-t-[var(--pp-coral)] animate-spin mx-auto mb-4" />
            <div className="text-base font-medium text-white mb-2">{t('quiz.preparingTitle')}</div>
            <p className="text-sm pp-app-subtle leading-relaxed mb-5">
              {t('quiz.preparingSub', {
                topicPrefix: focusedTopic ? `${focusedTopic} ` : '',
                count: QUIZ_QUESTION_COUNT,
              })}
            </p>
            <button
              onClick={() => loadLatestQuiz(activeDocumentId)}
              className="px-4 py-2 text-white text-sm rounded-xl transition-colors pp-app-button-primary"
            >
              {t('quiz.refreshNow')}
            </button>
          </div>
        ) : !questions.length ? (
          <div className="rounded-2xl pp-app-card px-6 py-10 text-sm pp-app-subtle text-center">
            <div className="max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-[rgba(255,118,105,0.12)] text-[var(--pp-coral)] border border-[rgba(255,118,105,0.18)] flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 3.5C4 2.67 4.67 2 5.5 2h9C15.33 2 16 2.67 16 3.5v13l-3-1.5L10 16.5 7 15 4 16.5v-13Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M7 7h6M7 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-base font-medium text-white mb-2">{t('quiz.emptyTitle')}</div>
              <div className="mb-5">
                {focusedTopic
                  ? t('quiz.emptySubTopic', { count: QUIZ_QUESTION_COUNT, topic: focusedTopic })
                  : t('quiz.emptySub', { count: QUIZ_QUESTION_COUNT })}
              </div>
              <button
                onClick={generateQuiz}
                disabled={loading || !activeDocumentIsPdf}
                className="px-5 py-2.5 text-white text-sm rounded-xl transition-colors disabled:opacity-50 pp-app-button-primary"
              >
                {t('quiz.generateCta', { count: QUIZ_QUESTION_COUNT })}
              </button>
            </div>
          </div>
        ) : done ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-5">{score / questions.length >= 0.7 ? '🎉' : '📚'}</div>
            <h2 className="font-display font-semibold text-2xl text-white mb-2">{t('quiz.result.title')}</h2>
            <p className="pp-app-muted text-sm mb-1">{t('quiz.result.score', { score, total: questions.length })}</p>
            <p className="pp-app-muted text-sm mb-8">
              {Math.round((score / questions.length) * 100)}% - {score / questions.length >= 0.7 ? t('quiz.result.great') : t('quiz.result.keepGoing')}
            </p>
            <div className="w-full h-2 bg-white/8 rounded-full overflow-hidden mb-8">
              <div className={`h-full rounded-full transition-all duration-700 ${score / questions.length >= 0.7 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${(score / questions.length) * 100}%` }} />
            </div>
            <div className="mb-8 rounded-2xl pp-app-card px-5 py-4 text-left">
              <div className="text-[10px] font-semibold uppercase tracking-widest pp-app-muted mb-2">{t('quiz.nextBestStep')}</div>
              <div className="text-sm text-[var(--pp-text-soft)] leading-relaxed">
                {recommendedReviewTopic
                  ? score / questions.length >= 0.7
                    ? t('quiz.resultStepGoodTopic', { topic: recommendedReviewTopic })
                    : t('quiz.resultStepWeakTopic', { topic: recommendedReviewTopic })
                  : score / questions.length >= 0.7
                    ? t('quiz.resultStepGood')
                    : t('quiz.resultStepWeak')}
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={generateQuiz} className="px-5 py-2.5 text-white text-sm rounded-xl transition-colors pp-app-button-primary">
                {t('quiz.result.retake')}
              </button>
              <button
                onClick={() => {
                  setAnswers(Array(questions.length).fill(null))
                  setQIdx(0)
                  setDone(false)
                }}
                className="px-5 py-2.5 border pp-app-border text-[var(--pp-text-soft)] text-sm rounded-xl hover:bg-white/5 transition-colors"
              >
                {t('quiz.retrySame')}
              </button>
            </div>
            <div className="flex flex-wrap gap-3 justify-center mt-4">
              {recommendedReviewTopic && (
                <>
                  <button
                    onClick={() => openStudyFocus?.({ documentId: activeDocumentId, topic: recommendedReviewTopic, screen: 'flashcards', origin: 'quiz_result' })}
                    className="px-5 py-2.5 border border-[rgba(255,118,105,0.2)] bg-[rgba(255,118,105,0.08)] text-[#ffd6cf] text-sm rounded-xl hover:bg-[rgba(255,118,105,0.12)] transition-colors"
                  >
                    {t('quiz.reviewTopic', { topic: recommendedReviewTopic })}
                  </button>
                  <button
                    onClick={() => openStudyFocus?.({ documentId: activeDocumentId, topic: recommendedReviewTopic, screen: 'quiz', origin: 'quiz_result' })}
                    className="px-5 py-2.5 border pp-app-border text-[var(--pp-text-soft)] text-sm rounded-xl hover:bg-white/5 transition-colors"
                  >
                    {t('quiz.retryTopic', { topic: recommendedReviewTopic })}
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  clearStudyFocus?.()
                  setScreen?.('mocktest')
                }}
                className="px-5 py-2.5 border pp-app-border text-[var(--pp-text-soft)] text-sm rounded-xl hover:bg-white/5 transition-colors"
              >
                {t('quiz.takeMock')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="text-xs pp-app-muted shrink-0">{t('quiz.question', { current: qIdx + 1, total: questions.length })}</span>
              <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden min-w-[180px]">
                <div className="h-full bg-[var(--pp-coral)] rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-medium text-[var(--pp-cyan)] shrink-0">{t('quiz.correct', { score })}</span>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {questions.map((_, index) => {
                const isAnswered = answers[index] !== null && answers[index] !== undefined
                const isActive = index === qIdx
                return (
                  <button
                    key={index}
                    onClick={() => jumpTo(index)}
                    disabled={index > answeredCount}
                    className={`w-9 h-9 rounded-full border text-xs font-semibold transition-colors ${
                      isActive
                        ? 'border-[rgba(255,118,105,0.22)] bg-[rgba(255,118,105,0.12)] text-white'
                        : isAnswered
                          ? 'border-[rgba(102,247,226,0.22)] bg-[rgba(102,247,226,0.08)] text-[var(--pp-cyan)]'
                          : 'border-[rgba(130,147,183,0.16)] bg-white/5 text-[var(--pp-text-muted)] disabled:opacity-60'
                    }`}
                  >
                    {index + 1}
                  </button>
                )
              })}
            </div>

            <div className="pp-app-card rounded-2xl p-6 mb-4">
              <div className="text-[10px] font-medium uppercase tracking-widest pp-app-muted mb-3">{t('quiz.question', { current: qIdx + 1, total: questions.length })}</div>
              <p className="text-base font-medium text-white leading-relaxed mb-6">{currentQuestion.q}</p>
              <div className="flex flex-col gap-2">
                {currentQuestion.opts.map((option, index) => (
                  <button key={index} onClick={() => pick(index)} className={optionStyle(index)}>
                    <span className={`w-6 h-6 rounded-full border text-xs font-semibold flex shrink-0 transition-all ${selected !== null && index === currentQuestion.correct ? 'border-emerald-400 text-emerald-600' : selected === index && index !== currentQuestion.correct ? 'border-red-400 text-red-500' : 'border-current'}`} style={{ alignItems: 'center', justifyContent: 'center' }}>
                      {selected !== null && index === currentQuestion.correct ? '✓' : selected === index && index !== currentQuestion.correct ? '✗' : LABELS[index] || index + 1}
                    </span>
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="pp-app-card rounded-2xl p-5">
              {selected !== null ? (
                <>
                  <div className={`text-sm font-semibold mb-1.5 ${selected === currentQuestion.correct ? 'text-emerald-600' : 'text-red-500'}`}>
                    {selected === currentQuestion.correct ? t('quiz.feedback.correct') : t('quiz.feedback.incorrect')}
                  </div>
                  <p className="text-sm pp-app-subtle leading-relaxed mb-4">{currentQuestion.exp}</p>
                </>
              ) : (
                <p className="text-sm pp-app-subtle leading-relaxed mb-4">
                  {t('quiz.chooseAnswer')}
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={prev}
                  disabled={qIdx === 0}
                  className="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
                >
                  {t('quiz.previous')}
                </button>
                <button
                  onClick={next}
                  disabled={selected === null}
                  className="px-5 py-2 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  {qIdx + 1 < questions.length ? t('quiz.next') : t('quiz.seeResults')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      {showLoader && <AppLoader overlay subtitle={loaderSubtitle} />}
    </div>
  )
}
