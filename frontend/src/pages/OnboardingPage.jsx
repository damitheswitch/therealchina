import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { OnboardingForm } from '../components/OnboardingForm'
import { validateDisplayName } from '../lib/validateDisplayName'

export const OnboardingPage = () => {
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      navigate('/', { replace: true })
      return
    }

    fetchProfileWithRetry()
  }, [user, authLoading, navigate])

  const fetchProfileWithRetry = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError && profileError.code === 'PGRST116') {
        await new Promise((resolve) => setTimeout(resolve, 800))
        const { data: retry, error: retryError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (retryError) throw retryError
        setProfile(retry)
      } else if (profileError) {
        throw profileError
      } else {
        setProfile(data)
      }
    } catch (err) {
      console.error('Error fetching profile for onboarding:', err)
      setError('Could not load your profile. Please refresh the page or try again.')
      showToast('Could not load your profile. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = () => {
    showToast('Welcome to The Real China!', 'success')
    navigate('/', { replace: true })
  }

  if (authLoading || loading) {
    return (
      <div className="loading" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div className="container" style={{ paddingTop: 'var(--sp-4)' }}>
        <div className="section" style={{ textAlign: 'center' }}>
          <h1 className="section-title">Something went wrong</h1>
          <p className="muted">{error}</p>
          <button onClick={fetchProfileWithRetry} className="btn btn-primary mt-2">
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
    : (user.user_metadata?.full_name || user.user_metadata?.display_name || '')

  return (
    <div className="container onboarding-page" style={{ paddingTop: 'var(--sp-4)', paddingBottom: 'var(--sp-4)' }}>
      <div className="onboarding-header" style={{ textAlign: 'center', marginBottom: 'var(--sp-4)' }}>
        <h1 className="section-title">Welcome to The Real China</h1>
        <p className="muted">Set up your profile so other students can find and connect with you.</p>
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
