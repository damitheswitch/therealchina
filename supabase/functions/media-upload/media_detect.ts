// Pure magic-byte file type detection, shared by the media-upload Edge
// Function and covered by Deno tests (media_detect_test.ts). No I/O here.

export type DetectedType = {
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

export function detectMediaType(buffer: ArrayBuffer): DetectedType {
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
