import { useState, useEffect, useRef } from 'react'
import AppLoader from '../components/AppLoader'
import TopBar from '../components/TopBar'
import { mockTestApi } from '../lib/api'
import { useResolvedStudyTopic } from '../lib/studyStage'

const TYPE_LABEL = {
  short_answer: 'Short Answer',
  long_answer:  'Long Answer',
  numerical:    'Numerical / Maths',
  fill_blank:   'Fill in the Blank',
}
const SECTION_STYLE = {
  'Section A': { bg: 'rgba(255,118,105,0.12)', text: '#ffd2cc', border: 'rgba(255,118,105,0.24)' },
  'Section B': { bg: 'rgba(16,185,129,0.12)', text: '#bbf7d0', border: 'rgba(52,211,153,0.24)' },
  'Section C': { bg: 'rgba(245,158,11,0.12)', text: '#fde68a', border: 'rgba(251,191,36,0.24)' },
}

function fmtTime(s) {
  const h  = Math.floor(s / 3600)
  const m  = Math.floor((s % 3600) / 60)
  const sc = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`
}

function fmtDuration(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? (s > 0 ? `${m}m ${s}s` : `${m}m`) : `${s}s`
}

// ── Countdown timer ───────────────────────────────────────────────────
function useCountdown(totalSecs, onExpire) {
  const [left, setLeft] = useState(totalSecs)
  const expired         = useRef(false)
  useEffect(() => {
    if (left <= 0 && !expired.current) { expired.current = true; onExpire?.(); return }
    const id = setTimeout(() => setLeft(l => l - 1), 1000)
    return () => clearTimeout(id)
  }, [left])
  return { left, elapsed: totalSecs - left, formatted: fmtTime(left), isLow: left < 300 }
}

// ════════════════════════════════════════════════════════════════════
// PHASE 1 — Setup (with past tests + resume)
// ════════════════════════════════════════════════════════════════════
function SetupPhase({ documents, activeDocument, setSelectedDocumentId, studyFocus, onGenerate, onResume, loading, error }) {
  const [docId, setDocId] = useState(activeDocument?.mime_type === 'application/pdf' ? activeDocument.id : documents[0]?.id || '')
  const [pastTests, setPastTests]   = useState([])
  const [loadingList, setLoadingList] = useState(false)

  const pdfs        = documents.filter(d => d.mime_type === 'application/pdf')
  const selectedDoc = pdfs.find(d => d.id === docId)
  const {
    focusTopic,
    stageDayNumber,
    isRoadmapFocus,
  } = useResolvedStudyTopic({
    document: selectedDoc || null,
    studyFocus,
  })

  useEffect(() => {
    if (activeDocument?.mime_type === 'application/pdf' && (!docId || !pdfs.some((doc) => doc.id === docId))) {
      setDocId(activeDocument.id)
      return
    }

    if (!pdfs.some((doc) => doc.id === docId)) {
      setDocId(pdfs[0]?.id || '')
    }
  }, [activeDocument?.id, activeDocument?.mime_type, docId, pdfs])

  // Load past tests
  useEffect(() => {
    async function load() {
      setLoadingList(true)
      try {
        const data = await mockTestApi.list()
        setPastTests(data.mockTests || [])
      } catch {}
      finally { setLoadingList(false) }
    }
    load()
  }, [])

  const existingTest = pastTests.find((test) => (
    test.documentId === docId
    && (test.focusTopic || '') === (focusTopic || '')
    && (Number(test.stageDayNumber) || null) === (Number(stageDayNumber) || null)
  )) || null

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">
      <div className="max-w-xl mx-auto">
        {error && (
          <div className="mb-5 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
        )}

        {pdfs.length === 0 ? (
          <div className="pp-app-card rounded-2xl text-center py-10 px-6 text-[var(--pp-text-soft)]">
            <div className="text-3xl mb-2">📂</div>
            <p className="text-sm">No PDF documents uploaded yet. Upload one to begin.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">

            {/* Document selector */}
            <div className="pp-app-card rounded-2xl p-5">
              <div className="text-[10px] font-semibold uppercase tracking-widest pp-app-muted mb-3">Select Document</div>
              <div className="flex flex-col gap-2">
                {pdfs.map(doc => (
                  <label key={doc.id}
                    className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                    style={docId === doc.id
                      ? { background: 'rgba(255,118,105,0.12)', borderColor: 'rgba(255,118,105,0.24)' }
                      : { background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(130,147,183,0.16)' }}>
                    <input type="radio" name="doc" value={doc.id} checked={docId === doc.id}
                      onChange={() => {
                        setDocId(doc.id)
                        setSelectedDocumentId?.(doc.id)
                      }} className="accent-violet-600" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">{doc.title}</div>
                      <div className="text-xs pp-app-muted">{doc.subject || 'General'}{doc.total_pages ? ` · ${doc.total_pages} pages` : ''}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {selectedDoc && (
              <div className="border border-[rgba(255,118,105,0.18)] bg-[linear-gradient(135deg,rgba(255,118,105,0.14),rgba(102,247,226,0.06))] rounded-2xl px-5 py-4 flex flex-wrap gap-5 text-sm">
                {[
                  { k: 'Document', v: selectedDoc.title },
                  { k: 'Topic', v: isRoadmapFocus && stageDayNumber ? `Day ${stageDayNumber} · ${focusTopic}` : focusTopic || 'Current roadmap topic' },
                  { k: 'Duration', v: '1 hr' },
                  { k: 'Questions', v: 'Up to 15' },
                ].map(i => (
                  <div key={i.k}>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--pp-coral)] font-medium mb-0.5">{i.k}</div>
                    <div className="font-medium text-white max-w-[160px] truncate">{i.v}</div>
                  </div>
                ))}
              </div>
            )}

            {existingTest && (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-5">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-300 mb-3">Existing Mock Test</div>
                <div className="flex items-center justify-between gap-3 bg-white/5 border border-amber-400/20 rounded-xl px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{existingTest.title}</div>
                    <div className="text-xs pp-app-muted">
                      {existingTest.durationMinutes} min · {existingTest.totalMarks} marks · {existingTest.questionCount} questions
                    </div>
                  </div>
                  <button
                    onClick={() => onResume(existingTest.id)}
                    className="text-xs px-3 py-2 rounded-lg font-semibold text-white shrink-0 transition-all hover:opacity-85"
                    style={{ background: '#f59e0b' }}
                  >
                    {existingTest.attemptCount > 0 ? 'Open Test →' : 'Resume →'}
                  </button>
                </div>
                <div className="mt-3 text-xs text-amber-200">
                  This topic-stage mock test is already ready. We&apos;ll reopen the same paper for this roadmap stage instead of generating a duplicate.
                </div>
              </div>
            )}

            <button
              onClick={() => onGenerate({ documentId: docId, focusTopic, stageDayNumber })}
              disabled={loading || loadingList || !docId || Boolean(existingTest)}
              className="w-full py-4 rounded-2xl text-white font-semibold text-base transition-all disabled:opacity-50 pp-app-button-primary"
              style={loading ? { opacity: 0.7 } : undefined}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="40" strokeLinecap="round"/>
                  </svg>
                  Generating question paper…
                </span>
              ) : loadingList ? 'Checking existing mock tests…' : existingTest ? 'Mock test already created for this stage' : 'Generate Topic Mock Test'}
            </button>

          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// PHASE 2 — Exam (with incomplete indicator)
// ════════════════════════════════════════════════════════════════════
function ExamPhase({ mockTest, questions, onSubmit, submitting }) {
  const [answers,     setAnswers]     = useState({})
  const [activeQ,     setActiveQ]     = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const textareaRef = useRef(null)

  const { left, elapsed, formatted, isLow } = useCountdown(
    mockTest.durationMinutes * 60,
    () => setShowConfirm(true)
  )

  useEffect(() => { textareaRef.current?.focus() }, [activeQ])

  const answeredCount   = Object.values(answers).filter(a => a?.trim()).length
  const unansweredCount = questions.length - answeredCount
  const q               = questions[activeQ]
  const secStyle        = SECTION_STYLE[q?.section] || { bg: 'rgba(255,255,255,0.06)', text: '#cbd5e1', border: 'rgba(130,147,183,0.18)' }
  const sections        = [...new Set(questions.map(q => q.section || 'General'))]

  function handleSubmit() {
    const arr = questions.map((_, i) => ({ questionIndex: i, answer: answers[i] || '' }))
    onSubmit(arr, elapsed)
    setShowConfirm(false)
  }

  return (
    <div className="relative flex flex-col flex-1 min-h-0">

      {/* Timer + submit bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b pp-app-border bg-[rgba(8,14,26,0.88)] shrink-0 gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: isLow ? '#ef4444' : '#22c55e' }} />
          <span className="font-mono font-bold text-sm" style={{ color: isLow ? '#ef4444' : '#edf2ff' }}>{formatted}</span>
          <span className="text-xs pp-app-muted hidden sm:inline">remaining</span>
        </div>

        {/* Answered progress bar */}
        <div className="flex-1 hidden sm:flex items-center gap-2 max-w-xs">
          <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(answeredCount / questions.length) * 100}%`, background: '#ff7669' }} />
          </div>
          <span className="text-xs pp-app-muted shrink-0">{answeredCount}/{questions.length}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Unanswered warning */}
          {unansweredCount > 0 && (
            <span className="text-xs text-amber-300 bg-amber-500/10 border border-amber-400/20 px-2 py-1 rounded-lg hidden sm:block">
              {unansweredCount} unanswered
            </span>
          )}
          <button onClick={() => setShowConfirm(true)} disabled={submitting}
            className="text-xs px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-50 transition-all"
            style={{ background: '#ff7669' }}>
            {submitting ? 'Submitting…' : 'Submit Exam'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* Question nav sidebar */}
        <div className="hidden md:flex flex-col w-48 shrink-0 border-r pp-app-border overflow-y-auto py-3 bg-white/5">
          {sections.map(sec => (
            <div key={sec}>
              <div className="px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest pp-app-muted">{sec}</div>
              {questions.map((qq, i) => {
                if ((qq.section || 'General') !== sec) return null
                const done = answers[i]?.trim()
                return (
                  <button key={i} onClick={() => setActiveQ(i)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-all border-l-2"
                    style={activeQ === i
                      ? { borderColor: '#ff7669', background: 'rgba(255,118,105,0.12)', color: '#edf2ff', fontWeight: 600 }
                      : { borderColor: 'transparent', color: '#9eabc7' }}>
                    <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={done
                        ? { background: 'rgba(34,197,94,0.12)', color: '#86efac' }
                        : { background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }
                      }>
                      {done ? '✓' : i + 1}
                    </div>
                    <span className="truncate flex-1">{TYPE_LABEL[qq.type]?.split(' ')[0]}</span>
                    <span className="shrink-0 text-[10px] pp-app-muted">{qq.marks}m</span>
                  </button>
                )
              })}
            </div>
          ))}

          {/* Legend */}
          <div className="px-4 pt-4 pb-2 border-t pp-app-border mt-2">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-4 h-4 rounded text-[8px] flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)', color: '#86efac' }}>✓</div>
              <span className="text-[10px] pp-app-muted">Answered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded text-[8px] flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>·</div>
              <span className="text-[10px] pp-app-muted">Not answered</span>
            </div>
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
          <div className="max-w-2xl mx-auto">

            {/* Question meta */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs px-2.5 py-1 rounded-full font-medium border"
                style={{ background: secStyle.bg, color: secStyle.text, borderColor: secStyle.border }}>
                {q?.section || 'General'}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-[var(--pp-text-soft)] font-medium border pp-app-border">
                {TYPE_LABEL[q?.type] || 'Question'}
              </span>
              {!answers[activeQ]?.trim() && (
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                  Not answered yet
                </span>
              )}
              <span className="text-xs px-2.5 py-1 rounded-full border border-[rgba(255,118,105,0.2)] bg-[rgba(255,118,105,0.1)] text-white font-semibold ml-auto">
                {q?.marks} {q?.marks === 1 ? 'mark' : 'marks'}
              </span>
            </div>

            {/* Question */}
            <div className="pp-app-card rounded-2xl p-5 mb-5">
              <div className="text-[10px] uppercase tracking-widest pp-app-muted font-medium mb-2">
                Question {activeQ + 1} of {questions.length}
              </div>
              <p className="text-base font-semibold text-white leading-relaxed"
                style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '-0.01em' }}>
                {q?.question}
              </p>
              {q?.hint && (
                <div className="mt-3 text-xs bg-amber-500/10 border border-amber-400/20 text-amber-200 rounded-lg px-3 py-2">
                  💡 {q.hint}
                </div>
              )}
              {q?.type === 'numerical' && (
                <div className="mt-3 text-xs bg-cyan-500/10 border border-cyan-400/20 text-cyan-200 rounded-lg px-3 py-2">
                  📐 Show all your working step by step
                </div>
              )}
              <div className="mt-2 text-xs pp-app-muted">Expected: {q?.expectedLength || 'appropriate length'}</div>
            </div>

            {/* Answer textarea */}
            <div className="mb-5">
              <div className="text-[10px] uppercase tracking-widest pp-app-muted font-medium mb-2">Your Answer</div>
              <textarea
                ref={textareaRef}
                value={answers[activeQ] || ''}
                onChange={e => setAnswers(prev => ({ ...prev, [activeQ]: e.target.value }))}
                placeholder={
                  q?.type === 'fill_blank'   ? 'Write the missing word or phrase…' :
                  q?.type === 'numerical'    ? 'Step 1:\nStep 2:\n...\nFinal Answer:' :
                  q?.type === 'short_answer' ? 'Write your answer in 2-3 sentences…' :
                  'Write your detailed answer here…'
                }
                rows={q?.type === 'long_answer' ? 12 : q?.type === 'numerical' ? 10 : 4}
                className="w-full border pp-app-input rounded-xl px-4 py-3 text-sm outline-none resize-y leading-relaxed transition-colors"
                style={{ minHeight: q?.type === 'long_answer' ? 240 : 100 }}
                onFocus={e  => e.target.style.borderColor = 'rgba(102,247,226,0.38)'}
                onBlur={e   => e.target.style.borderColor = 'rgba(130,147,183,0.22)'}
              />
              <div className="flex justify-between mt-1 text-xs pp-app-muted">
                <span>{(answers[activeQ] || '').length} chars</span>
                {answers[activeQ]?.trim()
                  ? <span className="text-emerald-500 font-medium">✓ Answered</span>
                  : <span className="text-amber-500 font-medium">⚠ Not answered</span>
                }
              </div>
            </div>

            {/* Prev / Next */}
            <div className="flex gap-3">
              <button onClick={() => setActiveQ(i => Math.max(0, i - 1))} disabled={activeQ === 0}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border pp-app-border text-[var(--pp-text-soft)] hover:bg-white/5 disabled:opacity-40 transition-all">
                ← Prev
              </button>
              {activeQ < questions.length - 1 ? (
                <button onClick={() => setActiveQ(i => i + 1)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all pp-app-button-primary">
                  Next →
                </button>
              ) : (
                <button onClick={() => setShowConfirm(true)} disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                  style={{ background: '#ff7669' }}>
                  Finish & Submit
                </button>
              )}
            </div>

            {/* Mobile quick-nav */}
            <div className="flex flex-wrap gap-1.5 mt-5 md:hidden pt-4 border-t pp-app-border">
              {questions.map((_, i) => (
                <button key={i} onClick={() => setActiveQ(i)}
                  className="w-8 h-8 rounded-lg text-xs font-bold transition-all"
                  style={activeQ === i
                    ? { background: '#ff7669', color: '#fff' }
                    : answers[i]?.trim()
                      ? { background: 'rgba(34,197,94,0.12)', color: '#86efac', border: '1px solid rgba(52,211,153,0.2)' }
                      : { background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }
                  }>{i + 1}</button>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* Submit confirm */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="pp-app-card rounded-2xl shadow-2xl p-7 max-w-sm w-full">
            <div className="text-center mb-6">
              <div className="text-3xl mb-3">{left <= 0 ? '⏰' : unansweredCount === 0 ? '✅' : '⚠️'}</div>
              <div className="font-semibold text-white text-lg mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                {left <= 0 ? 'Time is up!' : 'Submit your exam?'}
              </div>
              <p className="text-sm pp-app-subtle">
                {left <= 0
                  ? 'Time expired. Your answers will be submitted now.'
                  : unansweredCount > 0
                    ? `${unansweredCount} question${unansweredCount > 1 ? 's' : ''} not answered. Submit anyway?`
                    : 'All questions answered. Ready to submit!'
                }
              </p>
              {unansweredCount > 0 && left > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                  {questions.map((_, i) => !answers[i]?.trim() && (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-md font-medium"
                      style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                      Q{i + 1}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              {left > 0 && (
                <button onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border pp-app-border text-sm text-[var(--pp-text-soft)] hover:bg-white/5 transition-all">
                  Keep going
                </button>
              )}
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                style={{ background: '#ff7669' }}>
                {submitting ? 'Submitting…' : 'Submit now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// PHASE 3 — Marking
// ════════════════════════════════════════════════════════════════════
function MarkingPhase({ mockTest, markingState, onRefresh, onBack }) {
  const progressTotal = Math.max(Number(markingState?.progressTotal || mockTest?.questionCount || 0), 0)
  const progressDone = Math.min(progressTotal, Math.max(Number(markingState?.progressDone || 0), 0))
  const progressPct = progressTotal > 0 ? Math.round((progressDone / progressTotal) * 100) : 0
  const status = markingState?.status || 'queued'
  const isFailed = status === 'failed'

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8">
      <div className="max-w-xl mx-auto">
        <div className="pp-app-card rounded-3xl p-6 sm:p-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl mx-auto mb-5"
            style={{ background: isFailed ? 'rgba(239,68,68,0.12)' : 'rgba(255,118,105,0.12)', color: isFailed ? '#fca5a5' : '#ff9d93' }}>
            <div className={`w-7 h-7 rounded-full border-[3px] ${isFailed ? 'border-red-400/30' : 'border-[rgba(255,118,105,0.28)]'} border-t-current ${isFailed ? '' : 'animate-spin'}`} />
          </div>
          <div className="text-center mb-6">
            <div className="text-[10px] uppercase tracking-[0.24em] pp-app-muted font-semibold mb-2">
              {isFailed ? 'Marking Paused' : status === 'processing' ? 'AI Marking In Progress' : 'Queued For Marking'}
            </div>
            <div className="text-2xl font-semibold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
              {isFailed ? 'We hit a delay while marking your paper' : 'Your paper is being evaluated'}
            </div>
            <p className="text-sm pp-app-subtle leading-relaxed">
              {isFailed
                ? (markingState?.errorMessage || 'Please check again in a moment. Your submission is still saved.')
                : 'You can stay on this screen while we grade each answer in the background and prepare your full breakdown.'}
            </p>
          </div>

          <div className="rounded-2xl border pp-app-border bg-white/5 px-4 py-4 mb-5">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium text-white">Progress</span>
              <span className="pp-app-subtle">{progressDone}/{progressTotal || '0'} questions</span>
            </div>
            <div className="h-2.5 bg-white/8 rounded-full overflow-hidden border pp-app-border">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, background: isFailed ? '#F97316' : '#ff7669' }} />
            </div>
            <div className="mt-2 text-xs pp-app-muted">
              {isFailed ? 'Marking stopped before completion.' : `${progressPct}% complete`}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <div className="rounded-2xl border pp-app-border bg-white/5 px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest pp-app-muted font-medium mb-1">Paper</div>
              <div className="text-sm font-medium text-white truncate">{mockTest?.title || 'Mock Test'}</div>
            </div>
            <div className="rounded-2xl border pp-app-border bg-white/5 px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest pp-app-muted font-medium mb-1">Status</div>
              <div className="text-sm font-medium text-white capitalize">{status}</div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={onRefresh}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all pp-app-button-primary">
              Check progress
            </button>
            <button onClick={onBack}
              className="flex-1 py-3 rounded-xl text-sm font-medium border pp-app-border text-[var(--pp-text-soft)] hover:bg-white/5 transition-all">
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// PHASE 4 — Results
// ════════════════════════════════════════════════════════════════════
function ResultsPhase({ result, onRetry, onBack, onPracticeTopic, onReviewTopic }) {
  const [tab,       setTab]       = useState('overview')
  const [expandedQ, setExpandedQ] = useState(null)

  const ringCircum = 2 * Math.PI * 42

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
      <div className="max-w-2xl mx-auto">

        {/* Score card */}
        <div className="pp-app-card rounded-2xl p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative shrink-0" style={{ width: 110, height: 110 }}>
              <svg width="110" height="110" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(130,147,183,0.2)" strokeWidth="9"/>
                <circle cx="50" cy="50" r="42" fill="none"
                  stroke={result.gradeColor} strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={ringCircum}
                  strokeDashoffset={ringCircum * (1 - Math.min(result.percentage, 100) / 100)}
                  style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-bold text-xl" style={{ color: result.gradeColor, fontFamily: 'Syne, sans-serif' }}>{result.grade}</div>
                <div className="text-xs pp-app-muted">{result.percentage}%</div>
              </div>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: result.gradeColor }}>
                {result.marksObtained}/{result.totalMarks}
              </div>
              <div className="pp-app-subtle text-sm">{result.gradeLabel}</div>
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t pp-app-border">
                {[
                  { k: 'Correct',  v: `${result.correctCount}/${result.questionsCount}` },
                  { k: 'Time',     v: fmtDuration(result.timeTakenSecs) },
                  { k: 'Subject',  v: result.subject || 'General' },
                ].map(s => (
                  <div key={s.k} className="text-center">
                    <div className="text-[10px] uppercase tracking-widest pp-app-muted font-medium mb-0.5">{s.k}</div>
                    <div className="text-xs font-semibold text-white truncate">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b pp-app-border mb-5">
          {[{ id: 'overview', label: '📊 Overview' }, { id: 'answers', label: '📝 All Answers' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${tab === t.id ? 'border-[var(--pp-coral)] text-white' : 'border-transparent text-[var(--pp-text-soft)] hover:text-white'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="flex flex-col gap-4">
            <div className="pp-app-card rounded-2xl p-5">
              <div className="text-[10px] font-semibold uppercase tracking-widest pp-app-muted mb-4">Section Breakdown</div>
              <div className="flex flex-col gap-3">
                {result.sectionBreakdown.map(s => (
                  <div key={s.section}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium text-white">{s.section}</span>
                      <span className="pp-app-subtle">{s.marks}/{s.maxMarks} · {s.percentage}%</span>
                    </div>
                    <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${s.percentage}%`, background: s.percentage >= 60 ? '#22c55e' : s.percentage >= 40 ? '#f59e0b' : '#ef4444' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {result.weakTopics?.length > 0 && (
              <div className="bg-red-500/10 border border-red-400/20 rounded-2xl p-5">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-red-300 mb-3">📉 Needs Revision</div>
                <div className="flex flex-wrap gap-2">
                  {result.weakTopics.map(t => (
                    <span key={t.topic} className="text-xs px-3 py-1.5 bg-white/5 border border-red-400/20 text-red-300 rounded-full font-medium">
                      {t.topic} ({t.percentage}%)
                    </span>
                  ))}
                </div>
                {!!result.weakTopics[0]?.topic && (
                  <div className="flex flex-wrap gap-3 mt-4">
                    <button
                      onClick={() => onPracticeTopic?.(result.weakTopics[0].topic)}
                      className="px-4 py-2 rounded-lg text-white text-sm transition-colors pp-app-button-primary"
                    >
                      Focused quiz on {result.weakTopics[0].topic}
                    </button>
                    <button
                      onClick={() => onReviewTopic?.(result.weakTopics[0].topic)}
                      className="px-4 py-2 rounded-lg border border-red-400/20 bg-white/5 text-red-300 text-sm hover:bg-red-500/10 transition-colors"
                    >
                      Flashcards for {result.weakTopics[0].topic}
                    </button>
                  </div>
                )}
              </div>
            )}
            {result.strongTopics?.length > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-400/20 rounded-2xl p-5">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300 mb-3">💪 Strong Topics</div>
                <div className="flex flex-wrap gap-2">
                  {result.strongTopics.map(t => (
                    <span key={t.topic} className="text-xs px-3 py-1.5 bg-white/5 border border-emerald-400/20 text-emerald-300 rounded-full font-medium">
                      {t.topic} ({t.percentage}%)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'answers' && (
          <div className="flex flex-col gap-3">
            {result.analysis.map((a, i) => (
              <div key={i} className="pp-app-card rounded-2xl overflow-hidden">
                <button onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/5 transition-colors">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={a.isCorrect
                      ? { background: 'rgba(34,197,94,0.12)', color: '#86efac' }
                      : a.marksAwarded > 0
                        ? { background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }
                        : a.studentAnswer?.trim()
                          ? { background: 'rgba(239,68,68,0.12)', color: '#fca5a5' }
                          : { background: 'rgba(255,255,255,0.06)', color: '#9eabc7' }
                    }>
                    {a.marksAwarded > 0 ? '✓' : a.studentAnswer?.trim() ? '✗' : '—'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">Q{a.questionNumber}. {a.question}</div>
                    <div className="text-xs pp-app-muted mt-0.5">
                      {a.section} · {a.topic}
                      {!a.studentAnswer?.trim() && <span className="ml-2 text-amber-500 font-medium">· Not answered</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right ml-2">
                    <div className="text-sm font-bold"
                      style={{ color: a.isCorrect ? '#22c55e' : a.marksAwarded > 0 ? '#f59e0b' : '#ef4444' }}>
                      {a.marksAwarded}/{a.maxMarks}
                    </div>
                    <div className="text-[10px] pp-app-muted">{expandedQ === i ? '▲' : '▼'}</div>
                  </div>
                </button>

                {expandedQ === i && (
                  <div className="px-5 pb-5 border-t pp-app-border pt-4 flex flex-col gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest pp-app-muted font-medium mb-2">Your Answer</div>
                      <div className="text-sm pp-app-subtle bg-white/5 rounded-xl p-3 leading-relaxed whitespace-pre-wrap">
                        {a.studentAnswer?.trim() || <span className="italic pp-app-muted">No answer provided — 0 marks awarded</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest pp-app-muted font-medium mb-2">AI Feedback</div>
                      <div className="text-sm pp-app-subtle leading-relaxed">{a.feedback}</div>
                    </div>
                    {a.keyPointsCovered?.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-emerald-600 font-medium mb-2">✓ Points Covered</div>
                        <ul className="flex flex-col gap-1">
                          {a.keyPointsCovered.map((pt, j) => <li key={j} className="text-xs text-emerald-700 flex gap-2"><span>•</span><span>{pt}</span></li>)}
                        </ul>
                      </div>
                    )}
                    {a.keyPointsMissed?.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-red-500 font-medium mb-2">✗ Points Missed</div>
                        <ul className="flex flex-col gap-1">
                          {a.keyPointsMissed.map((pt, j) => <li key={j} className="text-xs text-red-600 flex gap-2"><span>•</span><span>{pt}</span></li>)}
                        </ul>
                      </div>
                    )}
                    {/* Model answer reveal — shown after submission */}
                    {a.modelAnswer && (
                      <div className="border-t pp-app-border pt-4 mt-2">
                        <div className="text-[10px] uppercase tracking-widest text-[var(--pp-cyan)] font-medium mb-2">📖 Model Answer</div>
                        <div className="text-xs text-[var(--pp-text)] bg-[rgba(102,247,226,0.08)] border border-[rgba(102,247,226,0.18)] rounded-xl p-3 leading-relaxed whitespace-pre-wrap">
                          {a.modelAnswer}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={onRetry}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all pp-app-button-primary">
            Retake Test
          </button>
          <button onClick={onBack}
            className="flex-1 py-3 rounded-xl text-sm font-medium border pp-app-border text-[var(--pp-text-soft)] hover:bg-white/5 transition-all">
            Back to Mock Test
          </button>
        </div>

      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// Main component
// ════════════════════════════════════════════════════════════════════
export default function MockTest({
  onOpenSidebar,
  documents = [],
  activeDocument = null,
  setSelectedDocumentId,
  studyFocus,
  openStudyFocus,
}) {
  const [phase,      setPhase]      = useState('setup')
  const [mockTest,   setMockTest]   = useState(null)
  const [questions,  setQuestions]  = useState([])
  const [result,     setResult]     = useState(null)
  const [submissionId, setSubmissionId] = useState('')
  const [markingState, setMarkingState] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  function startExam(data) {
    setMockTest(data.mockTest)
    setQuestions(data.questions)
    setSubmissionId('')
    setMarkingState(null)
    setResult(null)
    setPhase('exam')
  }

  async function handleGenerate(opts) {
    setGenerating(true); setError('')
    try {
      const data = await mockTestApi.generate(opts.documentId, {
        focusTopic: opts.focusTopic || '',
        stageDayNumber: opts.stageDayNumber || null,
      })
      startExam(data)
    } catch (e) {
      setError(e.message || 'Failed to generate question paper. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleResume(mockTestId) {
    setGenerating(true); setError('')
    try {
      // Fetch the existing test's questions
      const data = await mockTestApi.get(mockTestId)
      startExam(data)
    } catch (e) {
      setError(e.message || 'Failed to load test. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSubmit(answers, timeTakenSecs) {
    setSubmitting(true); setError('')
    try {
      const data = await mockTestApi.submit(mockTest.id, answers, timeTakenSecs)
      setSubmissionId(data.submissionId || '')
      setMarkingState({
        status: data.status || 'queued',
        progressDone: Number(data.progressDone || 0),
        progressTotal: Number(data.progressTotal || questions.length || 0),
        submittedAt: data.submittedAt || null,
      })
      setPhase('marking')
    } catch (e) {
      setError(e.message || 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function refreshSubmissionStatus(targetSubmissionId = submissionId, options = {}) {
    const { silent = false } = options
    if (!targetSubmissionId) return

    try {
      const data = await mockTestApi.getSubmission(targetSubmissionId)
      setMarkingState(data)

      if (data?.status === 'ready' && data?.result) {
        setResult(data.result)
        setError('')
        setPhase('results')
        return
      }

      if (data?.status === 'failed' && !silent) {
        setError(data.errorMessage || 'Auto-marking failed. Please try again.')
      }
    } catch (e) {
      if (!silent) {
        setError(e.message || 'We could not refresh your marking progress. Please try again.')
      }
    }
  }

  useEffect(() => {
    if (phase !== 'marking' || !submissionId) return

    let cancelled = false

    const load = async (silent = false) => {
      if (cancelled) return
      await refreshSubmissionStatus(submissionId, { silent })
    }

    void load(false)
    const intervalId = setInterval(() => {
      void load(true)
    }, 2500)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [phase, submissionId])

  const TITLES = {
    setup:   'Mock Test',
    exam:    mockTest?.title || 'Exam in Progress',
    marking: 'Marking in Progress',
    results: 'Results',
  }
  const SUBTITLES = {
    setup:   'Generate a topic-wise mock test from your current roadmap stage and move to the next one after you finish that stage.',
    exam:    `${questions.length} questions · ${mockTest?.totalMarks} marks · ${mockTest?.durationMinutes} min${mockTest?.focusTopic ? ` · ${mockTest.focusTopic}` : ''}`,
    marking: markingState ? `${Math.max(Number(markingState.progressDone || 0), 0)}/${Math.max(Number(markingState.progressTotal || 0), 0)} answers marked` : 'Your answers are being evaluated in the background.',
    results: result ? `${result.marksObtained}/${result.totalMarks} · Grade ${result.grade}` : '',
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TopBar title={TITLES[phase]} subtitle={SUBTITLES[phase]} onOpenSidebar={onOpenSidebar} />

      {error && phase !== 'setup' && (
        <div className="mx-4 mt-3 rounded-xl border border-red-400/20 bg-red-500/10 text-red-200 text-sm px-4 py-3 shrink-0">
          {error}
        </div>
      )}

      {phase === 'setup' && (
        <SetupPhase
          documents={documents}
          activeDocument={activeDocument}
          setSelectedDocumentId={setSelectedDocumentId}
          studyFocus={studyFocus}
          onGenerate={handleGenerate}
          onResume={handleResume}
          loading={generating}
          error={error}
        />
      )}
      {phase === 'exam' && mockTest && (
        <ExamPhase mockTest={mockTest} questions={questions} onSubmit={handleSubmit} submitting={submitting} />
      )}
      {phase === 'marking' && mockTest && (
        <MarkingPhase
          mockTest={mockTest}
          markingState={markingState}
          onRefresh={() => refreshSubmissionStatus(submissionId)}
          onBack={() => {
            setPhase('setup')
            setMockTest(null)
            setQuestions([])
            setResult(null)
            setSubmissionId('')
            setMarkingState(null)
            setError('')
          }}
        />
      )}
      {phase === 'results' && result && (
        <ResultsPhase
          result={result}
          onRetry={() => { setPhase('exam'); setResult(null); setSubmissionId(''); setMarkingState(null); setError('') }}
          onBack={() => { setPhase('setup'); setMockTest(null); setQuestions([]); setResult(null); setSubmissionId(''); setMarkingState(null); setError('') }}
          onPracticeTopic={(topic) => openStudyFocus?.({
            documentId: activeDocument?.id || mockTest?.documentId || null,
            topic,
            screen: 'quiz',
            origin: 'mocktest_result',
          })}
          onReviewTopic={(topic) => openStudyFocus?.({
            documentId: activeDocument?.id || mockTest?.documentId || null,
            topic,
            screen: 'flashcards',
            origin: 'mocktest_result',
          })}
        />
      )}
      {(generating || submitting) && (
        <AppLoader
          overlay
          subtitle={generating ? 'Loading your question paper…' : 'AI is marking your answers…'}
        />
      )}
    </div>
  )
}
