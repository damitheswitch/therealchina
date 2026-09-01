import { supabase } from './supabaseClient'

export const MAX_FILES = 5
export const MAX_IMAGE_SIZE_MB = 10
export const MAX_VIDEO_SIZE_MB = 50

export const RATE_LIMIT_MESSAGE =
  "You've reached our upload guard for now. Please wait a little before sharing more photos or videos. We want to keep TRC authentic and spam-free."

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']

/**
 * Client-side pre-check for fast UX. The server performs the real validation.
 * @param {File} file
 * @returns {{ valid: boolean, error: string | null, type: 'image' | 'video' }}
 */
export const validateMediaFile = (file) => {
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type) || file.type.startsWith('image/')
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type) || file.type.startsWith('video/')

  if (!isImage && !isVideo) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.name}. Only images (JPG, PNG, WEBP, GIF, HEIC) and videos (MP4, WEBM, MOV, MKV) are allowed.`,
      type: null,
    }
  }

  const mediaType = isVideo ? 'video' : 'image'
  const maxBytes = (isVideo ? MAX_VIDEO_SIZE_MB : MAX_IMAGE_SIZE_MB) * 1024 * 1024

  if (file.size > maxBytes) {
    const limit = isVideo ? `${MAX_VIDEO_SIZE_MB}MB` : `${MAX_IMAGE_SIZE_MB}MB`
    return {
      valid: false,
      error: `File "${file.name}" exceeds the maximum ${mediaType} size limit of ${limit}.`,
      type: mediaType,
    }
  }

  return { valid: true, error: null, type: mediaType }
}

export async function parseFunctionError(error) {
  if (error?.context && typeof error.context.json === 'function') {
    try {
      const body = await error.context.json()
      return body?.error || error.message
    } catch {
      // ignore
    }
  }
  if (error?.message) return error.message
  return 'Upload failed'
}

/**
 * Creates a server-side upload session.
 * For anonymous users this requires a Cloudflare Turnstile token.
 * @param {{ cfToken?: string }} options
 * @returns {Promise<{ sessionId: string, expiresAt: string }>}
 */
export const createUploadSession = async ({ cfToken }) => {
  const { data, error } = await supabase.functions.invoke('media-upload', {
    body: { action: 'createSession', cfToken },
  })
  if (error) {
    const msg = await parseFunctionError(error)
    throw new Error(msg)
  }
  return data
}

/**
 * Uploads a single file through the media-upload Edge Function.
 * @param {{ file: File, sessionId: string }} options
 * @returns {Promise<{ url: string, type: 'image' | 'video', name: string }>}
 */
export const uploadFile = async ({ file, sessionId }) => {
  const formData = new FormData()
  formData.append('sessionId', sessionId)
  formData.append('file', file)

  const { data, error } = await supabase.functions.invoke('media-upload', {
    body: formData,
  })
  if (error) {
    const msg = await parseFunctionError(error)
    throw new Error(msg)
  }
  return data
}
