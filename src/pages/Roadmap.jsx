import { useEffect, useState } from 'react'
import AppLoader from '../components/AppLoader'
import TopBar from '../components/TopBar'
import { useT } from '../i18n'
import { documentsApi } from '../lib/api'
import { buildRoadmapTopics } from '../lib/documents'

const chipColors = {
  done: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  current: 'bg-violet-50 text-violet-600 border-violet-100',
  pending: 'bg-zinc-50 text-zinc-400 border-zinc-100',
}

function TopicItem({ topic, isLast, onPractice }) {
  const isDone = topic.status === 'done'
  const isCurrent = topic.status === 'current'

  return (
    <div className="flex gap-5">
      <div className="flex flex-col items-center">
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 transition-all ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : isCurrent ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-zinc-200 text-zinc-300'}`}>
          {isDone
            ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            : isCurrent ? <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><polygon points="2,1 7,4 2,7" fill="white"/></svg>
            : <span className="text-zinc-300">{topic.number}</span>}
        </div>
        {!isLast && <div className={`w-px flex-1 mt-2 min-h-[32px] ${isDone ? 'bg-emerald-200' : 'bg-zinc-100'}`} />}
      </div>
      <div className="flex-1 pb-8">
        <div className="bg-white border border-zinc-100 rounded-xl p-5 hover:border-zinc-200 transition-colors">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h3 className={`font-medium text-sm mb-1 ${isCurrent ? 'text-violet-700' : 'text-zinc-800'}`}>{topic.title}</h3>
              <div className="flex items-center gap-4 text-xs text-zinc-400">
                <span>⏱ {topic.mins} min</span>
                {topic.score !== null
                  ? <span className={topic.score < 60 ? 'text-red-500' : 'text-emerald-500'}>Quiz: {topic.score}%</span>
                  : <span>{isDone ? 'Reviewed' : 'Not started'}</span>}
              </div>
            </div>
            {isCurrent && (
              <button onClick={onPractice} className="text-xs px-3.5 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors whitespace-nowrap shrink-0">
                Practice →
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {topic.chips.length ? topic.chips.map((chip) => (
              <span key={chip} className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${chipColors[topic.status]}`}>{chip}</span>
            )) : (
              <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${chipColors[topic.status]}`}>{topic.status === 'done' ? 'Completed' : topic.status === 'current' ? 'In progress' : 'Pending'}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Roadmap({
  onOpenSidebar, documents = [], activeDocument, setSelectedDocumentId, setScreen, refreshAppData }) {
  const { t } = useT()
  const [generating, setGenerating] = useState(false)
  const [roadmapError, setRoadmapError] = useState('')
  const topics = activeDocument ? buildRoadmapTopics(activeDocument).map((topic, index) => ({ ...topic, number: index + 1 })) : []
  const donePct = activeDocument?.pct_covered || 0
  const activeDocumentIsPdf = activeDocument?.mime_type === 'application/pdf'

  useEffect(() => {
    setGenerating(false)
    setRoadmapError('')
  }, [activeDocument?.id])

  async function handleGenerateRoadmap() {
    if (!activeDocument?.id || generating) return

    setGenerating(true)
    setRoadmapError('')

    try {
      await documentsApi.generateRoadmap(activeDocument.id)
      await refreshAppData?.()
      setSelectedDocumentId(activeDocument.id)
    } catch (error) {
      setRoadmapError(error.message || 'We could not prepare a roadmap yet. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TopBar
        onOpenSidebar={onOpenSidebar}
        title={t('roadmap.title')}
        subtitle={activeDocument ? `${activeDocument.subject} — ${topics.length} topics` : 'Select a document to build a roadmap.'}
        action={activeDocument && topics.length ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">{t('roadmap.progress')}</span>
            <div className="w-24 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${donePct}%` }} />
            </div>
            <span className="text-xs font-medium text-emerald-500">{donePct}%</span>
          </div>
        ) : null}
      />
      <div className="flex-1 overflow-y-auto px-8 py-7 max-w-3xl w-full">
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

        {!documents.length ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
            Upload a document first to generate a roadmap from its topics.
          </div>
        ) : !activeDocument ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
            Select a document above to view or generate its roadmap.
          </div>
        ) : !activeDocumentIsPdf ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
            Roadmaps are currently available for PDF documents only.
          </div>
        ) : !topics.length ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
            <div className="font-medium text-zinc-800 mb-2">This document does not have a roadmap yet.</div>
            <div className="mb-4">Generate one now and we&apos;ll build a study outline from the PDF text.</div>
            <button
              onClick={handleGenerateRoadmap}
              disabled={generating}
              className="text-xs px-3.5 py-2 border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
            >
              Generate roadmap
            </button>
            {roadmapError && (
              <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {roadmapError}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-5 mb-7 text-xs text-zinc-400">
              {[
                { color: 'bg-emerald-500', label: t('roadmap.legend.completed') },
                { color: 'bg-violet-600', label: t('roadmap.legend.inProgress') },
                { color: 'bg-zinc-200', label: t('roadmap.legend.notStarted') },
              ].map((legend) => (
                <div key={legend.label} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${legend.color}`} />
                  {legend.label}
                </div>
              ))}
            </div>
            {topics.map((topic, index) => (
              <TopicItem
                key={topic.id}
                topic={topic}
                isLast={index === topics.length - 1}
                onPractice={() => setScreen('quiz')}
              />
            ))}
          </>
        )}
      </div>
      {generating && <AppLoader fullScreen subtitle="Preparing your roadmap from the PDF" />}
    </div>
  )
}
