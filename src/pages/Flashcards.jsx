import { useEffect, useRef, useState } from 'react'
import TopBar from '../components/TopBar'
import { useT } from '../i18n'
import { quizApi } from '../lib/api'

const FLASHCARD_COUNT = 50
const TAP_THRESHOLD = 10
const SWIPE_THRESHOLD = 110
const SWIPE_EXIT_DISTANCE = 520
const SWIPE_DURATION_MS = 220

function normalizeCards(cards = []) {
  return cards.map((card, index) => ({
    id: `${card?.topic || 'card'}-${index}`,
    front: card?.front || card?.question || `Flashcard ${index + 1}`,
    back: card?.back || card?.explanation || card?.options?.[0] || 'Answer unavailable',
    topic: card?.topic || 'General',
  }))
}

export default function Flashcards({ documents, activeDocument, setSelectedDocumentId }) {
  const { t } = useT()
  const [deck, setDeck] = useState(null)
  const [cards, setCards] = useState([])
  const [cardIndex, setCardIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [dragX, setDragX] = useState(0)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const swipeTimeoutRef = useRef(null)
  const dragStateRef = useRef(null)

  const activeDocumentId = activeDocument?.id || null
  const activeDocumentIsPdf = activeDocument?.mime_type === 'application/pdf'
  const currentCard = cards[cardIndex] || null
  const nextCard = cards[cardIndex + 1] || null
  const progressPct = cards.length ? Math.round(((cardIndex + 1) / cards.length) * 100) : 0
  const swipeRotation = dragX / 18
  const nextCardScale = 0.96 + Math.min(Math.abs(dragX) / 1600, 0.03)
  const nextCardTranslate = Math.max(18 - Math.abs(dragX) / 12, 6)

  function clearSwipeTimeout() {
    if (swipeTimeoutRef.current) {
      clearTimeout(swipeTimeoutRef.current)
      swipeTimeoutRef.current = null
    }
  }

  function resetCardMotion() {
    clearSwipeTimeout()
    dragStateRef.current = null
    setDragX(0)
    setDragY(0)
    setIsDragging(false)
  }

  function clearDeckState({ keepError = false } = {}) {
    resetCardMotion()
    setDeck(null)
    setCards([])
    setCardIndex(0)
    setRevealed(false)
    setPending(false)
    if (!keepError) {
      setError('')
    }
  }

  function applyReadyDeck(result) {
    const nextDeck = result?.quiz || null
    const nextCards = normalizeCards(result?.questions || nextDeck?.questions || [])

    resetCardMotion()
    setDeck(nextDeck)
    setCards(nextCards)
    setCardIndex(0)
    setRevealed(false)
    setPending(false)
    setError('')
  }

  async function loadLatestDeck(documentId, options = {}) {
    const { silent = false } = options

    if (!documentId) return

    if (!silent) {
      setLoading(true)
    }

    try {
      const result = await quizApi.getLatest(documentId, { type: 'flashcard' })
      const status = result?.status || result?.quiz?.status || 'missing'

      if (status === 'ready' && (result?.questions?.length || result?.quiz?.questions?.length)) {
        applyReadyDeck(result)
        return
      }

      clearDeckState({ keepError: true })
      setDeck(result?.quiz || null)

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
    } catch (deckError) {
      if (!silent) {
        setError(deckError.message || t('errors.generic'))
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  async function generateDeck() {
    if (!activeDocument) return

    if (!activeDocumentIsPdf) {
      clearDeckState({ keepError: true })
      setError(t('flashcards.pdfOnly'))
      return
    }

    setLoading(true)
    clearDeckState({ keepError: true })
    setError('')

    try {
      const result = await quizApi.generate(activeDocument.id, {
        count: FLASHCARD_COUNT,
        type: 'flashcard',
      })

      if ((result?.status || result?.quiz?.status) === 'pending') {
        setDeck(result.quiz || null)
        setPending(true)
      } else {
        applyReadyDeck(result)
      }
    } catch (deckError) {
      setError(deckError.message || t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  function goToCard(nextIndex) {
    if (nextIndex < 0 || nextIndex >= cards.length) return
    resetCardMotion()
    setCardIndex(nextIndex)
    setRevealed(false)
  }

  function completeSwipe(direction) {
    if (!currentCard || cardIndex + 1 >= cards.length) {
      resetCardMotion()
      return
    }

    clearSwipeTimeout()
    setIsDragging(false)
    setDragX(direction * SWIPE_EXIT_DISTANCE)
    setDragY(8)

    swipeTimeoutRef.current = setTimeout(() => {
      setCardIndex((current) => current + 1)
      setRevealed(false)
      setDragX(0)
      setDragY(0)
      setIsDragging(false)
      swipeTimeoutRef.current = null
    }, SWIPE_DURATION_MS)
  }

  function handlePointerDown(event) {
    if (!currentCard) return

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    }

    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function handlePointerMove(event) {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    const dx = event.clientX - dragState.startX
    const dy = event.clientY - dragState.startY

    setIsDragging(true)
    setDragX(dx)
    setDragY(dy * 0.12)
  }

  function handlePointerUp(event) {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    const dx = event.clientX - dragState.startX
    const dy = event.clientY - dragState.startY
    dragStateRef.current = null

    if (Math.abs(dx) < TAP_THRESHOLD && Math.abs(dy) < TAP_THRESHOLD) {
      setIsDragging(false)
      setDragX(0)
      setDragY(0)
      setRevealed((current) => !current)
      return
    }

    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      completeSwipe(dx >= 0 ? 1 : -1)
      return
    }

    resetCardMotion()
  }

  function handlePointerCancel() {
    resetCardMotion()
  }

  useEffect(() => {
    clearDeckState()

    if (!activeDocumentId || !activeDocumentIsPdf) {
      if (activeDocument && !activeDocumentIsPdf) {
        setError(t('flashcards.pdfOnly'))
      }
      return
    }

    void loadLatestDeck(activeDocumentId)
  }, [activeDocumentId, activeDocument?.mime_type])

  useEffect(() => {
    if (!pending || !activeDocumentId) return

    const intervalId = setInterval(() => {
      void loadLatestDeck(activeDocumentId, { silent: true })
    }, 5000)

    return () => clearInterval(intervalId)
  }, [pending, activeDocumentId])

  useEffect(() => () => {
    clearSwipeTimeout()
  }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TopBar
        title={activeDocument ? `${t('flashcards.title')} — ${activeDocument.title}` : t('flashcards.title')}
        subtitle={activeDocument ? t('flashcards.subtitle') : t('flashcards.selectDocument')}
        action={(
          <button
            onClick={pending ? () => loadLatestDeck(activeDocumentId) : generateDeck}
            disabled={!activeDocument || loading || (!activeDocumentIsPdf && !pending)}
            className="text-xs px-3.5 py-2 border border-zinc-200 rounded-lg text-zinc-500 hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            {loading ? t('common.loading') : pending ? t('flashcards.checkStatus') : t('flashcards.generate')}
          </button>
        )}
      />
      <div className="flex-1 overflow-y-auto px-8 py-7 max-w-4xl w-full mx-auto">
        {!!documents.length && (
          <div className="flex flex-wrap gap-2 mb-6">
            {documents.map((document) => (
              <button
                key={document.id}
                onClick={() => setSelectedDocumentId(document.id)}
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

        {deck?.source === 'auto_upload' && deck?.requested_count === FLASHCARD_COUNT && !pending && !error && (
          <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50/70 px-4 py-3 text-sm text-violet-700">
            {t('flashcards.autoGenerated')}
          </div>
        )}

        {!documents.length ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
            {t('flashcards.noDocuments')}
          </div>
        ) : !activeDocumentIsPdf ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
            {t('flashcards.pdfOnly')}
          </div>
        ) : loading && !pending && !cards.length ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
            {t('common.loading')}
          </div>
        ) : pending ? (
          <div className="rounded-2xl border border-violet-100 bg-white px-6 py-10 text-center">
            <div className="w-11 h-11 rounded-full border-4 border-violet-100 border-t-violet-500 animate-spin mx-auto mb-4" />
            <div className="text-base font-medium text-zinc-800 mb-2">{t('flashcards.preparing')}</div>
            <p className="text-sm text-zinc-500 leading-relaxed mb-5">
              {t('flashcards.preparingSub')}
            </p>
            <button
              onClick={() => loadLatestDeck(activeDocumentId)}
              className="px-4 py-2 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-700 transition-colors"
            >
              {t('flashcards.refreshNow')}
            </button>
          </div>
        ) : !cards.length ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
            {t('flashcards.empty')}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="text-xs text-zinc-400 shrink-0">{t('flashcards.card', { current: cardIndex + 1, total: cards.length })}</span>
              <div className="flex-1 h-1 bg-zinc-100 rounded-full overflow-hidden min-w-[180px]">
                <div className="h-full bg-violet-500 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-100 shrink-0">
                {currentCard?.topic || 'General'}
              </span>
            </div>

            <div className="mb-4 rounded-2xl border border-zinc-100 bg-white/80 px-4 py-3 text-sm text-zinc-500">
              {t('flashcards.swipeHint')}
            </div>

            <div className="relative h-[520px] mb-5 select-none" style={{ perspective: '1600px' }}>
              <div className="absolute inset-x-7 top-6 bottom-0 rounded-[28px] bg-gradient-to-br from-zinc-100 to-zinc-200/80" />

              {nextCard && (
                <div
                  className="absolute inset-x-4 top-3 bottom-0 rounded-[28px] border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-sky-50 shadow-sm overflow-hidden"
                  style={{
                    transform: `translateY(${nextCardTranslate}px) scale(${nextCardScale})`,
                    transition: 'transform 220ms ease',
                  }}
                >
                  <div className="p-6 h-full flex flex-col">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-violet-500">{t('flashcards.upNext')}</span>
                      <span className="text-[10px] px-2.5 py-1 rounded-full bg-white text-violet-600 border border-violet-100">{nextCard.topic}</span>
                    </div>
                    <div className="flex-1 flex items-center">
                      <p className="text-xl font-display font-semibold text-zinc-700 leading-relaxed overflow-hidden">
                        {nextCard.front}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div
                className="absolute inset-0"
                style={{
                  transform: `translate3d(${dragX}px, ${dragY}px, 0) rotate(${swipeRotation}deg)`,
                  transition: isDragging ? 'none' : `transform ${SWIPE_DURATION_MS}ms ease`,
                }}
              >
                <button
                  type="button"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerCancel}
                  className="relative w-full h-full rounded-[32px] text-left bg-transparent border-0 p-0 cursor-grab active:cursor-grabbing focus:outline-none"
                  style={{ touchAction: 'none' }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      transform: revealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      transformStyle: 'preserve-3d',
                      transition: isDragging ? 'none' : 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  >
                    <div
                      className="absolute inset-0 rounded-[32px] border border-violet-100 bg-gradient-to-br from-white via-violet-50/70 to-sky-50 shadow-[0_24px_60px_-30px_rgba(139,92,246,0.45)] overflow-hidden"
                      style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                    >
                      <div className="p-7 h-full flex flex-col">
                        <div className="flex items-center justify-between gap-3 mb-6">
                          <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-violet-500">{t('flashcards.front')}</span>
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-white text-violet-600 border border-violet-100">{currentCard?.topic || 'General'}</span>
                        </div>

                        <div className="flex-1 flex items-center">
                          <p className="text-[clamp(1.6rem,2.6vw,2.55rem)] font-display font-semibold text-zinc-900 leading-[1.15]">
                            {currentCard?.front}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-6 border-t border-violet-100/80 text-sm">
                          <span className="text-zinc-500">{t('flashcards.tapToFlip')}</span>
                          <span className="text-violet-600">{t('flashcards.swipeToStudy')}</span>
                        </div>
                      </div>
                    </div>

                    <div
                      className="absolute inset-0 rounded-[32px] border border-zinc-900 bg-zinc-900 shadow-[0_24px_60px_-30px_rgba(24,24,27,0.65)] overflow-hidden"
                      style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                      }}
                    >
                      <div className="p-7 h-full flex flex-col">
                        <div className="flex items-center justify-between gap-3 mb-6">
                          <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-zinc-400">{t('flashcards.back')}</span>
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-zinc-200 border border-white/10">{currentCard?.topic || 'General'}</span>
                        </div>

                        <div className="flex-1 flex items-center">
                          <p className="text-[clamp(1.1rem,2vw,1.45rem)] text-white leading-relaxed">
                            {currentCard?.back}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-6 border-t border-white/10 text-sm">
                          <span className="text-zinc-400">{t('flashcards.tapToFlipBack')}</span>
                          <span className="text-sky-300">{t('flashcards.swipeToStudy')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="bg-white border border-zinc-100 rounded-2xl px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => goToCard(cardIndex - 1)}
                  disabled={cardIndex === 0}
                  className="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
                >
                  {t('flashcards.previous')}
                </button>

                <button
                  onClick={() => setRevealed((current) => !current)}
                  className="px-5 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-500 transition-colors"
                >
                  {revealed ? t('flashcards.hideAnswer') : t('flashcards.revealAnswer')}
                </button>

                <button
                  onClick={() => goToCard(cardIndex + 1)}
                  disabled={cardIndex + 1 >= cards.length}
                  className="px-4 py-2 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  {t('flashcards.next')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
