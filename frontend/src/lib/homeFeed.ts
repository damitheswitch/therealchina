// Homepage feed rules. A wall of "No reviews yet" cards makes the site look
// empty, so the default homepage view leads with universities that have
// reviews and keeps the rest one search (or one "browse all" click) away.

interface HasReviewCount {
  review_count: number
}

interface HasRankings {
  rankings?: unknown
}

export const FIRST_REVIEW_BOARD_SIZE = 6

// Reviewed universities first. If nothing has a review yet (fresh database)
// fall back to the full list so the homepage is never blank.
export const reviewedOnly = <T extends HasReviewCount>(rows: T[]): T[] => {
  const reviewed = rows.filter((u) => u.review_count > 0)
  return reviewed.length > 0 ? reviewed : rows
}

const nationalRank = (u: HasRankings): number => {
  const rankings = u.rankings
  if (rankings && typeof rankings === 'object' && 'shanghai_national' in rankings) {
    const rank = (rankings as { shanghai_national?: unknown }).shanghai_national
    if (typeof rank === 'number') return rank
  }
  return Number.POSITIVE_INFINITY
}

// Universities still waiting for a first review, best-known first. We have no
// per-university "request" counter, so national rank stands in for how many
// students are likely to be looking at the page.
export const pickFirstReviewCandidates = <T extends HasReviewCount & HasRankings>(
  rows: T[],
  limit = FIRST_REVIEW_BOARD_SIZE
): T[] =>
  rows
    .filter((u) => u.review_count === 0)
    .sort((a, b) => nationalRank(a) - nationalRank(b))
    .slice(0, limit)
