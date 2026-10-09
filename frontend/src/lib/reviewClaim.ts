import { supabase } from './supabaseClient'
import { parseFunctionError } from './mediaUpload'

// ---- Anonymous review claiming -------------------------------------------------
// A review left while logged out carries a browser-generated claim token,
// stored on the private reviewer_context row by review-submit. The token lives
// in localStorage on this device — after the reviewer signs up or logs in, the
// review-claim Edge Function matches it (or their verified account email
// against the address they left on the review) and offers the review back.

const CLAIM_TOKEN_KEY = 'trc_review_claim_token'
const BOOST_TOKENS_KEY = 'trc_boost_tokens'
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

// ---- Per-review Boost capability (Phase 3) --------------------------------------
// Unlike the shared legacy claim token, this is a fresh capability per review,
// minted only from the CSPRNG — no Math.random fallback. The server stores its
// SHA-256 digest, so a stolen database row cannot replay it. Without Web Crypto
// the review still submits; it just cannot be Boosted anonymously.

export const BOOST_TOKEN_RE = /^[A-Za-z0-9_-]{40,64}$/

const base64Url = (bytes: Uint8Array): string => {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const createBoostToken = (): string | null => {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    return null
  }
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64Url(bytes)
}

const readBoostTokens = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(BOOST_TOKENS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [reviewId, token] of Object.entries(parsed)) {
      if (UUID_RE.test(reviewId) && typeof token === 'string' && BOOST_TOKEN_RE.test(token)) {
        out[reviewId] = token
      }
    }
    return out
  } catch {
    return {}
  }
}

const writeBoostTokens = (tokens: Record<string, string>): void => {
  try {
    localStorage.setItem(BOOST_TOKENS_KEY, JSON.stringify(tokens))
  } catch {
    // Storage full/blocked — the review still published; Boost just won't work
    // after a reload.
  }
}

export const storeBoostToken = (reviewId: string, token: string): void => {
  if (!UUID_RE.test(reviewId) || !BOOST_TOKEN_RE.test(token)) return
  writeBoostTokens({ ...readBoostTokens(), [reviewId]: token })
}

export const getBoostToken = (reviewId: string): string | null => {
  return readBoostTokens()[reviewId] ?? null
}

// Everything this browser could prove, for claim-list matching.
export const listBoostTokens = (): string[] => Object.values(readBoostTokens())

export const dropBoostToken = (reviewId: string): void => {
  const tokens = readBoostTokens()
  if (!(reviewId in tokens)) return
  delete tokens[reviewId]
  writeBoostTokens(tokens)
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
    body: {
      action: 'list',
      claimToken: getStoredClaimToken(),
      boostTokens: listBoostTokens(),
    },
  })
  if (error) throw new Error(await parseClaimError(error))
  return (data as { reviews?: ClaimableReview[] } | null)?.reviews ?? []
}

export const resolveClaim = async (reviewId: string, decision: ClaimDecision): Promise<void> => {
  const { error } = await supabase.functions.invoke('review-claim', {
    body: {
      action: 'resolve',
      reviewId,
      decision,
      claimToken: getStoredClaimToken(),
      boostToken: getBoostToken(reviewId),
    },
  })
  if (error) throw new Error(await parseClaimError(error))
  dropBoostToken(reviewId)
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
