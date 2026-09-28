// Claim matching for review-claim — pure functions, unit-tested in
// matcher_test.ts. A caller can claim a review when either their browser's
// claim token matches the private reviewer_context row, or their verified
// auth email matches the address the anonymous reviewer left.

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Commas and parens are also excluded: an email enters a PostgREST .or()
// string, where they could otherwise smuggle extra filter terms.
export const EMAIL_RE = /^[^\s@,()]+@[^\s@,()]+\.[^\s@,()]{2,}$/

// PostgREST .or() string for "this caller has a claim path to the row":
// the browser's claim token, or their verified auth email matching the
// address the anonymous reviewer left. Both atoms are re-validated here —
// the string this builds lands in a raw .or() filter, where commas/parens
// could otherwise smuggle extra conditions.
export function claimMatcher(claimToken: string | null, email: string | null): string | null {
  const parts: string[] = []
  if (claimToken && UUID_RE.test(claimToken)) parts.push(`claim_token.eq.${claimToken}`)
  if (email && EMAIL_RE.test(email)) {
    parts.push(`email.ilike.${email.replace(/([%_\\])/g, '\\$1')}`)
  }
  return parts.length ? parts.join(',') : null
}

export function asClaimToken(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null
}

// The caller's email arrives from the verified JWT, but normalize + validate
// anyway before it can reach a filter string.
export function asCallerEmail(value: string | null | undefined): string | null {
  if (!value) return null
  const email = value.toLowerCase().trim()
  return EMAIL_RE.test(email) ? email : null
}
