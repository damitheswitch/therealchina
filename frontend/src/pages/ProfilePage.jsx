import { useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ProfileEditForm } from '../components/ProfileEditForm'
import { ProfileView } from '../components/ProfileView'
import { Link } from 'react-router-dom'
import { Icons } from '../components/Icons'

// ProfilePage component - Main profile page with routing logic
export const ProfilePage = () => {
  const { userId } = useParams()
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  // If no userId parameter, show current user's profile (edit mode)
  if (!userId) {
    if (!user) {
      return (
        <div className="container empty-state" style={{ paddingTop: '6rem' }}>
          <h3>Authentication Required</h3>
          <p>Please sign in to access your profile.</p>
          <Link to="/" className="btn btn-primary mt-2">
            <Icons.ArrowLeft /> Back to universities
          </Link>
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