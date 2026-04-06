import { useRef, useState } from 'react'
import AppLoader from '../components/AppLoader'
import TopBar from '../components/TopBar'
import { useT } from '../i18n'
import { documentsApi, quizApi } from '../lib/api'

const MAX_FILE_SIZE = 50 * 1024 * 1024
const ALLOWED_FILE_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export default function Upload({
  onOpenSidebar, refreshAppData, setSelectedDocumentId, setScreen }) {
  const { t } = useT()
  const fileInputRef = useRef(null)
  const [link, setLink] = useState('')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [lastDocumentId, setLastDocumentId] = useState(null)

  const formats = [
    { label: 'PDF', color: 'bg-violet-50 text-violet-600 border-violet-100' },
    { label: 'DOCX', color: 'bg-blue-50 text-blue-600 border-blue-100' },
    { label: 'PPTX', color: 'bg-amber-50 text-amber-600 border-amber-100' },
    { label: 'YouTube', color: 'bg-red-50 text-red-500 border-red-100' },
    { label: 'Article URL', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { label: 'Image / Handwriting', color: 'bg-zinc-50 text-zinc-500 border-zinc-200' },
  ]

  const autoFeatures = [
    { icon: '🗺️', title: t('upload.features.roadmap'), desc: t('upload.features.roadmapSub') },
    { icon: '💬', title: t('upload.features.chat'), desc: t('upload.features.chatSub') },
    { icon: '📝', title: t('upload.features.quiz'), desc: t('upload.features.quizSub') },
    { icon: '📊', title: t('upload.features.progress'), desc: t('upload.features.progressSub') },
  ]

  function validateFile(file) {
    if (!file) {
      return t('errors.noFile')
    }

    if (!ALLOWED_FILE_TYPES.has(file.type)) {
      return t('errors.invalidType')
    }

    if (file.size > MAX_FILE_SIZE) {
      return t('errors.fileTooLarge')
    }

    return ''
  }

  async function handleUpload(file) {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setError('')
    setSuccessMessage('')

    try {
      const result = await documentsApi.upload(file, setUploadProgress)
      await refreshAppData()
      setSelectedDocumentId(result.document.id)
      setLastDocumentId(result.document.id)

      if (result.analysisAvailable) {
        void (async () => {
          try {
            await quizApi.preGenerate(result.document.id, {
              count: 5,
              type: 'mcq',
            })
          } catch {
            // Background preparation is best-effort.
          }

          try {
            await quizApi.preGenerate(result.document.id, {
              count: 50,
              type: 'flashcard',
            })
          } catch {
            // Background preparation is best-effort.
          }
        })()
      }

      setSuccessMessage(
        result.analysisAvailable && result.roadmapReady
          ? `${result.document.title} is ready. Your roadmap is available now, and you can start studying right away.`
          : result.analysisAvailable
          ? `${result.document.title} uploaded successfully. If the roadmap is still empty, open the Roadmap tab and generate it from the document.`
          : `${result.document.title} uploaded successfully. AI analysis currently works best for PDF documents.`
      )
    } catch (uploadError) {
      setError(uploadError.message || t('errors.generic'))
    } finally {
      setUploading(false)
    }
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    handleUpload(file)
    event.target.value = ''
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    handleUpload(file)
  }

  function handleLinkImport() {
    setError('')
    setSuccessMessage('Link imports are next in the queue. File uploads are live now.')
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TopBar onOpenSidebar={onOpenSidebar} title={t('upload.title')} subtitle={t('upload.subtitle')} />
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-7 max-w-2xl w-full mx-auto">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={handleFileChange}
        />

        <div
          onDragOver={(event) => {
            event.preventDefault()
            if (!uploading) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl px-8 py-14 text-center transition-all mb-6 ${uploading ? 'opacity-80' : 'cursor-pointer'} ${dragging ? 'border-violet-400 bg-violet-50' : 'border-zinc-200 hover:border-violet-200 hover:bg-violet-50/30'}`}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <div className="w-12 h-12 bg-white border border-zinc-100 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3V13M10 3L7 6M10 3L13 6" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.5 15H16.5" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <p className="font-display font-semibold text-zinc-700 text-base mb-1">{t('upload.dropzone')}</p>
          <p className="text-sm text-zinc-400 mb-5">{t('upload.dropzoneSub')}</p>
          <button
            type="button"
            disabled={uploading}
            onClick={(event) => {
              event.stopPropagation()
              fileInputRef.current?.click()
            }}
            className="px-5 py-2 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-60"
          >
            {t('upload.chooseFile')}
          </button>
          {uploading && (
            <div className="mt-5">
              <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}
        </div>
        {uploading && <AppLoader fullScreen subtitle={`Uploading your document${uploadProgress ? ` · ${uploadProgress}%` : ''}`} />}

        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <div>{successMessage}</div>
            {lastDocumentId && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    setSelectedDocumentId(lastDocumentId)
                    setScreen('dashboard')
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white border border-emerald-200 hover:bg-emerald-50 transition-colors"
                >
                  Open assistant
                </button>
                <button
                  onClick={() => {
                    setSelectedDocumentId(lastDocumentId)
                    setScreen('roadmap')
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white border border-emerald-200 hover:bg-emerald-50 transition-colors"
                >
                  View roadmap
                </button>
                <button
                  onClick={() => {
                    setSelectedDocumentId(lastDocumentId)
                    setScreen('flashcards')
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white border border-emerald-200 hover:bg-emerald-50 transition-colors"
                >
                  Open flashcards
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-zinc-100" />
          <span className="text-xs text-zinc-300">{t('upload.pasteLink')}</span>
          <div className="flex-1 h-px bg-zinc-100" />
        </div>

        <div className="flex gap-2 mb-8">
          <input
            type="text"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder={t('upload.linkPlaceholder')}
            className="flex-1 border border-zinc-200 rounded-lg px-4 py-2.5 text-sm text-zinc-700 placeholder-zinc-300 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-50 transition-all"
          />
          <button
            onClick={handleLinkImport}
            className="px-4 py-2.5 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-700 transition-colors whitespace-nowrap"
          >
            {t('upload.import')}
          </button>
        </div>

        <div className="mb-8">
          <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-300 mb-3">{t('upload.formats')}</div>
          <div className="flex flex-wrap gap-2">
            {formats.map((format) => (
              <span key={format.label} className={`text-xs px-3 py-1.5 rounded-full border font-medium ${format.color}`}>{format.label}</span>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-300 mb-3">{t('upload.autoGenerate')}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {autoFeatures.map((feature) => (
              <div key={feature.title} className="flex gap-3.5 bg-white border border-zinc-100 rounded-xl p-4">
                <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center shrink-0 text-base">{feature.icon}</div>
                <div>
                  <div className="text-sm font-medium text-zinc-800">{feature.title}</div>
                  <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{feature.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
