import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useProfile } from '../hooks/useProfile'
import { OnboardingForm } from '../components/OnboardingForm'
import { validateDisplayName } from '../lib/validateDisplayName'

export const OnboardingPage = () => {
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const { profile, loading, error, refetch } = useProfile(user?.id, { retry: true })

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      navigate('/', { replace: true })
      return
    }
  }, [user, authLoading, navigate])

  // Surface fetch errors as a toast (preserves previous inline behavior).
  useEffect(() => {
    if (error) showToast('Could not load your profile. Please try again.', 'error')
  }, [error, showToast])

  const handleComplete = () => {
    showToast('Welcome to The Real China!', 'success')
    navigate('/', { replace: true })
  }

  if (authLoading || loading || !user) {
    return (
      <div
        className="loading"
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div className="container" style={{ paddingTop: 'var(--sp-4)' }}>
        <div className="section" style={{ textAlign: 'center' }}>
          <h1 className="section-title">Something went wrong</h1>
          <p className="muted">
            Could not load your profile. Please refresh the page or try again.
          </p>
          <button onClick={refetch} className="btn btn-primary mt-2">
            Try again
          </button>
        </div>
      </div>
    )
  }

  const hasName = !!profile?.display_name
  const nameIsValid = hasName ? validateDisplayName(profile.display_name).valid : false
  const displayNameEditable = !hasName || !nameIsValid
  const initialDisplayName = hasName
    ? profile.display_name
    : user?.user_metadata?.full_name || user?.user_metadata?.display_name || ''

  return (
    <div
      className="container onboarding-page"
      style={{ paddingTop: 'var(--sp-4)', paddingBottom: 'var(--sp-4)' }}
    >
      <div
        className="onboarding-header"
        style={{ textAlign: 'center', marginBottom: 'var(--sp-4)' }}
      >
        <h1 className="section-title">Welcome to The Real China</h1>
        <p className="muted">
          Set up your profile so other students can find and connect with you.
        </p>
      </div>

      <OnboardingForm
        initialDisplayName={initialDisplayName}
        displayNameEditable={displayNameEditable}
        initialProfile={profile}
        onComplete={handleComplete}
      />
    </div>
  )
}
