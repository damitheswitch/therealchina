import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import type { ReviewCardData } from '../../lib/reviewDisplay'
import type { ReviewFieldValues } from '../../lib/reviewFlow'
import type { ReviewForm } from '../../hooks/useReviewForm'
import type { MediaItem } from '../../lib/reviewSubmit'
import { StarRating } from '../StarRating'
import { SealBadge } from '../SealBadge'
import { MediaGallery } from '../MediaGallery'
import { RecommendPill, ReviewContext, ReviewExtras } from '../ReviewExtras'
import { useAuth } from '../../contexts/AuthContext'
import { useProfileContext } from '../../contexts/ProfileContext'
import { useAuthModal } from '../../contexts/AuthModalContext'

// The card needs `rating` on top of the display-fields shape ReviewCardData
// describes (the real card reads it off the full reviews row).
type PreviewReview = ReviewCardData & { rating: number }

// Renders the just-published review the way it appears on the university
// page. Driven straight off form values, so it fills in live while the
// reviewer answers Boost cards.
export const PublishedReviewPreview = ({
  values,
  media,
  date,
}: {
  values: ReviewFieldValues
  media: MediaItem[]
  date: string
}) => {
  const { user } = useAuth()
  const { profile } = useProfileContext()

  const review = useMemo<PreviewReview>(
    () => ({
      rating: values.rating,
      recommend: values.recommend || null,
      program: values.program || null,
      degree_level: values.degreeLevel || null,
      enrollment_status: values.enrollmentStatus || null,
      start_year: values.startYear || null,
      end_year: values.endYear || null,
      language_of_instruction: values.languageOfInstruction || null,
      tuition_range: values.tuitionRange || null,
      living_cost_range: values.livingCostRange || null,
      funding_type: values.fundingType || null,
      funding_coverage:
        values.fundingType && values.fundingType !== 'self' ? values.fundingCoverage || null : null,
      pros: values.pros || null,
      cons: values.cons || null,
      tags: values.selectedTags,
      media: media as unknown as PreviewReview['media'],
      rating_academics: values.subscores.rating_academics ?? null,
      rating_campus: values.subscores.rating_campus ?? null,
      rating_accommodation: values.subscores.rating_accommodation ?? null,
      rating_cost: values.subscores.rating_cost ?? null,
      rating_intl_office: values.subscores.rating_intl_office ?? null,
      rating_social: values.subscores.rating_social ?? null,
      rating_extracurricular: values.subscores.rating_extracurricular ?? null,
      rating_career: values.subscores.rating_career ?? null,
    }),
    [values, media]
  )

  const authorName = user ? (profile?.display_name ?? 'You') : 'Anonymous'

  return (
    <div className="review-card">
      <div className="review-header">
        <StarRating rating={review.rating} />
        <div className="review-meta">
          <RecommendPill value={review.recommend} />
          {user && <SealBadge />}
          <span>{date}</span>
        </div>
      </div>
      <div className="review-author">
        <span className={`review-author-name${user ? '' : ' muted'}`}>{authorName}</span>
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
  canBoost,
  onBoost,
  onDone,
}: {
  form: ReviewForm
  media: MediaItem[]
  publishedAt: string
  universitySlug: string | null
  isAnonymous: boolean
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

  return (
    <div className="wizard-step active">
      <h2 className="step-title">Your review is live.</h2>
      <p className="step-sub">This is how it looks on the page.</p>

      <PublishedReviewPreview values={form.values} media={media} date={date} />

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
          <h3 className="success-offer-title">Keep your review</h3>
          <p className="step-sub" style={{ marginBottom: 'var(--sp-2)' }}>
            Create a free account to get notified when someone replies to your review, edit it
            later, or put your name on it. It stays anonymous unless you choose otherwise.
          </p>
          <div className="success-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() =>
                openAuthModal('register', {
                  title: 'Create a free account',
                  subtitle:
                    'Claim your review, get reply notifications, and manage it from your profile.',
                  closable: true,
                })
              }
            >
              Create free account
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
