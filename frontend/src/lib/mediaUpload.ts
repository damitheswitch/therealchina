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

export type MediaType = 'image' | 'video'

export interface MediaValidationResult {
  valid: boolean
  error: string | null
  type: MediaType | null
}

export interface UploadSession {
  sessionId: string
  expiresAt: string
}

export interface UploadedFile {
  url: string
  type: MediaType
  name: string
}

export const validateMediaFile = (file: File): MediaValidationResult => {
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type) || file.type.startsWith('image/')
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type) || file.type.startsWith('video/')

  if (!isImage && !isVideo) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.name}. Only images (JPG, PNG, WEBP, GIF, HEIC) and videos (MP4, WEBM, MOV, MKV) are allowed.`,
      type: null,
    }
  }

  const mediaType: MediaType = isVideo ? 'video' : 'image'
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

export async function parseFunctionError(error: unknown): Promise<string> {
  if (typeof error === 'object' && error !== null) {
    const err = error as {
      context?: { json?: () => Promise<unknown> }
      message?: string
    }
    if (err.context && typeof err.context.json === 'function') {
      try {
        const body = (await err.context.json()) as { error?: string } | undefined
        return body?.error || err.message || 'Upload failed'
      } catch {
        // ignore
      }
    }
    if (typeof err.message === 'string') return err.message
  }
  if (typeof error === 'string') return error
  return 'Upload failed'
}

export const createUploadSession = async ({
  cfToken,
}: { cfToken?: string } = {}): Promise<UploadSession> => {
  const { data, error } = await supabase.functions.invoke('media-upload', {
    body: { action: 'createSession', cfToken },
  })
  if (error) {
    const msg = await parseFunctionError(error)
    throw new Error(msg)
  }
  return data as UploadSession
}

export const uploadFile = async ({
  file,
  sessionId,
}: {
  file: File
  sessionId: string
}): Promise<UploadedFile> => {
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
  return data as UploadedFile
}
