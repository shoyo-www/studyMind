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
  'Section A': { bg: '#EEF2FF', text: '#3730A3', border: '#C7D2FE' },
  'Section B': { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  'Section C': { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
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
          <div className="mb-5 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        {pdfs.length === 0 ? (
          <div className="text-center py-10 text-zinc-400">
            <div className="text-3xl mb-2">📂</div>
            <p className="text-sm">No PDF documents uploaded yet. Upload one to begin.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">

            {/* Document selector */}
            <div className="bg-white border border-zinc-100 rounded-2xl p-5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">Select Document</div>
              <div className="flex flex-col gap-2">
                {pdfs.map(doc => (
                  <label key={doc.id}
                    className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                    style={docId === doc.id
                      ? { background: '#EEF2FF', borderColor: '#A5B4FC' }
                      : { background: '#FAFAF9', borderColor: '#E4E4E7' }}>
                    <input type="radio" name="doc" value={doc.id} checked={docId === doc.id}
                      onChange={() => {
                        setDocId(doc.id)
                        setSelectedDocumentId?.(doc.id)
                      }} className="accent-violet-600" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-800 truncate">{doc.title}</div>
                      <div className="text-xs text-zinc-400">{doc.subject || 'General'}{doc.total_pages ? ` · ${doc.total_pages} pages` : ''}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {selectedDoc && (
              <div className="bg-violet-50 border border-violet-100 rounded-2xl px-5 py-4 flex flex-wrap gap-5 text-sm">
                {[
                  { k: 'Document', v: selectedDoc.title },
                  { k: 'Topic', v: isRoadmapFocus && stageDayNumber ? `Day ${stageDayNumber} · ${focusTopic}` : focusTopic || 'Current roadmap topic' },
                  { k: 'Duration', v: '1 hr' },
                  { k: 'Questions', v: 'Up to 15' },
                ].map(i => (
                  <div key={i.k}>
                    <div className="text-[10px] uppercase tracking-widest text-violet-400 font-medium mb-0.5">{i.k}</div>
                    <div className="font-medium text-violet-900 max-w-[160px] truncate">{i.v}</div>
                  </div>
                ))}
              </div>
            )}

            {existingTest && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 mb-3">Existing Mock Test</div>
                <div className="flex items-center justify-between gap-3 bg-white border border-amber-100 rounded-xl px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-800 truncate">{existingTest.title}</div>
                    <div className="text-xs text-zinc-400">
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
                <div className="mt-3 text-xs text-amber-700">
                  This topic-stage mock test is already ready. We&apos;ll reopen the same paper for this roadmap stage instead of generating a duplicate.
                </div>
              </div>
            )}

            <button
              onClick={() => onGenerate({ documentId: docId, focusTopic, stageDayNumber })}
              disabled={loading || loadingList || !docId || Boolean(existingTest)}
              className="w-full py-4 rounded-2xl text-white font-semibold text-base transition-all disabled:opacity-50"
              style={{ background: loading ? '#A5B4FC' : '#6c63ff' }}>
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
  const secStyle        = SECTION_STYLE[q?.section] || { bg: '#F4F4F5', text: '#52525B', border: '#D4D4D8' }
  const sections        = [...new Set(questions.map(q => q.section || 'General'))]

  function handleSubmit() {
    const arr = questions.map((_, i) => ({ questionIndex: i, answer: answers[i] || '' }))
    onSubmit(arr, elapsed)
    setShowConfirm(false)
  }

  return (
    <div className="relative flex flex-col flex-1 min-h-0">

      {/* Timer + submit bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-zinc-100 bg-white shrink-0 gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: isLow ? '#ef4444' : '#22c55e' }} />
          <span className="font-mono font-bold text-sm" style={{ color: isLow ? '#ef4444' : '#111110' }}>{formatted}</span>
          <span className="text-xs text-zinc-400 hidden sm:inline">remaining</span>
        </div>

        {/* Answered progress bar */}
        <div className="flex-1 hidden sm:flex items-center gap-2 max-w-xs">
          <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(answeredCount / questions.length) * 100}%`, background: '#6c63ff' }} />
          </div>
          <span className="text-xs text-zinc-400 shrink-0">{answeredCount}/{questions.length}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Unanswered warning */}
          {unansweredCount > 0 && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg hidden sm:block">
              {unansweredCount} unanswered
            </span>
          )}
          <button onClick={() => setShowConfirm(true)} disabled={submitting}
            className="text-xs px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-50 transition-all"
            style={{ background: '#111110' }}>
            {submitting ? 'Submitting…' : 'Submit Exam'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* Question nav sidebar */}
        <div className="hidden md:flex flex-col w-48 shrink-0 border-r border-zinc-100 overflow-y-auto py-3 bg-zinc-50/50">
          {sections.map(sec => (
            <div key={sec}>
              <div className="px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400">{sec}</div>
              {questions.map((qq, i) => {
                if ((qq.section || 'General') !== sec) return null
                const done = answers[i]?.trim()
                return (
                  <button key={i} onClick={() => setActiveQ(i)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-all border-l-2"
                    style={activeQ === i
                      ? { borderColor: '#6c63ff', background: '#EEF2FF', color: '#3730A3', fontWeight: 600 }
                      : { borderColor: 'transparent', color: '#71717A' }}>
                    <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={done
                        ? { background: '#ECFDF5', color: '#065F46' }
                        : { background: '#FEF9EE', color: '#D97706', border: '1px solid #FDE68A' }
                      }>
                      {done ? '✓' : i + 1}
                    </div>
                    <span className="truncate flex-1">{TYPE_LABEL[qq.type]?.split(' ')[0]}</span>
                    <span className="shrink-0 text-[10px] text-zinc-400">{qq.marks}m</span>
                  </button>
                )
              })}
            </div>
          ))}

          {/* Legend */}
          <div className="px-4 pt-4 pb-2 border-t border-zinc-100 mt-2">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-4 h-4 rounded text-[8px] flex items-center justify-center" style={{ background: '#ECFDF5', color: '#065F46' }}>✓</div>
              <span className="text-[10px] text-zinc-400">Answered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded text-[8px] flex items-center justify-center" style={{ background: '#FEF9EE', color: '#D97706', border: '1px solid #FDE68A' }}>·</div>
              <span className="text-[10px] text-zinc-400">Not answered</span>
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
              <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-500 font-medium">
                {TYPE_LABEL[q?.type] || 'Question'}
              </span>
              {!answers[activeQ]?.trim() && (
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: '#FEF9EE', color: '#D97706', border: '1px solid #FDE68A' }}>
                  Not answered yet
                </span>
              )}
              <span className="text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 font-semibold ml-auto">
                {q?.marks} {q?.marks === 1 ? 'mark' : 'marks'}
              </span>
            </div>

            {/* Question */}
            <div className="bg-white border border-zinc-100 rounded-2xl p-5 mb-5">
              <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-medium mb-2">
                Question {activeQ + 1} of {questions.length}
              </div>
              <p className="text-base font-semibold text-zinc-900 leading-relaxed"
                style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '-0.01em' }}>
                {q?.question}
              </p>
              {q?.hint && (
                <div className="mt-3 text-xs bg-amber-50 border border-amber-100 text-amber-700 rounded-lg px-3 py-2">
                  💡 {q.hint}
                </div>
              )}
              {q?.type === 'numerical' && (
                <div className="mt-3 text-xs bg-blue-50 border border-blue-100 text-blue-700 rounded-lg px-3 py-2">
                  📐 Show all your working step by step
                </div>
              )}
              <div className="mt-2 text-xs text-zinc-400">Expected: {q?.expectedLength || 'appropriate length'}</div>
            </div>

            {/* Answer textarea */}
            <div className="mb-5">
              <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-medium mb-2">Your Answer</div>
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
                className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-800 outline-none resize-y leading-relaxed transition-colors"
                style={{ minHeight: q?.type === 'long_answer' ? 240 : 100 }}
                onFocus={e  => e.target.style.borderColor = '#6c63ff'}
                onBlur={e   => e.target.style.borderColor = '#E4E4E7'}
              />
              <div className="flex justify-between mt-1 text-xs text-zinc-400">
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
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 transition-all">
                ← Prev
              </button>
              {activeQ < questions.length - 1 ? (
                <button onClick={() => setActiveQ(i => i + 1)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: '#6c63ff' }}>
                  Next →
                </button>
              ) : (
                <button onClick={() => setShowConfirm(true)} disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                  style={{ background: '#111110' }}>
                  Finish & Submit
                </button>
              )}
            </div>

            {/* Mobile quick-nav */}
            <div className="flex flex-wrap gap-1.5 mt-5 md:hidden pt-4 border-t border-zinc-100">
              {questions.map((_, i) => (
                <button key={i} onClick={() => setActiveQ(i)}
                  className="w-8 h-8 rounded-lg text-xs font-bold transition-all"
                  style={activeQ === i
                    ? { background: '#6c63ff', color: '#fff' }
                    : answers[i]?.trim()
                      ? { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }
                      : { background: '#FEF9EE', color: '#D97706', border: '1px solid #FDE68A' }
                  }>{i + 1}</button>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* Submit confirm */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-7 max-w-sm w-full">
            <div className="text-center mb-6">
              <div className="text-3xl mb-3">{left <= 0 ? '⏰' : unansweredCount === 0 ? '✅' : '⚠️'}</div>
              <div className="font-semibold text-zinc-900 text-lg mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                {left <= 0 ? 'Time is up!' : 'Submit your exam?'}
              </div>
              <p className="text-sm text-zinc-500">
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
                      style={{ background: '#FEF9EE', color: '#D97706', border: '1px solid #FDE68A' }}>
                      Q{i + 1}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              {left > 0 && (
                <button onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-all">
                  Keep going
                </button>
              )}
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                style={{ background: '#6c63ff' }}>
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
        <div className="bg-white border border-zinc-100 rounded-3xl p-6 sm:p-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl mx-auto mb-5"
            style={{ background: isFailed ? '#FEF2F2' : '#EEF2FF', color: isFailed ? '#DC2626' : '#4F46E5' }}>
            <div className={`w-7 h-7 rounded-full border-[3px] ${isFailed ? 'border-red-200' : 'border-violet-200'} border-t-current ${isFailed ? '' : 'animate-spin'}`} />
          </div>
          <div className="text-center mb-6">
            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-400 font-semibold mb-2">
              {isFailed ? 'Marking Paused' : status === 'processing' ? 'AI Marking In Progress' : 'Queued For Marking'}
            </div>
            <div className="text-2xl font-semibold text-zinc-900 mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
              {isFailed ? 'We hit a delay while marking your paper' : 'Your paper is being evaluated'}
            </div>
            <p className="text-sm text-zinc-500 leading-relaxed">
              {isFailed
                ? (markingState?.errorMessage || 'Please check again in a moment. Your submission is still saved.')
                : 'You can stay on this screen while we grade each answer in the background and prepare your full breakdown.'}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-4 mb-5">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium text-zinc-700">Progress</span>
              <span className="text-zinc-500">{progressDone}/{progressTotal || '0'} questions</span>
            </div>
            <div className="h-2.5 bg-white rounded-full overflow-hidden border border-zinc-100">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, background: isFailed ? '#F97316' : '#6c63ff' }} />
            </div>
            <div className="mt-2 text-xs text-zinc-400">
              {isFailed ? 'Marking stopped before completion.' : `${progressPct}% complete`}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <div className="rounded-2xl border border-zinc-100 px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-medium mb-1">Paper</div>
              <div className="text-sm font-medium text-zinc-800 truncate">{mockTest?.title || 'Mock Test'}</div>
            </div>
            <div className="rounded-2xl border border-zinc-100 px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-medium mb-1">Status</div>
              <div className="text-sm font-medium text-zinc-800 capitalize">{status}</div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={onRefresh}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: '#6c63ff' }}>
              Check progress
            </button>
            <button onClick={onBack}
              className="flex-1 py-3 rounded-xl text-sm font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-all">
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
        <div className="bg-white border border-zinc-100 rounded-2xl p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative shrink-0" style={{ width: 110, height: 110 }}>
              <svg width="110" height="110" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E4E4E7" strokeWidth="9"/>
                <circle cx="50" cy="50" r="42" fill="none"
                  stroke={result.gradeColor} strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={ringCircum}
                  strokeDashoffset={ringCircum * (1 - Math.min(result.percentage, 100) / 100)}
                  style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-bold text-xl" style={{ color: result.gradeColor, fontFamily: 'Syne, sans-serif' }}>{result.grade}</div>
                <div className="text-xs text-zinc-400">{result.percentage}%</div>
              </div>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: result.gradeColor }}>
                {result.marksObtained}/{result.totalMarks}
              </div>
              <div className="text-zinc-500 text-sm">{result.gradeLabel}</div>
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-zinc-100">
                {[
                  { k: 'Correct',  v: `${result.correctCount}/${result.questionsCount}` },
                  { k: 'Time',     v: fmtDuration(result.timeTakenSecs) },
                  { k: 'Subject',  v: result.subject || 'General' },
                ].map(s => (
                  <div key={s.k} className="text-center">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-medium mb-0.5">{s.k}</div>
                    <div className="text-xs font-semibold text-zinc-800 truncate">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-100 mb-5">
          {[{ id: 'overview', label: '📊 Overview' }, { id: 'answers', label: '📝 All Answers' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${tab === t.id ? 'border-violet-500 text-violet-700' : 'border-transparent text-zinc-400 hover:text-zinc-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white border border-zinc-100 rounded-2xl p-5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-4">Section Breakdown</div>
              <div className="flex flex-col gap-3">
                {result.sectionBreakdown.map(s => (
                  <div key={s.section}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium text-zinc-800">{s.section}</span>
                      <span className="text-zinc-500">{s.marks}/{s.maxMarks} · {s.percentage}%</span>
                    </div>
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${s.percentage}%`, background: s.percentage >= 60 ? '#22c55e' : s.percentage >= 40 ? '#f59e0b' : '#ef4444' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {result.weakTopics?.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-red-500 mb-3">📉 Needs Revision</div>
                <div className="flex flex-wrap gap-2">
                  {result.weakTopics.map(t => (
                    <span key={t.topic} className="text-xs px-3 py-1.5 bg-white border border-red-100 text-red-600 rounded-full font-medium">
                      {t.topic} ({t.percentage}%)
                    </span>
                  ))}
                </div>
                {!!result.weakTopics[0]?.topic && (
                  <div className="flex flex-wrap gap-3 mt-4">
                    <button
                      onClick={() => onPracticeTopic?.(result.weakTopics[0].topic)}
                      className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm hover:bg-zinc-700 transition-colors"
                    >
                      Focused quiz on {result.weakTopics[0].topic}
                    </button>
                    <button
                      onClick={() => onReviewTopic?.(result.weakTopics[0].topic)}
                      className="px-4 py-2 rounded-lg border border-red-200 bg-white text-red-600 text-sm hover:bg-red-50 transition-colors"
                    >
                      Flashcards for {result.weakTopics[0].topic}
                    </button>
                  </div>
                )}
              </div>
            )}
            {result.strongTopics?.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 mb-3">💪 Strong Topics</div>
                <div className="flex flex-wrap gap-2">
                  {result.strongTopics.map(t => (
                    <span key={t.topic} className="text-xs px-3 py-1.5 bg-white border border-emerald-100 text-emerald-700 rounded-full font-medium">
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
              <div key={i} className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
                <button onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-zinc-50 transition-colors">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={a.isCorrect
                      ? { background: '#ECFDF5', color: '#065F46' }
                      : a.marksAwarded > 0
                        ? { background: '#FFFBEB', color: '#92400E' }
                        : a.studentAnswer?.trim()
                          ? { background: '#FEF2F2', color: '#991B1B' }
                          : { background: '#F4F4F5', color: '#71717A' }
                    }>
                    {a.marksAwarded > 0 ? '✓' : a.studentAnswer?.trim() ? '✗' : '—'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-800 truncate">Q{a.questionNumber}. {a.question}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {a.section} · {a.topic}
                      {!a.studentAnswer?.trim() && <span className="ml-2 text-amber-500 font-medium">· Not answered</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right ml-2">
                    <div className="text-sm font-bold"
                      style={{ color: a.isCorrect ? '#22c55e' : a.marksAwarded > 0 ? '#f59e0b' : '#ef4444' }}>
                      {a.marksAwarded}/{a.maxMarks}
                    </div>
                    <div className="text-[10px] text-zinc-400">{expandedQ === i ? '▲' : '▼'}</div>
                  </div>
                </button>

                {expandedQ === i && (
                  <div className="px-5 pb-5 border-t border-zinc-100 pt-4 flex flex-col gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-medium mb-2">Your Answer</div>
                      <div className="text-sm text-zinc-700 bg-zinc-50 rounded-xl p-3 leading-relaxed whitespace-pre-wrap">
                        {a.studentAnswer?.trim() || <span className="italic text-zinc-400">No answer provided — 0 marks awarded</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-medium mb-2">AI Feedback</div>
                      <div className="text-sm text-zinc-700 leading-relaxed">{a.feedback}</div>
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
                      <div className="border-t border-zinc-100 pt-4 mt-2">
                        <div className="text-[10px] uppercase tracking-widest text-violet-600 font-medium mb-2">📖 Model Answer</div>
                        <div className="text-xs text-violet-900 bg-violet-50 border border-violet-100 rounded-xl p-3 leading-relaxed whitespace-pre-wrap">
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
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: '#6c63ff' }}>
            Retake Test
          </button>
          <button onClick={onBack}
            className="flex-1 py-3 rounded-xl text-sm font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-all">
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
        <div className="mx-4 mt-3 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl shrink-0">
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
