// Supabase Edge Function: review-manage
// Lets a signed-in user update or soft-delete THEIR OWN reviews. There are no
// UPDATE/DELETE RLS policies on reviews — this function is the only write
// path besides review-submit and review-claim, and it enforces ownership
// twice: a read check against the verified user id, and a `user_id` predicate
// inside the write itself so a row can never be touched by another user,
// even via crafted direct requests.
//
// "Own" covers two shapes: public reviews (reviews.user_id = caller) and
// anonymously-claimed ones (reviews.user_id IS NULL, private
// reviewer_context.owner_id = caller). Anon-owned writes re-check
// `user_id IS NULL` in the query so a concurrent public claim can never be
// silently overwritten.
//
// Payload: { action: 'update' | 'delete', reviewId: string, ...reviewFields }
// Update accepts the same field set as review-submit (minus university and
// reviewerContext) and runs the identical shared validation.

import {
  supabaseAdmin,
  MEDIA_URL_PREFIX,
  getCaller,
  getClientIP,
  checkRateLimit,
  corsHeaders,
  jsonResponse,
} from '../_shared/guard.ts'
import { validateReviewFields, type MediaItem } from '../_shared/reviewFields.ts'

// Edits and deletes are far less abuse-prone than submissions — same hourly
// budget as authenticated submissions is more than enough.
const MANAGE_LIMIT_PER_HOUR = 30

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RATE_LIMIT_MESSAGE =
  'That was a lot of changes in a short time. Give it a little while and try again.'

// Delete storage objects only when no other live review still references the
// same URL — media validation only checks the URL prefix, so a review could
// reference a file another review legitimately uses.
async function purgeUnreferencedMedia(urls: string[], exceptReviewId: string) {
  const paths: string[] = []
  for (const url of urls) {
    if (typeof url !== 'string' || !url.startsWith(MEDIA_URL_PREFIX)) continue
    const { data: stillUsed, error } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .neq('id', exceptReviewId)
      .is('deleted_at', null)
      .filter('media', 'cs', JSON.stringify([{ url }]))
      .limit(1)
    if (error) {
      console.error('Media reference check failed:', error)
      continue // fail closed: keep the object rather than delete shared media
    }
    if (!stillUsed || stillUsed.length === 0) {
      paths.push(url.slice(MEDIA_URL_PREFIX.length))
    }
  }
  if (paths.length > 0) {
    const { error } = await supabaseAdmin.storage.from('review-media').remove(paths)
    if (error) console.error('Media purge error:', error)
  }
}

const mediaUrls = (media: unknown): string[] =>
  Array.isArray(media)
    ? (media as MediaItem[]).map((m) => m?.url).filter((u): u is string => typeof u === 'string')
    : []

async function handleManage(req: Request): Promise<Response> {
  const caller = await getCaller(req)
  // Authenticated users only — anonymous reviews have user_id NULL and can
  // never be managed, so there is no anonymous path here at all.
  if (!caller || caller.role !== 'authenticated' || !caller.sub) {
    return jsonResponse(req, { error: 'Sign in to manage your reviews' }, 401)
  }

  const ip = getClientIP(req)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse(req, { error: 'Invalid JSON body' }, 400)
  }

  const action = body.action
  const reviewId = body.reviewId
  if (action !== 'update' && action !== 'delete') {
    return jsonResponse(req, { error: 'action must be "update" or "delete"' }, 400)
  }
  if (typeof reviewId !== 'string' || !UUID_RE.test(reviewId)) {
    return jsonResponse(req, { error: 'Invalid review id' }, 400)
  }

  const allowed = await checkRateLimit(`review-manage:${caller.sub}`, MANAGE_LIMIT_PER_HOUR)
  if (!allowed) {
    return jsonResponse(req, { error: RATE_LIMIT_MESSAGE }, 429)
  }

  // ---- Ownership ---------------------------------------------------------------
  const { data: review, error: fetchError } = await supabaseAdmin
    .from('reviews')
    .select('id, user_id, media, deleted_at')
    .eq('id', reviewId)
    .maybeSingle()
  if (fetchError) {
    console.error('Review fetch error:', fetchError)
    return jsonResponse(req, { error: 'Something went wrong. Please try again.' }, 500)
  }

  // Public ownership is reviews.user_id; anonymous claims live on the private
  // reviewer_context row (owner_id). Only look there when the cheap check fails.
  let ownsAnonymously = false
  if (review && review.user_id === null) {
    const { data: ctx } = await supabaseAdmin
      .from('reviewer_context')
      .select('owner_id')
      .eq('review_id', reviewId)
      .maybeSingle()
    ownsAnonymously = ctx?.owner_id === caller.sub
  }

  // Same response for missing rows and other people's reviews — existence is
  // not leaked to non-owners.
  if (!review || (review.user_id !== caller.sub && !ownsAnonymously)) {
    return jsonResponse(req, { error: 'Review not found' }, 404)
  }

  // Ownership predicate re-applied inside every write: the caller's id when
  // publicly owned, or `user_id IS NULL` when anonymously owned — a concurrent
  // public claim turns it into someone else's row, and the predicate then
  // matches nothing instead of touching a stranger's review.
  const applyOwnership = <
    T extends { eq(c: string, v: string): T; is(c: string, v: null): T },
  >(
    q: T
  ): T => (ownsAnonymously ? q.is('user_id', null) : q.eq('user_id', caller.sub!))

  // ---- Delete (soft) -------------------------------------------------------------
  if (action === 'delete') {
    if (review.deleted_at) {
      return jsonResponse(req, { deleted: true }, 200) // idempotent
    }
    const { data: deletedRows, error } = await applyOwnership(
      supabaseAdmin
        .from('reviews')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', reviewId)
        .is('deleted_at', null)
    ).select('id')
    if (error) {
      console.error('Review delete error:', error)
      return jsonResponse(req, { error: 'Could not delete the review. Please try again.' }, 500)
    }
    if (!deletedRows || deletedRows.length === 0) {
      // Lost a race with a public claim — the row is no longer theirs to touch.
      return jsonResponse(req, { error: 'Review not found' }, 404)
    }
    await purgeUnreferencedMedia(mediaUrls(review.media), reviewId)
    return jsonResponse(req, { deleted: true }, 200)
  }

  // ---- Update --------------------------------------------------------------------
  if (review.deleted_at) {
    return jsonResponse(req, { error: 'This review was deleted' }, 409)
  }

  let fields
  try {
    fields = validateReviewFields(body, MEDIA_URL_PREFIX)
  } catch (err) {
    return jsonResponse(
      req,
      { error: err instanceof Error ? err.message : 'Invalid review' },
      400
    )
  }

  const { data: updatedRows, error: updateError } = await applyOwnership(
    supabaseAdmin
      .from('reviews')
      .update(fields)
      .eq('id', reviewId)
      .is('deleted_at', null)
  ).select('id')

  if (updateError) {
    console.error('Review update error:', updateError)
    return jsonResponse(req, { error: 'Could not save the changes. Please try again.' }, 500)
  }
  if (!updatedRows || updatedRows.length === 0) {
    return jsonResponse(req, { error: 'Review not found' }, 404)
  }

  // Purge media dropped by this edit (storage cleanup, best effort)
  const removedUrls = mediaUrls(review.media).filter(
    (u) => !fields.media.some((m) => m.url === u)
  )
  if (removedUrls.length > 0) {
    await purgeUnreferencedMedia(removedUrls, reviewId)
  }

  return jsonResponse(req, { reviewId }, 200)
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
    return await handleManage(req)
  } catch (err) {
    console.error('Unhandled error:', err)
    return jsonResponse(req, { error: 'Internal server error' }, 500)
  }
})
