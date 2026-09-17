import { StarRating } from './StarRating'
import {
  buildContextLine,
  buildFactItems,
  getRecommendMeta,
  getSubScores,
  type ReviewDisplayData,
} from '../lib/reviewDisplay'

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
