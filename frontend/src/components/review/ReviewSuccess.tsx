import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import type { ReviewFieldValues, PreviewReview } from '../../lib/reviewFlow'
import { previewReviewFromFields } from '../../lib/reviewFlow'
import type { ReviewForm } from '../../hooks/useReviewForm'
import type { MediaItem } from '../../lib/reviewSubmit'
import { StarRating } from '../StarRating'
import { SealBadge } from '../SealBadge'
import { MediaGallery } from '../MediaGallery'
import { RecommendPill, ReviewContext, ReviewExtras, ReviewStrengthMeter } from '../ReviewExtras'
import { useAuth } from '../../contexts/AuthContext'
import { useProfileContext } from '../../contexts/ProfileContext'
import { useAuthModal } from '../../contexts/AuthModalContext'

// Renders the just-published review the way it appears on the university
// page. Driven straight off form values, so it fills in live while the
// reviewer answers Boost cards.
export const PublishedReviewPreview = ({
  values,
  media,
  date,
  anonymous = false,
}: {
  values: ReviewFieldValues
  media: MediaItem[]
  date: string
  // A signed-in reviewer who chose "Post as Anonymous" still sees the public
  // truth here: no name, no seal.
  anonymous?: boolean
}) => {
  const { user } = useAuth()
  const { profile } = useProfileContext()

  const review = useMemo<PreviewReview>(
    () => previewReviewFromFields(values, media),
    [values, media]
  )

  const showIdentity = Boolean(user) && !anonymous
  const authorName = showIdentity ? (profile?.display_name ?? 'You') : 'Anonymous'

  return (
    <div className="review-card">
      <div className="review-header">
        <StarRating rating={review.rating} />
        <div className="review-meta">
          <RecommendPill value={review.recommend} />
          {showIdentity && <SealBadge />}
          <span>{date}</span>
        </div>
      </div>
      <div className="review-author">
        <span className={`review-author-name${showIdentity ? '' : ' muted'}`}>{authorName}</span>
      </div>
      <ReviewContext review={review} />
      <p className="review-text">{values.reviewText}</p>
      <ReviewExtras review={review} />
      {media.length > 0 && <MediaGallery media={media} />}
    </div>
  )
}

// The post-publish landing: the review card as it now appears on the
// university page, then the offers — Boost for anyone holding the write
// capability (JWT or per-review token), plus a closable sign-up invite for
// anonymous reviewers.
export const ReviewSuccess = ({
  form,
  media,
  publishedAt,
  universitySlug,
  isAnonymous,
  postedAnonymously = false,
  canBoost,
  onBoost,
  onDone,
}: {
  form: ReviewForm
  media: MediaItem[]
  publishedAt: string
  universitySlug: string | null
  isAnonymous: boolean
  // Signed-in reviewer who picked "Post as Anonymous" — the preview must show
  // the public truth (Anonymous, no seal).
  postedAnonymously?: boolean
  canBoost: boolean
  onBoost: () => void
  onDone: () => void
}) => {
  const { openAuthModal } = useAuthModal()
  const [offerDismissed, setOfferDismissed] = useState(false)

  const date = new Date(publishedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

  // The success screen is only ever the publisher's own view, so the
  // author-only meter is safe here for signed-in and anonymous reviewers
  // alike (anonymous authors never reach My reviews — this is their only
  // strength feedback). It stays out of PublishedReviewPreview on purpose:
  // that component is reused live inside the Boost card stack.
  const preview = previewReviewFromFields(form.values, media)

  return (
    <div className="wizard-step active">
      <h2 className="step-title">Your review is live.</h2>
      <p className="step-sub">This is how it looks on the page.</p>

      <PublishedReviewPreview
        values={form.values}
        media={media}
        date={date}
        anonymous={postedAnonymously}
      />

      <ReviewStrengthMeter review={preview} />

      {canBoost && (
        <div className="success-offer">
          <h3 className="success-offer-title">Make it more useful in 60 seconds?</h3>
          <p className="step-sub" style={{ marginBottom: 'var(--sp-2)' }}>
            Program, ratings, costs. One card at a time, each saved as you go.
          </p>
          <div className="success-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={onBoost}>
              Add more detail
            </button>
            <button type="button" className="btn btn-ghost" onClick={onDone}>
              Done
            </button>
          </div>
        </div>
      )}

      {isAnonymous && !offerDismissed && (
        <div className="success-offer">
          <button
            type="button"
            className="success-offer-close"
            aria-label="Dismiss sign-up offer"
            onClick={() => setOfferDismissed(true)}
          >
            ×
          </button>
          <h3 className="success-offer-title">Lock in private ownership of this review</h3>
          <p className="step-sub" style={{ marginBottom: 'var(--sp-1)' }}>
            Your review is live as Anonymous. Create a free account in 20 seconds to manage it
            privately:
          </p>
          <ul className="success-offer-perks">
            <li>Edit or delete this review anytime</li>
            <li>Get email alerts when an applicant asks a follow-up question</li>
            <li>
              Keep it 100% Anonymous, or add your nickname and the Verified seal later with one
              click
            </li>
          </ul>
          <p className="form-hint" style={{ marginBottom: 'var(--sp-2)' }}>
            🔒 Your email is never public, and you can hide your profile from the student directory.
          </p>
          <div className="success-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() =>
                openAuthModal('register', {
                  title: 'Save your review to a private account',
                  subtitle:
                    'Your review stays Anonymous publicly unless you choose to put your nickname on it.',
                  closable: true,
                })
              }
            >
              Create free private account
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setOfferDismissed(true)}>
              Maybe later
            </button>
          </div>
        </div>
      )}

      <div className="wizard-nav" style={{ justifyContent: 'flex-start' }}>
        {universitySlug ? (
          <Link to={`/university/${universitySlug}`} className="btn btn-outline">
            See it on the page →
          </Link>
        ) : (
          <Link to="/universities" className="btn btn-outline">
            Browse universities →
          </Link>
        )}
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  )
}
