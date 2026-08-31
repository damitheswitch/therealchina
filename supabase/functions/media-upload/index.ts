// Supabase Edge Function: media-upload
// All media uploads (anonymous and authenticated) go through this function.
// It performs server-side magic-byte validation, enforces rate limits, verifies
// Cloudflare Turnstile for anonymous users, and uploads to Storage with the
// service role key so the bucket can remain public-read-only.

import { createClient } from 'supabase'

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

// Admin client uses the service role key and bypasses Storage RLS.
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

// ---- CORS ----------------------------------------------------------------------

const CORS_ORIGIN = (Deno.env.get('CORS_ORIGIN') || '*').replace(/\/$/, '')

const corsHeaders = (origin?: string) => {
  const requestOrigin = (origin || '').replace(/\/$/, '')
  const allowOrigin =
    CORS_ORIGIN === '*' || requestOrigin === CORS_ORIGIN
      ? origin || CORS_ORIGIN
      : CORS_ORIGIN
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

// ---- Auth helpers --------------------------------------------------------------

function decodeJwt(token: string) {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const payload = parts[1]
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
  try {
    return JSON.parse(atob(padded)) as { role: 'anon' | 'authenticated'; sub?: string }
  } catch {
    return null
  }
}

function getPublishableKeys(): string[] {
  const raw = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Record<string, string>
    if (typeof parsed === 'object' && parsed !== null) {
      return Object.values(parsed).filter((k) => typeof k === 'string')
    }
    return [raw]
  } catch {
    return [raw]
  }
}

// Accept user JWTs on Authorization and publishable/legacy API keys on apikey.
// The new Supabase publishable/secret keys (sb_publishable_... / sb_secret_...)
// are not JWTs and must be compared to the known publishable keys.
function getAuthToken(req: Request): { role: 'anon' | 'authenticated'; sub?: string } | null {
  const authHeader = req.headers.get('authorization') || ''
  const apikey = req.headers.get('apikey') || ''
  const authToken = authHeader.replace(/^Bearer\s+/i, '')

  const publishableKeys = getPublishableKeys()
  const legacyAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

  const token = authToken || apikey
  if (!token) return null

  if (publishableKeys.includes(token)) return { role: 'anon' }
  if (legacyAnonKey && token === legacyAnonKey) return { role: 'anon' }

  return decodeJwt(token)
}

function getClientIP(req: Request): string {
  const privateRegex =
    /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)|^(fc00:|fe80:|::1|0\.0\.0\.0)/
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    for (const ip of forwarded.split(',').map((s) => s.trim())) {
      if (!privateRegex.test(ip) && ip) return ip
    }
  }
  const cf = req.headers.get('cf-connecting-ip')
  if (cf && !privateRegex.test(cf)) return cf
  const real = req.headers.get('x-real-ip')
  if (real && !privateRegex.test(real)) return real
  return 'unknown'
}

// ---- Turnstile -----------------------------------------------------------------

async function verifyTurnstile(token: string, ip: string) {
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
  const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] }
  if (!data.success) {
    console.error('Turnstile verification failed:', data['error-codes'])
    throw new Error('Turnstile verification failed')
  }
}

// ---- Magic-byte file type detection -------------------------------------------

type DetectedType = {
  mime: string
  category: 'image' | 'video'
  ext: string
} | null

function readString(bytes: Uint8Array, start: number, length: number): string {
  let s = ''
  for (let i = 0; i < length; i++) {
    if (start + i >= bytes.length) break
    const c = bytes[start + i]
    if (c === 0) break
    s += String.fromCharCode(c)
  }
  return s
}

function detectFtypBrand(bytes: Uint8Array): string {
  if (bytes.length < 16) return ''
  return readString(bytes, 8, 4).toLowerCase().trim()
}

function detectEbmlDocType(bytes: Uint8Array): 'webm' | 'matroska' | 'unknown' {
  const head = readString(bytes, 0, Math.min(bytes.length, 200)).toLowerCase()
  if (head.includes('webm')) return 'webm'
  if (head.includes('matroska')) return 'matroska'

  // Fallback: look for the DocType element ID 0x42 0x86 and nearby string.
  for (let i = 0; i < bytes.length - 10; i++) {
    if (bytes[i] === 0x42 && bytes[i + 1] === 0x86) {
      for (let o = 2; o < 8 && i + o + 12 < bytes.length; o++) {
        const s = readString(bytes, i + o, 12).toLowerCase()
        if (s.includes('webm')) return 'webm'
        if (s.includes('matroska')) return 'matroska'
      }
    }
  }
  return 'unknown'
}

function detectMediaType(buffer: ArrayBuffer): DetectedType {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 16) return null

  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', category: 'image', ext: 'jpg' }
  }

  // PNG
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mime: 'image/png', category: 'image', ext: 'png' }
  }

  // GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    const version = bytes[4]
    if (version === 0x37 || version === 0x39) {
      return { mime: 'image/gif', category: 'image', ext: 'gif' }
    }
  }

  // WebP (RIFF...WEBP)
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes.length > 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: 'image/webp', category: 'image', ext: 'webp' }
  }

  // HEIC / HEIF / AVIF and MP4/MOV all start with an ftyp box.
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = detectFtypBrand(bytes)

    const imageBrands = ['heic', 'heif', 'mif1', 'heix', 'hevc', 'heim', 'heis', 'avci', 'avif']
    if (imageBrands.includes(brand)) {
      if (brand === 'avif') {
        return { mime: 'image/avif', category: 'image', ext: 'avif' }
      }
      if (brand === 'heif' || brand === 'mif1' || brand === 'heim' || brand === 'heis') {
        return { mime: 'image/heif', category: 'image', ext: 'heif' }
      }
      return { mime: 'image/heic', category: 'image', ext: 'heic' }
    }

    const quicktimeBrands = ['qt', 'moov', 'mqt']
    if (quicktimeBrands.includes(brand)) {
      return { mime: 'video/quicktime', category: 'video', ext: 'mov' }
    }

    // Other ftyp -> MP4
    return { mime: 'video/mp4', category: 'video', ext: 'mp4' }
  }

  // QuickTime / old MOV (moov/mdat at offset 4)
  const atomAt4 = readString(bytes, 4, 4).toLowerCase()
  if (['moov', 'mdat', 'free', 'wide', 'skip'].includes(atomAt4)) {
    return { mime: 'video/quicktime', category: 'video', ext: 'mov' }
  }

  // WebM / Matroska (EBML)
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    const docType = detectEbmlDocType(bytes)
    if (docType === 'matroska') {
      return { mime: 'video/x-matroska', category: 'video', ext: 'mkv' }
    }
    return { mime: 'video/webm', category: 'video', ext: 'webm' }
  }

  return null
}

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

async function checkRateLimit(key: string, limit: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('record_upload_attempt', { p_key: key })
  if (error) {
    console.error('Rate limit RPC error:', error)
    // If the rate-limit table is unavailable, fail open so the app keeps working.
    return true
  }
  return (data as number) <= limit
}

// ---- Handlers ------------------------------------------------------------------

async function handleCreateSession(req: Request): Promise<Response> {
  const ip = getClientIP(req)
  const jwt = getAuthToken(req)

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
    await verifyTurnstile(cfToken, ip)
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
  const jwt = getAuthToken(req)

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

  // Use and increment the session counter atomically.
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

  // Authenticated sessions are tied to the user.
  if (!session.is_anon && session.user_id !== jwt.sub) {
    return jsonResponse(req, { error: 'Session does not belong to the current user' }, 403)
  }

  // Rate limit by request IP for anonymous, by user for authenticated.
  const ip = getClientIP(req)
  const rateKey = session.is_anon ? `ip:${ip}` : `user:${session.user_id || jwt.sub}`
  const rateLimit = session.is_anon ? ANON_UPLOAD_LIMIT_PER_HOUR : AUTH_UPLOAD_LIMIT_PER_HOUR
  const shouldRateLimit = !session.is_anon || ip !== 'unknown'
  if (shouldRateLimit) {
    const allowed = await checkRateLimit(rateKey, rateLimit)
    if (!allowed) {
      return jsonResponse(req, { error: RATE_LIMIT_MESSAGE }, 429)
    }
  }

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
