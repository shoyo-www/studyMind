import { useEffect, useRef, useState } from 'react'
import AppLoader from '../components/AppLoader'
import TopBar from '../components/TopBar'
import { useT } from '../i18n'
import { quizApi } from '../lib/api'

const DEFAULT_FLASHCARD_COUNT = 50
const DIFF_DOT = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' }

function normalizeFlashcards(questions = []) {
  return questions
    .map((question, index) => ({
      id: question?.id || `${index + 1}`,
      front: question?.front || question?.question || `Flashcard ${index + 1}`,
      back: question?.back || question?.explanation || question?.options?.[0] || 'Answer unavailable',
      topic: question?.topic || 'General',
      difficulty: question?.difficulty || 'medium',
    }))
    .filter((card) => card.front && card.back)
}

function SwipeCard({ card, onSwipe, zIndex, isTop, stackOffset }) {
  const [flipped, setFlipped] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [leaving, setLeaving] = useState(null)
  const startPos = useRef({ x: 0, y: 0 })
  const ref = useRef(null)

  function pointerDown(event) {
    if (!isTop) return
    event.currentTarget.setPointerCapture(event.pointerId)
    startPos.current = { x: event.clientX, y: event.clientY }
    setIsDragging(true)
  }

  function pointerMove(event) {
    if (!isDragging || !isTop) return
    setDragX(event.clientX - startPos.current.x)
    setDragY((event.clientY - startPos.current.y) * 0.12)
  }

  function pointerUp() {
    if (!isDragging || !isTop) return
    setIsDragging(false)
    if (dragX > 110) {
      fly('right')
    } else if (dragX < -110) {
      fly('left')
    } else {
      setDragX(0)
      setDragY(0)
    }
  }

  function fly(direction) {
    setLeaving(direction)
    setTimeout(() => onSwipe(card.id, direction), 320)
  }

  const rotation = isTop ? dragX * 0.07 : 0
  const translateX = leaving === 'right' ? 700 : leaving === 'left' ? -700 : dragX
  const translateY = leaving ? -60 : isTop ? dragY : stackOffset * 12
  const scale = isTop ? 1 : 0.96 - stackOffset * 0.03
  const opacity = leaving ? 0 : 1
  const showKnow = isTop && dragX > 50
  const showSkip = isTop && dragX < -50

  return (
    <div
      ref={ref}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onClick={() => isTop && !isDragging && Math.abs(dragX) < 6 && setFlipped((value) => !value)}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex,
        transform: `translateX(${translateX}px) translateY(${translateY}px) rotate(${rotation}deg) scale(${scale})`,
        opacity,
        transition: isDragging ? 'none' : leaving ? 'all 0.32s cubic-bezier(0.4,0,0.2,1)' : 'transform 0.3s ease, opacity 0.3s ease',
        cursor: isTop ? (isDragging ? 'grabbing' : 'grab') : 'default',
        perspective: 1200,
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.45s ease',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            borderRadius: 20,
            background: '#fff',
            border: '1px solid #E4E4E7',
            boxShadow: isTop ? '0 24px 64px rgba(0,0,0,0.13)' : '0 6px 20px rgba(0,0,0,0.06)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {showKnow && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 20,
                zIndex: 5,
                background: `rgba(34,197,94,${Math.min(dragX / 160, 0.18)})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ border: '4px solid #22c55e', borderRadius: 10, padding: '6px 18px', transform: 'rotate(-12deg)', opacity: Math.min(dragX / 120, 1) }}>
                <span style={{ fontSize: 26, fontWeight: 900, color: '#22c55e', fontFamily: 'Syne,sans-serif' }}>KNOW ✓</span>
              </div>
            </div>
          )}

          {showSkip && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 20,
                zIndex: 5,
                background: `rgba(239,68,68,${Math.min(-dragX / 160, 0.18)})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ border: '4px solid #ef4444', borderRadius: 10, padding: '6px 18px', transform: 'rotate(12deg)', opacity: Math.min(-dragX / 120, 1) }}>
                <span style={{ fontSize: 26, fontWeight: 900, color: '#ef4444', fontFamily: 'Syne,sans-serif' }}>SKIP ✗</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px' }}>
            <span style={{ fontSize: 11, color: '#71717a' }}>{card.topic}</span>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: DIFF_DOT[card.difficulty] || '#a1a1aa' }} />
            <span style={{ fontSize: 11, color: '#a1a1aa' }}>{card.difficulty}</span>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 28px 8px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#d4d4d8', marginBottom: 18 }}>Prompt</div>
            <p style={{ fontSize: 20, fontWeight: 600, fontFamily: 'Syne,sans-serif', letterSpacing: '-0.01em', color: '#111110', textAlign: 'center', lineHeight: 1.4 }}>
              {card.front}
            </p>
          </div>

          <div style={{ padding: '12px 20px 20px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, color: '#d4d4d8' }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1.5v4M5.5 7.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="5.5" cy="9.5" r=".5" fill="currentColor"/></svg>
              Tap to flip
            </div>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderRadius: 20,
            background: 'linear-gradient(145deg,#6c63ff,#8b5cf6)',
            boxShadow: '0 24px 64px rgba(108,99,255,0.3)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)', marginBottom: 18 }}>Answer</div>
            <p style={{ fontSize: 16, fontWeight: 500, color: '#fff', textAlign: 'center', lineHeight: 1.65 }}>
              {card.back}
            </p>
          </div>
          <div style={{ padding: '12px 20px 20px', textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            → Know it | ← Review again
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Flashcards({
  activeDocument,
  setScreen,
  studyFocus,
  openStudyFocus,
  clearStudyFocus,
}) {
  const { t } = useT()
  const [quiz, setQuiz] = useState(null)
  const [allCards, setAllCards] = useState([])
  const [deck, setDeck] = useState([])
  const [known, setKnown] = useState([])
  const [skipped, setSkipped] = useState([])
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const [checkingExisting, setCheckingExisting] = useState(false)
  const [error, setError] = useState('')

  const activeDocumentId = activeDocument?.id || null
  const focusedTopic = studyFocus?.documentId === activeDocumentId ? `${studyFocus?.topic || ''}`.trim() : ''
  const activeDocumentIsPdf = activeDocument?.mime_type === 'application/pdf'
  const total = allCards.length
  const doneCount = known.length + skipped.length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0
  function resetRound(cards) {
    setDeck([...cards])
    setKnown([])
    setSkipped([])
    setDone(cards.length === 0)
  }

  function clearFlashcardState({ keepError = false } = {}) {
    setQuiz(null)
    setAllCards([])
    setDeck([])
    setKnown([])
    setSkipped([])
    setDone(false)
    setPending(false)
    if (!keepError) {
      setError('')
    }
  }

  function applyReadyDeck(result) {
    const nextQuiz = result?.quiz || null
    const nextCards = normalizeFlashcards(result?.questions || nextQuiz?.questions || [])

    setQuiz(nextQuiz)
    setAllCards(nextCards)
    setDeck([...nextCards])
    setKnown([])
    setSkipped([])
    setDone(nextCards.length === 0)
    setPending(false)
    setError('')
  }

  async function loadLatestFlashcards(documentId, options = {}) {
    const { silent = false } = options

    if (!documentId) return

    if (!silent) {
      setLoading(true)
    }

    try {
      const result = await quizApi.getLatest(documentId, { type: 'flashcard', topic: focusedTopic || undefined })
      const status = result?.status || result?.quiz?.status || 'missing'

      if (status === 'ready' && (result?.questions?.length || result?.quiz?.questions?.length)) {
        applyReadyDeck(result)
        return
      }

      clearFlashcardState({ keepError: true })
      setQuiz(result?.quiz || null)

      if (status === 'pending') {
        setPending(true)
        setError('')
        return
      }

      if (status === 'failed') {
        setError(result?.quiz?.error_message || t('flashcards.failed'))
        return
      }

      setError('')
    } catch (flashcardError) {
      if (!silent) {
        setError(flashcardError.message || t('errors.generic'))
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  async function generateFlashcards() {
    if (!activeDocument) return

    if (!activeDocumentIsPdf) {
      clearFlashcardState({ keepError: true })
      setError(t('flashcards.pdfOnly'))
      return
    }

    setLoading(true)
    clearFlashcardState({ keepError: true })
    setError('')

    try {
      const result = await quizApi.generate(activeDocument.id, {
        count: DEFAULT_FLASHCARD_COUNT,
        type: 'flashcard',
        topic: focusedTopic || null,
      })

      if ((result?.status || result?.quiz?.status) === 'pending') {
        setQuiz(result.quiz || null)
        setPending(true)
      } else {
        applyReadyDeck(result)
      }
    } catch (flashcardError) {
      setError(flashcardError.message || t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  function handleSwipe(cardId, direction) {
    if (direction === 'right') {
      setKnown((current) => [...current, cardId])
    } else {
      setSkipped((current) => [...current, cardId])
    }

    setDeck((current) => {
      const nextDeck = current.filter((card) => card.id !== cardId)
      if (nextDeck.length === 0) {
        setTimeout(() => setDone(true), 400)
      }
      return nextDeck
    })
  }

  function handleAction(direction) {
    if (!deck.length) return
    handleSwipe(deck[0].id, direction)
  }

  function restart() {
    resetRound(allCards)
  }

  function reviewSkipped() {
    const nextCards = allCards.filter((card) => skipped.includes(card.id))
    setDeck(nextCards)
    setKnown([])
    setSkipped([])
    setDone(nextCards.length === 0)
  }

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'ArrowLeft') handleAction('left')
      if (event.key === 'ArrowRight') handleAction('right')
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deck])

  useEffect(() => {
    let cancelled = false

    clearFlashcardState()
    setCheckingExisting(false)

    if (!activeDocumentId || !activeDocumentIsPdf) {
      if (activeDocument && !activeDocumentIsPdf) {
        setError(t('flashcards.pdfOnly'))
      }
      return
    }

    setCheckingExisting(true)

    void (async () => {
      await loadLatestFlashcards(activeDocumentId, { silent: true })

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
      void loadLatestFlashcards(activeDocumentId, { silent: true })
    }, 5000)

    return () => clearInterval(intervalId)
  }, [pending, activeDocumentId])

  const subtitle = activeDocument
    ? `${t('flashcards.subtitle')} · ${activeDocument.title}${focusedTopic ? ` · Focus: ${focusedTopic}` : ''}`
    : t('flashcards.subtitle')

  return (
    <div className="relative flex flex-col flex-1 min-h-0">
      <TopBar
        title={t('flashcards.title')}
        subtitle={subtitle}
        action={(
          <button
            onClick={pending ? () => loadLatestFlashcards(activeDocumentId) : generateFlashcards}
            disabled={!activeDocument || loading || checkingExisting || (!activeDocumentIsPdf && !pending)}
            className="text-xs px-3.5 py-2 border border-zinc-200 rounded-lg text-zinc-500 hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            {pending ? t('flashcards.checkStatus') : t('flashcards.generate')}
          </button>
        )}
      />

      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start pt-6 px-6 bg-zinc-50">
        {focusedTopic && (
          <div className="w-full max-w-md mb-4 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-800">
            <div className="font-semibold mb-1">Focused revision is on</div>
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

        {!activeDocument ? (
          <div className="max-w-md w-full rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
            {t('flashcards.selectDocument')}
          </div>
        ) : !activeDocumentIsPdf ? (
          <div className="max-w-md w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
            {t('flashcards.pdfOnly')}
          </div>
        ) : checkingExisting ? (
          <div className="max-w-md w-full rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
            <div className="font-semibold text-zinc-800 mb-2">Checking your flashcards</div>
            <div>We&apos;re loading any saved or auto-generated deck for this document before showing the generate option.</div>
          </div>
        ) : pending ? (
          <div className="max-w-md w-full rounded-2xl border border-violet-100 bg-white p-6 text-sm text-zinc-600 shadow-sm">
            <div className="font-semibold text-zinc-800 mb-2">{t('flashcards.preparing')}</div>
            <div>{t('flashcards.preparingSub')}</div>
          </div>
        ) : error ? (
          <div className="max-w-md w-full rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
            {error}
          </div>
        ) : !allCards.length ? (
          <div className="max-w-md w-full rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
            {focusedTopic
              ? `No flashcards are ready yet for ${focusedTopic}. Generate a focused deck to start revising this weak area.`
              : t('flashcards.empty')}
          </div>
        ) : (
          <>
            {quiz?.source === 'auto_upload' && (
              <div className="w-full max-w-md mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {t('flashcards.autoGenerated')}
              </div>
            )}

            <div className="w-full max-w-sm mb-5">
              <div className="flex items-center justify-between mb-3 gap-3">
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-zinc-500">{known.length} known</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-zinc-500">{skipped.length} skipped</span>
                  </div>
                </div>
                <span className="text-xs text-zinc-400">{deck.length} left</span>
              </div>

              <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: '#6c63ff' }}
                />
              </div>
            </div>

            {done ? (
              <div className="flex flex-col items-center justify-center flex-1 max-w-xs text-center w-full">
                <div className="text-5xl mb-5">{known.length >= total * 0.7 ? '🎉' : '📚'}</div>
                <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: '#111110', marginBottom: 6 }}>
                  Round complete!
                </h2>
                <p className="text-zinc-400 text-sm mb-8">
                  You knew <strong className="text-emerald-600">{known.length}</strong> and need to review <strong className="text-red-500">{skipped.length}</strong>.
                </p>
                {focusedTopic && (
                  <div className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 mb-6">
                    {skipped.length > 0
                      ? `You still need another pass on ${focusedTopic}. Review the skipped cards now, then test yourself with a focused quiz.`
                      : `Great job. You look stronger on ${focusedTopic}. A focused quiz is the best next step.`}
                  </div>
                )}

                <div style={{ position: 'relative', width: 112, height: 112, marginBottom: 28 }}>
                  <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#E4E4E7" strokeWidth="9" />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke={known.length >= total * 0.7 ? '#22c55e' : '#f59e0b'}
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 42}`}
                      strokeDashoffset={`${2 * Math.PI * 42 * (1 - known.length / Math.max(total, 1))}`}
                      style={{ transition: 'stroke-dashoffset 1s ease' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 700, color: '#111110' }}>
                      {Math.round((known.length / Math.max(total, 1)) * 100)}%
                    </span>
                    <span style={{ fontSize: 10, color: '#a1a1aa' }}>known</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 w-full">
                  {skipped.length > 0 && (
                    <button
                      onClick={reviewSkipped}
                      className="w-full py-3 rounded-xl text-sm font-semibold text-white"
                      style={{ background: '#6c63ff' }}
                    >
                      Review {skipped.length} skipped
                    </button>
                  )}
                  <button
                    onClick={restart}
                    className="w-full py-3 rounded-xl text-sm font-medium border border-zinc-200 text-zinc-600 hover:bg-white transition-all"
                  >
                    Start over
                  </button>
                  <button
                    onClick={() => setScreen('quiz')}
                    className="w-full py-3 rounded-xl text-sm font-medium text-violet-600 hover:bg-violet-50 transition-all"
                  >
                    Take a quiz instead →
                  </button>
                  {focusedTopic && (
                    <button
                      onClick={() => openStudyFocus?.({ documentId: activeDocumentId, topic: focusedTopic, screen: 'quiz', origin: 'flashcards_result' })}
                      className="w-full py-3 rounded-xl text-sm font-medium border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-all"
                    >
                      Quiz me on {focusedTopic}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div style={{ position: 'relative', width: '100%', maxWidth: 360, height: 380, marginBottom: 24 }}>
                  {deck.length === 0 ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div className="text-center">
                        <div className="text-4xl mb-2">✨</div>
                        <div className="text-sm text-zinc-400">All done!</div>
                      </div>
                    </div>
                  ) : (
                    [...deck].slice(0, 3).reverse().map((card, index) => {
                      const stackPos = Math.min(deck.length - 1, 2) - index
                      return (
                        <SwipeCard
                          key={card.id}
                          card={card}
                          onSwipe={handleSwipe}
                          zIndex={index + 10}
                          isTop={stackPos === 0}
                          stackOffset={stackPos}
                        />
                      )
                    })
                  )}
                </div>

                {doneCount === 0 && deck.length > 0 && (
                  <div className="flex items-center gap-6 mb-4 text-[11px] text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" /></svg>
                      </div>
                      Skip
                    </div>
                    <span>Tap to flip</span>
                    <div className="flex items-center gap-1.5">
                      Know it
                      <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="#22c55e" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </div>
                    </div>
                  </div>
                )}

                {deck.length > 0 && (
                  <div className="flex items-center gap-7">
                    <button onClick={() => handleAction('left')} className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform">
                      <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center transition-all group-hover:bg-red-50" style={{ border: '2px solid #FCA5A5', boxShadow: '0 4px 16px rgba(239,68,68,0.15)' }}>
                        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                          <path d="M5 5l12 12M17 5L5 17" stroke="#ef4444" strokeWidth="2.4" strokeLinecap="round" />
                        </svg>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#ef4444' }}>Skip</span>
                    </button>

                    <button className="flex flex-col items-center gap-1.5 group">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center group-hover:bg-zinc-50 transition-all" style={{ border: '1.5px solid #E4E4E7', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                          <path d="M2 7.5a5.5 5.5 0 1 0 5.5-5.5" stroke="#a1a1aa" strokeWidth="1.3" strokeLinecap="round" />
                          <path d="M2 7.5L4 5M2 7.5L4 10" stroke="#a1a1aa" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <span style={{ fontSize: 10, color: '#a1a1aa' }}>Flip on card</span>
                    </button>

                    <button onClick={() => handleAction('right')} className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform">
                      <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center transition-all group-hover:bg-emerald-50" style={{ border: '2px solid #86EFAC', boxShadow: '0 4px 16px rgba(34,197,94,0.15)' }}>
                        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                          <path d="M4 11.5L9 16.5L18 6" stroke="#22c55e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#22c55e' }}>Know it</span>
                    </button>
                  </div>
                )}

                <div style={{ marginTop: 14, fontSize: 10, color: '#d4d4d8', display: 'flex', gap: 16 }}>
                  <span>← Skip</span>
                  <span>Tap = Flip</span>
                  <span>→ Know it</span>
                </div>
              </>
            )}
          </>
        )}
      </div>
      {showLoader && <AppLoader overlay subtitle={loaderSubtitle} />}
    </div>
  )
}
