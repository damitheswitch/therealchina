// The earliest published review of a university gets a "First review" label.
// Ordering matches the one-row query in useUniversityReviews: created_at
// ascending, then id ascending as the tiebreak.

// Rows come from views whose generated types allow nulls; undated rows are skipped.
export interface DatedReview {
  id: string | null
  created_at: string | null
}

export const earliestReviewId = (reviews: DatedReview[]): string | null => {
  let first: { id: string; created_at: string } | null = null
  for (const r of reviews) {
    if (!r.id || !r.created_at) continue
    if (
      !first ||
      r.created_at < first.created_at ||
      (r.created_at === first.created_at && r.id < first.id)
    ) {
      first = { id: r.id, created_at: r.created_at }
    }
  }
  return first?.id ?? null
}
