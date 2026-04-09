import { useEffect, useState, Component } from 'react'
import { Analytics } from '@vercel/analytics/react'
import Sidebar   from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Upload    from './pages/Upload'
import Chat      from './pages/Chat'
import Roadmap   from './pages/Roadmap'
import Quiz      from './pages/Quiz'
import Flashcards from './pages/Flashcards'
import Progress  from './pages/Progress'
import Pricing   from './pages/Pricing'
import Landing   from './pages/Landing'
import Auth      from './pages/Auth'
import MockTest  from './pages/MockTest'
import Profile   from './pages/Profile'
import AppLoader from './components/AppLoader'
import ChatPanel from './components/ChatPanel'
import BottomNav from './components/BottomNav'
import { documentsApi, profileApi } from './lib/api'
import { normalizeDocuments } from './lib/documents'
import { auth, supabase, isSupabaseConfigured, missingSupabaseEnvMessage } from './lib/supabase'

const PAGES = {
  dashboard: Dashboard,
  upload:    Upload,
  chat:      Chat,
  roadmap:   Roadmap,
  quiz:      Quiz,
  flashcards: Flashcards,
  progress:  Progress,
  pricing:   Pricing,
  mocktest:  MockTest,
  profile:   Profile,
}

class PageErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(err) { return { hasError: true, error: err } }
  componentDidCatch(err) { console.error('[PageErrorBoundary]', err) }
  render() {
    if (this.state.hasError) return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', padding:40, textAlign:'center', gap:12 }}>
        <div style={{ fontSize:36 }}>⚠️</div>
        <div style={{ fontFamily:'Syne,sans-serif', fontSize:18, fontWeight:600, color:'#111110' }}>Something went wrong</div>
        <div style={{ fontSize:13, color:'#71717A', maxWidth:280 }}>{this.state.error?.message || 'An unexpected error occurred.'}</div>
        <button onClick={() => this.setState({ hasError:false, error:null })}
          style={{ padding:'10px 24px', background:'#6c63ff', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', marginTop:8 }}>
          Try again
        </button>
      </div>
    )
    return this.props.children
  }
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
  const [studyFocus, setStudyFocus] = useState({ documentId: null, topic: '', origin: '' })
  const [sidebarOpen, setSidebarOpen] = useState(false)  // mobile drawer
  const [appBooting,  setAppBooting]  = useState(true)   // initial session check

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
    setScreen(s === 'pricing' ? 'dashboard' : s)
    setSidebarOpen(false)
  }

  function clearStudyFocus() {
    setStudyFocus({ documentId: null, topic: '', origin: '' })
  }

  function openStudyFocus({ documentId = null, topic = '', screen: nextScreen = 'quiz', origin = '' } = {}) {
    const normalizedTopic = `${topic || ''}`.trim()
    const nextDocumentId = documentId || selectedDocumentId || null

    if (nextDocumentId) {
      setSelectedDocumentId(nextDocumentId)
    }

    setStudyFocus({
      documentId: nextDocumentId,
      topic: normalizedTopic,
      origin: origin || nextScreen,
    })

    setScreen(nextScreen)
    setSidebarOpen(false)
  }

  async function handleLogout() {
    setAppLoading(true)
    setAppError('')
    try {
      await auth.signOut()
    } catch (error) {
      setAppError(error.message || 'Failed to log out.')
      setAppLoading(false)
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); setView('app') }
      setAppBooting(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) { setUser(session.user); setView('app') }
      else {
        setUser(null)
        setProfileData(null)
        setDocuments([])
        setSelectedDocumentId(null)
        setStudyFocus({ documentId: null, topic: '', origin: '' })
        setAppError('')
        setView('landing')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { if (user) refreshAppData() }, [user?.id])

  useEffect(() => {
    if (!documents.length) { setSelectedDocumentId(null); return }
    if (!documents.some(d => d.id === selectedDocumentId)) setSelectedDocumentId(documents[0].id)
  }, [documents, selectedDocumentId])

  useEffect(() => {
    if (!studyFocus.documentId) return
    if (selectedDocumentId && studyFocus.documentId !== selectedDocumentId) {
      clearStudyFocus()
    }
  }, [selectedDocumentId, studyFocus.documentId])

  if (appBooting) return <AppLoader fullScreen />

  if (view === 'landing') return <Landing onGetStarted={() => setView('auth')} onLogin={() => setView('auth')} />
  if (view === 'auth')    return <Auth onBack={() => setView('landing')} onSuccess={() => setView('app')} configError={!isSupabaseConfigured ? missingSupabaseEnvMessage : ''} />

  const resolvedScreen = screen === 'pricing' ? 'dashboard' : screen
  const Page = PAGES[resolvedScreen] || Dashboard
  const activeDocument = documents.find(d => d.id === selectedDocumentId) || null
  const pageProps = {
    user,
    profile: profileData?.profile,
    stats: profileData?.stats,
    documents,
    activeDocument,
    selectedDocumentId,
    setSelectedDocumentId,
    refreshAppData,
    appLoading,
    appError,
    openDocument,
    setScreen: navigate,
    onLogout: handleLogout,
    studyFocus,
    openStudyFocus,
    clearStudyFocus,
  }

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
          onLogout={handleLogout}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* ── Main ── */}
      <main className="relative flex flex-col flex-1 min-w-0 overflow-hidden" style={{ paddingBottom: 'var(--bottom-nav-height, 0)' }}>
        <PageErrorBoundary>
          <Page
            {...pageProps}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        </PageErrorBoundary>
        {appLoading && <AppLoader overlay subtitle="Refreshing your PrepPal workspace" />}
      </main>

      {/* ── Right AI Chat Panel ── */}
      <ChatPanel activeDocument={activeDocument} />
      <BottomNav screen={resolvedScreen} setScreen={navigate} />
      <Analytics />
    </div>
  )
}
