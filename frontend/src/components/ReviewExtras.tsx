import { StarRating } from './StarRating'
import {
  buildContextLine,
  buildFactItems,
  getRecommendMeta,
  getSubScores,
  type ReviewCardData,
  type ReviewDisplayData,
} from '../lib/reviewDisplay'
import {
  DETAIL_AREA_COUNT,
  DETAILED_THRESHOLD,
  detailScore,
  isDetailedReview,
  missingDetailAreas,
} from '../lib/reviewDetail'

// Small pill shown in the card header: "Recommends" / "Neutral" /
// "Doesn't recommend". Renders nothing for reviews without a value.
export const RecommendPill = ({ value }: { value?: string | null }) => {
  const meta = getRecommendMeta(value)
  if (!meta) return null
  return (
    <span className={`review-recommend rec-${value}`}>
      {meta.emoji} {meta.label}
    </span>
  )
}

// Muted context lines above the review text: program / degree / enrollment /
// years on one line, instruction language and cost facts on a second.
export const ReviewContext = ({ review }: { review: ReviewDisplayData }) => {
  const context = buildContextLine(review)
  const facts = buildFactItems(review)
  if (!context && facts.length === 0) return null
  return (
    <div className="review-context-block">
      {context && <p className="review-context">{context}</p>}
      {facts.length > 0 && <p className="review-facts">{facts.join(' · ')}</p>}
    </div>
  )
}

// Sections below the review text: pros/cons blocks, sub-score grid, tag chips.
export const ReviewExtras = ({ review }: { review: ReviewDisplayData }) => {
  const subscores = getSubScores(review)
  const tags = (review.tags ?? []).filter(Boolean)
  if (!review.pros && !review.cons && subscores.length === 0 && tags.length === 0) return null

  return (
    <>
      {(review.pros || review.cons) && (
        <div className="review-proscons">
          {review.pros && (
            <div className="review-pc">
              <span className="review-pc-label pc-pros">Pros</span>
              <p className="review-pc-text">{review.pros}</p>
            </div>
          )}
          {review.cons && (
            <div className="review-pc">
              <span className="review-pc-label pc-cons">Cons</span>
              <p className="review-pc-text">{review.cons}</p>
            </div>
          )}
        </div>
      )}

      {subscores.length > 0 && (
        <div className="review-subscores">
          {subscores.map((s) => (
            <div key={s.key} className="review-subscore">
              <span className="review-subscore-label">{s.label}</span>
              <StarRating rating={s.value} sizeClass="stars-sm" />
            </div>
          ))}
        </div>
      )}

      {tags.length > 0 && (
        <div className="chip-row">
          {tags.map((tag) => (
            <span key={tag} className="chip">
              {tag}
            </span>
          ))}
        </div>
      )}
    </>
  )
}

// Author-facing completeness gauge (D4.4 — owner decision: authors only, a
// public score would invite gaming). Shown in My reviews; the post-publish
// success screen picks it up when the Phase 3 branch lands. Nothing here
// renders on public cards — their mark is the gold accent alone.
export const ReviewStrengthMeter = ({ review }: { review: ReviewCardData }) => {
  const score = detailScore(review)
  const missing = missingDetailAreas(review)
  const earned = isDetailedReview(review)
  const missingLabels = missing.map((a) => a.label).join(', ')
  return (
    <div className="strength-meter">
      <div className="strength-meter-head">
        <span className="strength-meter-label">Review strength</span>
        <span className="strength-meter-count">
          {score} of {DETAIL_AREA_COUNT}
        </span>
      </div>
      <div
        className="strength-meter-track"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={DETAIL_AREA_COUNT}
        aria-valuetext={`${score} of ${DETAIL_AREA_COUNT} areas`}
        aria-label="Review strength"
      >
        <span
          className="strength-meter-fill"
          style={{ width: `${(score / DETAIL_AREA_COUNT) * 100}%` }}
        />
      </div>
      <p className="strength-meter-hint">
        {earned
          ? missing.length
            ? `Gold highlight earned. Still missing: ${missingLabels}.`
            : 'Gold highlight earned. Every area covered.'
          : `Still missing: ${missingLabels}. ${DETAILED_THRESHOLD} or more areas earn the gold highlight.`}
      </p>
    </div>
  )
}
