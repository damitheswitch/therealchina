import { supabase } from './supabaseClient'
import { parseFunctionError } from './mediaUpload'

// ---- Anonymous review claiming -------------------------------------------------
// A review left while logged out carries a browser-generated claim token,
// stored on the private reviewer_context row by review-submit. The token lives
// in localStorage on this device — after the reviewer signs up or logs in, the
// review-claim Edge Function matches it (or their verified account email
// against the address they left on the review) and offers the review back.

const CLAIM_TOKEN_KEY = 'trc_review_claim_token'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const randomToken = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for non-secure contexts — still 122 bits of Math.random entropy
  // shaped like a UUID; the server only cares that the format parses.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// The stored token, or null. Never mints one — used by the post-login check,
// which must not mark browsers that never left a review.
export const getStoredClaimToken = (): string | null => {
  try {
    const token = localStorage.getItem(CLAIM_TOKEN_KEY)
    return token && UUID_RE.test(token) ? token : null
  } catch {
    return null
  }
}

// Mint-or-reuse the browser's claim token. Called at anonymous submit time so
// only actual reviewers carry one.
export const getOrCreateClaimToken = (): string | null => {
  const existing = getStoredClaimToken()
  if (existing) return existing
  try {
    const token = randomToken()
    localStorage.setItem(CLAIM_TOKEN_KEY, token)
    return token
  } catch {
    return null
  }
}

export interface ClaimableReview {
  reviewId: string
  rating: number
  text: string
  program: string | null
  createdAt: string | null
  universityName: string | null
  universitySlug: string | null
  matchedBy: 'device' | 'email'
}

export type ClaimDecision = 'named' | 'anonymous' | 'not_mine'

const parseClaimError = async (error: unknown): Promise<string> => {
  const msg = await parseFunctionError(error)
  return msg === 'Upload failed' ? 'Something went wrong. Please try again.' : msg
}

// Reviews this account can still claim — matched by the browser token, or by
// the verified account email against the address left on the review.
export const listClaimableReviews = async (): Promise<ClaimableReview[]> => {
  const { data, error } = await supabase.functions.invoke('review-claim', {
    body: { action: 'list', claimToken: getStoredClaimToken() },
  })
  if (error) throw new Error(await parseClaimError(error))
  return (data as { reviews?: ClaimableReview[] } | null)?.reviews ?? []
}

export const resolveClaim = async (reviewId: string, decision: ClaimDecision): Promise<void> => {
  const { error } = await supabase.functions.invoke('review-claim', {
    body: { action: 'resolve', reviewId, decision, claimToken: getStoredClaimToken() },
  })
  if (error) throw new Error(await parseClaimError(error))
}

// Ids of the reviews the signed-in user owns anonymously — the public row
// keeps user_id NULL, so this private link is the only thing connecting them.
export const listAnonymousOwnedIds = async (): Promise<string[]> => {
  const { data, error } = await supabase.functions.invoke('review-claim', {
    body: { action: 'mine' },
  })
  if (error) throw new Error(await parseClaimError(error))
  return (data as { reviewIds?: string[] } | null)?.reviewIds ?? []
}

// Merge the public "my reviews" set with anonymously-owned ones: dedupe by id
// (a review can't be both, but the query paths are independent) and keep the
// newest-first order the list renders in.
export const mergeMyReviews = <T extends { id: string; created_at: string | null }>(
  own: T[],
  claimed: T[]
): T[] => {
  const seen = new Set(own.map((r) => r.id))
  return [...own, ...claimed.filter((r) => !seen.has(r.id))].sort((a, b) =>
    (b.created_at ?? '').localeCompare(a.created_at ?? '')
  )
}
