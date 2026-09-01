import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
// LandingPage stays in the entry chunk: it is what most visits load first.
import { LandingPage } from './pages/LandingPage'
import { OnboardingGuard } from './components/OnboardingGuard'
import { AuthModal } from './components/AuthModal'
import { useAuthModal } from './contexts/AuthModalContext'
import { useAuth } from './contexts/AuthContext'

// Route-level code splitting: each page becomes its own chunk, fetched on
// first navigation. Pages use named exports, hence the default-mapping.
const UniversityPage = lazy(() =>
  import('./pages/UniversityPage').then((m) => ({ default: m.UniversityPage }))
)
const ReviewPage = lazy(() => import('./pages/ReviewPage').then((m) => ({ default: m.ReviewPage })))
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))
)
const UserDirectoryPage = lazy(() =>
  import('./pages/UserDirectoryPage').then((m) => ({ default: m.UserDirectoryPage }))
)
const FlightListingsPage = lazy(() =>
  import('./pages/FlightListingsPage').then((m) => ({ default: m.FlightListingsPage }))
)
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
)
const OnboardingPage = lazy(() =>
  import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage }))
)

const PageFallback = () => (
  <div className="loading" style={{ minHeight: '40vh' }}>
    Loading...
  </div>
)

function App() {
  const { isOpen, initialMode, closeAuthModal, config } = useAuthModal()
  const { user, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isOnboarding = location.pathname === '/onboarding'

  // Redirect an anonymous reviewer to their review after they sign in/up
  useEffect(() => {
    if (loading) return
    const submitted = sessionStorage.getItem('trc_anon_review_submitted')
    if (user && submitted) {
      const slug = sessionStorage.getItem('trc_anon_review_redirect')
      sessionStorage.removeItem('trc_anon_review_submitted')
      sessionStorage.removeItem('trc_anon_review_redirect')
      if (slug) {
        navigate(`/university/${slug}`)
      } else {
        navigate('/')
      }
    }
  }, [user, loading, navigate])

  return (
    <>
      {!isOnboarding && <Header />}
      <main>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/onboarding" element={<OnboardingPage />} />

            <Route element={<OnboardingGuard />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/university/:slug" element={<UniversityPage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile/:userId" element={<ProfilePage />} />
              <Route path="/users" element={<UserDirectoryPage />} />
              <Route path="/flights" element={<FlightListingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </main>
      {!isOnboarding && <Footer />}
      <AuthModal
        isOpen={isOpen}
        onClose={closeAuthModal}
        initialMode={initialMode}
        config={config}
      />
    </>
  )
}

export default App
