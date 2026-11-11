import { useState } from 'react'
import { Icons } from './Icons'
import { useAuth } from '../contexts/AuthContext'
import { useAuthModal } from '../contexts/AuthModalContext'
import { useToast } from '../contexts/ToastContext'
import { submitContentReport, type ReportTargetType } from '../lib/contentReport'

// One-click flag for a review or comment, same pattern as the Q&A report
// buttons. Signed-out visitors get the sign-in modal (on click, never on load).
export const ReportButton = ({
  targetType,
  targetId,
}: {
  targetType: ReportTargetType
  targetId: string
}) => {
  const { user } = useAuth()
  const { openAuthModal } = useAuthModal()
  const { showToast } = useToast()
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')

  const handleClick = async () => {
    if (!user) {
      openAuthModal('login')
      return
    }
    setState('sending')
    try {
      await submitContentReport({ targetType, targetId })
      setState('sent')
      showToast('Report noted. Our team will take a look.', 'success')
    } catch (err) {
      console.error('Report failed:', err)
      setState('idle')
      showToast('Could not send that report. Try again.', 'error')
    }
  }

  const label = targetType === 'review' ? 'Report this review' : 'Report this comment'

  return (
    <button
      type="button"
      className="flag-btn"
      onClick={handleClick}
      disabled={state !== 'idle'}
      aria-label={state === 'sent' ? `${label}: reported` : label}
    >
      <Icons.Flag /> {state === 'sent' ? 'Reported' : 'Report'}
    </button>
  )
}
