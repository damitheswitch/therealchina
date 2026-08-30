import { useEffect, useState } from 'react'
import { useNavigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'

export const OnboardingGuard = () => {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [onboardingComplete, setOnboardingComplete] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setChecking(false)
      return
    }

    const checkProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single()

      if (error || !data) {
        setTimeout(async () => {
          const { data: retry } = await supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('id', user.id)
            .single()
          if (retry?.onboarding_completed) {
            setOnboardingComplete(true)
          } else {
            navigate('/onboarding', { replace: true })
          }
          setChecking(false)
        }, 800)
        return
      }

      if (data.onboarding_completed) {
        setOnboardingComplete(true)
      } else {
        navigate('/onboarding', { replace: true })
      }
      setChecking(false)
    }

    checkProfile()
  }, [user, authLoading, navigate])

  if (authLoading || checking) {
    return (
      <div
        className="loading"
        style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        Loading...
      </div>
    )
  }

  if (!user || onboardingComplete) {
    return <Outlet />
  }

  return (
    <div
      className="loading"
      style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      Loading...
    </div>
  )
}
