import type { Tables } from '../types/database.types'
import { detailScore, type ReviewDetailInput } from './reviewDetail'

// Shared review sort model. 'helpful' ranks by upvotes + filled detail
// areas — PostgREST can't ORDER BY a related-row count, so hooks rank that
// one client-side; the other options map to real columns and can run
// server-side.
export type ReviewSort = 'newest' | 'highest' | 'lowest' | 'helpful'

export const DEFAULT_REVIEW_SORT: ReviewSort = 'newest'

// D4.3 (owner decision 2026-10-09): on university pages the default sort is
// 'auto' — resolved to 'helpful' once the page has at least this many
// reviews, 'newest' below that. Lives here (not in the hook) so the
// prerender pipeline can order payloads to match the hydrated default view.
export const HELPFUL_DEFAULT_MIN_REVIEWS = 5
export type ReviewSortChoice = ReviewSort | 'auto'
export const resolveAutoSort = (sort: ReviewSortChoice, reviewCount: number): ReviewSort =>
  sort === 'auto' ? (reviewCount >= HELPFUL_DEFAULT_MIN_REVIEWS ? 'helpful' : 'newest') : sort

export const REVIEW_SORT_OPTIONS: { value: ReviewSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'highest', label: 'Highest rated' },
  { value: 'lowest', label: 'Lowest rated' },
  { value: 'helpful', label: 'Most helpful' },
]

export const isReviewSort = (value: unknown): value is ReviewSort =>
  REVIEW_SORT_OPTIONS.some((o) => o.value === value)

// The fields every sort needs — full review rows satisfy this, and the
// "heads" selects used by two-phase fetches do too (REVIEW_DETAIL_COLUMNS
// adds the detail fields 'helpful' reads; absent keys score zero).
export type ReviewSortable = Pick<Tables<'reviews'>, 'id' | 'rating' | 'created_at'> &
  ReviewDetailInput

// Stable tiebreak for every sort: newest first, id desc last. Mirrors the
// server ORDER BY so client- and server-sorted pages agree at boundaries.
const byRecency = (a: ReviewSortable, b: ReviewSortable): number =>
  (b.created_at ?? '').localeCompare(a.created_at ?? '') || b.id.localeCompare(a.id)

export const compareReviews = (
  a: ReviewSortable,
  b: ReviewSortable,
  sort: ReviewSort,
  upvoteCounts: Record<string, number> = {}
): number => {
  switch (sort) {
    case 'highest':
      return b.rating - a.rating || byRecency(a, b)
    case 'lowest':
      return a.rating - b.rating || byRecency(a, b)
    case 'helpful': {
      // Each filled detail area counts like one upvote (D4.3): a review that
      // answers more of the reader's questions ranks with one that earned
      // the same vote count. Recency stays the final tiebreak.
      const score = (r: ReviewSortable) => (upvoteCounts[r.id] ?? 0) + detailScore(r)
      return score(b) - score(a) || byRecency(a, b)
    }
    case 'newest':
      return byRecency(a, b)
  }
}

// Returns a sorted copy — the input order is never mutated (the seeded
// prerender payload is shared between hooks).
export const sortReviews = <T extends ReviewSortable>(
  reviews: readonly T[],
  sort: ReviewSort,
  upvoteCounts: Record<string, number> = {}
): T[] => [...reviews].sort((a, b) => compareReviews(a, b, sort, upvoteCounts))

// Column + direction for the server-backed sorts. Always append a recency
// tiebreak after this so pagination is deterministic.
export const REVIEW_SERVER_ORDER: Record<
  Exclude<ReviewSort, 'helpful'>,
  { column: 'created_at' | 'rating'; ascending: boolean }
> = {
  newest: { column: 'created_at', ascending: false },
  highest: { column: 'rating', ascending: false },
  lowest: { column: 'rating', ascending: true },
}

export const isServerSortable = (sort: ReviewSort): sort is Exclude<ReviewSort, 'helpful'> =>
  sort !== 'helpful'

// upvotes rows → review_id → count. Batched `.in()` rows, never per-row
// queries (same convention as the engagement-counts effects).
export const countByReviewId = (
  rows: readonly { review_id: string }[] | null | undefined
): Record<string, number> => {
  const counts: Record<string, number> = {}
  for (const row of rows ?? []) {
    counts[row.review_id] = (counts[row.review_id] ?? 0) + 1
  }
  return counts
}
