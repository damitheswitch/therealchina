import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { StarRating } from './StarRating'
import { SealBadge } from './SealBadge'
import { UpvoteButton } from './UpvoteButton'
import { CommentSection } from './CommentSection'
import { MediaGallery } from './MediaGallery'
import { SealAvatar } from './SealAvatar'
import { Icons } from './Icons'
import { RecommendPill, ReviewContext, ReviewExtras } from './ReviewExtras'
import { getReviewTeaserItems, hasReviewExtras } from '../lib/reviewDisplay'

// ~3 rendered lines of .review-text (16px × 1.65) with a 1px epsilon so an
// exactly-3-line review never false-positives as overflowing.
const PREVIEW_LINES = 3
const LINE_HEIGHT_FALLBACK = 26

// Prerendered pages render this component in Node, where useLayoutEffect
// warns and no DOM measurement exists anyway — useEffect there, layout
// effect in the browser.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// ReviewCard component. The author profile is looked up and batched by the
// parent page to avoid one profile query per card (N+1).
// Long/info-dense reviews collapse to a teaser: verdict header, context, a
// 3-line text preview, and "what's inside" chips — expanding reveals the
// full text plus pros/cons, category ratings, tags, and media.
/**
 * @param {object} props
 * @param {object} props.review
 * @param {object | null} [props.author]
 * @param {{ count: number, upvoted?: boolean }} [props.upvote]
 * @param {number | null} [props.commentCount]
 */
export const ReviewCard = ({ review, author, upvote, commentCount = null }) => {
  const { id, rating, text, media, created_at, user_id, recommend } = review
  const [expanded, setExpanded] = useState(false)
  // Optimistically clamped: prerendered HTML ships every card clamped (a
  // no-op visually on short text), so hydration never un-collapses a card —
  // measure() only removes the clamp when the text actually fits.
  const [clamped, setClamped] = useState(true)
  const [textOverflows, setTextOverflows] = useState(false)
  const textRef = useRef(null)
  const cardRef = useRef(null)
  const regionId = useId()

  const hasExtras = hasReviewExtras(review)
  const teaserItems = getReviewTeaserItems(review)
  const isCollapsible = textOverflows || hasExtras
  const showClamped = clamped && !expanded

  // Measures the unclamped text height against the preview line count. Runs
  // inside useLayoutEffect so a needed clamp lands before the first paint —
  // no flash in either direction. The ResizeObserver re-measures on viewport
  // resize and late font loads.
  useIsomorphicLayoutEffect(() => {
    const el = textRef.current
    if (!el) return

    const measure = () => {
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || LINE_HEIGHT_FALLBACK
      const overflows = el.scrollHeight > lineHeight * PREVIEW_LINES + 1
      setTextOverflows(overflows)
      setClamped(overflows)
    }

    measure()

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      // scrollHeight is unreliable while line-clamped (clamped content isn't
      // scrollable overflow in engines that implement the spec), so
      // re-measure unclamped inside one synchronous layout block — pre-paint,
      // and it converges because the restored state matches React's render.
      const wasClamped = el.classList.contains('clamped')
      if (wasClamped) el.classList.remove('clamped')
      measure()
      if (wasClamped) el.classList.add('clamped')
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [text])

  const toggleExpanded = () => {
    if (expanded) {
      // Collapsing a long review mid-read would strand the user far below the
      // card — bring the card back into view.
      cardRef.current?.scrollIntoView({ block: 'nearest' })
    }
    setExpanded((prev) => !prev)
  }

  const date = new Date(created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

  return (
    <div id={`review-${id}`} className="review-card fade-in" ref={cardRef}>
      <div className="review-header">
        <StarRating rating={rating} />
        <div className="review-meta">
          <RecommendPill value={recommend} />
          {user_id && <SealBadge />}
          <span>{date}</span>
        </div>
      </div>

      {user_id && (
        <div className="review-author">
          {author ? (
            <Link to={`/profile/${user_id}`} className="review-author-link">
              <SealAvatar displayName={author.display_name} size={24} />
              <span className="review-author-name">{author.display_name}</span>
            </Link>
          ) : (
            <span className="review-author-name muted">Former member</span>
          )}
        </div>
      )}

      <ReviewContext review={review} />

      <div className="review-text-wrap">
        <p ref={textRef} className={`review-text${showClamped ? ' clamped' : ''}`}>
          {text}
        </p>
        {showClamped && textOverflows && <div className="review-text-fade" aria-hidden="true" />}
      </div>

      {isCollapsible && (
        <div className="review-disclosure-row">
          {!expanded && teaserItems.length > 0 && (
            <div className="review-teaser">
              {teaserItems.map((item) => (
                <span key={item} className="teaser-chip">
                  {item}
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            className={`review-expand-btn${expanded ? ' open' : ''}`}
            onClick={toggleExpanded}
            aria-expanded={expanded}
            aria-controls={expanded && hasExtras ? regionId : undefined}
          >
            <span>{expanded ? 'Show less' : 'Read full review'}</span>
            <Icons.Chevron />
          </button>
        </div>
      )}

      {expanded && hasExtras && (
        <div className="review-expanded-region" id={regionId}>
          <ReviewExtras review={review} />
          {media && media.length > 0 && <MediaGallery media={media} />}
        </div>
      )}

      {expanded && hasExtras && (
        <div className="review-disclosure-row">
          <button
            type="button"
            className="review-expand-btn open"
            onClick={toggleExpanded}
            aria-expanded={expanded}
            aria-controls={regionId}
          >
            <span>Show less</span>
            <Icons.Chevron />
          </button>
        </div>
      )}

      <div className="review-actions">
        <UpvoteButton reviewId={id} initialCount={upvote?.count} initialUpvoted={upvote?.upvoted} />
        <CommentSection reviewId={id} initialCount={commentCount} />
      </div>
    </div>
  )
}
