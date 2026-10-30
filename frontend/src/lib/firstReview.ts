// The earliest published review of a university gets a "First review" label.
// Ordering matches the one-row query in useUniversityReviews: created_at
// ascending, then id ascending as the tiebreak.

export interface DatedReview {
  id: string
  created_at: string
}

export const earliestReviewId = (reviews: DatedReview[]): string | null => {
  let first: DatedReview | null = null
  for (const r of reviews) {
    if (
      !first ||
      r.created_at < first.created_at ||
      (r.created_at === first.created_at && r.id < first.id)
    ) {
      first = r
    }
  }
  return first?.id ?? null
}
