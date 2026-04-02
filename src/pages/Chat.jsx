import { useEffect, useRef, useState } from 'react'
import TopBar from '../components/TopBar'
import { useT } from '../i18n'
import { chatApi } from '../lib/api'

function buildGreeting(title) {
  return `Hi! I have read your ${title} notes. Ask me anything and I will answer only from your document.`
}

export default function Chat({
  documents,
  activeDocument,
  selectedDocumentId,
  setSelectedDocumentId,
  appLoading,
  appError,
}) {
  const { t } = useT()
  const [threads, setThreads] = useState({})
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [requestError, setRequestError] = useState('')
  const endRef = useRef(null)

  const currentMessages = activeDocument ? (threads[activeDocument.id] || []) : []

  useEffect(() => {
    if (activeDocument && !threads[activeDocument.id]) {
      setThreads((current) => ({
        ...current,
        [activeDocument.id]: [
          { role: 'assistant', text: buildGreeting(activeDocument.title) },
        ],
      }))
    }
  }, [activeDocument, threads])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentMessages, loading])

  async function send(text) {
    const value = (text || input).trim()
    if (!value || loading || !activeDocument) return

    if (activeDocument.mime_type !== 'application/pdf') {
      setRequestError('AI chat currently supports PDF documents only.')
      return
    }

    const existingMessages = currentMessages
    const optimisticMessages = [...existingMessages, { role: 'user', text: value }]
    setThreads((current) => ({
      ...current,
      [activeDocument.id]: optimisticMessages,
    }))
    setInput('')
    setLoading(true)
    setRequestError('')

    try {
      const result = await chatApi.send(activeDocument.id, value, existingMessages)
      setThreads((current) => ({
        ...current,
        [activeDocument.id]: [...optimisticMessages, { role: 'assistant', text: result.reply }],
      }))
    } catch (error) {
      setRequestError(error.message || t('errors.generic'))
      setThreads((current) => ({
        ...current,
        [activeDocument.id]: existingMessages,
      }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TopBar
        title={t('chat.title')}
        subtitle={activeDocument ? t('chat.subtitle') : 'Select a document to start chatting.'}
        action={activeDocument ? (
          <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1 rounded-full font-medium">
            {activeDocument.title}
          </span>
        ) : null}
      />
      <div className="flex flex-1 min-h-0">
        <div className="w-56 shrink-0 border-r border-zinc-100 bg-zinc-50/50 py-4 overflow-y-auto">
          <div className="px-4 mb-3 text-[10px] font-medium uppercase tracking-widest text-zinc-300">{t('chat.documents')}</div>
          {documents.map((document) => (
            <button
              key={document.id}
              onClick={() => {
                setSelectedDocumentId(document.id)
                setRequestError('')
              }}
              className={`w-full text-left px-4 py-2.5 text-xs transition-all ${selectedDocumentId === document.id ? 'text-violet-700 bg-violet-50 font-medium' : 'text-zinc-400 hover:text-zinc-700 hover:bg-white'}`}
            >
              <div className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2.5C2 1.67 2.67 1 3.5 1H7.5L10 3.5V9.5C10 10.33 9.33 11 8.5 11H3.5C2.67 11 2 10.33 2 9.5V2.5Z" stroke="currentColor" strokeWidth="1.1"/></svg>
                <span className="truncate">{document.title}</span>
              </div>
              <div className="mt-1 h-1 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-violet-300 rounded-full" style={{ width: `${document.pct_covered}%` }} />
              </div>
            </button>
          ))}
          {!documents.length && (
            <div className="px-4 text-xs text-zinc-400">No documents yet.</div>
          )}
        </div>

        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex gap-2 px-5 py-3 border-b border-zinc-100 overflow-x-auto shrink-0">
            {Array.isArray(t('chat.suggestions')) && t('chat.suggestions').map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => send(suggestion)}
                disabled={!activeDocument || loading}
                className="text-xs px-3 py-1.5 bg-white border border-zinc-100 rounded-full text-zinc-500 whitespace-nowrap hover:border-violet-200 hover:text-violet-600 transition-all shrink-0 disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>

          {(appError || requestError) && (
            <div className="px-6 pt-4">
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {requestError || appError}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4 bg-zinc-50/30">
            {appLoading && !documents.length ? (
              <div className="text-sm text-zinc-400">{t('common.loading')}</div>
            ) : !activeDocument ? (
              <div className="text-sm text-zinc-400">Select a document to start chatting with your notes.</div>
            ) : (
              currentMessages.map((message, index) => (
                <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-xs font-semibold text-violet-700 shrink-0 mr-2.5 mt-0.5">AI</div>
                  )}
                  <div className={`max-w-[72%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${message.role === 'user' ? 'bg-zinc-900 text-white rounded-br-sm' : 'bg-white border border-zinc-100 text-zinc-700 rounded-bl-sm'}`}>
                    {message.text}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-xs font-semibold text-violet-700 shrink-0 mr-2.5 mt-0.5">AI</div>
                <div className="bg-white border border-zinc-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-bounce" style={{ animationDelay: `${index * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="px-5 py-4 border-t border-zinc-100 bg-white flex gap-2 shrink-0">
            <textarea
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  send()
                }
              }}
              placeholder={t('chat.placeholder')}
              disabled={!activeDocument || loading}
              className="flex-1 border border-zinc-200 rounded-lg px-4 py-2.5 text-sm text-zinc-700 placeholder-zinc-300 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-50 transition-all resize-none min-h-[44px] max-h-32"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading || !activeDocument}
              className="px-4 py-2.5 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-700 disabled:opacity-40 transition-colors self-end"
            >
              {t('common.send')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
