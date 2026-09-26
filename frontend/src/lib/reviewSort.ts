import type { Tables } from '../types/database.types'

// Shared review sort model. 'helpful' ranks by upvote count — PostgREST can't
// ORDER BY a related-row count, so hooks rank that one client-side; the other
// options map to real columns and can run server-side.
export type ReviewSort = 'newest' | 'highest' | 'lowest' | 'helpful'

export const DEFAULT_REVIEW_SORT: ReviewSort = 'newest'

export const REVIEW_SORT_OPTIONS: { value: ReviewSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'highest', label: 'Highest rated' },
  { value: 'lowest', label: 'Lowest rated' },
  { value: 'helpful', label: 'Most helpful' },
]

export const isReviewSort = (value: unknown): value is ReviewSort =>
  REVIEW_SORT_OPTIONS.some((o) => o.value === value)

// The fields every sort needs — full review rows satisfy this, and the light
// "heads" select (id, rating, created_at) used by two-phase fetches does too.
export type ReviewSortable = Pick<Tables<'reviews'>, 'id' | 'rating' | 'created_at'>

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
    case 'helpful':
      return (upvoteCounts[b.id] ?? 0) - (upvoteCounts[a.id] ?? 0) || byRecency(a, b)
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
