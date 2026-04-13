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
    { label: 'PDF', color: 'bg-[rgba(255,118,105,0.12)] text-[var(--pp-coral)] border-[rgba(255,118,105,0.18)]' },
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
          className={`border-2 border-dashed rounded-[1.8rem] px-8 py-14 text-center transition-all mb-6 pp-app-card ${uploading ? 'opacity-80' : 'cursor-pointer'} ${dragging ? 'border-[var(--pp-cyan)] bg-[rgba(102,247,226,0.08)]' : 'border-[rgba(130,147,183,0.18)] hover:border-[rgba(255,118,105,0.26)] hover:bg-white/5'}`}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <div className="w-12 h-12 bg-white/5 border pp-app-border rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3V13M10 3L7 6M10 3L13 6" stroke="#9eabc7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.5 15H16.5" stroke="#9eabc7" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <p className="font-display font-semibold text-white text-base mb-1">{t('upload.dropzone')}</p>
          <p className="text-sm pp-app-muted mb-5">{t('upload.dropzoneSub')}</p>
          <button
            type="button"
            disabled={uploading}
            onClick={(event) => {
              event.stopPropagation()
              fileInputRef.current?.click()
            }}
            className="px-5 py-2 text-white text-sm rounded-xl transition-colors disabled:opacity-60 pp-app-button-primary"
          >
            {t('upload.chooseFile')}
          </button>
          {uploading && (
            <div className="mt-5">
              <div className="w-full h-2 bg-white/8 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%`, background: 'linear-gradient(90deg, #ff7669, #66f7e2)' }} />
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
          <div className="mb-4 rounded-xl border border-[rgba(255,118,105,0.2)] bg-[rgba(255,118,105,0.08)] px-4 py-3 text-sm text-[#ffd6cf]">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-xl border border-[rgba(102,247,226,0.2)] bg-[rgba(102,247,226,0.08)] px-4 py-3 text-sm text-[var(--pp-cyan)]">
            <div>{successMessage}</div>
            {lastDocumentId && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    setSelectedDocumentId(lastDocumentId)
                    setScreen('dashboard')
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-[rgba(102,247,226,0.18)] hover:bg-white/10 transition-colors"
                >
                  Open assistant
                </button>
                <button
                  onClick={() => {
                    setSelectedDocumentId(lastDocumentId)
                    setScreen('roadmap')
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-[rgba(102,247,226,0.18)] hover:bg-white/10 transition-colors"
                >
                  View roadmap
                </button>
                <button
                  onClick={() => {
                    setSelectedDocumentId(lastDocumentId)
                    setScreen('flashcards')
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-[rgba(102,247,226,0.18)] hover:bg-white/10 transition-colors"
                >
                  Open flashcards
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mb-8">
          <div className="text-[10px] font-medium uppercase tracking-widest pp-app-muted mb-3">{t('upload.formats')}</div>
          <div className="flex flex-wrap gap-2">
            {formats.map((format) => (
              <span key={format.label} className={`text-xs px-3 py-1.5 rounded-full border font-medium ${format.color}`}>{format.label}</span>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-medium uppercase tracking-widest pp-app-muted mb-3">{t('upload.autoGenerate')}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {autoFeatures.map((feature) => (
              <div key={feature.title} className="flex gap-3.5 pp-app-card rounded-2xl p-4">
                <div className="w-8 h-8 bg-[rgba(255,118,105,0.12)] rounded-lg flex items-center justify-center shrink-0 text-base border border-[rgba(255,118,105,0.18)]">{feature.icon}</div>
                <div>
                  <div className="text-sm font-medium text-white">{feature.title}</div>
                  <div className="text-xs pp-app-muted mt-0.5 leading-relaxed">{feature.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
