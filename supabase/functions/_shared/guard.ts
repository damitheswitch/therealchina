// Shared plumbing for the review Edge Functions: service-role client, caller
// authentication, CORS, trusted-IP extraction, and rate limiting. Anything in
// here must stay identical in behavior across functions that import it.

import { createClient } from 'supabase'

export function getSecretKey(): string | null {
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

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
export const SUPABASE_SERVICE_ROLE_KEY = getSecretKey()
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and a service role / secret key must be set')
}

// Admin client uses the service role key and bypasses RLS: the importing
// function is the authorization boundary, so every caller check matters.
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

// Media URLs must point at our own bucket; nothing else is accepted.
export const MEDIA_URL_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/review-media/`

// ---- CORS ----------------------------------------------------------------------
// CORS_ORIGIN supports:
//   - "*"                              (allow any origin)
//   - "https://example.com"            (single exact origin)
//   - "https://a.com,https://b.com"    (comma-separated list)
//   - "https://deploy-preview-*--app.netlify.app"  (wildcard * matches any chars)
const CORS_ORIGIN_RAW = (Deno.env.get('CORS_ORIGIN') || '*').trim()

export const CORS_PATTERNS: string[] =
  CORS_ORIGIN_RAW === '*'
    ? ['*']
    : CORS_ORIGIN_RAW.split(',')
        .map((o) => o.trim().replace(/\/$/, ''))
        .filter(Boolean)

export function originMatches(requestOrigin: string, pattern: string): boolean {
  if (pattern === '*') return true
  if (!pattern.includes('*')) return requestOrigin === pattern
  // Convert glob pattern to regex: escape regex special chars, then turn * into .*
  const regex = new RegExp(
    '^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, (ch) => (ch === '*' ? '.*' : '\\' + ch)) + '$'
  )
  return regex.test(requestOrigin)
}

export const corsHeaders = (origin?: string) => {
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

export function jsonResponse(req: Request, body: unknown, status: number) {
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
export function isPublicApiKey(token: string): boolean {
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
  if (legacyAnonKey && token === legacyAnonKey) return true
  return isLegacyAnonJwt(token)
}

// A well-formed project anon JWT is also a valid public API key: runtimes on
// key-migrated projects inject only the publishable key, so a stale-but-valid
// legacy JWT (old bundles, cached env) would otherwise 401. Decode-only is
// safe because API keys are public client credentials — possession is auth —
// and the 'anon' role grants nothing beyond public access. User JWTs
// (role 'authenticated') still go through signature verification in
// verifyUserToken; this never shortcuts them.
function isLegacyAnonJwt(token: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 3) return false
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.iss !== 'supabase' || payload.role !== 'anon') return false
    const ref = (SUPABASE_URL || '').match(/^https?:\/\/([^.]+)\./)?.[1]
    if (!ref || payload.ref !== ref) return false
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

// Never trust base64-decoded JWT claims: verify the signature and expiry
// server-side before granting any authenticated privilege. Fail closed.
// The returned email is the verified auth.users address — safe to match
// against, unlike anything client-supplied.
export async function verifyUserToken(
  token: string
): Promise<{ id: string; email: string | null } | null> {
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !data.user) return null
    return { id: data.user.id, email: data.user.email ?? null }
  } catch (err) {
    console.error('Token verification error:', err)
    return null
  }
}

export type Caller = { role: 'anon' | 'authenticated'; sub?: string; email?: string | null }

export async function getCaller(req: Request): Promise<Caller | null> {
  const authToken = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const apikey = req.headers.get('apikey') || ''

  if (authToken) {
    if (isPublicApiKey(authToken)) return { role: 'anon' }
    const user = await verifyUserToken(authToken)
    return user ? { role: 'authenticated', sub: user.id, email: user.email } : null
  }

  if (apikey && isPublicApiKey(apikey)) return { role: 'anon' }
  return null
}

export function getClientIP(req: Request): string {
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

// ---- Rate limiting (shared table with media-upload) ------------------------------

export async function checkRateLimit(key: string, limit: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('record_upload_attempt', { p_key: key })
  if (error) {
    console.error('Rate limit RPC error:', error)
    // If the rate-limit table is unavailable, fail open so the app keeps working.
    return true
  }
  return (data as number) <= limit
}
