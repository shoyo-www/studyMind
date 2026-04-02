import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import Chat from './pages/Chat'
import Roadmap from './pages/Roadmap'
import Quiz from './pages/Quiz'
import Flashcards from './pages/Flashcards'
import Progress from './pages/Progress'
import Pricing from './pages/Pricing'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import { documentsApi, profileApi } from './lib/api'
import { normalizeDocuments } from './lib/documents'
import { supabase, isSupabaseConfigured, missingSupabaseEnvMessage } from './lib/supabase'

const PAGES = {
  dashboard: Dashboard,
  upload: Upload,
  chat: Chat,
  roadmap: Roadmap,
  quiz: Quiz,
  flashcards: Flashcards,
  progress: Progress,
  pricing: Pricing,
}

export default function App() {
  const [view, setView] = useState('landing')
  const [screen, setScreen] = useState('dashboard')
  const [user, setUser] = useState(null)
  const [profileData, setProfileData] = useState(null)
  const [documents, setDocuments] = useState([])
  const [appLoading, setAppLoading] = useState(false)
  const [appError, setAppError] = useState('')
  const [selectedDocumentId, setSelectedDocumentId] = useState(null)

  async function refreshAppData() {
    if (!supabase || !user) return

    setAppLoading(true)
    setAppError('')

    try {
      const [profile, fetchedDocuments] = await Promise.all([
        profileApi.get(),
        documentsApi.list(),
      ])

      const normalizedDocuments = normalizeDocuments(fetchedDocuments)
      setProfileData(profile)
      setDocuments(normalizedDocuments)
    } catch (error) {
      setAppError(error.message || 'Failed to load your study data.')
    } finally {
      setAppLoading(false)
    }
  }

  function openDocument(documentId, nextScreen = 'chat') {
    setSelectedDocumentId(documentId)
    setScreen(nextScreen)
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        setView('app')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        setView('app')
      } else {
        setUser(null)
        setProfileData(null)
        setDocuments([])
        setSelectedDocumentId(null)
        setAppError('')
        setView('landing')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      refreshAppData()
    }
  }, [user?.id])

  useEffect(() => {
    if (!documents.length) {
      setSelectedDocumentId(null)
      return
    }

    const stillExists = documents.some((document) => document.id === selectedDocumentId)
    if (!stillExists) {
      setSelectedDocumentId(documents[0].id)
    }
  }, [documents, selectedDocumentId])

  if (view === 'landing') {
    return (
      <Landing
        onGetStarted={() => setView('auth')}
        onLogin={() => setView('auth')}
      />
    )
  }

  if (view === 'auth') {
    return (
      <Auth
        onBack={() => setView('landing')}
        onSuccess={() => setView('app')}
        configError={!isSupabaseConfigured ? missingSupabaseEnvMessage : ''}
      />
    )
  }

  const Page = PAGES[screen]
  const activeDocument = documents.find((document) => document.id === selectedDocumentId) || null

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      <Sidebar
        screen={screen}
        setScreen={setScreen}
        user={user}
        profile={profileData?.profile}
      />
      <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Page
          user={user}
          profile={profileData?.profile}
          stats={profileData?.stats}
          documents={documents}
          activeDocument={activeDocument}
          selectedDocumentId={selectedDocumentId}
          setSelectedDocumentId={setSelectedDocumentId}
          refreshAppData={refreshAppData}
          appLoading={appLoading}
          appError={appError}
          openDocument={openDocument}
          setScreen={setScreen}
        />
      </main>
    </div>
  )
}
