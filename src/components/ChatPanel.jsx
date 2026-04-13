import { useEffect, useMemo, useRef, useState } from 'react'
import { chatApi } from '../lib/api'
import { stripReasoningBlocks } from '../lib/chat'
import GeneratingIndicator from './GeneratingIndicator'

const THREAD_CACHE = {}
const CHAT_INPUT_MAX_HEIGHT = 88

function buildGreeting(document) {
  if (!document) {
    return 'Select a PDF to start a notebook-style chat.'
  }

  if (document.mime_type !== 'application/pdf') {
    return `"${document.title}" is not a PDF. Select a PDF to ask questions about its contents.`
  }

  return [
    `I am focused on "${document.title}".`,
    'Ask for a summary, key concepts, explanations, or quiz questions.',
    'I will answer only from this selected PDF.',
  ].join(' ')
}

function buildStarterMessage(document) {
  return {
    role: 'assistant',
    text: buildGreeting(document),
    time: new Date(),
  }
}

function buildQuickPrompts(document) {
  if (!document || document.mime_type !== 'application/pdf') return []

  return [
    'Summarise this PDF',
    'What are the key topics?',
    'Create 3 quiz questions',
    'Explain the hardest concept simply',
  ]
}

function timeFmt(d) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function ChatPanel({ activeDocument = null }) {
  const [open, setOpen] = useState(false)
  const [threads, setThreads] = useState(() => ({ ...THREAD_CACHE }))
  const [loadingByDocument, setLoadingByDocument] = useState({})
  const [errorsByDocument, setErrorsByDocument] = useState({})
  const [input, setInput] = useState('')
  const endRef = useRef(null)
  const inputRef = useRef(null)

  const currentMessages = activeDocument ? (threads[activeDocument.id] || []) : []
  const currentError = activeDocument ? (errorsByDocument[activeDocument.id] || '') : ''
  const currentLoading = !!(activeDocument && loadingByDocument[activeDocument.id])
  const canChat = !!activeDocument && activeDocument.mime_type === 'application/pdf'
  const quickPrompts = useMemo(() => buildQuickPrompts(activeDocument), [activeDocument])

  useEffect(() => {
    if (activeDocument && !threads[activeDocument.id]) {
      setThreads((current) => ({
        ...current,
        [activeDocument.id]: [buildStarterMessage(activeDocument)],
      }))
    }
  }, [activeDocument, threads])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentMessages, currentLoading, open, activeDocument?.id])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [open, activeDocument?.id])

  useEffect(() => {
    setInput('')
  }, [activeDocument?.id])

  useEffect(() => {
    const textarea = inputRef.current
    if (!textarea) return

    textarea.style.height = '0px'
    textarea.style.height = `${Math.min(textarea.scrollHeight, CHAT_INPUT_MAX_HEIGHT)}px`
    textarea.style.overflowY = textarea.scrollHeight > CHAT_INPUT_MAX_HEIGHT ? 'auto' : 'hidden'
  }, [input, activeDocument?.id, open])

  useEffect(() => {
    Object.keys(THREAD_CACHE).forEach((key) => delete THREAD_CACHE[key])
    Object.assign(THREAD_CACHE, threads)
  }, [threads])

  async function send(text) {
    const value = (text || input).trim()
    if (!value || !activeDocument || currentLoading) return

    if (activeDocument.mime_type !== 'application/pdf') {
      setErrorsByDocument((current) => ({
        ...current,
        [activeDocument.id]: 'AI chat currently supports PDF documents only.',
      }))
      return
    }

    const existingMessages = currentMessages
    const optimisticMessages = [
      ...existingMessages,
      { role: 'user', text: value, time: new Date() },
    ]

    setThreads((current) => ({
      ...current,
      [activeDocument.id]: optimisticMessages,
    }))
    setErrorsByDocument((current) => ({
      ...current,
      [activeDocument.id]: '',
    }))
    setLoadingByDocument((current) => ({
      ...current,
      [activeDocument.id]: true,
    }))
    setInput('')

    try {
      const result = await chatApi.send(activeDocument.id, value, existingMessages)
      setThreads((current) => ({
        ...current,
        [activeDocument.id]: [
          ...optimisticMessages,
          { role: 'assistant', text: stripReasoningBlocks(result.reply), time: new Date() },
        ],
      }))
    } catch (error) {
      setErrorsByDocument((current) => ({
        ...current,
        [activeDocument.id]: error.message || 'Something went wrong while chatting with your PDF.',
      }))
      setThreads((current) => ({
        ...current,
        [activeDocument.id]: existingMessages,
      }))
    } finally {
      setLoadingByDocument((current) => ({
        ...current,
        [activeDocument.id]: false,
      }))
    }
  }

  function clearChat() {
    if (!activeDocument) return

    setThreads((current) => ({
      ...current,
      [activeDocument.id]: [buildStarterMessage(activeDocument)],
    }))
    setErrorsByDocument((current) => ({
      ...current,
      [activeDocument.id]: '',
    }))
  }

  const headerTitle = activeDocument ? activeDocument.title : 'PDF Notebook Chat'
  const headerSubtitle = !activeDocument
    ? 'Pick a document to start chatting'
    : canChat
      ? 'Linked to the selected PDF'
      : 'This selected file is not a PDF'

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close AI Chat"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/35 lg:hidden"
        />
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`fixed right-0 top-1/3 sm:top-1/2 -translate-y-1/2 z-40 lg:hidden flex-col items-center justify-center cursor-pointer select-none transition-all duration-200 hover:w-10 ${open ? 'pointer-events-none opacity-0' : 'flex opacity-100'}`}
        style={{
          width: 36,
          paddingTop: 18,
          paddingBottom: 18,
          borderRadius: '14px 0 0 14px',
          background: 'rgba(8,14,26,0.96)',
          boxShadow: '-6px 0 24px rgba(0,0,0,0.34)',
          gap: 8,
          border: '1px solid rgba(130,147,183,0.16)',
        }}
        title={open ? 'Close PDF Chat' : 'Open PDF Chat'}
      >
        <span
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            transform: 'rotate(180deg)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: '#fff',
            opacity: 0.92,
            fontFamily: 'DM Sans, sans-serif',
            textTransform: 'uppercase',
          }}
        >
          PDF Chat
        </span>

        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{
            transition: 'transform 0.2s',
            transform: open ? 'rotate(0deg)' : 'rotate(180deg)',
          }}
        >
          <path
            d="M8.5 3L5.5 6L8.5 9"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <aside
        className={`fixed top-0 right-0 bottom-0 z-40 flex w-[min(440px,calc(100vw-12px))] flex-col transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] lg:relative lg:z-auto lg:w-[min(40vw,420px)] lg:shrink-0 lg:translate-x-0 lg:shadow-none xl:w-[min(38vw,520px)] 2xl:w-[560px] ${open ? 'translate-x-0 shadow-2xl' : 'translate-x-full shadow-none'}`}
        style={{
          background: 'rgba(8,14,26,0.96)',
          borderLeft: '1px solid rgba(130,147,183,0.16)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div
          className="flex items-center gap-3 px-4 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(130,147,183,0.16)' }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,118,105,0.12)', border: '1px solid rgba(255,118,105,0.18)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 2.5C3 1.95 3.45 1.5 4 1.5H9L13 5.5V13C13 13.55 12.55 14 12 14H4C3.45 14 3 13.55 3 13V2.5Z" fill="rgba(255,118,105,0.06)" stroke="#ff7669" strokeWidth="1.2" />
              <path d="M8 5.5H5.5M10.5 8H5.5M10.5 10.5H5.5" stroke="#ff7669" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white leading-tight truncate">{headerTitle}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${canChat ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="text-[11px] pp-app-muted">{headerSubtitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={clearChat}
              disabled={!activeDocument}
              className="text-[11px] pp-app-muted hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors disabled:opacity-40"
              title="Clear chat"
            >
              Clear
            </button>
            <button
              onClick={() => setOpen(false)}
              className="lg:hidden w-7 h-7 flex items-center justify-center rounded hover:bg-white/5 transition-colors text-[var(--pp-text-muted)] hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {activeDocument && (
          <div className="px-4 py-3 border-b pp-app-border bg-white/5 shrink-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.22em] pp-app-muted">Selected Source</div>
            <div className="mt-1 text-sm font-medium text-white truncate">{activeDocument.title}</div>
            <div className="mt-1 text-[11px] pp-app-subtle">
              {canChat ? 'Answers stay grounded in this PDF only.' : 'Choose a PDF to use notebook-style chat.'}
            </div>
          </div>
        )}

        {currentError && (
          <div className="px-4 pt-4 shrink-0">
            <div className="rounded-xl border border-[rgba(255,118,105,0.2)] bg-[rgba(255,118,105,0.08)] px-3 py-2.5 text-xs text-[#ffd6cf]">
              {currentError}
            </div>
          </div>
        )}

        <div
          className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4"
          style={{ background: 'rgba(255,255,255,0.015)' }}
        >
          {!activeDocument ? (
            <div className="rounded-2xl border border-dashed pp-app-border bg-white/3 px-4 py-5 text-sm pp-app-subtle">
              Select a PDF from your study materials and this sidebar will behave like a notebook assistant for that document.
            </div>
          ) : (
            currentMessages.map((message, index) => (
              <div key={index} className={`flex items-end gap-2 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {message.role === 'assistant' && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                    style={{ background: 'rgba(255,118,105,0.12)', color: '#ff7669', border: '1px solid rgba(255,118,105,0.18)' }}
                  >
                    AI
                  </div>
                )}

                <div className={`flex flex-col gap-0.5 max-w-[92%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap break-words ${message.role === 'user' ? 'bg-[linear-gradient(135deg,#ff7669,#e45151)] text-white rounded-br-sm' : 'bg-[rgba(255,255,255,0.04)] border text-[var(--pp-text-soft)] rounded-bl-sm'}`}
                    style={message.role === 'assistant' ? { borderColor: 'rgba(130,147,183,0.16)' } : undefined}
                  >
                    {message.text}
                  </div>
                  <span className="text-[10px] pp-app-muted px-1">{timeFmt(message.time)}</span>
                </div>
              </div>
            ))
          )}

          {currentLoading && (
            <div className="flex items-end gap-2 flex-row">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                style={{ background: 'rgba(255,118,105,0.12)', color: '#ff7669', border: '1px solid rgba(255,118,105,0.18)' }}
              >
                AI
              </div>
              <div
                className="px-3 py-3 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(130,147,183,0.16)', borderBottomLeftRadius: 4 }}
              >
                <GeneratingIndicator
                  compact
                  label="Analysing PDF"
                  steps={[
                    'Scanning the selected PDF',
                    'Finding the relevant section',
                    'Writing the answer',
                  ]}
                />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {!!quickPrompts.length && currentMessages.length <= 1 && (
          <div
            className="flex flex-wrap gap-1.5 px-4 py-3 shrink-0"
            style={{ borderTop: '1px solid rgba(130,147,183,0.12)' }}
          >
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => send(prompt)}
                disabled={!canChat || currentLoading}
                className="text-[11px] px-2.5 py-1.5 rounded-full border pp-app-subtle hover:text-[var(--pp-cyan)] transition-all bg-white/5 disabled:opacity-40"
                style={{ borderColor: 'rgba(130,147,183,0.16)' }}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        <div
          className="flex items-end gap-2 px-4 py-3 shrink-0 bg-[rgba(8,14,26,0.96)]"
          style={{ borderTop: '1px solid rgba(130,147,183,0.16)' }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                send()
              }
            }}
            placeholder={
              !activeDocument
                ? 'Select a PDF to start chatting...'
                : !canChat
                  ? 'Only PDF documents are supported right now'
                  : `Ask about ${activeDocument.title}...`
            }
            disabled={!canChat || currentLoading}
            rows={2}
            className="flex-1 text-[13px] leading-5 text-[var(--pp-text)] placeholder-[var(--pp-text-muted)] outline-none resize-none"
            style={{
              border: 'none',
              background: 'transparent',
              minHeight: 48,
              maxHeight: CHAT_INPUT_MAX_HEIGHT,
            }}
          />

          <button
            onClick={() => send()}
            disabled={!input.trim() || !canChat || currentLoading}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30 hover:opacity-85 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #ff7669, #e45151)', flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M13 7L7.5 2M13 7l-5.5 5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  )
}
