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
import { anonRateKey } from '../_shared/rateKey.ts'
import { withRandomSuffix } from '../_shared/slug.ts'
import { maybeDispatchReward, requestReward, type RewardResult } from '../_shared/rewardDispatch.ts'
import { REWARD_CODE_RE } from '../_shared/reward.ts'
import {
  UNI_SLUG_MAX,
  parseNewUniversity,
  planNewUniversity,
  type NewUniversity,
} from './newUniversity.ts'
import {
  LIMITS,
  MEDIA_EXPIRED_MESSAGE,
  VALID_CURRENT_STATUS,
  asTrimmedString,
  mediaObjectNames,
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

const NEW_UNI_INSERT_ATTEMPTS = 3

type ResolvedUniversity = { id: string; slug: string; created: boolean }

// A weak slug (no Latin characters, or only generic words) says nothing about
// which university this is, so match on the name instead. The RPC matches
// case-insensitively on name/name_zh and holds a per-name lock across lookup
// and insert, so concurrent submissions of the same name share one row.
async function findOrCreateUniversityByName(
  name: string,
  city: string,
  province: string | null,
  base: string
): Promise<ResolvedUniversity> {
  for (let attempt = 0; attempt < NEW_UNI_INSERT_ATTEMPTS; attempt++) {
    const { data, error } = await supabaseAdmin
      .rpc('find_or_create_university_by_name', {
        p_name: name,
        p_city: city,
        p_slug: withRandomSuffix(base, UNI_SLUG_MAX, 'university'),
        p_province: province,
      })
      .single<ResolvedUniversity>()
    if (!error && data) return data
    // Random-suffix collision: try another suffix.
    if (error?.code !== '23505') throw error
  }
  throw new Error('Could not create the university. Please try again.')
}

async function findUniversityBySlug(slug: string): Promise<{ id: string; slug: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('universities')
    .select('id, slug')
    .or(`slug.eq.${slug},slug_aliases.cs.{${slug}}`)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

async function resolveUniversityId(body: {
  universitySlug?: string
  universityName?: string
  newUniversity?: NewUniversity
}): Promise<ResolvedUniversity> {
  if (body.universitySlug) {
    const s = body.universitySlug.trim().toLowerCase()
    // Format check keeps the PostgREST filter string injection-safe. The
    // client mirrors this in frontend/src/lib/reviewFlow.ts (UNI_SLUG_RE /
    // normalizeUniSlugParam) — keep the two in sync.
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
    const { name, city, province } = body.newUniversity
    const { kind, base } = planNewUniversity(name)
    if (kind === 'by-name') {
      return await findOrCreateUniversityByName(name, city, province, base)
    }

    // Reuse an existing row by canonical slug or alias instead of creating a
    // duplicate.
    const found = await findUniversityBySlug(base)
    if (found) return { ...found, created: false }

    for (let attempt = 0; attempt < NEW_UNI_INSERT_ATTEMPTS; attempt++) {
      const slug = attempt === 0 ? base : withRandomSuffix(base, UNI_SLUG_MAX, 'university')
      const { data, error } = await supabaseAdmin
        .from('universities')
        .insert({ name, city, province, slug })
        .select('id, slug')
        .single()

      if (!error && data) return { ...data, created: true }
      if (error?.code !== '23505') throw error

      // Slug race: someone just created this university, so reuse their row.
      if (attempt === 0) {
        const existing = await findUniversityBySlug(base)
        if (existing) return { ...existing, created: false }
      }
      // Random-suffix collision: try another suffix.
    }
    throw new Error('Could not create the university. Please try again.')
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
  // Signed-in reviewers may publish under "Anonymous" too: the public row
  // keeps user_id NULL and the ownership link lands on the private
  // reviewer_context row — the same shape an anonymous claim produces, so
  // review-claim/review-manage/comment-notify treat it identically.
  const postAnonymously = !isAnon && body.postAnonymously === true

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
  // trusted request IP for anonymous ones. An unknown IP shares one bucket
  // instead of skipping the limiter.
  const rateKey = isAnon ? anonRateKey('review-ip:', ip) : `review-user:${caller.sub}`
  const rateLimit = isAnon ? ANON_REVIEW_LIMIT_PER_HOUR : AUTH_REVIEW_LIMIT_PER_HOUR
  const allowed = await checkRateLimit(rateKey, rateLimit)
  if (!allowed) {
    return jsonResponse(req, { error: RATE_LIMIT_MESSAGE }, 429)
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

  // Media must still exist. An anonymous draft kept in localStorage can hold
  // uploads that media-cleanup has since removed; publishing those would show
  // broken images. Fails closed if the lookup errors.
  if (fields.media.length) {
    const { data: missing, error: missingError } = await supabaseAdmin.rpc('missing_review_media', {
      p_names: mediaObjectNames(fields.media, MEDIA_URL_PREFIX),
    })
    if (missingError) {
      console.error('Media existence check failed:', missingError)
      return jsonResponse(req, { error: 'Could not check your photos. Please try again.' }, 500)
    }
    if ((missing as { name: string }[] | null)?.length) {
      return jsonResponse(req, { error: MEDIA_EXPIRED_MESSAGE }, 400)
    }
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
    // Throws (→ 400 below) on a present but invalid payload.
    const newUniversity = parseNewUniversity(body.newUniversity)

    university = await resolveUniversityId({
      universitySlug: asTrimmedString(body.universitySlug, 200) || undefined,
      universityName: asTrimmedString(body.universityName, LIMITS.uniName.max) || undefined,
      newUniversity,
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
      user_id: isAnon || postAnonymously ? null : caller.sub,
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
  let boostAvailable = false
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
      } else {
        // Only report the capability usable when the digest actually landed —
        // the client hides the Boost offer otherwise instead of promising a
        // save that can only 403.
        boostAvailable = boostHash !== null
      }
    }
  }

  // Signed-in anonymous publish: the public review row stays user_id NULL,
  // and this private owner link is what lets the author see it under My
  // Reviews, edit/delete/reveal it via review-manage, and receive comment
  // notifications. Best-effort like the anonymous context insert above — the
  // review itself is already saved.
  if (postAnonymously && caller.sub) {
    const { error: ownerError } = await supabaseAdmin.from('reviewer_context').insert({
      review_id: review.id,
      owner_id: caller.sub,
      claimed_at: new Date().toISOString(),
    })
    if (ownerError) {
      console.error('Anonymous owner context insert error:', ownerError)
    }
  }

  // Referral: the review came through a share link (?ref=<gift code>). Only a
  // code that belongs to an existing gift is kept, so the owner can count
  // referrals per reviewer without junk rows. Best effort, never fails the review.
  const refCode = typeof body.ref === 'string' ? body.ref.trim().toUpperCase() : ''
  if (REWARD_CODE_RE.test(refCode)) {
    const { data: referrer } = await supabaseAdmin
      .from('review_rewards')
      .select('review_id, user_id')
      .eq('reward_code', refCode)
      .maybeSingle()
    const selfReferral = Boolean(!isAnon && referrer?.user_id && referrer.user_id === caller.sub)
    if (referrer && referrer.review_id !== review.id && !selfReferral) {
      const { error: refError } = await supabaseAdmin.from('review_referrals').insert({
        review_id: review.id,
        ref_code: refCode,
        referrer_review_id: referrer.review_id,
      })
      if (refError) console.error('Referral insert error:', refError)
    }
  }

  // Thank-you gift: only when the reviewer asked for it. A guest must have
  // typed an email (stored above on the private reviewer_context row); a member's
  // email is read from their account at send time. Best effort: never fails
  // the review.
  let reward: RewardResult = { state: 'off' }
  if (body.rewardRequested === true && (!isAnon || reviewerContext?.email)) {
    const code = await requestReward(
      review.id,
      isAnon ? 'anonymous' : 'signed_in',
      isAnon ? null : (caller.sub ?? null)
    )
    if (code) reward = await maybeDispatchReward(review.id)
  }

  return jsonResponse(
    req,
    {
      reviewId: review.id,
      universitySlug: university.slug,
      universityCreated: university.created,
      boostAvailable,
      reward,
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
