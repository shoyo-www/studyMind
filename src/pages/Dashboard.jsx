import { useState, useEffect } from 'react'
import TopBar from '../components/TopBar'
import StatCard from '../components/StatCard'
import { useT } from '../i18n'
import {
  formatRelativeDate,
  getCoveredTopicCount,
  getDisplayName,
  getTopicCount,
} from '../lib/documents'
import { progressApi } from '../lib/api'

function DocCard({ document, onOpen, t, lang }) {
  return (
    <button
      onClick={onOpen}
      className="bg-white border border-zinc-100 rounded-xl p-5 text-left hover:border-violet-200 hover:shadow-sm transition-all duration-200 group"
    >
      <div className="w-9 h-10 bg-violet-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-violet-100 transition-colors">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2.5C3 1.67157 3.67157 1 4.5 1H9.5L13 4.5V13.5C13 14.3284 12.3284 15 11.5 15H4.5C3.67157 15 3 14.3284 3 13.5V2.5Z" stroke="#7c3aed" strokeWidth="1.2"/><path d="M9.5 1V4.5H13" stroke="#7c3aed" strokeWidth="1.2" strokeLinejoin="round"/></svg>
      </div>
      <div className="text-sm font-medium text-zinc-800 mb-1 truncate">{document.title}</div>
      <div className="text-xs text-zinc-400 mb-3">
        {document.total_pages} {t('dashboard.pages')} · {formatRelativeDate(document.created_at, lang)}
      </div>
      <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${document.pct_covered}%` }} />
      </div>
      <div className="text-[11px] text-zinc-400 mt-1.5">{document.pct_covered}% {t('dashboard.covered')}</div>
    </button>
  )
}

function Notice({ tone = 'neutral', children, action }) {
  const toneClasses = tone === 'error'
    ? 'bg-red-50 border-red-100 text-red-700'
    : 'bg-zinc-100 border-zinc-200 text-zinc-600'

  return (
    <div className={`flex items-center justify-between gap-4 border rounded-xl px-4 py-3 text-sm ${toneClasses}`}>
      <span>{children}</span>
      {action}
    </div>
  )
}

export default function Dashboard({
  onOpenSidebar,
  user,
  profile,
  stats,
  documents,
  appLoading,
  appError,
  refreshAppData,
  openDocument,
  setScreen,
}) {
  const { t, lang } = useT()
  const [weakTopics, setWeakTopics]         = useState([])
  const [predictedScore, setPredictedScore] = useState(null)
  const [mockStats, setMockStats]           = useState(null)

  useEffect(() => {
    progressApi.get().then(data => {
      if (data?.weakTopics?.length) setWeakTopics(data.weakTopics)
      if (data?.mockTestStats)      setMockStats(data.mockTestStats)
      // Predicted score: quiz avg × 0.4 + mock avg × 0.6
      const quizAvg = data?.stats?.bestScore || 0
      const mockAvg = data?.mockTestStats?.avgScore || 0
      if (quizAvg || mockAvg) {
        const weight = mockAvg ? (quizAvg * 0.4 + mockAvg * 0.6) : quizAvg
        setPredictedScore(Math.round(weight))
      }
    }).catch(() => {})
  }, [documents.length])

  const hour = new Date().getHours()
  const greeting = hour < 12
    ? t('dashboard.greeting')
    : hour < 17
      ? t('dashboard.greetingAfternoon')
      : t('dashboard.greetingEvening')

  const displayName = getDisplayName(profile, user)
  const topicCount = stats?.totalTopics ?? documents.reduce((sum, document) => sum + getTopicCount(document), 0)
  const readinessPct = stats?.readinessPct ?? (documents.length ? Math.round(documents.reduce((sum, document) => sum + document.pct_covered, 0) / documents.length) : 0)
  const avgQuizScore = stats?.averageQuizScore ?? 0
  const totalCoveredTopics = documents.reduce((sum, document) => sum + getCoveredTopicCount(document), 0)
  const statsCards = [
    { label: t('dashboard.stats.documents'), value: String(stats?.documentCount ?? documents.length), change: `${topicCount} ${t('dashboard.stats.topics').toLowerCase()}` },
    { label: t('dashboard.stats.topics'), value: String(totalCoveredTopics), change: `${topicCount} total` },
    { label: t('dashboard.stats.quizAvg'), value: `${avgQuizScore}%`, change: `${stats?.attemptedQuizCount ?? 0} quizzes` },
    {
      label: predictedScore !== null ? 'Predicted Score' : t('dashboard.stats.readiness'),
      value: predictedScore !== null ? `${predictedScore}%` : `${readinessPct}%`,
      change: predictedScore !== null
        ? (predictedScore >= 75 ? 'On track for exam 🎯' : predictedScore >= 50 ? 'Needs improvement' : 'More practice needed')
        : (documents.length ? `${documents[0].subject || 'General'} focus` : t('common.comingSoon')),
    },
  ]

  const topDocument = documents[0]
  const nextTopic = topDocument?.topics?.[getCoveredTopicCount(topDocument)]?.title || topDocument?.topics?.[0]?.title
  const tasks = documents.length
    ? [
        {
          color: 'bg-violet-500',
          text: `${topDocument.title} — ${Math.max(getTopicCount(topDocument) - getCoveredTopicCount(topDocument), 0)} topics left in roadmap`,
          btn: t('common.resume'),
          onClick: () => openDocument(topDocument.id, 'roadmap'),
          primary: false,
        },
        {
          color: 'bg-emerald-400',
          text: nextTopic ? `Practice ${nextTopic} from ${topDocument.title}` : `Start a quiz from ${topDocument.title}`,
          btn: t('common.practice'),
          onClick: () => openDocument(topDocument.id, 'quiz'),
          primary: false,
        },
        {
          color: 'bg-sky-400',
          text: `Review the flashcards deck from ${topDocument.title}`,
          btn: t('common.review'),
          onClick: () => openDocument(topDocument.id, 'flashcards'),
          primary: false,
        },
        {
          color: 'bg-amber-400',
          text: `Open the PDF assistant for ${topDocument.title}`,
          btn: 'Open',
          onClick: () => openDocument(topDocument.id),
          primary: true,
        },
      ]
    : [
        {
          color: 'bg-zinc-400',
          text: 'Upload your first PDF to unlock the assistant, quiz, flashcards, and roadmap.',
          btn: t('dashboard.uploadNew'),
          onClick: () => setScreen('upload'),
          primary: true,
        },
      ]

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TopBar
        onOpenSidebar={onOpenSidebar}
        title={`${greeting}, ${displayName} 👋`}
        subtitle={documents.length ? t('dashboard.tasksToday', { count: tasks.length }) : 'Upload one study document to start your AI workspace.'}
        showLangSwitcher
        action={(
          <button onClick={() => setScreen('upload')} className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-700 transition-colors">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1V9M6 1L3 4M6 1L9 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M1 10H11" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
            {t('dashboard.uploadNew')}
          </button>
        )}
      />
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-7">
        {appError && (
          <div className="mb-6">
            <Notice
              tone="error"
              action={(
                <button onClick={refreshAppData} className="text-xs px-3 py-1.5 rounded-lg border border-red-200 hover:bg-white transition-colors">
                  {t('common.retry')}
                </button>
              )}
            >
              {appError}
            </Notice>
          </div>
        )}

        {/* ── Smart Next Step Card ───────────────────────────────── */}
        {documents.length > 0 && (() => {
          const topWeak  = weakTopics[0]
          const hasQuiz  = (stats?.attemptedQuizCount || 0) > 0
          const hasMock  = mockStats?.submittedCount > 0

          // Determine what to show
          let card = null

          if (topWeak && topWeak.score !== null && topWeak.score < 60) {
            // Weak topic found from quiz history
            card = {
              emoji: '🎯',
              label: 'Focus area',
              bg: '#FEF2F2', border: '#FECACA', labelColor: '#DC2626',
              title: `You're weak on: ${topWeak.topic}`,
              subtitle: `${topWeak.score}% accuracy · ${topWeak.detail || ''}`,
              cta: 'Practice this now →',
              ctaBg: '#DC2626',
              onClick: () => topWeak.documentId ? openDocument(topWeak.documentId, 'quiz') : setScreen('quiz'),
            }
          } else if (!hasQuiz) {
            // Never taken a quiz — nudge them
            card = {
              emoji: '❓',
              label: 'Get started',
              bg: '#EEF2FF', border: '#C7D2FE', labelColor: '#4338CA',
              title: 'Take your first quiz',
              subtitle: 'PrepPal will learn your weak topics and guide you from there.',
              cta: 'Start quiz →',
              ctaBg: '#6c63ff',
              onClick: () => openDocument(documents[0]?.id, 'quiz'),
            }
          } else if (!hasMock) {
            // Has quizzes but no mock test yet
            card = {
              emoji: '📋',
              label: 'Next level',
              bg: '#FFFBEB', border: '#FDE68A', labelColor: '#B45309',
              title: 'Try a full mock test',
              subtitle: "See how you'd do in a real exam — AI marks every answer.",
              cta: 'Generate mock test →',
              ctaBg: '#D97706',
              onClick: () => setScreen('mocktest'),
            }
          } else if (predictedScore !== null) {
            // Has quiz + mock data — show predicted score
            const colour = predictedScore >= 75 ? '#059669' : predictedScore >= 50 ? '#D97706' : '#DC2626'
            card = {
              emoji: predictedScore >= 75 ? '🏆' : predictedScore >= 50 ? '📈' : '⚠️',
              label: 'Predicted exam score',
              bg: '#F0FDF4', border: '#BBF7D0', labelColor: colour,
              title: `You're on track for ${predictedScore}%`,
              subtitle: predictedScore >= 75
                ? 'Great progress! Keep practicing to push higher.'
                : predictedScore >= 50
                  ? 'Getting there. Focus on your weak topics to improve.'
                  : `Need more practice. Your weakest area: ${topWeak?.topic || 'check progress page'}`,
              cta: predictedScore < 75 ? 'Fix weak topics →' : 'Keep practicing →',
              ctaBg: colour,
              onClick: () => topWeak?.documentId ? openDocument(topWeak.documentId, 'quiz') : setScreen('progress'),
            }
          }

          if (!card) return null

          return (
            <div className="mb-6 sm:mb-8 rounded-2xl border px-5 py-4 flex items-center justify-between gap-4"
              style={{ background: card.bg, borderColor: card.border }}>
              <div className="flex items-center gap-4 min-w-0">
                <div className="text-2xl shrink-0">{card.emoji}</div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: card.labelColor }}>{card.label}</div>
                  <div className="text-sm font-semibold text-zinc-900 truncate">{card.title}</div>
                  <div className="text-xs text-zinc-500 truncate mt-0.5">{card.subtitle}</div>
                </div>
              </div>
              <button onClick={card.onClick}
                className="text-xs font-semibold text-white px-4 py-2 rounded-xl shrink-0 transition-all hover:opacity-85"
                style={{ background: card.ctaBg }}>
                {card.cta}
              </button>
            </div>
          )
        })()}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {statsCards.map((card) => <StatCard key={card.label} {...card} />)}
        </div>

        <div className="mb-7">
          <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-300 mb-4">{t('dashboard.yourDocuments')}</div>

          {documents.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {documents.map((document) => (
                <DocCard
                  key={document.id}
                  document={document}
                  onOpen={() => openDocument(document.id)}
                  t={t}
                  lang={lang}
                />
              ))}
              <button onClick={() => setScreen('upload')} className="border border-dashed border-zinc-200 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer hover:border-violet-300 hover:bg-violet-50/40 transition-all min-h-[160px] group">
                <div className="w-8 h-8 rounded-full border border-dashed border-zinc-200 group-hover:border-violet-300 flex items-center justify-center mb-2"><span className="text-zinc-300 group-hover:text-violet-400 text-lg leading-none">+</span></div>
                <span className="text-xs text-zinc-300 group-hover:text-violet-400 transition-colors">{t('dashboard.uploadNew')}</span>
              </button>
            </div>
          ) : (
            <Notice
              action={(
                <button onClick={() => setScreen('upload')} className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-white transition-colors">
                  {t('dashboard.uploadNew')}
                </button>
              )}
            >
              No documents yet. Upload your first PDF to begin.
            </Notice>
          )}
        </div>

        <div>
          <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-300 mb-4">{t('dashboard.todaysTasks')}</div>
          <div className="flex flex-col gap-2">
            {tasks.map((task, index) => (
              <div key={index} className="flex items-center gap-4 bg-white border border-zinc-100 rounded-xl px-5 py-3.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${task.color}`} />
                <div className="flex-1 text-sm text-zinc-500 min-w-0 truncate sm:whitespace-normal sm:overflow-visible">{task.text}</div>
                <button
                  onClick={task.onClick}
                  className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition-colors shrink-0 ${task.primary ? 'bg-zinc-900 text-white hover:bg-zinc-700' : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
                >
                  {task.btn}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
