import { describe, it, expect, vi } from 'vitest'

// The module imports the Supabase client, which requires env vars; mock it so
// these tests validate only the upload helper logic.
vi.mock('./supabaseClient', () => ({ supabase: { functions: { invoke: vi.fn() } } }))

import { validateMediaFile, MAX_IMAGE_SIZE_MB, MAX_VIDEO_SIZE_MB } from './mediaUpload'

const makeFile = (name, type, sizeBytes = 1024) => {
  const file = new File([new Uint8Array(Math.min(sizeBytes, 8))], name, { type })
  Object.defineProperty(file, 'size', { value: sizeBytes })
  return file
}

describe('validateMediaFile', () => {
  it('accepts a small JPEG image', () => {
    const result = validateMediaFile(makeFile('photo.jpg', 'image/jpeg'))
    expect(result).toEqual({ valid: true, error: null, type: 'image' })
  })

  it('accepts a small MP4 video', () => {
    expect(validateMediaFile(makeFile('clip.mp4', 'video/mp4')).valid).toBe(true)
  })

  it('rejects an executable disguised by extension', () => {
    const result = validateMediaFile(makeFile('virus.jpg', 'application/x-msdownload'))
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/unsupported file type/i)
  })

  it('rejects plain text files', () => {
    expect(validateMediaFile(makeFile('notes.txt', 'text/plain')).valid).toBe(false)
  })

  it(`rejects images larger than ${MAX_IMAGE_SIZE_MB}MB`, () => {
    const file = makeFile('huge.png', 'image/png', (MAX_IMAGE_SIZE_MB + 1) * 1024 * 1024)
    const result = validateMediaFile(file)
    expect(result.valid).toBe(false)
    expect(result.type).toBe('image')
    expect(result.error).toMatch(/maximum image size/i)
  })

  it(`rejects videos larger than ${MAX_VIDEO_SIZE_MB}MB`, () => {
    const file = makeFile('movie.mp4', 'video/mp4', (MAX_VIDEO_SIZE_MB + 1) * 1024 * 1024)
    const result = validateMediaFile(file)
    expect(result.valid).toBe(false)
    expect(result.type).toBe('video')
  })

  it('accepts a video at exactly the size limit', () => {
    const file = makeFile('ok.mp4', 'video/mp4', MAX_VIDEO_SIZE_MB * 1024 * 1024)
    expect(validateMediaFile(file).valid).toBe(true)
  })
})
