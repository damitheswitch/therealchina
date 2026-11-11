// Helpers for showing one real review as a short quote (home hero, university
// page header). Pure, so they can be unit-tested and used while prerendering.

export interface QuoteCandidate {
  id: string
  rating: number
  text: string | null
  upvote_count?: number | null
  created_at: string
}

// Reviews shorter than this read as filler, not as a quote worth surfacing.
export const MIN_QUOTE_CHARS = 30

export const hasQuoteText = (r: Pick<QuoteCandidate, 'text'>): boolean =>
  (r.text?.trim().length ?? 0) >= MIN_QUOTE_CHARS

// Cuts at a word boundary near `max` characters and adds an ellipsis.
export const truncateQuote = (text: string, max = 140): string => {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${base.replace(/[\s.,;:!?]+$/, '')}…`
}

// Most upvoted review with real text; ties and zero-vote sets fall to newest.
export const pickTopQuote = <T extends QuoteCandidate>(reviews: T[]): T | null => {
  let best: T | null = null
  for (const r of reviews) {
    if (!hasQuoteText(r)) continue
    if (!best) {
      best = r
      continue
    }
    const dv = (r.upvote_count ?? 0) - (best.upvote_count ?? 0)
    if (dv > 0 || (dv === 0 && r.created_at > best.created_at)) best = r
  }
  return best
}

// Newest review with real text.
export const pickNewestQuote = <T extends QuoteCandidate>(reviews: T[]): T | null => {
  let best: T | null = null
  for (const r of reviews) {
    if (hasQuoteText(r) && (!best || r.created_at > best.created_at)) best = r
  }
  return best
}
