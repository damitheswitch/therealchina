// Supabase Edge Function: review-claim
// Lets a signed-in user claim reviews they wrote anonymously. Anonymous
// submissions carry a browser-generated claim token stored on the private
// reviewer_context row; the stored reviewer email is a second matcher so
// reviews written on another device still surface once the same address
// signs up. Everything reads and writes through the service role — the
// context table is never client-readable.
//
// Actions:
//   list     → { claimToken? } → reviews the caller may claim
//   resolve  → { reviewId, decision, claimToken? }
//              'named'     reviews.user_id = caller — public author + seal
//              'anonymous' reviewer_context.owner_id = caller — in their
//                          account, still renders Anonymous publicly
//              'not_mine'  token cleared + dismissed — never offered again
//   mine     → review ids the caller owns anonymously (for "My reviews")
//
// A review is claimable while reviews.user_id IS NULL and its context row has
// no owner_id and claim_dismissed = false. The matcher predicate is
// re-applied inside every write, so a raced or replayed request can never
// claim a review the caller has no link to.

import {
  supabaseAdmin,
  getCaller,
  checkRateLimit,
  corsHeaders,
  jsonResponse,
} from '../_shared/guard.ts'
import { UUID_RE, asCallerEmail, asClaimToken, claimMatcher } from './matcher.ts'

const CLAIM_LIMIT_PER_HOUR = 30

const RATE_LIMIT_MESSAGE =
  'That was a lot of requests in a short time. Give it a little while and try again.'

async function handleClaim(req: Request): Promise<Response> {
  const caller = await getCaller(req)
  // Claims are an authenticated-only surface: anonymous callers have nothing
  // to attach reviews to.
  if (!caller || caller.role !== 'authenticated' || !caller.sub) {
    return jsonResponse(req, { error: 'Sign in to claim your reviews' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse(req, { error: 'Invalid JSON body' }, 400)
  }

  const action = body.action
  if (action !== 'list' && action !== 'resolve' && action !== 'mine') {
    return jsonResponse(req, { error: 'action must be "list", "resolve" or "mine"' }, 400)
  }

  const allowed = await checkRateLimit(`review-claim:${caller.sub}`, CLAIM_LIMIT_PER_HOUR)
  if (!allowed) {
    return jsonResponse(req, { error: RATE_LIMIT_MESSAGE }, 429)
  }

  // ---- mine -------------------------------------------------------------------
  if (action === 'mine') {
    const { data, error } = await supabaseAdmin
      .from('reviewer_context')
      .select('review_id, reviews!inner(deleted_at)')
      .eq('owner_id', caller.sub)
      .is('reviews.deleted_at', null)
    if (error) {
      console.error('Claimed review lookup error:', error)
      return jsonResponse(req, { error: 'Something went wrong. Please try again.' }, 500)
    }
    return jsonResponse(
      req,
      { reviewIds: (data ?? []).map((r) => r.review_id as string) },
      200
    )
  }

  // ---- shared matcher ------------------------------------------------------------
  const claimToken = asClaimToken(body.claimToken)
  const callerEmail = asCallerEmail(caller.email)
  const matcher = claimMatcher(claimToken, callerEmail)
  if (!matcher) {
    // No token and no usable email → nothing can match.
    if (action === 'list') return jsonResponse(req, { reviews: [] }, 200)
    return jsonResponse(req, { error: 'Nothing to match this review to' }, 400)
  }

  // ---- list -------------------------------------------------------------------
  if (action === 'list') {
    const { data, error } = await supabaseAdmin
      .from('reviewer_context')
      .select(
        'claim_token, reviews!inner(id, rating, text, program, created_at, user_id, deleted_at, universities(name, slug))'
      )
      .or(matcher)
      .is('owner_id', null)
      .eq('claim_dismissed', false)
      .is('reviews.user_id', null)
      .is('reviews.deleted_at', null)
    if (error) {
      console.error('Claimable review lookup error:', error)
      return jsonResponse(req, { error: 'Something went wrong. Please try again.' }, 500)
    }

    const reviews = (data ?? [])
      .map((row) => {
        const r = row.reviews as unknown as {
          id: string
          rating: number
          text: string
          program: string | null
          created_at: string | null
          universities: { name: string; slug: string } | null
        }
        if (!r?.id) return null
        return {
          reviewId: r.id,
          rating: r.rating,
          text: r.text,
          program: r.program,
          createdAt: r.created_at,
          universityName: r.universities?.name ?? null,
          universitySlug: r.universities?.slug ?? null,
          matchedBy: claimToken && row.claim_token === claimToken ? 'device' : 'email',
        }
      })
      .filter(Boolean)

    return jsonResponse(req, { reviews }, 200)
  }

  // ---- resolve ------------------------------------------------------------------
  const reviewId = body.reviewId
  const decision = body.decision
  if (typeof reviewId !== 'string' || !UUID_RE.test(reviewId)) {
    return jsonResponse(req, { error: 'Invalid review id' }, 400)
  }
  if (decision !== 'named' && decision !== 'anonymous' && decision !== 'not_mine') {
    return jsonResponse(req, { error: 'decision must be "named", "anonymous" or "not_mine"' }, 400)
  }

  // The context row must exist, match this caller's token or verified email,
  // and the review must still be unclaimed (no public or anonymous owner).
  const { data: ctx, error: ctxFetchError } = await supabaseAdmin
    .from('reviewer_context')
    .select('review_id, owner_id, claim_dismissed, reviews!inner(user_id, deleted_at)')
    .eq('review_id', reviewId)
    .or(matcher)
    .maybeSingle()
  if (ctxFetchError) {
    console.error('Claim context fetch error:', ctxFetchError)
    return jsonResponse(req, { error: 'Something went wrong. Please try again.' }, 500)
  }
  const claimReview = ctx?.reviews as unknown as {
    user_id: string | null
    deleted_at: string | null
  } | null
  if (
    !ctx ||
    ctx.owner_id !== null ||
    ctx.claim_dismissed ||
    !claimReview ||
    claimReview.user_id !== null ||
    claimReview.deleted_at !== null
  ) {
    return jsonResponse(req, { error: 'Review not found or already claimed' }, 404)
  }

  if (decision === 'not_mine') {
    const { error } = await supabaseAdmin
      .from('reviewer_context')
      .update({ claim_token: null, claim_dismissed: true })
      .eq('review_id', reviewId)
      .or(matcher)
    if (error) {
      console.error('Claim dismiss error:', error)
      return jsonResponse(req, { error: 'Something went wrong. Please try again.' }, 500)
    }
    return jsonResponse(req, { resolved: true }, 200)
  }

  if (decision === 'anonymous') {
    // owner_id IS NULL inside the write: a raced double-click or replay can
    // never hand the review to a second owner.
    const { data, error } = await supabaseAdmin
      .from('reviewer_context')
      .update({
        owner_id: caller.sub,
        claim_token: null,
        claimed_at: new Date().toISOString(),
      })
      .eq('review_id', reviewId)
      .or(matcher)
      .is('owner_id', null)
      .select('review_id')
    if (error) {
      console.error('Anonymous claim error:', error)
      return jsonResponse(req, { error: 'Something went wrong. Please try again.' }, 500)
    }
    if (!data || data.length === 0) {
      return jsonResponse(req, { error: 'Review not found or already claimed' }, 404)
    }
    return jsonResponse(req, { resolved: true }, 200)
  }

  // 'named': the review itself takes user_id — it becomes a normal public
  // review (author shown, Verified seal, university stats flip via trigger).
  // user_id IS NULL inside the write so a concurrent claim can never
  // overwrite someone else's attribution.
  const { data: namedRows, error: namedError } = await supabaseAdmin
    .from('reviews')
    .update({ user_id: caller.sub })
    .eq('id', reviewId)
    .is('user_id', null)
    .is('deleted_at', null)
    .select('id')
  if (namedError) {
    console.error('Named claim error:', namedError)
    return jsonResponse(req, { error: 'Something went wrong. Please try again.' }, 500)
  }
  if (!namedRows || namedRows.length === 0) {
    return jsonResponse(req, { error: 'Review not found or already claimed' }, 404)
  }

  // Housekeeping on the context row — the review is already theirs, so this
  // is best-effort: clear the token and stamp the claim.
  const { error: ctxError } = await supabaseAdmin
    .from('reviewer_context')
    .update({ claim_token: null, claimed_at: new Date().toISOString() })
    .eq('review_id', reviewId)
  if (ctxError) {
    console.error('Claim context update error:', ctxError)
  }

  return jsonResponse(req, { resolved: true }, 200)
}

// ---- Main ------------------------------------------------------------------------

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || undefined

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed' }, 405)
  }

  try {
    return await handleClaim(req)
  } catch (err) {
    console.error('Unhandled error:', err)
    return jsonResponse(req, { error: 'Internal server error' }, 500)
  }
})
