import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUserDraftCount } from '../hooks/useUserDraftCount'
import { Icons } from './Icons'

// Small banner shown after login (or on any page) when the user has saved
// review drafts. Dismissible per session; deleting every draft removes it.
const DISMISS_KEY = 'trc_draft_banner_dismissed'

export const LoginDraftBanner = () => {
  const { user } = useAuth()
  const { count, loading, refetch } = useUserDraftCount()
  const location = useLocation()
  const [dismissed, setDismissed] = useState(false)

  // Refresh the count on navigation so deletions on /profile are reflected
  // without a remount.
  useEffect(() => {
    refetch()
  }, [location.pathname, refetch])

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      // Storage unavailable — treat as not dismissed.
    }
  }, [location.pathname])

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Storage unavailable — the state toggle still hides it for now.
    }
    setDismissed(true)
  }

  if (!user || loading || count === 0 || dismissed) return null
  if (location.pathname === '/review' || location.pathname === '/profile') return null

  return (
    <div className="draft-banner">
      <div className="draft-banner-copy">
        <Icons.Pen />
        <span>
          You have {count} saved review draft{count !== 1 ? 's' : ''} waiting. Finish them in your
          profile.
        </span>
      </div>
      <div className="draft-banner-actions">
        <Link to="/profile" className="btn btn-primary btn-sm">
          Go to profile
        </Link>
        <button type="button" className="btn btn-ghost btn-sm" onClick={handleDismiss}>
          Not now
        </button>
      </div>
    </div>
  )
}
