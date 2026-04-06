import { useState } from 'react'
import AppLoader from '../components/AppLoader'
import TopBar from '../components/TopBar'
import { useT } from '../i18n'
import { chatApi } from '../lib/api'

export default function Chat({
  onOpenSidebar,
  documents = [],
  activeDocument,
  selectedDocumentId,
  setSelectedDocumentId,
}) {
  const { t } = useT()
  const [messages,  setMessages]  = useState([])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  const pdfs = documents.filter(d => d.mime_type === 'application/pdf')

  async function send(text) {
    const val = (text || input).trim()
    if (!val || loading || !activeDocument) return

    const userMsg = { role: 'user', text: val, time: new Date() }
    setMessages(m => [...m, userMsg])
    setInput('')
    setLoading(true)
    setError('')

    try {
      const data = await chatApi.send(activeDocument.id, val, messages.slice(-10))
      setMessages(m => [...m, { role: 'assistant', text: data.reply, time: new Date() }])
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.')
      // Remove the optimistic user message on error
      setMessages(m => m.filter(msg => msg !== userMsg))
    } finally {
      setLoading(false)
    }
  }

  const SUGGESTIONS = [
    'Summarise this document',
    'What are the key concepts?',
    'Give me 5 important points',
    'Explain the main topic simply',
    'What topics are covered?',
  ]

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TopBar
        title="Chat"
        subtitle={activeDocument ? `Chatting with: ${activeDocument.title}` : 'Select a document to start'}
        onOpenSidebar={onOpenSidebar}
      />

      <div className="flex flex-1 min-h-0">
        {/* Document selector sidebar */}
        {pdfs.length > 0 && (
          <div className="hidden md:flex flex-col w-52 shrink-0 border-r border-zinc-100 bg-zinc-50/50 overflow-y-auto py-4">
            <div className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
              Your PDFs
            </div>
            {pdfs.map(doc => (
              <button
                key={doc.id}
                onClick={() => { setSelectedDocumentId(doc.id); setMessages([]) }}
                className="flex items-start gap-3 px-4 py-3 text-left transition-all border-l-2 group"
                style={selectedDocumentId === doc.id
                  ? { borderColor: '#6c63ff', background: '#EEF2FF' }
                  : { borderColor: 'transparent' }
                }
              >
                <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 1.5C2 1.22 2.22 1 2.5 1H7.5L10 3.5V10.5C10 10.78 9.78 11 9.5 11H2.5C2.22 11 2 10.78 2 10.5V1.5Z" stroke="#6c63ff" strokeWidth="1"/>
                    <path d="M7.5 1V3.5H10" stroke="#6c63ff" strokeWidth="1"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-zinc-800 truncate" style={selectedDocumentId === doc.id ? { color: '#3730A3' } : {}}>
                    {doc.title}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">{doc.subject || 'General'}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Chat area */}
        <div className="flex flex-col flex-1 min-h-0">
          {!activeDocument ? (
            /* No document selected */
            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
              <div className="text-4xl mb-4">📄</div>
              <h3 className="text-base font-semibold text-zinc-800 mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                Select a document to chat
              </h3>
              <p className="text-sm text-zinc-400 max-w-xs">
                Choose a PDF from the sidebar, or upload one first to start asking questions.
              </p>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 flex flex-col gap-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center pb-10">
                    <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mb-4 text-2xl">🤖</div>
                    <h3 className="text-base font-semibold text-zinc-800 mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                      Ask anything about your notes
                    </h3>
                    <p className="text-sm text-zinc-400 mb-6 max-w-xs">
                      I've read <strong className="text-zinc-600">{activeDocument.title}</strong>. Ask me anything from it.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                      {SUGGESTIONS.map(s => (
                        <button key={s} onClick={() => send(s)}
                          className="text-xs px-3 py-2 bg-white border border-zinc-200 rounded-full text-zinc-500 hover:border-violet-300 hover:text-violet-600 transition-all">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {m.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold mb-0.5"
                        style={{ background: '#EEF2FF', color: '#6c63ff', border: '1px solid #E0E7FF' }}>
                        AI
                      </div>
                    )}
                    <div className="max-w-[78%]">
                      <div
                        className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                        style={m.role === 'user'
                          ? { background: '#6c63ff', color: '#fff', borderBottomRightRadius: 4 }
                          : { background: '#fff', border: '1px solid #E4E4E7', color: '#2C2C2A', borderBottomLeftRadius: 4 }
                        }
                      >
                        {m.text}
                      </div>
                      <div className={`text-[10px] text-zinc-400 mt-1 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                        {m.time?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex items-end gap-2">
                    <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold"
                      style={{ background: '#EEF2FF', color: '#6c63ff', border: '1px solid #E0E7FF' }}>
                      AI
                    </div>
                    <div className="px-4 py-3 rounded-2xl flex gap-1 items-center"
                      style={{ background: '#fff', border: '1px solid #E4E4E7', borderBottomLeftRadius: 4 }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="mx-4 mb-2 text-xs text-red-500 bg-red-50 border border-red-100 px-4 py-2 rounded-lg">
                  {error}
                </div>
              )}

              {/* Input */}
              <div className="px-4 sm:px-6 py-4 border-t border-zinc-100 bg-white flex gap-2 items-center shrink-0">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                  placeholder={`Ask anything about ${activeDocument.title}…`}
                  className="flex-1 text-sm text-zinc-700 placeholder-zinc-300 outline-none border border-zinc-200 rounded-xl px-4 py-2.5 focus:border-violet-300 transition-colors"
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || loading}
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 hover:opacity-85 active:scale-95 shrink-0"
                  style={{ background: '#6c63ff' }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8h12M14 8L9 3M14 8L9 13" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {loading && <AppLoader fullScreen subtitle="Finding the answer in your PDF" />}
    </div>
  )
}
