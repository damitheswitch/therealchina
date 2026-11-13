import { useState } from 'react'
import { useToast } from '../contexts/ToastContext'
import { useClaimableReviews } from '../hooks/useClaimableReviews'
import { resolveClaim, type ClaimableReview, type ClaimDecision } from '../lib/reviewClaim'
import { ClaimReviewCard } from './ClaimReviewCard'

// Profile section for reviews posted before signing in. The sign-in prompt
// only shows once per session; this keeps them findable, so the owner can
// claim one and then edit or delete it from My reviews.
export const ClaimableReviews = ({ onClaimed }: { onClaimed: () => void }) => {
  const { items, remove } = useClaimableReviews()
  const { showToast } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)

  const decide = async (item: ClaimableReview, decision: ClaimDecision) => {
    setBusyId(item.reviewId)
    try {
      await resolveClaim(item.reviewId, decision)
      remove(item.reviewId)
      if (decision === 'named') {
        showToast('Done. It now shows your name and the Verified seal.', 'success')
      } else if (decision === 'anonymous') {
        showToast('Added to your reviews. It stays anonymous publicly.', 'success')
      }
      if (decision !== 'not_mine') onClaimed()
    } catch (err) {
      console.error('Claim resolve failed:', err)
      showToast(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
        'error'
      )
    } finally {
      setBusyId(null)
    }
  }

  if (items.length === 0) return null

  return (
    <div className="claim-list" style={{ marginBottom: 'var(--sp-3)' }}>
      <h4 style={{ margin: 0 }}>Posted before you signed in</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>
        These look like yours. Claim one to edit or delete it here. Until then it stays live on the
        university page.
      </p>
      {items.map((item) => (
        <ClaimReviewCard
          key={item.reviewId}
          item={item}
          busy={busyId === item.reviewId}
          disabled={busyId !== null}
          onDecide={(decision) => decide(item, decision)}
        />
      ))}
    </div>
  )
}
