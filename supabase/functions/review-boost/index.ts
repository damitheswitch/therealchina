// Supabase Edge Function: review-boost
// Post-publish "Boost" for anonymous reviewers. The caller presents the
// per-review capability minted in their browser at submit time; only the
// SHA-256 digest exists on the private reviewer_context row. Authorization,
// the 24-hour window, the 30-save budget, and the actual update all happen
// inside public.apply_anonymous_boost — one transaction with row locks, so a
// claim can never interleave with a Boost save.
//
// This function is intentionally thin: it validates the request shape and
// field values (the same rules review-submit/review-manage use), hashes the
// token, and maps the RPC result to HTTP. It never decides authorization
// outside the transaction.
//
// Signed-in users can hit this too while they still hold the token, but
// review-manage remains the full edit path — this function only writes the
// Boost allowlist.

import {
  supabaseAdmin,
  getCaller,
  corsHeaders,
  jsonResponse,
} from '../_shared/guard.ts'
import { validateBoostPatch } from '../_shared/reviewFields.ts'
import { asBoostToken, hashBoostToken } from '../_shared/boostToken.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Every outcome the RPC can return, mapped once. Messages are user-facing —
// keep them plain and free of internals.
const RESULTS: Record<string, { status: number; body: Record<string, unknown> }> = {
  ok: { status: 200, body: { saved: true } },
  empty: { status: 400, body: { error: 'Nothing to save.' } },
  bad_fields: { status: 400, body: { error: 'One of those fields cannot be saved here.' } },
  bad_token: {
    status: 403,
    body: { error: "This review can't be edited from this device." },
  },
  locked: {
    status: 429,
    body: {
      error: 'Too many attempts. Give it a few minutes and try again.',
    },
  },
  over_limit: {
    status: 429,
    body: { error: 'That review has had enough changes for now. You can edit more after signing up.' },
  },
  claimed: {
    status: 409,
    body: { error: 'This review belongs to an account now. Sign in to keep editing.' },
  },
  expired: {
    status: 410,
    body: {
      error: 'The quick-edit window for this review has closed. Sign up to edit it anytime.',
    },
  },
  not_found: { status: 404, body: { error: 'Review not found.' } },
}

async function handleBoost(req: Request): Promise<Response> {
  const caller = await getCaller(req)
  // Any valid project key or user JWT reaches here — the capability itself is
  // the authorization, checked inside the transaction. No caller at all means
  // nothing to verify against.
  if (!caller) {
    return jsonResponse(req, { error: 'Authorization header missing or invalid' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse(req, { error: 'Invalid JSON body' }, 400)
  }

  const reviewId = body.reviewId
  if (typeof reviewId !== 'string' || !UUID_RE.test(reviewId)) {
    return jsonResponse(req, { error: 'Invalid review id' }, 400)
  }

  const boostToken = asBoostToken(body.boostToken)
  if (!boostToken) {
    return jsonResponse(req, { error: "This review can't be edited from this device." }, 403)
  }

  if (typeof body.fields !== 'object' || body.fields === null || Array.isArray(body.fields)) {
    return jsonResponse(req, { error: 'fields must be an object' }, 400)
  }

  let patch: Record<string, unknown>
  try {
    patch = validateBoostPatch(body.fields as Record<string, unknown>)
  } catch (err) {
    return jsonResponse(
      req,
      { error: err instanceof Error ? err.message : 'Invalid fields' },
      400
    )
  }

  const boostHash = await hashBoostToken(boostToken)
  const { data, error } = await supabaseAdmin.rpc('apply_anonymous_boost', {
    p_review_id: reviewId,
    p_boost_hash: boostHash,
    p_patch: patch,
  })

  // Fail closed: a broken limiter or update must look like rejection, never a
  // silent pass.
  if (error || typeof data !== 'string' || !(data in RESULTS)) {
    console.error('Boost RPC error:', error ?? `unexpected result ${data}`)
    return jsonResponse(req, { error: 'Could not save that. Please try again.' }, 500)
  }

  const result = RESULTS[data]
  return jsonResponse(req, result.body, result.status)
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
    return await handleBoost(req)
  } catch (err) {
    console.error('Unhandled error:', err)
    return jsonResponse(req, { error: 'Internal server error' }, 500)
  }
})
