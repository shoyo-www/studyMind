import { useEffect, useState } from 'react'
import Sidebar   from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Upload    from './pages/Upload'
import Roadmap   from './pages/Roadmap'
import Quiz      from './pages/Quiz'
import Flashcards from './pages/Flashcards'
import Progress  from './pages/Progress'
import Pricing   from './pages/Pricing'
import Landing   from './pages/Landing'
import Auth      from './pages/Auth'
import ChatPanel from './components/ChatPanel'
import BottomNav from './components/BottomNav'
import { documentsApi, profileApi } from './lib/api'
import { normalizeDocuments } from './lib/documents'
import { supabase, isSupabaseConfigured, missingSupabaseEnvMessage } from './lib/supabase'

const PAGES = {
  dashboard: Dashboard,
  upload:    Upload,
  roadmap:   Roadmap,
  quiz:      Quiz,
  flashcards: Flashcards,
  progress:  Progress,
  pricing:   Pricing,
}

export default function App() {
  const [view,   setView]   = useState('landing')
  const [screen, setScreen] = useState('dashboard')
  const [user,   setUser]   = useState(null)
  const [profileData, setProfileData] = useState(null)
  const [documents,   setDocuments]   = useState([])
  const [appLoading,  setAppLoading]  = useState(false)
  const [appError,    setAppError]    = useState('')
  const [selectedDocumentId, setSelectedDocumentId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)  // mobile drawer

  async function refreshAppData() {
    if (!supabase || !user) return
    setAppLoading(true); setAppError('')
    try {
      const [profile, fetched] = await Promise.all([profileApi.get(), documentsApi.list()])
      setProfileData(profile)
      setDocuments(normalizeDocuments(fetched))
    } catch (e) {
      setAppError(e.message || 'Failed to load your study data.')
    } finally {
      setAppLoading(false)
    }
  }

  function openDocument(documentId, nextScreen = 'dashboard') {
    setSelectedDocumentId(documentId)
    setScreen(nextScreen)
    setSidebarOpen(false)
  }

  function navigate(s) {
    setScreen(s === 'chat' || s === 'pricing' ? 'dashboard' : s)
    setSidebarOpen(false)
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); setView('app') }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) { setUser(session.user); setView('app') }
      else { setUser(null); setProfileData(null); setDocuments([]); setSelectedDocumentId(null); setAppError(''); setView('landing') }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { if (user) refreshAppData() }, [user?.id])

  useEffect(() => {
    if (!documents.length) { setSelectedDocumentId(null); return }
    if (!documents.some(d => d.id === selectedDocumentId)) setSelectedDocumentId(documents[0].id)
  }, [documents, selectedDocumentId])

  if (view === 'landing') return <Landing onGetStarted={() => setView('auth')} onLogin={() => setView('auth')} />
  if (view === 'auth')    return <Auth onBack={() => setView('landing')} onSuccess={() => setView('app')} configError={!isSupabaseConfigured ? missingSupabaseEnvMessage : ''} />

  const resolvedScreen = screen === 'pricing' ? 'dashboard' : screen
  const Page = PAGES[resolvedScreen] || Dashboard
  const activeDocument = documents.find(d => d.id === selectedDocumentId) || null
  const pageProps = { user, profile: profileData?.profile, stats: profileData?.stats, documents, activeDocument, selectedDocumentId, setSelectedDocumentId, refreshAppData, appLoading, appError, openDocument, setScreen: navigate }

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">

      {/* ── Mobile overlay backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-40 lg:z-auto
        transition-transform duration-250 ease-in-out lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar
          screen={resolvedScreen}
          setScreen={navigate}
          user={user}
          profile={profileData?.profile}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* ── Main ── */}
      <main className="flex flex-col flex-1 min-w-0 overflow-hidden" style={{ paddingBottom: 'var(--bottom-nav-height, 0)' }}>
        <Page
          {...pageProps}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
      </main>

      {/* ── Right AI Chat Panel ── */}
      <ChatPanel activeDocument={activeDocument} />
      <BottomNav screen={resolvedScreen} setScreen={navigate} />
    </div>
  )
}
