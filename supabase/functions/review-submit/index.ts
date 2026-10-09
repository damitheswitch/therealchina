// Supabase Edge Function: review-submit
// All review submissions (anonymous and authenticated) go through this function.
// Anonymous callers must solve a Cloudflare Turnstile challenge; every caller is
// rate-limited. Universities referenced as "not listed" are created here, with
// server-side slug handling, instead of via direct client inserts. The function
// writes with the service role key, so no anonymous INSERT policies exist.
//
// Auth, CORS, rate limiting, and field validation live in ../_shared/ and are
// shared with review-manage — an edit can never sneak in values a fresh
// submission would reject.

import {
  supabaseAdmin,
  MEDIA_URL_PREFIX,
  getCaller,
  getClientIP,
  checkRateLimit,
  corsHeaders,
  jsonResponse,
} from '../_shared/guard.ts'
import { verifyTurnstile } from '../_shared/turnstile.ts'
import { asBoostToken, hashBoostToken } from '../_shared/boostToken.ts'
import {
  LIMITS,
  VALID_CURRENT_STATUS,
  asTrimmedString,
  validateReviewFields,
} from '../_shared/reviewFields.ts'

// ---- Config --------------------------------------------------------------------

const ANON_REVIEW_LIMIT_PER_HOUR = 10
const AUTH_REVIEW_LIMIT_PER_HOUR = 30

const RATE_LIMIT_MESSAGE =
  "You've submitted quite a few reviews in a short time. Please wait a little before sharing more — we want to keep TRC authentic and spam-free."

// ---- Turnstile -----------------------------------------------------------------
// verifyTurnstile lives in ../_shared/turnstile.ts (fail-closed, action-bound).

const TURNSTILE_ACTION = 'review-submit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ---- University resolution ------------------------------------------------------

function slugify(name: string): string {
  // Mirrors frontend/src/lib/seo/slugify.ts — keep in sync (slug has a DB
  // CHECK: ^[a-z0-9]+(-[a-z0-9]+)*$, max 120 chars).
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '')
  return slug || 'university'
}

async function resolveUniversityId(body: {
  universitySlug?: string
  universityName?: string
  newUniversity?: { name: string; city: string }
}): Promise<{ id: string; slug: string; created: boolean }> {
  if (body.universitySlug) {
    const s = body.universitySlug.trim().toLowerCase()
    // Format check keeps the PostgREST filter string injection-safe.
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) || s.length > 120) {
      throw new Error('invalid university slug')
    }
    const { data, error } = await supabaseAdmin
      .from('universities')
      .select('id, slug')
      .or(`slug.eq.${s},slug_aliases.cs.{${s}}`)
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('University not found')
    return { ...data, created: false }
  }

  if (body.universityName) {
    const { data, error } = await supabaseAdmin
      .from('universities')
      .select('id, slug')
      .ilike('name', body.universityName)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('University not found')
    return { ...data, created: false }
  }

  if (body.newUniversity) {
    const { name, city } = body.newUniversity
    const slug = slugify(name)
    // Reuse an existing row when the slugified name is already a canonical
    // slug or a known alias — avoids duplicate universities.
    const { data: found, error: findError } = await supabaseAdmin
      .from('universities')
      .select('id, slug')
      .or(`slug.eq.${slug},slug_aliases.cs.{${slug}}`)
      .limit(1)
      .maybeSingle()
    if (findError) throw findError
    if (found) return { ...found, created: false }

    const { data, error } = await supabaseAdmin
      .from('universities')
      .insert({ name, city, slug })
      .select('id, slug')
      .single()

    if (!error && data) return { ...data, created: true }

    // Slug race / duplicate: reuse the existing row for this slug.
    if (error?.code === '23505') {
      const { data: existing, error: lookupError } = await supabaseAdmin
        .from('universities')
        .select('id, slug')
        .or(`slug.eq.${slug},slug_aliases.cs.{${slug}}`)
        .limit(1)
        .single()
      if (lookupError || !existing) throw lookupError || new Error('University lookup failed')
      return { ...existing, created: false }
    }
    throw error
  }

  throw new Error('A university is required')
}

// ---- Handler -------------------------------------------------------------------

async function handleSubmit(req: Request): Promise<Response> {
  const caller = await getCaller(req)
  if (!caller) {
    return jsonResponse(req, { error: 'Authorization header missing or invalid' }, 401)
  }

  const ip = getClientIP(req)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse(req, { error: 'Invalid JSON body' }, 400)
  }

  const isAnon = caller.role === 'anon'

  // Anonymous submissions must prove they are human before anything else runs.
  if (isAnon) {
    const cfToken = body.cfToken
    if (!cfToken || typeof cfToken !== 'string') {
      return jsonResponse(req, { error: 'Turnstile token required for anonymous reviews' }, 400)
    }
    const ok = await verifyTurnstile(cfToken, ip, TURNSTILE_ACTION)
    if (!ok) {
      return jsonResponse(req, { error: 'Verification failed. Please try again.' }, 403)
    }
  } else {
    // Preserve the previous RLS behavior: authenticated reviewers must have
    // completed onboarding before posting.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', caller.sub)
      .maybeSingle()
    if (!profile?.onboarding_completed) {
      return jsonResponse(req, { error: 'Please complete your profile setup first.' }, 403)
    }
  }

  // Rate limit by verified identity: user id for authenticated callers,
  // trusted request IP for anonymous ones.
  const rateKey = isAnon ? `review-ip:${ip}` : `review-user:${caller.sub}`
  const rateLimit = isAnon ? ANON_REVIEW_LIMIT_PER_HOUR : AUTH_REVIEW_LIMIT_PER_HOUR
  if (!isAnon || ip !== 'unknown') {
    const allowed = await checkRateLimit(rateKey, rateLimit)
    if (!allowed) {
      return jsonResponse(req, { error: RATE_LIMIT_MESSAGE }, 429)
    }
  }

  // ---- Validate the payload ----
  let fields
  try {
    fields = validateReviewFields(body, MEDIA_URL_PREFIX)
  } catch (err) {
    return jsonResponse(
      req,
      { error: err instanceof Error ? err.message : 'Invalid submission' },
      400
    )
  }

  // Anonymous reviews carry browser-generated capabilities so the same person
  // can claim the review after signing up, and Boost it anonymously during the
  // first 24 hours. claimToken is the legacy shared UUID (older clients);
  // boostToken is the per-review crypto-random capability — only its SHA-256
  // digest is stored. Malformed tokens degrade to "not claimable/boostable";
  // they never fail the review itself.
  const claimToken =
    isAnon && typeof body.claimToken === 'string' && UUID_RE.test(body.claimToken)
      ? body.claimToken
      : null
  const boostToken = isAnon ? asBoostToken(body.boostToken) : null
  const boostHash = boostToken ? await hashBoostToken(boostToken) : null

  // Anonymous reviewer context (optional): stored in the private
  // reviewer_context table, never exposed to clients.
  let reviewerContext: {
    email: string | null
    emailConsent: boolean
    homeCountry: string | null
    currentStatus: string | null
    languagesSpoken: string[]
  } | null = null
  try {
    if (body.reviewerContext !== null && body.reviewerContext !== undefined) {
      if (typeof body.reviewerContext !== 'object' || Array.isArray(body.reviewerContext)) {
        throw new Error('reviewerContext must be an object')
      }
      const rc = body.reviewerContext as Record<string, unknown>
      const email = asTrimmedString(rc.email, 254)
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        throw new Error('Invalid email address')
      }
      const rcStatus = asTrimmedString(rc.currentStatus, 20)
      if (
        rcStatus &&
        !VALID_CURRENT_STATUS.includes(rcStatus as (typeof VALID_CURRENT_STATUS)[number])
      ) {
        throw new Error('Invalid current status')
      }
      const languagesSpoken: string[] = []
      if (rc.languagesSpoken !== null && rc.languagesSpoken !== undefined) {
        if (!Array.isArray(rc.languagesSpoken) || rc.languagesSpoken.length > 15) {
          throw new Error('Invalid languages list')
        }
        for (const l of rc.languagesSpoken) {
          const trimmed = asTrimmedString(l, 60)
          if (trimmed) languagesSpoken.push(trimmed)
        }
      }
      reviewerContext = {
        email,
        emailConsent: rc.emailConsent === true,
        homeCountry: asTrimmedString(rc.homeCountry, 80),
        currentStatus: rcStatus,
        languagesSpoken,
      }
    }
  } catch (err) {
    return jsonResponse(
      req,
      { error: err instanceof Error ? err.message : 'Invalid submission' },
      400
    )
  }

  // ---- Resolve / create the university ----
  let university: { id: string; slug: string; created: boolean }
  try {
    const newUniversity = body.newUniversity
      ? {
          name: asTrimmedString(
            (body.newUniversity as Record<string, unknown>).name,
            LIMITS.uniName.max
          ),
          city: asTrimmedString(
            (body.newUniversity as Record<string, unknown>).city,
            LIMITS.uniCity.max
          ),
        }
      : undefined

    if (newUniversity && (!newUniversity.name || !newUniversity.city)) {
      return jsonResponse(req, { error: 'University name and city are required' }, 400)
    }

    university = await resolveUniversityId({
      universitySlug: asTrimmedString(body.universitySlug, 200) || undefined,
      universityName: asTrimmedString(body.universityName, LIMITS.uniName.max) || undefined,
      newUniversity: newUniversity as { name: string; city: string } | undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not resolve university'
    const status = message === 'University not found' ? 404 : 400
    console.error('University resolution error:', err)
    return jsonResponse(req, { error: message }, status)
  }

  // ---- Insert the review ----
  const { data: review, error: insertError } = await supabaseAdmin
    .from('reviews')
    .insert({
      university_id: university.id,
      user_id: isAnon ? null : caller.sub,
      ...fields,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('Review insert error:', insertError)
    return jsonResponse(req, { error: 'Failed to save the review. Please try again.' }, 500)
  }

  // Anonymous "about you" answers land in the private reviewer_context table
  // (no client access at all). The row is also written when only a claim
  // token exists — it is the claim link, so it must exist even when the
  // reviewer skipped every optional field. Best-effort: a context failure
  // must not fail the review that was just saved.
  if (isAnon && (reviewerContext || claimToken || boostHash)) {
    const hasContext =
      reviewerContext !== null &&
      (reviewerContext.email !== null ||
        reviewerContext.emailConsent ||
        reviewerContext.homeCountry !== null ||
        reviewerContext.currentStatus !== null ||
        reviewerContext.languagesSpoken.length > 0)
    if (hasContext || claimToken || boostHash) {
      const { error: contextError } = await supabaseAdmin.from('reviewer_context').insert({
        review_id: review.id,
        email: reviewerContext?.email ?? null,
        email_consent: reviewerContext?.emailConsent ?? false,
        home_country: reviewerContext?.homeCountry ?? null,
        current_status: reviewerContext?.currentStatus ?? null,
        languages_spoken: reviewerContext?.languagesSpoken ?? [],
        claim_token: claimToken,
        boost_secret_hash: boostHash,
      })
      if (contextError) {
        console.error('Reviewer context insert error:', contextError)
      }
    }
  }

  return jsonResponse(
    req,
    {
      reviewId: review.id,
      universitySlug: university.slug,
      universityCreated: university.created,
    },
    200
  )
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
    return await handleSubmit(req)
  } catch (err) {
    console.error('Unhandled error:', err)
    return jsonResponse(req, { error: 'Internal server error' }, 500)
  }
})
