import { useRef, useState } from 'react'
import AppLoader from '../components/AppLoader'
import TopBar from '../components/TopBar'
import { useT } from '../i18n'
import { documentsApi, quizApi, studyPlanApi } from '../lib/api'
import { getStageContext } from '../lib/studyStage'
import { validateUploadFile } from '../../shared/uploadValidation.js'

export default function Upload({
  onOpenSidebar, refreshAppData, setSelectedDocumentId, setScreen }) {
  const { t, lang } = useT()
  const fileInputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStage, setUploadStage] = useState('upload')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [lastDocumentId, setLastDocumentId] = useState(null)

  const formats = [
    { label: 'PDF', color: 'bg-violet-50 text-violet-600 border-violet-100' },
  ]

  const autoFeatures = [
    { icon: '🗺️', title: t('upload.features.roadmap'), desc: t('upload.features.roadmapSub') },
    { icon: '💬', title: t('upload.features.chat'), desc: t('upload.features.chatSub') },
    { icon: '📝', title: t('upload.features.quiz'), desc: t('upload.features.quizSub') },
    { icon: '📊', title: t('upload.features.progress'), desc: t('upload.features.progressSub') },
  ]

  function validateFile(file) {
    const validationError = validateUploadFile(file)

    if (validationError === 'no_file') return t('errors.noFile')
    if (validationError === 'empty_file') return t('errors.emptyFile')
    if (validationError === 'invalid_type') return t('errors.invalidType')
    if (validationError === 'file_too_large') return t('errors.fileTooLarge')
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
    setUploadStage('upload')
    setError('')
    setSuccessMessage('')

    try {
      const result = await documentsApi.upload(file, setUploadProgress)
      await refreshAppData()
      setSelectedDocumentId(result.document.id)
      setLastDocumentId(result.document.id)

      let studyPlanReady = false
      let stageFocusTopic = ''

      if (result.analysisAvailable) {
        setUploadStage('roadmap')

        try {
          const planData = await studyPlanApi.generatePlan(result.document.id)
          stageFocusTopic = getStageContext(planData, result.document).focusTopic || ''
          studyPlanReady = true
          await refreshAppData()
          setSelectedDocumentId(result.document.id)
        } catch {
          // Keep upload successful even if roadmap preparation needs another try.
        }

        void (async () => {
          try {
            await quizApi.preGenerate(result.document.id, {
              count: 20,
              type: 'mcq',
              topic: stageFocusTopic || null,
              lang,
            })
          } catch {
            // Background preparation is best-effort.
          }

          try {
            await quizApi.preGenerate(result.document.id, {
              count: 50,
              type: 'flashcard',
              topic: stageFocusTopic || null,
              lang,
            })
          } catch {
            // Background preparation is best-effort.
          }
        })()
      }

      setSuccessMessage(
        result.analysisAvailable && (studyPlanReady || result.roadmapReady)
          ? `${result.document.title} is ready. Your roadmap is available now, and you can start studying right away.`
          : result.analysisAvailable
          ? `${result.document.title} uploaded successfully. If the roadmap is still empty, open the Roadmap tab and generate it from the document.`
          : `${result.document.title} uploaded successfully. AI analysis currently works best for PDF documents.`
      )

      setScreen('dashboard')
    } catch (uploadError) {
      setError(uploadError.message || t('errors.generic'))
    } finally {
      setUploading(false)
      setUploadStage('upload')
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

  return (
    <div className="relative flex flex-col flex-1 min-h-0">
      <TopBar onOpenSidebar={onOpenSidebar} title={t('upload.title')} subtitle={t('upload.subtitle')} />
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-7 max-w-2xl w-full mx-auto">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
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
        {uploading && (
          <AppLoader
            overlay
            subtitle={
              uploadStage === 'roadmap'
                ? 'Preparing your roadmap and daily study plan'
                : `Uploading your document${uploadProgress ? ` · ${uploadProgress}%` : ''}`
            }
          />
        )}

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
