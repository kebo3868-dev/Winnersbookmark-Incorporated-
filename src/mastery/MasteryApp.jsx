import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { StoreProvider, useStore } from './state/store'
import { BottomNav, AchievementToast, BrandMark } from './components/ui'
import { ACHIEVEMENT_BY_ID } from './data/achievements'

const Onboarding = lazy(() => import('./screens/Onboarding'))
const Home       = lazy(() => import('./screens/Home'))
const Learn      = lazy(() => import('./screens/Learn'))
const AcademyPath = lazy(() => import('./screens/AcademyPath'))
const Lesson     = lazy(() => import('./screens/Lesson'))
const Coach      = lazy(() => import('./screens/Coach'))
const RolePlay   = lazy(() => import('./screens/RolePlay'))
const Insights   = lazy(() => import('./screens/Insights'))
const Profile    = lazy(() => import('./screens/Profile'))
const Challenges = lazy(() => import('./screens/Challenges'))
const Journal    = lazy(() => import('./screens/Journal'))

function Loader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center animate-pulse">
        <div className="mx-auto mb-3 flex justify-center"><BrandMark size={48} /></div>
        <div className="eyebrow">Loading…</div>
      </div>
    </div>
  )
}

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

// Layout for the five main tabs: bottom nav + global achievement toast.
function TabShell() {
  const { state } = useStore()
  const [toast, setToast] = useState(null)
  const prevCount = useRef(Object.keys(state.achievements).length)

  useEffect(() => {
    const keys = Object.keys(state.achievements)
    if (keys.length > prevCount.current) {
      const newest = keys.slice().sort((a, b) => state.achievements[b] - state.achievements[a])[0]
      setToast(ACHIEVEMENT_BY_ID[newest])
      const t = setTimeout(() => setToast(null), 4200)
      prevCount.current = keys.length
      return () => clearTimeout(t)
    }
    prevCount.current = keys.length
  }, [state.achievements])

  return (
    <>
      <AchievementToast achievement={toast} onClose={() => setToast(null)} />
      <Outlet />
      <BottomNav />
    </>
  )
}

// Redirect to onboarding until the assessment is complete.
function Gate({ children }) {
  const { state } = useStore()
  if (!state.onboarded) return <Navigate to="/onboarding" replace />
  return children
}

function Routed() {
  const { state } = useStore()
  return (
    <>
      <ScrollTop />
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/onboarding" element={state.onboarded ? <Navigate to="/home" replace /> : <Onboarding />} />

          <Route element={<Gate><TabShell /></Gate>}>
            <Route path="/home" element={<Home />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/coach" element={<Coach />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/challenges" element={<Challenges />} />
            <Route path="/journal" element={<Journal />} />
          </Route>

          {/* Full-screen flows (no bottom nav) */}
          <Route path="/academy/:id" element={<Gate><AcademyPath /></Gate>} />
          <Route path="/lesson/:id" element={<Gate><Lesson /></Gate>} />
          <Route path="/roleplay/:id" element={<Gate><RolePlay /></Gate>} />

          <Route path="/" element={<Navigate to={state.onboarded ? '/home' : '/onboarding'} replace />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default function MasteryApp() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routed />
      </BrowserRouter>
    </StoreProvider>
  )
}
