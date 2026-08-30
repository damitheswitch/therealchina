import { Routes, Route, useLocation } from 'react-router-dom'
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

function App() {
  const { isOpen, initialMode, closeAuthModal } = useAuthModal()
  const location = useLocation()
  const isOnboarding = location.pathname === '/onboarding'

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
      <AuthModal isOpen={isOpen} onClose={closeAuthModal} initialMode={initialMode} />
    </>
  )
}

export default App