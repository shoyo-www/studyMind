import { useEffect, useState } from 'react'
import AppLoader from '../components/AppLoader'
import TopBar from '../components/TopBar'
import StatCard from '../components/StatCard'
import { useT } from '../i18n'
import { progressApi } from '../lib/api'

const SUBJECT_COLORS = [
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-400',
  'bg-sky-500',
  'bg-rose-400',
]

function HeatCell({ level }) {
  const bg = level === 0 ? 'bg-white/8' : level === 1 ? 'bg-[rgba(255,118,105,0.18)]' : level === 2 ? 'bg-[rgba(255,118,105,0.45)]' : 'bg-[var(--pp-coral)]'
  return <div className={`aspect-square rounded-sm ${bg}`} />
}

function formatPercentage(value) {
  return `${Math.max(0, Math.round(Number(value) || 0))}%`
}

export default function Progress({
  onOpenSidebar,
  documents = [],
  setScreen,
  setSelectedDocumentId,
  openStudyFocus,
}) {
  const { t } = useT()
  const [progressData, setProgressData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadProgress() {
    setLoading(true)
    setError('')

    try {
      const data = await progressApi.get()
      setProgressData(data)
    } catch (progressError) {
      setError(progressError.message || t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProgress()
  }, [documents.length])

  const stats = progressData?.stats || {}
  const readiness = progressData?.readiness || { subjects: [], overallPct: 0 }
  const activity = progressData?.activity || { cells: [], streakDays: 0, activeDays: 0 }
  const weakTopics = progressData?.weakTopics || []
  const topWeakTopic = weakTopics[0] || null
  const coachTitle = topWeakTopic
    ? `Focus next on ${topWeakTopic.topic}`
    : documents.length
      ? 'You are ready for your next study step'
      : 'Start your first study loop'
  const coachDescription = topWeakTopic
    ? topWeakTopic.score === null
      ? `This topic has not been covered properly yet. Start with a focused quiz or flashcards to turn it into a strength.`
      : `Your recent performance shows this is your weakest area right now at ${topWeakTopic.score}%. Review it first before moving on.`
    : documents.length
      ? readiness.overallPct >= 70
        ? 'Your readiness is building well. The next high-impact step is a full mock test to check exam pressure.'
        : 'Keep the loop moving: roadmap, focused practice, then a mock test.'
      : 'Upload a PDF and we will build your roadmap, practice loop, and revision targets.'

  const statCards = [
    {
      label: t('progress.stats.streak'),
      value: `${stats.streakDays || 0} ${stats.streakDays === 1 ? 'day' : 'days'}`,
      change: stats.activeDays ? `${stats.activeDays} active days in last 28` : 'Start your first study session',
    },
    {
      label: t('progress.stats.quizzes'),
      value: String(stats.quizzesDone || 0),
      change: stats.quizzesLast7Days ? `${stats.quizzesLast7Days} in last 7 days` : 'No quizzes completed this week',
    },
    {
      label: t('progress.stats.best'),
      value: stats.bestScore ? formatPercentage(stats.bestScore) : '0%',
      change: stats.bestScoreLabel || 'No scored quiz yet',
    },
    {
      label: t('progress.stats.flashcards'),
      value: String(stats.flashcardsCount || 0),
      change: stats.flashcardSets ? `${stats.flashcardSets} sets generated` : 'No flashcards yet',
    },
  ]

  const mockStatCards = [
    {
      label: 'Mock Tests Taken',
      value: String(stats.mockTestsTaken || 0),
      change: stats.mockTestsLast7Days ? `${stats.mockTestsLast7Days} in last 7 days` : 'No mock tests this week',
    },
    {
      label: 'Mock Test Avg Score',
      value: stats.mockTestsTaken ? formatPercentage(stats.mockAvgScore) : '—',
      change: stats.mockBestGrade ? `Best grade: ${stats.mockBestGrade}` : 'Complete a mock test to see avg',
    },
    {
      label: 'Best Mock Score',
      value: stats.mockTestsTaken ? formatPercentage(stats.mockBestScore) : '—',
      change: stats.mockTestsInProgress ? `${stats.mockTestsInProgress} test${stats.mockTestsInProgress > 1 ? 's' : ''} in progress` : 'No tests in progress',
    },
  ]

  function practiceTopic(topic) {
    if (topic?.documentId) {
      setSelectedDocumentId(topic.documentId)
    }
    if (topic?.topic) {
      openStudyFocus?.({
        documentId: topic.documentId,
        topic: topic.topic,
        screen: 'quiz',
        origin: 'progress',
      })
      return
    }
    setScreen('quiz')
  }

  return (
    <div className="relative flex flex-col flex-1 min-h-0">
      <TopBar
        title={t('progress.title')}
        subtitle={t('progress.subtitle')}
        action={
          <button onClick={() => setScreen('mocktest')} className="px-4 py-2 text-white text-sm rounded-xl transition-colors pp-app-button-primary">
            {t('progress.mockExam')}
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-7">
        {error && (
          <div className="mb-4 rounded-xl border border-[rgba(255,118,105,0.2)] bg-[rgba(255,118,105,0.08)] px-4 py-3 text-sm text-[#ffd6cf]">
            {error}
          </div>
        )}

        {!documents.length ? (
          <div className="rounded-2xl pp-app-card px-6 py-10 text-sm pp-app-subtle">
            Upload a document and complete a quiz to unlock your live progress dashboard.
          </div>
        ) : (
          <>
            <div className="mb-6 sm:mb-8 rounded-[1.7rem] pp-app-card px-5 py-5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--pp-coral)] mb-2">Next Best Step</div>
              <div className="text-lg font-semibold text-white mb-2">{coachTitle}</div>
              <div className="text-sm pp-app-subtle leading-relaxed mb-4">{coachDescription}</div>
              <div className="flex flex-wrap gap-3">
                {topWeakTopic ? (
                  <>
                    <button
                      onClick={() => openStudyFocus?.({
                        documentId: topWeakTopic.documentId,
                        topic: topWeakTopic.topic,
                        screen: 'quiz',
                        origin: 'progress',
                      })}
                      className="px-4 py-2 rounded-xl text-white text-sm transition-colors pp-app-button-primary"
                    >
                      Take focused quiz
                    </button>
                    <button
                      onClick={() => openStudyFocus?.({
                        documentId: topWeakTopic.documentId,
                        topic: topWeakTopic.topic,
                        screen: 'flashcards',
                        origin: 'progress',
                      })}
                      className="px-4 py-2 rounded-xl border pp-app-border bg-white/5 text-[var(--pp-cyan)] text-sm hover:bg-white/10 transition-colors"
                    >
                      Review with flashcards
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setScreen('roadmap')}
                      className="px-4 py-2 rounded-xl text-white text-sm transition-colors pp-app-button-primary"
                    >
                      Open roadmap
                    </button>
                    <button
                      onClick={() => setScreen('mocktest')}
                      className="px-4 py-2 rounded-xl border pp-app-border bg-white/5 text-white text-sm hover:bg-white/10 transition-colors"
                    >
                      Take mock test
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
              {statCards.map((stat) => <StatCard key={stat.label} {...stat} />)}
            </div>

            {/* Mock Test Stats */}
            {stats.mockTestsTotal > 0 && (
              <div className="mb-6 sm:mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-[10px] font-semibold uppercase tracking-widest pp-app-muted">Mock Test Performance</div>
                  {stats.mockTestsInProgress > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(255,118,105,0.12)', color: '#ffb3a7', border: '1px solid rgba(255,118,105,0.2)' }}>
                      {stats.mockTestsInProgress} in progress
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  {mockStatCards.map((stat) => <StatCard key={stat.label} {...stat} />)}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mb-4 sm:mb-5">
              <div className="pp-app-card rounded-xl p-5">
                <div className="text-[10px] font-medium uppercase tracking-widest pp-app-muted mb-5">{t('progress.readiness')}</div>
                <div className="flex flex-col gap-4">
                  {readiness.subjects.length ? readiness.subjects.map((subject, index) => (
                    <div key={subject.label}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-white font-medium">{subject.label}</span>
                        <span className="pp-app-muted">{subject.pct}%</span>
                      </div>
                      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${SUBJECT_COLORS[index % SUBJECT_COLORS.length]}`}
                          style={{ width: `${subject.pct}%` }}
                        />
                      </div>
                    </div>
                  )) : (
                    <div className="text-sm pp-app-subtle">Your subject readiness will appear after your first upload.</div>
                  )}
                </div>
                <div className="mt-6 pt-5 border-t pp-app-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs pp-app-muted">{t('progress.overallReady')}</span>
                    <span className="text-sm font-semibold text-white">{readiness.overallPct}%</span>
                  </div>
                  <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[var(--pp-coral)] to-[var(--pp-cyan)] rounded-full transition-all duration-700" style={{ width: `${readiness.overallPct}%` }} />
                  </div>
                  <p className="text-xs pp-app-muted mt-2">
                    Based on {documents.length} uploaded {documents.length === 1 ? 'document' : 'documents'} and your quiz activity.
                  </p>
                </div>
              </div>

              <div className="pp-app-card rounded-xl p-5">
                <div className="text-[10px] font-medium uppercase tracking-widest pp-app-muted mb-5">{t('progress.activity')}</div>
                <div className="grid grid-cols-7 gap-1.5">
                  {activity.cells.map((level, index) => <HeatCell key={index} level={level} />)}
                </div>
                <div className="mt-4 flex items-center justify-between text-[11px] pp-app-muted">
                  <span>{t('progress.daysAgo')}</span>
                  <div className="flex items-center gap-1">
                    <span>{t('progress.less')}</span>
                    {[0, 1, 2, 3].map((level) => <HeatCell key={level} level={level} />)}
                    <span>{t('progress.more')}</span>
                  </div>
                  <span>{t('progress.today')}</span>
                </div>
                <div className="mt-5 pt-5 border-t pp-app-border flex items-center gap-3">
                  <div className="w-9 h-9 bg-[rgba(255,118,105,0.12)] rounded-lg flex items-center justify-center text-lg border border-[rgba(255,118,105,0.18)]">🔥</div>
                  <div>
                    <div className="text-sm font-semibold text-white">{t('progress.streak', { count: activity.streakDays || 0 })}</div>
                    <div className="text-xs pp-app-muted">
                      {activity.activeDays ? `${activity.activeDays} active days in the last 28.` : 'No study activity yet this month.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pp-app-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-medium uppercase tracking-widest pp-app-muted">{t('progress.weakTopics')}</div>
                <button onClick={() => setScreen('quiz')} className="text-xs text-[var(--pp-cyan)] hover:text-white transition-colors">{t('progress.practiceAll')}</button>
              </div>
              <div className="flex flex-col gap-2">
                {weakTopics.length ? weakTopics.map((topic) => {
                  const strength = topic.score ?? topic.readinessPct ?? 20
                  const barColor = topic.score === null
                    ? 'bg-zinc-300'
                    : topic.score < 55
                      ? 'bg-red-400'
                      : topic.score < 65
                        ? 'bg-amber-400'
                        : 'bg-yellow-400'

                  return (
                    <div key={topic.id} className="flex items-center gap-4 py-3 border-b pp-app-border last:border-0">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-white block truncate">{topic.topic}</span>
                        <div className="text-xs pp-app-muted mt-0.5">{topic.detail}</div>
                        <div className="mt-1.5 h-1 bg-white/8 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${strength}%` }} />
                        </div>
                      </div>
                      <span className={`text-xs font-semibold border px-2.5 py-1 rounded-full shrink-0 ${topic.score === null ? 'bg-white/5 text-[var(--pp-text-soft)] border-[rgba(130,147,183,0.18)]' : 'bg-[rgba(255,118,105,0.08)] text-[#ffd6cf] border-[rgba(255,118,105,0.18)]'}`}>
                        {topic.score === null ? 'Review' : `${topic.score}%`}
                      </span>
                      <button onClick={() => practiceTopic(topic)} className="text-xs pp-app-muted hover:text-[var(--pp-cyan)] transition-colors shrink-0">
                        {t('progress.quizLink')}
                      </button>
                    </div>
                  )
                }) : (
                  <div className="text-sm pp-app-subtle py-2">No weak topics yet. Complete a few quizzes and your revision targets will appear here.</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      {loading && <AppLoader overlay subtitle="Loading your progress dashboard" />}
    </div>
  )
}
