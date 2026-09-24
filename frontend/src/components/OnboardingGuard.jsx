import { useEffect } from 'react'
import { useNavigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'

// Renders child routes immediately (no loading gate — required for prerendered
// HTML to survive hydration). Logged-in users without a completed profile are
// still redirected to /onboarding; the check runs in the background with an
// 800ms retry for just-created profiles, same as before.
export const OnboardingGuard = () => {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (authLoading || !user) return

    const controller = new AbortController()
    const fetchComplete = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .abortSignal(controller.signal)
        .maybeSingle()
      return !error && !!data?.onboarding_completed
    }

    let timer
    ;(async () => {
      if (await fetchComplete()) return
      if (controller.signal.aborted) return
      timer = setTimeout(async () => {
        const ok = await fetchComplete()
        if (!controller.signal.aborted && !ok) navigate('/onboarding', { replace: true })
      }, 800)
    })()

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [user, authLoading, navigate])

  return <Outlet />
}
