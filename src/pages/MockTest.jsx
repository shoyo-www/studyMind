import { useState, useEffect, useRef } from 'react'
import TopBar from '../components/TopBar'
import { mockTestApi } from '../lib/api'

// ── Helpers ───────────────────────────────────────────────────────────
const DURATION_OPTIONS = [
  { label: '1 hr',     value: 60  },
  { label: '1.5 hrs',  value: 90  },
  { label: '2 hrs',    value: 120 },
  { label: '2.5 hrs',  value: 150 },
  { label: '3 hrs',    value: 180 },
]
const MARKS_OPTIONS = [
  { label: '50 marks',  value: 50  },
  { label: '75 marks',  value: 75  },
  { label: '100 marks', value: 100 },
]
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
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function fmtDuration(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? (s > 0 ? `${m}m ${s}s` : `${m}m`) : `${s}s`
}

// ── Countdown timer hook ──────────────────────────────────────────────
function useCountdown(totalSecs, onExpire) {
  const [left, setLeft]   = useState(totalSecs)
  const expired           = useRef(false)

  useEffect(() => {
    if (left <= 0 && !expired.current) { expired.current = true; onExpire?.(); return }
    const id = setTimeout(() => setLeft(l => l - 1), 1000)
    return () => clearTimeout(id)
  }, [left])

  return { left, elapsed: totalSecs - left, formatted: fmtTime(left), isLow: left < 300 }
}

// ════════════════════════════════════════════════════════════════════
// PHASE 1 — Setup
// ════════════════════════════════════════════════════════════════════
function SetupPhase({ documents, onGenerate, loading, error }) {
  const [docId,    setDocId]    = useState(documents[0]?.id || '')
  const [duration, setDuration] = useState(180)
  const [marks,    setMarks]    = useState(100)

  const pdfs       = documents.filter(d => d.mime_type === 'application/pdf')
  const selectedDoc = pdfs.find(d => d.id === docId)

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-10">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">📝</div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: '#111110', marginBottom: 8 }}>
            Mock Test Generator
          </h2>
          <p className="text-sm text-zinc-400 max-w-sm mx-auto leading-relaxed">
            AI generates a full question paper from your notes. You write your answers, then AI marks each one and gives detailed feedback.
          </p>
        </div>

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

            {/* Document */}
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
                      onChange={() => setDocId(doc.id)} className="accent-violet-600" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-800 truncate">{doc.title}</div>
                      <div className="text-xs text-zinc-400">{doc.subject || 'General'}{doc.total_pages ? ` · ${doc.total_pages} pages` : ''}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="bg-white border border-zinc-100 rounded-2xl p-5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">Exam Duration</div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {DURATION_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => setDuration(o.value)}
                    className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                    style={duration === o.value
                      ? { background: '#6c63ff', color: '#fff', borderColor: '#6c63ff' }
                      : { background: '#FAFAF9', color: '#71717A', borderColor: '#E4E4E7' }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Marks */}
            <div className="bg-white border border-zinc-100 rounded-2xl p-5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">Total Marks</div>
              <div className="grid grid-cols-3 gap-2">
                {MARKS_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => setMarks(o.value)}
                    className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                    style={marks === o.value
                      ? { background: '#6c63ff', color: '#fff', borderColor: '#6c63ff' }
                      : { background: '#FAFAF9', color: '#71717A', borderColor: '#E4E4E7' }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            {selectedDoc && (
              <div className="bg-violet-50 border border-violet-100 rounded-2xl px-5 py-4 flex flex-wrap gap-5 text-sm">
                {[
                  { k: 'Document',  v: selectedDoc.title },
                  { k: 'Duration',  v: DURATION_OPTIONS.find(o => o.value === duration)?.label },
                  { k: 'Marks',     v: `${marks} marks` },
                ].map(i => (
                  <div key={i.k}>
                    <div className="text-[10px] uppercase tracking-widest text-violet-400 font-medium mb-0.5">{i.k}</div>
                    <div className="font-medium text-violet-900 max-w-[160px] truncate">{i.v}</div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => onGenerate({ documentId: docId, durationMinutes: duration, totalMarks: marks })}
              disabled={loading || !docId}
              className="w-full py-4 rounded-2xl text-white font-semibold text-base transition-all disabled:opacity-50"
              style={{ background: loading ? '#A5B4FC' : '#6c63ff' }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="40" strokeLinecap="round"/>
                  </svg>
                  Generating question paper…
                </span>
              ) : '🚀 Generate Question Paper'}
            </button>

          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// PHASE 2 — Exam
// ════════════════════════════════════════════════════════════════════
function ExamPhase({ mockTest, questions, onSubmit, submitting }) {
  const [answers,     setAnswers]     = useState({})   // { questionIndex: 'text' }
  const [activeQ,     setActiveQ]     = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const textareaRef = useRef(null)

  const { left, elapsed, formatted, isLow } = useCountdown(
    mockTest.durationMinutes * 60,
    () => setShowConfirm(true)
  )

  useEffect(() => { textareaRef.current?.focus() }, [activeQ])

  const answeredCount = Object.values(answers).filter(a => a?.trim()).length
  const q = questions[activeQ]
  const secStyle = SECTION_STYLE[q?.section] || { bg: '#F4F4F5', text: '#52525B', border: '#D4D4D8' }

  function handleSubmit() {
    const arr = questions.map((_, i) => ({ questionIndex: i, answer: answers[i] || '' }))
    onSubmit(arr, elapsed)
    setShowConfirm(false)
  }

  // Sections for nav
  const sections = [...new Set(questions.map(q => q.section || 'General'))]

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* Timer + submit bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-zinc-100 bg-white shrink-0 gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: isLow ? '#ef4444' : '#22c55e' }} />
          <span className="font-mono font-bold text-sm" style={{ color: isLow ? '#ef4444' : '#111110' }}>{formatted}</span>
          <span className="text-xs text-zinc-400 hidden sm:inline">remaining</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">{answeredCount}/{questions.length} answered</span>
          <button onClick={() => setShowConfirm(true)} disabled={submitting}
            className="text-xs px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-50 transition-all"
            style={{ background: '#111110' }}>
            {submitting ? 'Submitting…' : 'Submit Exam'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* Sidebar nav — desktop */}
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
                      style={{ background: done ? '#ECFDF5' : '#F4F4F5', color: done ? '#065F46' : '#A1A1AA' }}>
                      {i + 1}
                    </div>
                    <span className="truncate flex-1">{TYPE_LABEL[qq.type]?.split(' ')[0]}</span>
                    <span className="shrink-0 text-[10px] text-zinc-400">{qq.marks}m</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Main question area */}
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

            {/* Answer input */}
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
                style={{ minHeight: q?.type === 'long_answer' ? 240 : 100, fontFamily: 'DM Sans, sans-serif' }}
                onFocus={e  => e.target.style.borderColor = '#6c63ff'}
                onBlur={e   => e.target.style.borderColor = '#E4E4E7'}
              />
              <div className="flex justify-between mt-1 text-xs text-zinc-400">
                <span>{(answers[activeQ] || '').length} chars</span>
                {answers[activeQ]?.trim() && <span className="text-emerald-500 font-medium">✓ Answered</span>}
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
                      : { background: '#F4F4F5', color: '#71717A', border: '1px solid #E4E4E7' }
                  }>{i + 1}</button>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* Submit confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-7 max-w-sm w-full">
            <div className="text-center mb-6">
              <div className="text-3xl mb-3">{left <= 0 ? '⏰' : answeredCount === questions.length ? '✅' : '⚠️'}</div>
              <div className="font-semibold text-zinc-900 text-lg mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                {left <= 0 ? 'Time is up!' : 'Submit your exam?'}
              </div>
              <p className="text-sm text-zinc-500">
                {left <= 0
                  ? 'Your time has expired. Answers will be submitted.'
                  : `${answeredCount}/${questions.length} answered. ${questions.length - answeredCount} left blank.`}
              </p>
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
// PHASE 3 — Results
// ════════════════════════════════════════════════════════════════════
function ResultsPhase({ result, onRetry, onNewTest }) {
  const [tab,       setTab]       = useState('overview')
  const [expandedQ, setExpandedQ] = useState(null)

  const scoreRingPct = Math.min(result.percentage, 100)
  const ringCircum   = 2 * Math.PI * 42

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
      <div className="max-w-2xl mx-auto">

        {/* Score card */}
        <div className="bg-white border border-zinc-100 rounded-2xl p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">

            {/* SVG ring */}
            <div className="relative shrink-0" style={{ width: 110, height: 110 }}>
              <svg width="110" height="110" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E4E4E7" strokeWidth="9"/>
                <circle cx="50" cy="50" r="42" fill="none"
                  stroke={result.gradeColor} strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={ringCircum}
                  strokeDashoffset={ringCircum * (1 - scoreRingPct / 100)}
                  style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-bold text-xl" style={{ color: result.gradeColor, fontFamily: 'Syne, sans-serif' }}>
                  {result.grade}
                </div>
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
                  { k: 'Correct',    v: `${result.correctCount}/${result.questionsCount}` },
                  { k: 'Time',       v: fmtDuration(result.timeTakenSecs)                 },
                  { k: 'Subject',    v: result.subject || 'General'                       },
                ].map(s => (
                  <div key={s.k} className="text-center">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-medium mb-0.5">{s.k}</div>
                    <div className="text-xs font-semibold text-zinc-800">{s.v}</div>
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

            {/* Section breakdown */}
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

            {/* Weak topics */}
            {result.weakTopics.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-red-500 mb-3">📉 Needs Revision</div>
                <div className="flex flex-wrap gap-2">
                  {result.weakTopics.map(t => (
                    <span key={t.topic} className="text-xs px-3 py-1.5 bg-white border border-red-100 text-red-600 rounded-full font-medium">
                      {t.topic} ({t.percentage}%)
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Strong topics */}
            {result.strongTopics.length > 0 && (
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
                        : { background: '#FEF2F2', color: '#991B1B' }}>
                    {a.marksAwarded > 0 ? '✓' : '✗'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-800 truncate">Q{a.questionNumber}. {a.question}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">{a.section} · {a.topic}</div>
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
                    {/* Student answer */}
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-medium mb-2">Your Answer</div>
                      <div className="text-sm text-zinc-700 bg-zinc-50 rounded-xl p-3 leading-relaxed whitespace-pre-wrap">
                        {a.studentAnswer || <span className="italic text-zinc-400">No answer provided</span>}
                      </div>
                    </div>
                    {/* AI feedback */}
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-medium mb-2">AI Feedback</div>
                      <div className="text-sm text-zinc-700 leading-relaxed">{a.feedback}</div>
                    </div>
                    {/* Points covered */}
                    {a.keyPointsCovered.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-emerald-600 font-medium mb-2">✓ Points Covered</div>
                        <ul className="flex flex-col gap-1">
                          {a.keyPointsCovered.map((pt, j) => (
                            <li key={j} className="text-xs text-emerald-700 flex gap-2"><span>•</span><span>{pt}</span></li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* Points missed */}
                    {a.keyPointsMissed.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-red-500 font-medium mb-2">✗ Points Missed</div>
                        <ul className="flex flex-col gap-1">
                          {a.keyPointsMissed.map((pt, j) => (
                            <li key={j} className="text-xs text-red-600 flex gap-2"><span>•</span><span>{pt}</span></li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button onClick={onRetry}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: '#6c63ff' }}>
            Retake Test
          </button>
          <button onClick={onNewTest}
            className="flex-1 py-3 rounded-xl text-sm font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-all">
            New Test
          </button>
        </div>

      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// Main component
// ════════════════════════════════════════════════════════════════════
export default function MockTest({ onOpenSidebar, documents = [] }) {
  const [phase,      setPhase]      = useState('setup')
  const [mockTest,   setMockTest]   = useState(null)
  const [questions,  setQuestions]  = useState([])
  const [result,     setResult]     = useState(null)
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  async function handleGenerate(opts) {
    setGenerating(true); setError('')
    try {
      const data = await mockTestApi.generate(opts.documentId, {
        durationMinutes: opts.durationMinutes,
        totalMarks:      opts.totalMarks,
      })
      setMockTest(data.mockTest)
      setQuestions(data.questions)
      setPhase('exam')
    } catch (e) {
      setError(e.message || 'Failed to generate question paper. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSubmit(answers, timeTakenSecs) {
    setSubmitting(true); setError('')
    try {
      const data = await mockTestApi.submit(mockTest.id, answers, timeTakenSecs)
      setResult(data.result)
      setPhase('results')
    } catch (e) {
      setError(e.message || 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const TITLES = {
    setup:   'Mock Test',
    exam:    mockTest?.title || 'Exam in Progress',
    results: 'Results',
  }
  const SUBTITLES = {
    setup:   'AI-generated full question papers with written answers',
    exam:    `${questions.length} questions · ${mockTest?.totalMarks} marks · ${mockTest?.durationMinutes} min`,
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

      {mockTest?.generatedWithModel === 'groq-fallback' && phase !== 'setup' && !error && (
        <div className="mx-4 mt-3 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700 shrink-0">
          Gemini quota was exhausted, so this mock test was generated through the backend Groq fallback from your extracted PDF text.
        </div>
      )}

      {phase === 'setup' && (
        <SetupPhase documents={documents} onGenerate={handleGenerate} loading={generating} error={error} />
      )}
      {phase === 'exam' && mockTest && (
        <ExamPhase mockTest={mockTest} questions={questions} onSubmit={handleSubmit} submitting={submitting} />
      )}
      {phase === 'results' && result && (
        <ResultsPhase
          result={result}
          onRetry={() => { setPhase('exam'); setResult(null) }}
          onNewTest={() => { setPhase('setup'); setMockTest(null); setQuestions([]); setResult(null); setError('') }}
        />
      )}
    </div>
  )
}
