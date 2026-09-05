// Supabase Edge Function: review-submit
// All review submissions (anonymous and authenticated) go through this function.
// Anonymous callers must solve a Cloudflare Turnstile challenge; every caller is
// rate-limited. Universities referenced as "not listed" are created here, with
// server-side slug handling, instead of via direct client inserts. The function
// writes with the service role key, so no anonymous INSERT policies exist.

import { createClient } from 'supabase'

// ---- Config --------------------------------------------------------------------

const ANON_REVIEW_LIMIT_PER_HOUR = 10
const AUTH_REVIEW_LIMIT_PER_HOUR = 30
const MAX_MEDIA_ITEMS = 5

const LIMITS = {
  text: { min: 10, max: 5000 },
  program: { max: 120 },
  degreeLevel: { max: 60 },
  uniName: { max: 160 },
  uniCity: { max: 120 },
  pros: { max: 1000 },
  cons: { max: 1000 },
  tags: { max: 20 },
  tagLen: { max: 40 },
}

const VALID_ENROLLMENT = ['current', 'alumni', 'exchange', 'applicant'] as const
const VALID_FUNDING = ['self', 'csc', 'school', 'province'] as const
const VALID_COVERAGE = ['partial', 'full'] as const
const VALID_RECOMMEND = ['yes', 'no', 'maybe'] as const
const VALID_SUBSCORES = [
  'rating_academics', 'rating_campus', 'rating_accommodation', 'rating_cost',
  'rating_intl_office', 'rating_social', 'rating_extracurricular', 'rating_career',
] as const

const RATE_LIMIT_MESSAGE =
  "You've submitted quite a few reviews in a short time. Please wait a little before sharing more — we want to keep TRC authentic and spam-free."

function getSecretKey(): string | null {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy

  const rawKeys = Deno.env.get('SUPABASE_SECRET_KEYS') || Deno.env.get('SUPABASE_SECRET_KEY')
  if (!rawKeys) return null
  try {
    const parsed = JSON.parse(rawKeys) as Record<string, string>
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed['default'] || Object.values(parsed).find((k) => typeof k === 'string') || null
    }
  } catch {
    return rawKeys
  }
  return null
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = getSecretKey()
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and a service role / secret key must be set')
}

// Admin client uses the service role key and bypasses RLS: THIS function is the
// authorization boundary, so every check below matters.
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

// Media URLs must point at our own bucket; nothing else is accepted.
const MEDIA_URL_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/review-media/`

// ---- CORS ----------------------------------------------------------------------
// CORS_ORIGIN supports:
//   - "*"                              (allow any origin)
//   - "https://example.com"            (single exact origin)
//   - "https://a.com,https://b.com"    (comma-separated list)
//   - "https://deploy-preview-*--app.netlify.app"  (wildcard * matches any chars)
const CORS_ORIGIN_RAW = (Deno.env.get('CORS_ORIGIN') || '*').trim()

const CORS_PATTERNS: string[] =
  CORS_ORIGIN_RAW === '*'
    ? ['*']
    : CORS_ORIGIN_RAW.split(',')
        .map((o) => o.trim().replace(/\/$/, ''))
        .filter(Boolean)

function originMatches(requestOrigin: string, pattern: string): boolean {
  if (pattern === '*') return true
  if (!pattern.includes('*')) return requestOrigin === pattern
  // Convert glob pattern to regex: escape regex special chars, then turn * into .*
  const regex = new RegExp(
    '^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, (ch) => (ch === '*' ? '.*' : '\\' + ch)) + '$'
  )
  return regex.test(requestOrigin)
}

const corsHeaders = (origin?: string) => {
  const requestOrigin = (origin || '').replace(/\/$/, '')
  const allowOrigin = CORS_PATTERNS.some((p) => originMatches(requestOrigin, p))
    ? origin || (CORS_PATTERNS.length === 1 ? CORS_PATTERNS[0] : '*')
    : CORS_PATTERNS.length === 1
      ? CORS_PATTERNS[0]
      : ''
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

function jsonResponse(req: Request, body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req.headers.get('origin') || undefined),
      'Content-Type': 'application/json',
    },
  })
}

// ---- Auth ----------------------------------------------------------------------

// Publishable/legacy anon API keys are checked by value: they are API keys,
// not user credentials.
function isPublicApiKey(token: string): boolean {
  const raw = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      const values = typeof parsed === 'object' && parsed !== null ? Object.values(parsed) : [raw]
      if (values.includes(token)) return true
    } catch {
      if (raw === token) return true
    }
  }
  const legacyAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  return !!legacyAnonKey && token === legacyAnonKey
}

// Never trust base64-decoded JWT claims: verify the signature and expiry
// server-side before granting any authenticated privilege. Fail closed.
async function verifyUserToken(token: string): Promise<{ id: string } | null> {
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !data.user) return null
    return { id: data.user.id }
  } catch (err) {
    console.error('Token verification error:', err)
    return null
  }
}

type Caller = { role: 'anon' | 'authenticated'; sub?: string }

async function getCaller(req: Request): Promise<Caller | null> {
  const authToken = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const apikey = req.headers.get('apikey') || ''

  if (authToken) {
    if (isPublicApiKey(authToken)) return { role: 'anon' }
    const user = await verifyUserToken(authToken)
    return user ? { role: 'authenticated', sub: user.id } : null
  }

  if (apikey && isPublicApiKey(apikey)) return { role: 'anon' }
  return null
}

function getClientIP(req: Request): string {
  const privateRegex =
    /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)|^(fc00:|fe80:|::1|0\.0\.0\.0)/
  // Every proxy APPENDS to X-Forwarded-For, so the rightmost entry is the one
  // the platform itself added. Entries to the left are client-controlled and
  // must not be trusted for rate limiting.
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const ips = forwarded
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    for (let i = ips.length - 1; i >= 0; i--) {
      if (!privateRegex.test(ips[i])) return ips[i]
    }
  }
  return 'unknown'
}

// ---- Turnstile -----------------------------------------------------------------

const TURNSTILE_ACTION = 'review-submit'

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY not configured')
    return false
  }

  const form = new URLSearchParams()
  form.append('secret', secret)
  form.append('response', token)
  form.append('remoteip', ip)

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  })
  const data = (await res.json()) as {
    success: boolean
    action?: string
    hostname?: string
    'error-codes'?: string[]
  }
  if (!data.success) {
    console.error('Turnstile verification failed:', data['error-codes'])
    return false
  }
  // Validate the action to prevent token reuse across surfaces.
  if (data.action !== TURNSTILE_ACTION) {
    console.error('Turnstile action mismatch:', data.action, 'expected', TURNSTILE_ACTION)
    return false
  }
  // Optional hostname allowlist. When TURNSTILE_HOSTNAMES is unset, skip so
  // local dev keeps working. In production, set it to the exact frontend
  // hostnames (comma-separated, no scheme, no trailing slash) and never
  // include localhost / 127.0.0.1.
  const hostnamesRaw = Deno.env.get('TURNSTILE_HOSTNAMES')
  if (hostnamesRaw) {
    const allowed = new Set(
      hostnamesRaw
        .split(',')
        .map((h) => h.trim().replace(/\/$/, ''))
        .filter(Boolean)
    )
    if (!data.hostname || !allowed.has(data.hostname)) {
      console.error('Turnstile hostname not allowed:', data.hostname)
      return false
    }
  }
  return true
}

// ---- Rate limiting (shared table with media-upload) ----------------------------

async function checkRateLimit(key: string, limit: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('record_upload_attempt', { p_key: key })
  if (error) {
    console.error('Rate limit RPC error:', error)
    // If the rate-limit table is unavailable, fail open so the app keeps working.
    return true
  }
  return (data as number) <= limit
}

// ---- Input validation ----------------------------------------------------------

function asTrimmedString(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Error('invalid field type')
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (trimmed.length > maxLength) throw new Error('field too long')
  return trimmed || null
}

type MediaItem = { url: string; type: 'image' | 'video'; name?: string; mime?: string }

function validateMedia(value: unknown): MediaItem[] {
  if (value === null || value === undefined) return []
  if (!Array.isArray(value)) throw new Error('media must be an array')
  if (value.length > MAX_MEDIA_ITEMS) throw new Error(`at most ${MAX_MEDIA_ITEMS} media items`)

  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('invalid media item')
    const { url, type, name, mime } = item as Record<string, unknown>
    if (typeof url !== 'string' || !url.startsWith(MEDIA_URL_PREFIX)) {
      throw new Error('media url is not a TRC upload')
    }
    if (type !== 'image' && type !== 'video') throw new Error('invalid media type')
    return {
      url,
      type,
      name: typeof name === 'string' ? name.slice(0, 200) : undefined,
      mime: typeof mime === 'string' ? mime.slice(0, 100) : undefined,
    }
  })
}

// ---- University resolution ------------------------------------------------------

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'university'
}

async function resolveUniversityId(body: {
  universitySlug?: string
  universityName?: string
  newUniversity?: { name: string; city: string }
}): Promise<{ id: string; slug: string; created: boolean }> {
  if (body.universitySlug) {
    const { data, error } = await supabaseAdmin
      .from('universities')
      .select('id, slug')
      .eq('slug', body.universitySlug)
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
        .eq('slug', slug)
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
    const ok = await verifyTurnstile(cfToken, ip)
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
  let rating: number, text: string, program: string | null, degreeLevel: string | null
  let media: MediaItem[]
  let subscores: Record<string, number> = {}
  let enrollmentStatus: string | null, startYear: number | null, endYear: number | null
  let languageOfInstruction: string | null, tuitionRange: string | null, livingCostRange: string | null
  let fundingType: string | null, fundingCoverage: string | null, recommend: string | null
  let pros: string | null, cons: string | null, tags: string[]
  try {
    if (typeof body.rating !== 'number' || body.rating < 1 || body.rating > 5 || !Number.isInteger(body.rating)) {
      throw new Error('Rating must be a whole number between 1 and 5')
    }
    rating = body.rating

    const trimmedText = asTrimmedString(body.text, LIMITS.text.max)
    if (!trimmedText || trimmedText.length < LIMITS.text.min) {
      throw new Error(`Review text must be at least ${LIMITS.text.min} characters`)
    }
    text = trimmedText

    program = asTrimmedString(body.program, LIMITS.program.max)
    degreeLevel = asTrimmedString(body.degreeLevel, LIMITS.degreeLevel.max)
    media = validateMedia(body.media)

    // Sub-scores (optional, 1-5)
    if (body.subscores !== null && body.subscores !== undefined) {
      if (typeof body.subscores !== 'object' || Array.isArray(body.subscores)) {
        throw new Error('subscores must be an object')
      }
      for (const key of VALID_SUBSCORES) {
        const val = (body.subscores as Record<string, unknown>)[key]
        if (val === null || val === undefined) continue
        if (typeof val !== 'number' || !Number.isInteger(val) || val < 1 || val > 5) {
          throw new Error(`${key} must be a whole number between 1 and 5`)
        }
        subscores[key] = val
      }
    }

    enrollmentStatus = asTrimmedString(body.enrollmentStatus, 20)
    if (enrollmentStatus && !VALID_ENROLLMENT.includes(enrollmentStatus as typeof VALID_ENROLLMENT[number])) {
      throw new Error('Invalid enrollment status')
    }

    if (body.startYear !== null && body.startYear !== undefined) {
      if (typeof body.startYear !== 'number' || !Number.isInteger(body.startYear) || body.startYear < 1990 || body.startYear > new Date().getFullYear() + 1) {
        throw new Error('Invalid start year')
      }
      startYear = body.startYear
    } else {
      startYear = null
    }

    if (body.endYear !== null && body.endYear !== undefined) {
      if (typeof body.endYear !== 'number' || !Number.isInteger(body.endYear) || body.endYear < 1990 || body.endYear > new Date().getFullYear() + 1) {
        throw new Error('Invalid end year')
      }
      endYear = body.endYear
    } else {
      endYear = null
    }

    if (startYear !== null && endYear !== null && endYear < startYear) {
      throw new Error('End year cannot be before start year')
    }

    languageOfInstruction = asTrimmedString(body.languageOfInstruction, 60)
    tuitionRange = asTrimmedString(body.tuitionRange, 40)
    livingCostRange = asTrimmedString(body.livingCostRange, 40)

    fundingType = asTrimmedString(body.fundingType, 20)
    if (fundingType && !VALID_FUNDING.includes(fundingType as typeof VALID_FUNDING[number])) {
      throw new Error('Invalid funding type')
    }
    fundingCoverage = asTrimmedString(body.fundingCoverage, 20)
    if (fundingCoverage && !VALID_COVERAGE.includes(fundingCoverage as typeof VALID_COVERAGE[number])) {
      throw new Error('Invalid funding coverage')
    }
    // Coverage only valid when funding is not self-funded
    if (fundingCoverage && fundingType === 'self') {
      fundingCoverage = null
    }

    recommend = asTrimmedString(body.recommend, 10)
    if (recommend && !VALID_RECOMMEND.includes(recommend as typeof VALID_RECOMMEND[number])) {
      throw new Error('Invalid recommend value')
    }

    pros = asTrimmedString(body.pros, LIMITS.pros.max)
    cons = asTrimmedString(body.cons, LIMITS.cons.max)

    // Tags: array of short strings
    tags = []
    if (body.tags !== null && body.tags !== undefined) {
      if (!Array.isArray(body.tags)) throw new Error('tags must be an array')
      if (body.tags.length > LIMITS.tags.max) throw new Error(`at most ${LIMITS.tags.max} tags`)
      for (const t of body.tags) {
        const trimmed = asTrimmedString(t, LIMITS.tagLen.max)
        if (trimmed) tags.push(trimmed)
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
      rating,
      text,
      program,
      degree_level: degreeLevel,
      media,
      rating_academics: subscores.rating_academics ?? null,
      rating_campus: subscores.rating_campus ?? null,
      rating_accommodation: subscores.rating_accommodation ?? null,
      rating_cost: subscores.rating_cost ?? null,
      rating_intl_office: subscores.rating_intl_office ?? null,
      rating_social: subscores.rating_social ?? null,
      rating_extracurricular: subscores.rating_extracurricular ?? null,
      rating_career: subscores.rating_career ?? null,
      enrollment_status: enrollmentStatus,
      start_year: startYear,
      end_year: endYear,
      language_of_instruction: languageOfInstruction,
      tuition_range: tuitionRange,
      living_cost_range: livingCostRange,
      funding_type: fundingType,
      funding_coverage: fundingCoverage,
      recommend,
      pros,
      cons,
      tags,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('Review insert error:', insertError)
    return jsonResponse(req, { error: 'Failed to save the review. Please try again.' }, 500)
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

// ---- Main ----------------------------------------------------------------------

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
