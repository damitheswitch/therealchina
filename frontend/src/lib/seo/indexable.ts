// The single rule that decides whether a university page earns indexing:
// ≥2 substantive reviews (≥200 chars each) or ≥3 reviews total. Used
// identically by the static pipeline (which routes get prerendered) and the
// page itself (robots meta on SPA-rendered thin pages stays noindex).
export const SUBSTANTIVE_REVIEW_CHARS = 200

export const isSubstantiveReview = (text: string | null | undefined): boolean =>
  (text?.trim().length ?? 0) >= SUBSTANTIVE_REVIEW_CHARS

export const indexableByReviews = (
  reviews: { text?: string | null }[] | null | undefined
): boolean => {
  const rows = reviews ?? []
  const substantive = rows.filter((r) => isSubstantiveReview(r.text)).length
  return substantive >= 2 || rows.length >= 3
}
