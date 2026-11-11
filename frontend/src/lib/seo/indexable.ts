// The single rule that decides whether a university page earns indexing:
// >=2 substantive reviews (>=200 chars each) or >=3 reviews with written
// text. Used identically by the static pipeline (which routes get
// prerendered) and the page itself (robots meta on SPA-rendered thin pages
// stays noindex).
//
// Quick ratings (review_kind 'quick': rating/tags only, no written text)
// never count toward either threshold — indexing is meant to reward real
// substance. They do count toward the star average and recommend percent
// elsewhere; only this gate is text-bound.
export const SUBSTANTIVE_REVIEW_CHARS = 200

export const isSubstantiveReview = (text: string | null | undefined): boolean =>
  (text?.trim().length ?? 0) >= SUBSTANTIVE_REVIEW_CHARS

interface IndexableReviewRow {
  text?: string | null
  // Slim aggregate rows don't fetch text; they carry the generated
  // review_kind column instead. 'full' = has written text, same definition
  // the database derives.
  review_kind?: string | null
}

const hasWrittenText = (r: IndexableReviewRow): boolean =>
  (r.text?.trim().length ?? 0) > 0 || r.review_kind === 'full'

export const indexableByReviews = (reviews: IndexableReviewRow[] | null | undefined): boolean => {
  const rows = reviews ?? []
  const substantive = rows.filter((r) => isSubstantiveReview(r.text)).length
  const withText = rows.filter(hasWrittenText).length
  return substantive >= 2 || withText >= 3
}
