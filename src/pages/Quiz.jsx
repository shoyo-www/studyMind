import { useEffect, useRef, useState } from 'react'
import AppLoader from '../components/AppLoader'
import TopBar from '../components/TopBar'
import { useT } from '../i18n'
import { quizApi } from '../lib/api'

const LABELS = ['A', 'B', 'C', 'D']
const QUIZ_QUESTION_COUNT = 20

function normalizeQuestions(questions = []) {
  return questions.map((question) => {
    const options = Array.isArray(question?.options) ? question.options : ['True', 'False']

    return {
      q: question?.question || question?.front || 'Untitled question',
      opts: options,
      topic: question?.topic || 'General',
      difficulty: question?.difficulty || 'medium',
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

function getRecommendedReviewTopic(questions = [], answers = []) {
  const wrongTopicCounts = new Map()

  questions.forEach((question, index) => {
    const answer = answers[index]
    const topic = `${question?.topic || ''}`.trim()

    if (!topic || topic === 'General' || answer === null || answer === undefined) {
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
  const { t } = useT()
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
  const focusedTopic = studyFocus?.documentId === activeDocumentId ? `${studyFocus?.topic || ''}`.trim() : ''
  const currentQuestion = questions[qIdx]
  const selected = answers[qIdx] ?? null
  const score = getScore(questions, answers)
  const recommendedReviewTopic = getRecommendedReviewTopic(questions, answers) || focusedTopic
  const answeredCount = answers.filter((answer) => answer !== null && answer !== undefined).length
  const pct = questions.length ? Math.round(((qIdx + 1) / questions.length) * 100) : 0
  const activeDocumentIsPdf = activeDocument?.mime_type === 'application/pdf'
  const showLoader = loading
  const loaderSubtitle = pending
    ? 'Checking whether your latest quiz is ready'
    : questions.length
      ? 'Refreshing your quiz'
      : `Generating your ${focusedTopic ? `${focusedTopic} ` : ''}${QUIZ_QUESTION_COUNT}-question quiz`

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
    const nextQuestions = normalizeQuestions(result?.questions || nextQuiz?.questions || [])
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
    setPending(false)
    setError('')
  }

  async function loadSavedQuizProgress(documentId) {
    if (!documentId) return

    try {
      const result = await quizApi.getLatest(documentId, { type: 'mcq', topic: focusedTopic || undefined, resumeOnly: true })
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
      const result = await quizApi.getLatest(documentId, { type: 'mcq', topic: focusedTopic || undefined })
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
        setError(result?.quiz?.error_message || 'Automatic quiz generation failed. Generate a new quiz to try again.')
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
      setError('AI quiz generation currently supports PDF documents only.')
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
    if (selected === null) return `${base} border-zinc-100 text-zinc-700 hover:border-violet-200 hover:bg-violet-50/40 cursor-pointer`
    if (index === currentQuestion.correct) return `${base} border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default`
    if (index === selected) return `${base} border-red-200 bg-red-50 text-red-600 cursor-default`
    return `${base} border-zinc-100 text-zinc-300 cursor-default`
  }

  useEffect(() => {
    let cancelled = false

    clearQuizState()
    setCheckingExisting(false)

    if (!activeDocumentId || !activeDocumentIsPdf) {
      if (activeDocument && !activeDocumentIsPdf) {
        setError('AI quiz generation currently supports PDF documents only.')
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
  }, [activeDocumentId, activeDocument?.mime_type, focusedTopic])

  useEffect(() => {
    if (!pending || !activeDocumentId) return

    const intervalId = setInterval(() => {
      void loadLatestQuiz(activeDocumentId, { silent: true })
    }, 5000)

    return () => clearInterval(intervalId)
  }, [pending, activeDocumentId])

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
        subtitle={activeDocument ? (focusedTopic ? `${t('quiz.subtitle')} · Focus: ${focusedTopic}` : t('quiz.subtitle')) : 'Select a document to generate a quiz.'}
        action={(
          <button
            onClick={pending ? () => loadLatestQuiz(activeDocumentId) : generateQuiz}
            disabled={!activeDocument || loading || checkingExisting || (!activeDocumentIsPdf && !pending)}
            className="text-xs px-3.5 py-2 border border-zinc-200 rounded-lg text-zinc-500 hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            {pending ? 'Check status' : `Generate ${QUIZ_QUESTION_COUNT}-question quiz`}
          </button>
        )}
      />
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-7 max-w-2xl w-full mx-auto">
        {focusedTopic && (
          <div className="mb-4 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-800">
            <div className="font-semibold mb-1">Focused practice is on</div>
            <div className="flex flex-wrap items-center gap-2">
              <span>{focusedTopic}</span>
              <button
                onClick={clearStudyFocus}
                className="text-xs px-2.5 py-1 rounded-full border border-violet-200 bg-white text-violet-600 hover:bg-violet-100 transition-colors"
              >
                Clear focus
              </button>
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
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${activeDocument?.id === document.id ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-zinc-200 bg-white text-zinc-500 hover:border-violet-200 hover:text-violet-600'}`}
              >
                {document.title}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!documents.length ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
            Upload a document first to generate quizzes from your notes.
          </div>
        ) : !activeDocumentIsPdf ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
            AI quiz generation currently supports PDF documents only.
          </div>
        ) : checkingExisting ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-center">
            <div className="w-11 h-11 rounded-full border-4 border-zinc-100 border-t-violet-500 animate-spin mx-auto mb-4" />
            <div className="text-base font-medium text-zinc-800 mb-2">Checking your latest quiz</div>
            <p className="text-sm text-zinc-500 leading-relaxed">
              We&apos;re loading any saved or auto-generated quiz for this document before showing the generate option.
            </p>
          </div>
        ) : pending ? (
          <div className="rounded-2xl border border-violet-100 bg-white px-6 py-10 text-center">
            <div className="w-11 h-11 rounded-full border-4 border-violet-100 border-t-violet-500 animate-spin mx-auto mb-4" />
            <div className="text-base font-medium text-zinc-800 mb-2">Your quiz is being prepared</div>
            <p className="text-sm text-zinc-500 leading-relaxed mb-5">
              We&apos;re generating your {focusedTopic ? `${focusedTopic} ` : ''}{QUIZ_QUESTION_COUNT}-question quiz now. This page will refresh automatically every few seconds.
            </p>
            <button
              onClick={() => loadLatestQuiz(activeDocumentId)}
              className="px-4 py-2 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Refresh now
            </button>
          </div>
        ) : !questions.length ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 3.5C4 2.67 4.67 2 5.5 2h9C15.33 2 16 2.67 16 3.5v13l-3-1.5L10 16.5 7 15 4 16.5v-13Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M7 7h6M7 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-base font-medium text-zinc-800 mb-2">Ready for a fresh quiz?</div>
              <div className="mb-5">
                {focusedTopic
                  ? `Generate a fresh ${QUIZ_QUESTION_COUNT}-question quiz on ${focusedTopic} from the selected document.`
                  : `Generate a fresh ${QUIZ_QUESTION_COUNT}-question quiz from the selected document to start practising.`}
              </div>
              <button
                onClick={generateQuiz}
                disabled={loading || !activeDocumentIsPdf}
                className="px-5 py-2.5 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                Generate {QUIZ_QUESTION_COUNT}-question quiz
              </button>
            </div>
          </div>
        ) : done ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-5">{score / questions.length >= 0.7 ? '🎉' : '📚'}</div>
            <h2 className="font-display font-semibold text-2xl text-zinc-900 mb-2">{t('quiz.result.title')}</h2>
            <p className="text-zinc-400 text-sm mb-1">{t('quiz.result.score', { score, total: questions.length })}</p>
            <p className="text-zinc-400 text-sm mb-8">
              {Math.round((score / questions.length) * 100)}% - {score / questions.length >= 0.7 ? t('quiz.result.great') : t('quiz.result.keepGoing')}
            </p>
            <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden mb-8">
              <div className={`h-full rounded-full transition-all duration-700 ${score / questions.length >= 0.7 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${(score / questions.length) * 100}%` }} />
            </div>
            <div className="mb-8 rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-left">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">Next Best Step</div>
              <div className="text-sm text-zinc-700 leading-relaxed">
                {recommendedReviewTopic
                  ? score / questions.length >= 0.7
                    ? `Nice work. Lock in ${recommendedReviewTopic} with flashcards, then move to a full mock test.`
                    : `Your weakest area in this round was ${recommendedReviewTopic}. Review it with flashcards, then retry a focused quiz.`
                  : score / questions.length >= 0.7
                    ? 'Nice work. You are ready to step up to a full mock test or move forward in the roadmap.'
                    : 'Review the trickiest concepts with flashcards, then take another quiz to strengthen them.'}
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={generateQuiz} className="px-5 py-2.5 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-700 transition-colors">
                {t('quiz.result.retake')}
              </button>
              <button
                onClick={() => {
                  setAnswers(Array(questions.length).fill(null))
                  setQIdx(0)
                  setDone(false)
                }}
                className="px-5 py-2.5 border border-zinc-200 text-zinc-600 text-sm rounded-lg hover:bg-zinc-50 transition-colors"
              >
                Retry same quiz
              </button>
            </div>
            <div className="flex flex-wrap gap-3 justify-center mt-4">
              {recommendedReviewTopic && (
                <>
                  <button
                    onClick={() => openStudyFocus?.({ documentId: activeDocumentId, topic: recommendedReviewTopic, screen: 'flashcards', origin: 'quiz_result' })}
                    className="px-5 py-2.5 border border-violet-200 bg-violet-50 text-violet-700 text-sm rounded-lg hover:bg-violet-100 transition-colors"
                  >
                    Review {recommendedReviewTopic}
                  </button>
                  <button
                    onClick={() => openStudyFocus?.({ documentId: activeDocumentId, topic: recommendedReviewTopic, screen: 'quiz', origin: 'quiz_result' })}
                    className="px-5 py-2.5 border border-zinc-200 text-zinc-600 text-sm rounded-lg hover:bg-zinc-50 transition-colors"
                  >
                    Retry quiz on {recommendedReviewTopic}
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  clearStudyFocus?.()
                  setScreen?.('mocktest')
                }}
                className="px-5 py-2.5 border border-zinc-200 text-zinc-600 text-sm rounded-lg hover:bg-zinc-50 transition-colors"
              >
                Take mock test
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="text-xs text-zinc-400 shrink-0">{t('quiz.question', { current: qIdx + 1, total: questions.length })}</span>
              <div className="flex-1 h-1 bg-zinc-100 rounded-full overflow-hidden min-w-[180px]">
                <div className="h-full bg-violet-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-medium text-violet-600 shrink-0">{t('quiz.correct', { score })}</span>
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
                        ? 'border-violet-300 bg-violet-50 text-violet-700'
                        : isAnswered
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-zinc-200 bg-white text-zinc-400 disabled:opacity-60'
                    }`}
                  >
                    {index + 1}
                  </button>
                )
              })}
            </div>

            <div className="bg-white border border-zinc-100 rounded-2xl p-6 mb-4">
              <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-300 mb-3">Question {qIdx + 1}</div>
              <p className="text-base font-medium text-zinc-800 leading-relaxed mb-6">{currentQuestion.q}</p>
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

            <div className="bg-white border border-zinc-100 rounded-2xl p-5">
              {selected !== null ? (
                <>
                  <div className={`text-sm font-semibold mb-1.5 ${selected === currentQuestion.correct ? 'text-emerald-600' : 'text-red-500'}`}>
                    {selected === currentQuestion.correct ? t('quiz.feedback.correct') : t('quiz.feedback.incorrect')}
                  </div>
                  <p className="text-sm text-zinc-500 leading-relaxed mb-4">{currentQuestion.exp}</p>
                </>
              ) : (
                <p className="text-sm text-zinc-500 leading-relaxed mb-4">
                  Choose one option to lock in your answer and continue.
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={prev}
                  disabled={qIdx === 0}
                  className="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={next}
                  disabled={selected === null}
                  className="px-5 py-2 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  {qIdx + 1 < questions.length ? 'Next question' : 'See results'}
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
