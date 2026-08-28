import { Routes, Route } from 'react-router-dom'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { LandingPage } from './pages/LandingPage'
import { UniversityPage } from './pages/UniversityPage'
import { ReviewPage } from './pages/ReviewPage'
import { ProfilePage } from './pages/ProfilePage'
import { UserDirectoryPage } from './pages/UserDirectoryPage'
import { NotFoundPage } from './pages/NotFoundPage'

function App() {
  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/university/:slug" element={<UniversityPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          <Route path="/users" element={<UserDirectoryPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}

export default App