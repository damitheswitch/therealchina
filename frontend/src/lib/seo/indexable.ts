// The single rule that decides whether a university page earns indexing:
// at least one substantive review (≥200 chars). Used identically by the
// static pipeline (which routes get prerendered) and the page itself
// (robots meta on SPA-rendered thin pages stays noindex).
export const SUBSTANTIVE_REVIEW_CHARS = 200

export const isSubstantiveReview = (text: string | null | undefined): boolean =>
  (text?.trim().length ?? 0) >= SUBSTANTIVE_REVIEW_CHARS

export const hasSubstantiveReview = (
  reviews: { text?: string | null }[] | null | undefined
): boolean => (reviews ?? []).some((r) => isSubstantiveReview(r.text))
