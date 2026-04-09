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
  const bg = level === 0 ? 'bg-zinc-100' : level === 1 ? 'bg-violet-100' : level === 2 ? 'bg-violet-300' : 'bg-violet-600'
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
          <button onClick={() => setScreen('mocktest')} className="px-4 py-2 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-700 transition-colors">
            {t('progress.mockExam')}
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-7">
        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!documents.length ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
            Upload a document and complete a quiz to unlock your live progress dashboard.
          </div>
        ) : (
          <>
            <div className="mb-6 sm:mb-8 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 via-white to-emerald-50 px-5 py-5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-violet-500 mb-2">Next Best Step</div>
              <div className="text-lg font-semibold text-zinc-900 mb-2">{coachTitle}</div>
              <div className="text-sm text-zinc-600 leading-relaxed mb-4">{coachDescription}</div>
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
                      className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm hover:bg-zinc-700 transition-colors"
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
                      className="px-4 py-2 rounded-lg border border-violet-200 bg-white text-violet-700 text-sm hover:bg-violet-50 transition-colors"
                    >
                      Review with flashcards
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setScreen('roadmap')}
                      className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm hover:bg-zinc-700 transition-colors"
                    >
                      Open roadmap
                    </button>
                    <button
                      onClick={() => setScreen('mocktest')}
                      className="px-4 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-700 text-sm hover:bg-zinc-50 transition-colors"
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
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Mock Test Performance</div>
                  {stats.mockTestsInProgress > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}>
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
              <div className="bg-white border border-zinc-100 rounded-xl p-5">
                <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-300 mb-5">{t('progress.readiness')}</div>
                <div className="flex flex-col gap-4">
                  {readiness.subjects.length ? readiness.subjects.map((subject, index) => (
                    <div key={subject.label}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-zinc-600 font-medium">{subject.label}</span>
                        <span className="text-zinc-400">{subject.pct}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${SUBJECT_COLORS[index % SUBJECT_COLORS.length]}`}
                          style={{ width: `${subject.pct}%` }}
                        />
                      </div>
                    </div>
                  )) : (
                    <div className="text-sm text-zinc-500">Your subject readiness will appear after your first upload.</div>
                  )}
                </div>
                <div className="mt-6 pt-5 border-t border-zinc-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-400">{t('progress.overallReady')}</span>
                    <span className="text-sm font-semibold text-zinc-800">{readiness.overallPct}%</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full transition-all duration-700" style={{ width: `${readiness.overallPct}%` }} />
                  </div>
                  <p className="text-xs text-zinc-400 mt-2">
                    Based on {documents.length} uploaded {documents.length === 1 ? 'document' : 'documents'} and your quiz activity.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-zinc-100 rounded-xl p-5">
                <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-300 mb-5">{t('progress.activity')}</div>
                <div className="grid grid-cols-7 gap-1.5">
                  {activity.cells.map((level, index) => <HeatCell key={index} level={level} />)}
                </div>
                <div className="mt-4 flex items-center justify-between text-[11px] text-zinc-300">
                  <span>{t('progress.daysAgo')}</span>
                  <div className="flex items-center gap-1">
                    <span>{t('progress.less')}</span>
                    {[0, 1, 2, 3].map((level) => <HeatCell key={level} level={level} />)}
                    <span>{t('progress.more')}</span>
                  </div>
                  <span>{t('progress.today')}</span>
                </div>
                <div className="mt-5 pt-5 border-t border-zinc-50 flex items-center gap-3">
                  <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center text-lg">🔥</div>
                  <div>
                    <div className="text-sm font-semibold text-zinc-800">{t('progress.streak', { count: activity.streakDays || 0 })}</div>
                    <div className="text-xs text-zinc-400">
                      {activity.activeDays ? `${activity.activeDays} active days in the last 28.` : 'No study activity yet this month.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-zinc-100 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-300">{t('progress.weakTopics')}</div>
                <button onClick={() => setScreen('quiz')} className="text-xs text-violet-600 hover:text-violet-800 transition-colors">{t('progress.practiceAll')}</button>
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
                    <div key={topic.id} className="flex items-center gap-4 py-3 border-b border-zinc-50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-zinc-700 block truncate">{topic.topic}</span>
                        <div className="text-xs text-zinc-400 mt-0.5">{topic.detail}</div>
                        <div className="mt-1.5 h-1 bg-zinc-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${strength}%` }} />
                        </div>
                      </div>
                      <span className={`text-xs font-semibold border px-2.5 py-1 rounded-full shrink-0 ${topic.score === null ? 'bg-zinc-50 text-zinc-500 border-zinc-200' : 'bg-red-50 text-red-500 border-red-100'}`}>
                        {topic.score === null ? 'Review' : `${topic.score}%`}
                      </span>
                      <button onClick={() => practiceTopic(topic)} className="text-xs text-zinc-400 hover:text-violet-600 transition-colors shrink-0">
                        {t('progress.quizLink')}
                      </button>
                    </div>
                  )
                }) : (
                  <div className="text-sm text-zinc-500 py-2">No weak topics yet. Complete a few quizzes and your revision targets will appear here.</div>
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
