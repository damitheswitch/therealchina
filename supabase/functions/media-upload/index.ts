// Supabase Edge Function: media-upload
// All media uploads (anonymous and authenticated) go through this function.
// It performs server-side magic-byte validation, enforces rate limits, verifies
// Cloudflare Turnstile for anonymous users, and uploads to Storage with the
// service role key so the bucket can remain public-read-only.

// Auth, CORS, rate limiting and the service-role client live in ../_shared/
// and are shared with the review functions — one copy, no drift.
import {
  supabaseAdmin,
  getCaller,
  getClientIP,
  checkRateLimit,
  corsHeaders,
  jsonResponse,
} from '../_shared/guard.ts'
import { detectMediaType } from './media_detect.ts'

// ---- Config --------------------------------------------------------------------

const MAX_SESSION_FILES = 20
const MAX_IMAGE_SIZE_MB = 10
const MAX_VIDEO_SIZE_MB = 50
const SESSION_TTL_MINUTES = 15
const ANON_UPLOAD_LIMIT_PER_HOUR = 5
const AUTH_UPLOAD_LIMIT_PER_HOUR = 20

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
]

const IMAGE_MAX_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024
const VIDEO_MAX_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024

const RATE_LIMIT_MESSAGE =
  "You've reached our upload guard for now. Please wait a little before sharing more photos or videos. We want to keep TRC authentic and spam-free."

// ---- Turnstile -----------------------------------------------------------------

const TURNSTILE_ACTION = 'media-upload'

async function verifyTurnstile(token: string, ip: string, expectedAction: string) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret) throw new Error('TURNSTILE_SECRET_KEY not configured')

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
    throw new Error('Turnstile verification failed')
  }
  // Validate the action to prevent token reuse across surfaces.
  if (data.action !== expectedAction) {
    console.error(
      'Turnstile action mismatch:',
      data.action,
      'expected',
      expectedAction
    )
    throw new Error('Turnstile verification failed')
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
      throw new Error('Turnstile verification failed')
    }
  }
}

// Magic-byte file type detection lives in ./media_detect.ts (pure, unit-tested
// by media_detect_test.ts). Imported above.

// ---- Storage helpers -----------------------------------------------------------

function safeObjectName(originalName: string, ext: string): string {
  const timestamp = Date.now()
  const random = crypto.randomUUID()
  const base = originalName
    .split('.')
    .slice(0, -1)
    .join('.')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .slice(0, 30) || 'media'
  return `reviews/${random}/${timestamp}-${base}.${ext}`
}

// ---- Handlers ------------------------------------------------------------------

async function handleCreateSession(req: Request): Promise<Response> {
  const ip = getClientIP(req)
  const jwt = await getCaller(req)

  if (!jwt) {
    return jsonResponse(req, { error: 'Authorization header missing or invalid' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse(req, { error: 'Invalid JSON body' }, 400)
  }

  const isAnon = jwt.role === 'anon'
  const userId = jwt.sub

  if (isAnon) {
    const cfToken = body.cfToken
    if (!cfToken || typeof cfToken !== 'string') {
      return jsonResponse(req, { error: 'Turnstile token required for anonymous uploads' }, 400)
    }
    // Turnstile failure is a client problem, not an internal error: return a
    // status the frontend can act on instead of a generic 500.
    try {
      await verifyTurnstile(cfToken, ip, TURNSTILE_ACTION)
    } catch {
      return jsonResponse(req, { error: 'Verification failed. Please try again.' }, 403)
    }
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('upload_sessions')
    .insert({
      ip,
      is_anon: isAnon,
      user_id: userId || null,
      files_used: 0,
      max_files: MAX_SESSION_FILES,
      expires_at: expiresAt,
    })
    .select('id, expires_at')
    .single()

  if (error) {
    console.error('Create session error:', error)
    return jsonResponse(req, { error: 'Failed to create upload session' }, 500)
  }

  return jsonResponse(req, { sessionId: data.id, expiresAt: data.expires_at }, 200)
}

async function handleUpload(req: Request): Promise<Response> {
  const jwt = await getCaller(req)

  if (!jwt) {
    return jsonResponse(req, { error: 'Authorization header missing or invalid' }, 401)
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch (err) {
    console.error('Parse multipart error:', err)
    return jsonResponse(req, { error: 'Invalid multipart body' }, 400)
  }

  const sessionId = form.get('sessionId')
  const file = form.get('file')

  if (!sessionId || typeof sessionId !== 'string') {
    return jsonResponse(req, { error: 'Session ID required' }, 400)
  }

  if (!file || !(file instanceof File)) {
    return jsonResponse(req, { error: 'File required' }, 400)
  }

  // Validate the file BEFORE touching any counters: rejected uploads must not
  // consume rate-limit budget or session file slots.
  if (file.size === 0) {
    return jsonResponse(req, { error: 'File is empty' }, 400)
  }

  // Detect type from the first 8 KB.
  const headerBuffer = await file.slice(0, 8192).arrayBuffer()
  const detected = detectMediaType(headerBuffer)
  if (!detected) {
    return jsonResponse(
      req,
      { error: 'Unsupported or unrecognised file type. Please upload a valid image or video.' },
      400
    )
  }

  if (!ALLOWED_IMAGE_TYPES.includes(detected.mime) && !ALLOWED_VIDEO_TYPES.includes(detected.mime)) {
    return jsonResponse(req, { error: `File type ${detected.mime} is not allowed` }, 400)
  }

  const maxSize = detected.category === 'image' ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES
  if (file.size > maxSize) {
    return jsonResponse(
      req,
      {
        error: `${detected.category === 'image' ? 'Image' : 'Video'} exceeds ${
          detected.category === 'image' ? MAX_IMAGE_SIZE_MB : MAX_VIDEO_SIZE_MB
        } MB`,
      },
      413
    )
  }

  // Rate limit by verified identity: user id for authenticated callers,
  // trusted request IP for anonymous ones.
  const ip = getClientIP(req)
  const isAnon = jwt.role === 'anon'
  const rateKey = isAnon ? `ip:${ip}` : `user:${jwt.sub}`
  const rateLimit = isAnon ? ANON_UPLOAD_LIMIT_PER_HOUR : AUTH_UPLOAD_LIMIT_PER_HOUR
  if (!isAnon || ip !== 'unknown') {
    const allowed = await checkRateLimit(rateKey, rateLimit)
    if (!allowed) {
      return jsonResponse(req, { error: RATE_LIMIT_MESSAGE }, 429)
    }
  }

  // Consume a session slot atomically, only after the request has passed
  // every check that could reject it for reasons the caller can fix.
  const { data: sessionRows, error: sessionError } = await supabaseAdmin.rpc(
    'use_upload_session',
    { p_session_id: sessionId }
  )
  if (sessionError || !sessionRows || (Array.isArray(sessionRows) && sessionRows.length === 0)) {
    console.error('Session use error:', sessionError)
    return jsonResponse(req, { error: 'Invalid or expired upload session' }, 401)
  }

  const session = Array.isArray(sessionRows) ? sessionRows[0] : sessionRows
  if (!session) {
    return jsonResponse(req, { error: 'Invalid or expired upload session' }, 401)
  }

  // Authenticated sessions are tied to the user that created them.
  if (!session.is_anon && session.user_id !== jwt.sub) {
    return jsonResponse(req, { error: 'Session does not belong to the current user' }, 403)
  }

  // Verify the whole file still matches the header (defence in depth).
  const fullBuffer = await file.arrayBuffer()
  const fullDetected = detectMediaType(fullBuffer)
  if (!fullDetected || fullDetected.mime !== detected.mime) {
    return jsonResponse(req, { error: 'File type mismatch or unsupported content' }, 400)
  }

  // Upload to Storage using the service role key.
  const objectName = safeObjectName(file.name, detected.ext)

  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from('review-media')
    .upload(objectName, new Uint8Array(fullBuffer), {
      contentType: detected.mime,
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    console.error('Storage upload error:', uploadError)
    return jsonResponse(req, { error: 'Failed to store media. Please try again.' }, 500)
  }

  const { data: urlData } = supabaseAdmin.storage.from('review-media').getPublicUrl(uploadData.path)

  return jsonResponse(
    req,
    {
      url: urlData.publicUrl,
      type: detected.category,
      name: file.name,
      mime: detected.mime,
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

  const contentType = req.headers.get('content-type') || ''

  try {
    if (contentType.includes('application/json')) {
      return await handleCreateSession(req)
    }
    return await handleUpload(req)
  } catch (err) {
    console.error('Unhandled error:', err)
    return jsonResponse(req, { error: 'Internal server error' }, 500)
  }
})
