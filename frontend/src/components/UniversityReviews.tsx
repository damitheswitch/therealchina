import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUniversityReviews } from '../hooks/useUniversityReviews'
import { ReviewCard } from './ReviewCard'
import { ReviewSortSelect } from './ReviewSortSelect'
import { Icons } from './Icons'
import { DEFAULT_REVIEW_SORT, type ReviewSort } from '../lib/reviewSort'
import type { Tables } from '../types/database.types'

type UniversityRef = Pick<Tables<'universities'>, 'id' | 'name' | 'slug'>

// One university's review section, paginated server-side. The page mounts
// this with key={university.id} so switching universities remounts the whole
// section — page, loading, and list state reset atomically instead of
// flashing the previous university's reviews under the new header.
export const UniversityReviews = ({ university }: { university: UniversityRef }) => {
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<ReviewSort>(DEFAULT_REVIEW_SORT)
  const {
    reviews,
    authors,
    totalCount,
    pageCount,
    loading,
    error,
    refetch,
    commentCounts,
    upvotes,
  } = useUniversityReviews(university.id, page, sort)
  const sectionRef = useRef<HTMLDivElement>(null)

  // The count can shrink while the user sits on a later page (e.g. a review
  // was deleted): clamp back into range. Scoped to successful loads so a
  // failed fetch keeps the error state visible instead of auto-retrying.
  useEffect(() => {
    if (!loading && !error && page > pageCount) setPage(pageCount)
  }, [loading, error, page, pageCount])

  const goToPage = (next: number) => {
    setPage(next)
    // The section's scroll-margin-top keeps the title clear of the sticky
    // header; smooth animation comes from the global CSS rule.
    sectionRef.current?.scrollIntoView()
  }

  const handleSortChange = (next: ReviewSort) => {
    // Sort change reorders the whole corpus — the old page index is
    // meaningless under the new order, so always restart at page 1.
    setSort(next)
    setPage(1)
  }

  return (
    <div className="section uni-reviews" style={{ paddingTop: 'var(--sp-2)' }} ref={sectionRef}>
      <div className="reviews-head">
        <h2 className="section-title">Student Reviews{totalCount > 0 ? ` (${totalCount})` : ''}</h2>
        {totalCount > 1 && <ReviewSortSelect value={sort} onChange={handleSortChange} />}
      </div>

      {loading ? (
        <div className="empty-state">
          <p>Loading reviews...</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          <h3>Couldn&apos;t load reviews</h3>
          <button type="button" className="btn btn-outline mt-2" onClick={refetch}>
            Try again
          </button>
        </div>
      ) : totalCount > 0 ? (
        <>
          {reviews.length === 0 ? (
            // Out-of-range page after a count shrink — the clamp effect is
            // already refetching; don't flash the "no reviews" empty state.
            <div className="empty-state">
              <p>Loading reviews...</p>
            </div>
          ) : (
            <div className="review-list">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  author={review.user_id ? (authors[review.user_id] ?? null) : null}
                  upvote={upvotes[review.id]}
                  commentCount={commentCounts[review.id]}
                />
              ))}
            </div>
          )}
          {pageCount > 1 && (
            <div className="pagination">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || loading}
              >
                <Icons.ArrowLeft /> Previous
              </button>
              <span className="pagination-info">
                Page {page} of {pageCount} · {totalCount} reviews
              </span>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => goToPage(page + 1)}
                disabled={page >= pageCount || loading}
              >
                Next <Icons.ArrowRight />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <h3>No reviews yet</h3>
          <p>Be the first to share your experience at {university.name}.</p>
          <Link to={`/review?uni=${university.slug}`} className="btn btn-primary mt-2">
            <Icons.Pen /> Leave a Review
          </Link>
        </div>
      )}
    </div>
  )
}
