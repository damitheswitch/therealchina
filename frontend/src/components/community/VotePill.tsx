import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useAuthModal } from '../../contexts/AuthModalContext'
import { useToast } from '../../contexts/ToastContext'
import { toggleAnswerUpvote, toggleQuestionUpvote } from '../../lib/communityApi'

// Real vote pill: calls the toggle_*_upvote RPC and trusts its authoritative
// {upvoted, count} response — no optimistic drift, toggling twice is safe.
// Signed-out clicks open the auth modal instead of pretending to vote.
export const VotePill = ({
  targetType,
  targetId,
  count,
  initialUpvoted = false,
  label,
}: {
  targetType: 'question' | 'answer'
  targetId: string
  count: number
  initialUpvoted?: boolean
  label?: string
}) => {
  const { user } = useAuth()
  const { openAuthModal } = useAuthModal()
  const { showToast } = useToast()
  const [upvoted, setUpvoted] = useState(initialUpvoted)
  const [shown, setShown] = useState(count)
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    if (!user) {
      openAuthModal('login')
      return
    }
    if (busy) return
    setBusy(true)
    try {
      const res =
        targetType === 'question'
          ? await toggleQuestionUpvote(targetId)
          : await toggleAnswerUpvote(targetId)
      setUpvoted(res.upvoted)
      setShown(res.upvoteCount)
    } catch (err) {
      console.error('Vote failed:', err)
      showToast('Could not save your vote. Try again.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={`upvote-btn${upvoted ? ' active' : ''}`}
      aria-pressed={upvoted}
      disabled={busy}
      onClick={toggle}
    >
      👍 {label ? `${label} ` : ''}({shown})
    </button>
  )
}
