import { Link } from 'react-router-dom'
import type { ClaimableReview, ClaimDecision } from '../lib/reviewClaim'
import { StarRating } from './StarRating'

// One review the signed-in user can claim, with the three decisions. Shared by
// the post-sign-in prompt and the "posted before signing in" profile section.
export const ClaimReviewCard = ({
  item,
  busy,
  disabled,
  onDecide,
}: {
  item: ClaimableReview
  busy: boolean
  disabled: boolean
  onDecide: (decision: ClaimDecision) => void
}) => {
  const date = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : null
  return (
    <div className="claim-review">
      <div className="claim-review-head">
        <StarRating rating={item.rating} />
        {date && <span className="muted">{date}</span>}
      </div>
      {item.universityName &&
        (item.universitySlug ? (
          <Link to={`/university/${item.universitySlug}/`} className="claim-review-uni">
            {item.universityName}
          </Link>
        ) : (
          <div className="claim-review-uni">{item.universityName}</div>
        ))}
      {item.text?.trim() ? (
        <p className="claim-review-text">{item.text}</p>
      ) : (
        <span className="quick-rating-badge">Quick rating</span>
      )}
      {item.matchedBy === 'email' && (
        <p className="form-hint" style={{ marginTop: 0 }}>
          Matched by the email you left on the review.
        </p>
      )}
      <div className="claim-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled}
          title="Your display name and the Verified seal show on it"
          onClick={() => onDecide('named')}
        >
          {busy ? 'Claiming...' : 'Put my name on it'}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          disabled={disabled}
          title="Saved to your account. Publicly it stays Anonymous, and you can put your name on it later from My reviews."
          onClick={() => onDecide('anonymous')}
        >
          Keep it anonymous
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={disabled}
          onClick={() => onDecide('not_mine')}
        >
          Not mine
        </button>
      </div>
    </div>
  )
}
