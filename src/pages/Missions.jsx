import { useEffect, useMemo, useState } from 'react'
import AppLoader from '../components/AppLoader'
import TopBar from '../components/TopBar'
import { useT } from '../i18n'
import { studyPlanApi } from '../lib/api'

const masteryStyles = {
  WEAK: 'bg-red-50 text-red-700 border-red-100',
  IMPROVING: 'bg-amber-50 text-amber-700 border-amber-100',
  STRONG: 'bg-emerald-50 text-emerald-700 border-emerald-100',
}

function TopicChip({ children, tone = 'neutral' }) {
  const toneClass = tone === 'violet'
    ? 'bg-violet-50 text-violet-700 border-violet-100'
    : 'bg-zinc-50 text-zinc-600 border-zinc-100'

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass}`}>
      {children}
    </span>
  )
}

function ScoreCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">{label}</div>
      <div className="text-lg font-semibold text-zinc-900">{value}</div>
      <div className="text-xs text-zinc-500 mt-1">{hint}</div>
    </div>
  )
}

function QuestionBlock({ title, subtitle, questions = [], answers = [], setAnswers, disabled = false, accent = 'violet' }) {
  const ringClass = accent === 'rose'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-violet-200 bg-violet-50 text-violet-700'

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5">
      <div className="mb-5">
        <div className="text-lg font-semibold text-zinc-900">{title}</div>
        <div className="text-sm text-zinc-500 mt-1">{subtitle}</div>
      </div>

      <div className="flex flex-col gap-4">
        {questions.map((question, index) => (
          <div key={question.id || `${title}-${index}`} className="rounded-xl border border-zinc-100 p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full border ${ringClass}`}>
                {question.type || 'conceptual'}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-300">
                {question.topic}
              </span>
            </div>
            <div className="text-sm font-medium text-zinc-800 mb-3">
              {index + 1}. {question.question}
            </div>
            <div className="grid gap-2">
              {question.options.map((option, optionIndex) => {
                const selected = answers[index] === optionIndex
                return (
                  <button
                    key={`${question.id || index}-${optionIndex}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return
                      setAnswers((current) => {
                        const next = [...current]
                        next[index] = optionIndex
                        return next
                      })
                    }}
                    className={`text-left rounded-xl border px-3.5 py-3 text-sm transition-colors ${selected ? ringClass : 'border-zinc-100 text-zinc-700 hover:border-zinc-200 hover:bg-zinc-50'} ${disabled ? 'cursor-default' : ''}`}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Missions({
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
  const [missionLoading, setMissionLoading] = useState(false)
  const [submittingMission, setSubmittingMission] = useState(false)
  const [error, setError] = useState('')
  const [quickQuizAnswers, setQuickQuizAnswers] = useState([])
  const [miniTestAnswers, setMiniTestAnswers] = useState([])
  const [missionResult, setMissionResult] = useState(null)

  const activeDocumentIsPdf = activeDocument?.mime_type === 'application/pdf'
  const currentMission = planData?.currentSession?.mission || null
  const currentSession = planData?.currentSession || null
  const completedDays = planData?.completedDays || 0
  const totalDays = planData?.plan?.roadmap?.totalDays || planData?.plan?.roadmap?.days?.length || 0
  const overallProgress = totalDays ? Math.round((completedDays / totalDays) * 100) : 0
  const analysis = planData?.plan?.analysis || null

  async function loadPlan({ showLoader = true } = {}) {
    if (!activeDocument?.id || !activeDocumentIsPdf) {
      setPlanData(null)
      setMissionResult(null)
      setQuickQuizAnswers([])
      setMiniTestAnswers([])
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

  async function ensureMissionLoaded(nextPlanData = null) {
    const target = nextPlanData || planData
    if (!activeDocument?.id || !target?.plan || !target?.currentDay || target?.currentSession?.mission || missionLoading) {
      return
    }

    setMissionLoading(true)
    setError('')

    try {
      const data = await studyPlanApi.generateMission(activeDocument.id)
      setPlanData(data)
    } catch (missionError) {
      setError(missionError.message || 'We could not build today’s mission yet. Please try again.')
    } finally {
      setMissionLoading(false)
    }
  }

  async function handleGeneratePlan() {
    if (!activeDocument?.id || generatingPlan) return

    setGeneratingPlan(true)
    setError('')
    setMissionResult(null)

    try {
      const data = await studyPlanApi.generatePlan(activeDocument.id)
      setPlanData(data)
      await ensureMissionLoaded(data)
      await refreshAppData?.()
    } catch (planError) {
      setError(planError.message || 'We could not create a study plan yet. Please try again.')
    } finally {
      setGeneratingPlan(false)
    }
  }

  async function handleSubmitMission() {
    if (!currentSession?.id || !currentMission || submittingMission) return

    setSubmittingMission(true)
    setError('')

    try {
      const data = await studyPlanApi.submitMission(currentSession.id, quickQuizAnswers, miniTestAnswers)
      setPlanData((current) => ({
        ...current,
        ...data,
      }))
      setMissionResult(data.evaluation)
      await refreshAppData?.()
    } catch (submitError) {
      setError(submitError.message || 'We could not score that mission yet. Please try again.')
    } finally {
      setSubmittingMission(false)
    }
  }

  useEffect(() => {
    void loadPlan()
  }, [activeDocument?.id, activeDocument?.mime_type])

  useEffect(() => {
    if (!planData?.plan || !planData?.currentDay || planData?.currentSession?.mission) return
    void ensureMissionLoaded(planData)
  }, [planData?.plan?.id, planData?.currentDay?.dayNumber, planData?.currentSession?.id])

  useEffect(() => {
    const quickCount = currentMission?.quickQuiz?.length || 0
    const miniCount = currentMission?.miniTest?.length || 0
    const savedQuickAnswers = Array.isArray(currentSession?.answers?.quickQuiz) ? currentSession.answers.quickQuiz : []
    const savedMiniAnswers = Array.isArray(currentSession?.answers?.miniTest) ? currentSession.answers.miniTest : []

    setQuickQuizAnswers(Array.from({ length: quickCount }, (_, index) => (
      Number.isInteger(savedQuickAnswers[index]) ? savedQuickAnswers[index] : null
    )))
    setMiniTestAnswers(Array.from({ length: miniCount }, (_, index) => (
      Number.isInteger(savedMiniAnswers[index]) ? savedMiniAnswers[index] : null
    )))

    if (currentSession?.completed_at) {
      setMissionResult({
        overallScore: currentSession.overall_score,
        quickQuiz: { pct: currentSession.quick_quiz_score },
        miniTest: { pct: currentSession.mini_test_score },
        masteryStatus: currentSession.mastery_status,
        feedback: currentSession.feedback || {},
      })
    } else {
      setMissionResult(null)
    }
  }, [currentSession?.id, currentSession?.completed_at, currentMission?.quickQuiz?.length, currentMission?.miniTest?.length])

  const quickReady = quickQuizAnswers.length > 0 && quickQuizAnswers.every((answer) => answer !== null)
  const miniReady = miniTestAnswers.length > 0 && miniTestAnswers.every((answer) => answer !== null)
  const missionReadyToSubmit = quickReady && miniReady

  return (
    <div className="relative flex flex-col flex-1 min-h-0">
      <TopBar
        onOpenSidebar={onOpenSidebar}
        title="Daily Missions"
        subtitle={activeDocument ? `${activeDocument.subject} · Day ${planData?.currentDayNumber || 1} of ${totalDays || (analysis?.totalTopics || 0)}` : 'Select a document to open today’s mission.'}
        action={activeDocument && totalDays ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">Mission progress</span>
            <div className="w-24 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${overallProgress}%` }} />
            </div>
            <span className="text-xs font-medium text-emerald-500">{overallProgress}%</span>
          </div>
        ) : null}
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-7 max-w-4xl w-full">
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
          <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!documents.length ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
            Upload a PDF first and we will turn it into a daily study system.
          </div>
        ) : !activeDocument ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
            Select a document above to open its daily mission.
          </div>
        ) : !activeDocumentIsPdf ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
            Daily missions are available for PDF documents only right now.
          </div>
        ) : !planData?.plan ? (
          <div className="rounded-3xl border border-zinc-100 bg-white px-6 py-7 sm:px-8">
            <div className="max-w-2xl">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-violet-500 mb-2">Study Coach</div>
              <div className="text-2xl font-semibold text-zinc-900 mb-3">Build the roadmap first, then start daily missions</div>
              <p className="text-sm text-zinc-600 leading-relaxed mb-6">
                We need one study plan before we can generate today&apos;s mission. Once that is ready, this tab becomes your daily 20-minute session space.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleGeneratePlan}
                  disabled={generatingPlan}
                  className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white text-sm hover:bg-zinc-700 transition-colors disabled:opacity-60"
                >
                  Build my study plan
                </button>
                <button
                  onClick={() => setScreen('roadmap')}
                  className="px-5 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 text-sm hover:bg-zinc-50 transition-colors"
                >
                  Open roadmap
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-emerald-50 px-6 py-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-violet-500 mb-2">Today&apos;s Mission</div>
                  <div className="text-2xl font-semibold text-zinc-900">
                    Day {planData.currentDayNumber}: {currentMission?.missionTitle || planData.currentDay?.summary}
                  </div>
                  <p className="text-sm text-zinc-600 mt-2 max-w-2xl leading-relaxed">
                    {currentMission?.missionSummary || planData.currentDay?.focusReason}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {missionResult?.masteryStatus && (
                    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${masteryStyles[missionResult.masteryStatus] || masteryStyles.IMPROVING}`}>
                      {missionResult.masteryStatus}
                    </span>
                  )}
                  <button
                    onClick={() => setScreen('roadmap')}
                    className="px-4 py-2 rounded-lg border border-violet-200 bg-white text-violet-700 text-sm hover:bg-violet-50 transition-colors"
                  >
                    View roadmap
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {(currentMission?.focusTopics || planData.currentDay?.topics || []).map((topic) => (
                  <TopicChip key={topic} tone="violet">{topic}</TopicChip>
                ))}
              </div>

              <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-4 text-sm text-zinc-700 leading-relaxed">
                <div className="font-semibold text-zinc-900 mb-1">Exactly what to do next</div>
                {currentMission?.exactNextStep || 'Generate today’s mission and start with the first concept card.'}
              </div>
            </div>

            {currentMission ? (
              <>
                <div className="rounded-2xl border border-zinc-100 bg-white p-5">
                  <div className="text-lg font-semibold text-zinc-900 mb-1">Concept Learning · 10 min</div>
                  <div className="text-sm text-zinc-500 mb-5">Read these one by one, say the main idea out loud, then move straight into the quick quiz.</div>
                  <div className="grid gap-3">
                    {currentMission.conceptLearning.map((item, index) => (
                      <div key={`${item.topic}-${index}`} className="rounded-2xl border border-zinc-100 p-4">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-zinc-900">{item.topic}</span>
                          <TopicChip>{index + 1} / {currentMission.conceptLearning.length}</TopicChip>
                        </div>
                        <div className="text-sm text-zinc-700 leading-relaxed mb-2">{item.simpleExplanation}</div>
                        <div className="text-xs text-violet-700 mb-1">{item.memoryHook}</div>
                        <div className="text-xs text-zinc-500">{item.nextAction}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <QuestionBlock
                  title="Quick Quiz · 5 min"
                  subtitle="Five fast checks. Mix of concept + application. Don’t overthink it."
                  questions={currentMission.quickQuiz}
                  answers={quickQuizAnswers}
                  setAnswers={setQuickQuizAnswers}
                  disabled={Boolean(currentSession?.completed_at)}
                />

                <QuestionBlock
                  title="Mini Test · 5 to 8 min"
                  subtitle="A slightly tougher round to see what actually stuck."
                  questions={currentMission.miniTest}
                  answers={miniTestAnswers}
                  setAnswers={setMiniTestAnswers}
                  disabled={Boolean(currentSession?.completed_at)}
                  accent="rose"
                />

                {!currentSession?.completed_at && (
                  <div className="rounded-2xl border border-zinc-100 bg-white p-5">
                    <div className="text-sm text-zinc-600 mb-4">
                      Finish all answers, then submit the mission so we can mark topics as <span className="font-semibold text-red-500">WEAK</span>, <span className="font-semibold text-amber-600">IMPROVING</span>, or <span className="font-semibold text-emerald-600">STRONG</span> and adjust what comes next.
                    </div>
                    <button
                      onClick={handleSubmitMission}
                      disabled={!missionReadyToSubmit || submittingMission}
                      className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white text-sm hover:bg-zinc-700 transition-colors disabled:opacity-50"
                    >
                      Submit today&apos;s mission
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-zinc-100 bg-white px-6 py-10 text-sm text-zinc-500">
                We&apos;re preparing today&apos;s 20-minute mission now.
              </div>
            )}

            {missionResult && (
              <div className="rounded-3xl border border-zinc-100 bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">Session Feedback</div>
                    <div className="text-2xl font-semibold text-zinc-900">{missionResult.feedback?.headline || 'Session complete'}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 min-w-[240px]">
                    <ScoreCard label="Quick Quiz" value={`${missionResult.quickQuiz?.pct || 0}%`} hint="Fast check" />
                    <ScoreCard label="Mini Test" value={`${missionResult.miniTest?.pct || 0}%`} hint="Harder round" />
                    <ScoreCard label="Overall" value={`${missionResult.overallScore || 0}%`} hint={missionResult.masteryStatus || 'Status'} />
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                    <div className="text-sm font-semibold text-emerald-900 mb-1">What you did well</div>
                    <div className="text-sm text-emerald-800 leading-relaxed">{missionResult.feedback?.whatWentWell}</div>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
                    <div className="text-sm font-semibold text-amber-900 mb-1">What needs work</div>
                    <div className="text-sm text-amber-800 leading-relaxed">{missionResult.feedback?.needsImprovement}</div>
                  </div>
                  <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-4">
                    <div className="text-sm font-semibold text-violet-900 mb-1">What to focus on next</div>
                    <div className="text-sm text-violet-800 leading-relaxed mb-2">{missionResult.feedback?.focusNext}</div>
                    <div className="text-sm text-violet-800 leading-relaxed font-medium">{missionResult.feedback?.tomorrowPreview}</div>
                  </div>
                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-4 text-sm text-zinc-700">
                    {missionResult.feedback?.exactNextStep}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {(loading || generatingPlan || missionLoading || submittingMission) && (
        <AppLoader
          overlay
          subtitle={
            generatingPlan
              ? 'Building your study roadmap and analysis'
              : missionLoading
                ? 'Preparing today’s 20-minute mission'
                : submittingMission
                  ? 'Scoring your mission and updating tomorrow’s focus'
                  : 'Loading your daily mission'
          }
        />
      )}
    </div>
  )
}
