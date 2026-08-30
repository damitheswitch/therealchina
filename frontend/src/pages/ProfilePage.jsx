import { useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useAuthModal } from '../contexts/AuthModalContext'
import { ProfileEditForm } from '../components/ProfileEditForm'
import { ProfileView } from '../components/ProfileView'
import { Link } from 'react-router-dom'
import { Icons } from '../components/Icons'

// ProfilePage component - Main profile page with routing logic
export const ProfilePage = () => {
  const { userId } = useParams()
  const { user, loading: authLoading } = useAuth()
  const { openAuthModal } = useAuthModal()

  if (authLoading) {
    return <div className="loading">Loading...</div>
  }

  // If no userId parameter, show current user's profile (edit mode)
  if (!userId) {
    if (!user) {
      return (
        <div className="container empty-state" style={{ paddingTop: '6rem' }}>
          <Icons.User size={48} />
          <h1>Build your profile</h1>
          <p>
            Sign in and add a social handle to connect with people inside The Real China. (TRC)
          </p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => openAuthModal('register')}
              className="btn btn-primary"
            >
              Create account
            </button>
            <button
              onClick={() => openAuthModal('login')}
              className="btn btn-outline"
            >
              Sign in
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="container" style={{ paddingTop: 'var(--sp-4)' }}>
        <div className="section">
          <h1 className="section-title">My Profile</h1>
          <p className="muted mb-3">Manage your profile information and preferences.</p>
          <ProfileEditForm />
        </div>
      </div>
    )
  }

  // If userId parameter exists, show that user's profile (view mode)
  return (
    <div className="container" style={{ paddingTop: 'var(--sp-4)' }}>
      <div className="section">
        <Link to="/" className="btn btn-outline" style={{ marginBottom: 'var(--sp-2)' }}>
          <Icons.ArrowLeft /> Back
        </Link>
        <ProfileView userId={userId} />
      </div>
    </div>
  )
}