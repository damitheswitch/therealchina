import { useEffect } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { LandingPage } from './pages/LandingPage'
import { UniversityPage } from './pages/UniversityPage'
import { ReviewPage } from './pages/ReviewPage'
import { ProfilePage } from './pages/ProfilePage'
import { UserDirectoryPage } from './pages/UserDirectoryPage'
import { FlightListingsPage } from './pages/FlightListingsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { OnboardingGuard } from './components/OnboardingGuard'
import { AuthModal } from './components/AuthModal'
import { useAuthModal } from './contexts/AuthModalContext'
import { useAuth } from './contexts/AuthContext'

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
      </main>
      {!isOnboarding && <Footer />}
      <AuthModal isOpen={isOpen} onClose={closeAuthModal} initialMode={initialMode} config={config} />
    </>
  )
}

export default App