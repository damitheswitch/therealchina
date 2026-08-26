import { supabase } from './supabaseClient'

export const MAX_FILES = 5
export const MAX_IMAGE_SIZE_MB = 10
export const MAX_VIDEO_SIZE_MB = 50

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
  'video/quicktime', // .mov
  'video/x-matroska', // .mkv
]

/**
 * Validates a file before uploading
 * @param {File} file
 * @returns {{ valid: boolean, error: string | null, type: 'image' | 'video' }}
 */
export const validateMediaFile = (file) => {
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type) || file.type.startsWith('image/')
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type) || file.type.startsWith('video/')

  if (!isImage && !isVideo) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.name}. Only images (JPG, PNG, WEBP, GIF) and videos (MP4, WEBM, MOV) are allowed.`,
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

/**
 * Uploads a single media file to Supabase Storage ('review-media' bucket)
 * @param {File} file
 * @returns {Promise<{ url: string, type: 'image' | 'video', name: string }>}
 */
export const uploadSingleMedia = async (file) => {
  const validation = validateMediaFile(file)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  const fileExt = file.name.split('.').pop() || (validation.type === 'video' ? 'mp4' : 'jpg')
  const cleanName = file.name
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .substring(0, 30)
  const filePath = `reviews/${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${cleanName}.${fileExt}`

  const { data, error } = await supabase.storage
    .from('review-media')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    console.error('Storage upload error:', error)
    throw new Error(`Failed to upload ${file.name}: ${error.message}`)
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from('review-media')
    .getPublicUrl(data.path)

  return {
    url: publicUrlData.publicUrl,
    type: validation.type,
    name: file.name,
  }
}

/**
 * Uploads multiple media files sequentially and tracks progress
 * @param {File[]} files
 * @param {(current: number, total: number) => void} [onProgress]
 * @returns {Promise<Array<{ url: string, type: 'image' | 'video', name: string }>>}
 */
export const uploadMultipleMedia = async (files, onProgress) => {
  if (!files || files.length === 0) return []

  if (files.length > MAX_FILES) {
    throw new Error(`You can upload a maximum of ${MAX_FILES} photos/videos per review.`)
  }

  // Validate all files first
  for (const file of files) {
    const v = validateMediaFile(file)
    if (!v.valid) throw new Error(v.error)
  }

  const uploadedMedia = []
  for (let i = 0; i < files.length; i++) {
    if (onProgress) onProgress(i + 1, files.length)
    const result = await uploadSingleMedia(files[i])
    uploadedMedia.push(result)
  }

  return uploadedMedia
}
