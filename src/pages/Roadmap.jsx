import { useEffect, useMemo, useState } from 'react'
import AppLoader from '../components/AppLoader'
import TopBar from '../components/TopBar'
import { useT } from '../i18n'
import { studyPlanApi } from '../lib/api'

const difficultyStyles = {
  easy: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20',
  medium: 'bg-amber-500/10 text-amber-300 border-amber-400/20',
  hard: 'bg-rose-500/10 text-rose-300 border-rose-400/20',
}

const masteryStyles = {
  WEAK: 'bg-red-500/10 text-red-300 border-red-400/20',
  IMPROVING: 'bg-amber-500/10 text-amber-300 border-amber-400/20',
  STRONG: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20',
}

function TopicChip({ children, tone = 'neutral' }) {
  const toneClass = tone === 'violet'
    ? 'border-[rgba(255,118,105,0.2)] bg-[rgba(255,118,105,0.12)] text-white'
    : 'pp-app-chip'

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass}`}>
      {children}
    </span>
  )
}

function ScoreCard({ label, value, hint }) {
  return (
    <div className="rounded-xl pp-app-card px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest pp-app-muted mb-1">{label}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="text-xs pp-app-subtle mt-1">{hint}</div>
    </div>
  )
}

function PlanDayCard({ day, session, isCurrent }) {
  const statusLabel = session?.completed_at
    ? session.mastery_status || 'DONE'
    : isCurrent
      ? 'TODAY'
      : 'UP NEXT'
  const statusClass = session?.completed_at
    ? masteryStyles[session.mastery_status] || 'pp-app-chip'
    : isCurrent
      ? 'border-[rgba(255,118,105,0.2)] bg-[rgba(255,118,105,0.12)] text-white'
      : 'pp-app-chip'

  return (
    <div className={`rounded-2xl border p-5 transition-colors ${isCurrent ? 'border-[rgba(255,118,105,0.2)] bg-[rgba(255,118,105,0.08)]' : 'pp-app-card'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest pp-app-muted mb-1">Day {day.dayNumber}</div>
          <div className="text-base font-semibold text-white">{day.summary}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${difficultyStyles[day.difficulty] || difficultyStyles.medium}`}>
            {day.difficulty}
          </span>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClass}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {day.topics.map((topic) => <TopicChip key={`${day.dayNumber}-${topic}`} tone={isCurrent ? 'violet' : 'neutral'}>{topic}</TopicChip>)}
      </div>

      <div className="text-sm pp-app-subtle leading-relaxed mb-3">{day.focusReason}</div>
      <div className="text-xs pp-app-muted">{day.objective}</div>
      {session?.completed_at && session?.overall_score !== null && session?.overall_score !== undefined && (
        <div className="mt-3 border-t pp-app-border pt-3 text-xs pp-app-muted">
          Mission score: <span className="font-semibold text-white">{session.overall_score}%</span>
        </div>
      )}
    </div>
  )
}

export default function Roadmap({
  onOpenSidebar,
  documents = [],
  activeDocument,
  setSelectedDocumentId,
  refreshAppData,
  setScreen,
}) {
  const { t } = useT()
  const [planData, setPlanData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [error, setError] = useState('')

  const activeDocumentIsPdf = activeDocument?.mime_type === 'application/pdf'
  const sessionsByDay = useMemo(() => {
    const map = new Map()
    ;(planData?.sessions || []).forEach((session) => {
      map.set(Number(session.day_number), session)
    })
    return map
  }, [planData?.sessions])

  async function loadPlan({ showLoader = true } = {}) {
    if (!activeDocument?.id || !activeDocumentIsPdf) {
      setPlanData(null)
      setError('')
      return
    }

    if (showLoader) {
      setLoading(true)
    }
    setError('')

    try {
      const data = await studyPlanApi.get(activeDocument.id)
      setPlanData(data)
    } catch (loadError) {
      setError(loadError.message || 'We could not load the study plan yet. Please try again.')
    } finally {
      if (showLoader) {
        setLoading(false)
      }
    }
  }

  async function handleGeneratePlan() {
    if (!activeDocument?.id || generatingPlan) return

    setGeneratingPlan(true)
    setError('')

    try {
      const data = await studyPlanApi.generatePlan(activeDocument.id)
      setPlanData(data)
      await refreshAppData?.()
    } catch (planError) {
      setError(planError.message || 'We could not create a study plan yet. Please try again.')
    } finally {
      setGeneratingPlan(false)
    }
  }

  useEffect(() => {
    void loadPlan()
  }, [activeDocument?.id, activeDocument?.mime_type])

  const analysis = planData?.plan?.analysis || null
  const roadmapDays = planData?.plan?.roadmap?.days || []
  const completedDays = planData?.completedDays || 0
  const totalDays = planData?.plan?.roadmap?.totalDays || roadmapDays.length || 0
  const overallProgress = totalDays ? Math.round((completedDays / totalDays) * 100) : 0

  return (
    <div className="relative flex flex-col flex-1 min-h-0">
      <TopBar
        onOpenSidebar={onOpenSidebar}
        title={t('roadmap.title')}
        subtitle={activeDocument ? `${activeDocument.subject} · ${totalDays || (analysis?.totalTopics || 0)} study days` : 'Select a document to build your study plan.'}
        action={activeDocument && totalDays ? (
          <div className="flex items-center gap-3">
            <span className="text-xs pp-app-muted">Roadmap progress</span>
            <div className="w-24 h-1.5 bg-white/8 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${overallProgress}%` }} />
            </div>
            <span className="text-xs font-medium text-emerald-500">{overallProgress}%</span>
          </div>
        ) : null}
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-7 max-w-5xl w-full">
        {!!documents.length && (
          <div className="flex flex-wrap gap-2 mb-6">
            {documents.map((document) => (
              <button
                key={document.id}
                onClick={() => setSelectedDocumentId(document.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${activeDocument?.id === document.id ? 'pp-app-chip-active' : 'pp-app-chip hover:border-[rgba(102,247,226,0.28)] hover:text-[var(--pp-cyan)]'}`}
              >
                {document.title}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!documents.length ? (
          <div className="rounded-2xl pp-app-card px-6 py-10 text-sm pp-app-subtle">
            Upload a PDF first and we will turn it into a daily study system.
          </div>
        ) : !activeDocument ? (
          <div className="rounded-2xl pp-app-card px-6 py-10 text-sm pp-app-subtle">
            Select a document above to build its roadmap.
          </div>
        ) : !activeDocumentIsPdf ? (
          <div className="rounded-2xl pp-app-card px-6 py-10 text-sm pp-app-subtle">
            Study roadmaps are available for PDF documents only right now.
          </div>
        ) : !planData?.plan ? (
          <div className="rounded-3xl pp-app-card px-6 py-7 sm:px-8">
            <div className="max-w-2xl">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-violet-500 mb-2">Study Coach</div>
              <div className="text-2xl font-semibold text-white mb-3">Turn this PDF into a clean study roadmap</div>
              <p className="text-sm pp-app-subtle leading-relaxed mb-6">
                We will extract topics and subtopics, estimate difficulty, spot repeated concepts, and build a 7 to 30 day roadmap. Your daily mission now lives in its own separate section.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleGeneratePlan}
                  disabled={generatingPlan}
                  className="px-5 py-2.5 rounded-xl text-white text-sm transition-colors disabled:opacity-60 pp-app-button-primary"
                >
                  Build my roadmap
                </button>
                <button
                  onClick={() => setScreen('missions')}
                  className="px-5 py-2.5 rounded-xl border pp-app-border text-[var(--pp-text-soft)] text-sm hover:bg-white/5 transition-colors"
                >
                  Open daily missions
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-5">
            <div className="space-y-5">
              <div className="rounded-3xl pp-app-card p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest pp-app-muted mb-2">Content Analysis</div>
                    <div className="text-lg font-semibold text-white">{analysis?.totalTopics || 0} extracted topics</div>
                  </div>
                  <button
                    onClick={handleGeneratePlan}
                    disabled={generatingPlan}
                    className="text-xs px-3.5 py-2 rounded-lg border pp-app-border text-[var(--pp-text-soft)] hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    Refresh roadmap
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <ScoreCard label="Easy" value={String(analysis?.difficultyBreakdown?.easy || 0)} hint="Warm-up ideas" />
                  <ScoreCard label="Medium" value={String(analysis?.difficultyBreakdown?.medium || 0)} hint="Core build" />
                  <ScoreCard label="Hard" value={String(analysis?.difficultyBreakdown?.hard || 0)} hint="Stretch zone" />
                </div>

                <div className="mb-4">
                  <div className="text-sm font-semibold text-white mb-2">Repeated concepts</div>
                  <div className="flex flex-wrap gap-2">
                    {(analysis?.repeatedConcepts || []).length ? analysis.repeatedConcepts.map((concept) => (
                      <TopicChip key={concept.term}>
                        {concept.term} {concept.count ? `· ${concept.count}x` : ''}
                      </TopicChip>
                    )) : (
                      <div className="text-sm pp-app-subtle">Repeated concepts will appear here once the PDF is analyzed deeply.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-[rgba(255,118,105,0.18)] bg-[linear-gradient(135deg,rgba(255,118,105,0.14),rgba(102,247,226,0.06))] p-4">
                  <div className="text-sm font-semibold text-white mb-1">Daily missions are separate now</div>
                  <div className="text-sm pp-app-subtle leading-relaxed mb-3">
                    Roadmap stays focused on the full study plan. Open the Daily Missions tab when you want today&apos;s 20-minute task, quiz, mini test, and feedback.
                  </div>
                  <button
                    onClick={() => setScreen('missions')}
                    className="px-4 py-2 rounded-lg border pp-app-border text-[var(--pp-cyan)] text-sm hover:bg-white/5 transition-colors"
                  >
                    Open today&apos;s mission
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl pp-app-card p-5">
              <div className="text-[10px] font-semibold uppercase tracking-widest pp-app-muted mb-2">7 to 30 Day Roadmap</div>
              <div className="text-lg font-semibold text-white mb-4">Daily progression from easy to hard</div>
              <div className="grid gap-3 max-h-[70vh] overflow-y-auto pr-1">
                {roadmapDays.map((day) => (
                  <PlanDayCard
                    key={day.dayNumber}
                    day={day}
                    session={sessionsByDay.get(day.dayNumber)}
                    isCurrent={day.dayNumber === planData.currentDayNumber}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {(loading || generatingPlan) && (
        <AppLoader
          overlay
          subtitle={generatingPlan ? 'Building your study roadmap and analysis' : 'Loading your study roadmap'}
        />
      )}
    </div>
  )
}
