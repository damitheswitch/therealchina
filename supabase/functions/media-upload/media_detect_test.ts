import { assertEquals } from 'jsr:@std/assert'
import { detectMediaType } from './media_detect.ts'

function bytes(parts: Array<number[] | string>): ArrayBuffer {
  const flat: number[] = []
  for (const part of parts) {
    if (typeof part === 'string') {
      for (const ch of part) flat.push(ch.charCodeAt(0))
    } else {
      flat.push(...part)
    }
  }
  // Pad to at least 32 bytes: detection requires a minimum header length.
  while (flat.length < 32) flat.push(0)
  return new Uint8Array(flat).buffer
}

Deno.test('detects JPEG', () => {
  const detected = detectMediaType(bytes([[0xff, 0xd8, 0xff, 0xe0]]))
  assertEquals(detected, { mime: 'image/jpeg', category: 'image', ext: 'jpg' })
})

Deno.test('detects PNG', () => {
  const detected = detectMediaType(bytes([[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]]))
  assertEquals(detected, { mime: 'image/png', category: 'image', ext: 'png' })
})

Deno.test('detects GIF87a and GIF89a', () => {
  assertEquals(detectMediaType(bytes(['GIF87a']))?.mime, 'image/gif')
  assertEquals(detectMediaType(bytes(['GIF89a']))?.mime, 'image/gif')
})

Deno.test('detects WebP', () => {
  const detected = detectMediaType(bytes(['RIFF', [0, 0, 0, 0], 'WEBP']))
  assertEquals(detected, { mime: 'image/webp', category: 'image', ext: 'webp' })
})

Deno.test('detects HEIC by ftyp brand', () => {
  const detected = detectMediaType(bytes([[0, 0, 0, 0x18], 'ftyp', 'heic']))
  assertEquals(detected, { mime: 'image/heic', category: 'image', ext: 'heic' })
})

Deno.test('detects MP4 for generic ftyp brands', () => {
  assertEquals(detectMediaType(bytes([[0, 0, 0, 0x18], 'ftyp', 'isom']))?.mime, 'video/mp4')
  assertEquals(detectMediaType(bytes([[0, 0, 0, 0x18], 'ftyp', 'M4V ']))?.mime, 'video/mp4')
})

Deno.test('detects QuickTime by qt brand and by moov atom', () => {
  assertEquals(detectMediaType(bytes([[0, 0, 0, 0x18], 'ftyp', 'qt  ']))?.mime, 'video/quicktime')
  assertEquals(detectMediaType(bytes([[0, 0, 0, 0x14], 'moov']))?.mime, 'video/quicktime')
})

Deno.test('detects WebM and Matroska via EBML DocType element', () => {
  const webm = bytes([[0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x42, 0x86, 0x85], 'webm'])
  assertEquals(detectMediaType(webm)?.mime, 'video/webm')
  const mkv = bytes([[0x1a, 0x45, 0xdf, 0xa3, 0x97, 0x42, 0x86, 0x88], 'matroska'])
  assertEquals(detectMediaType(mkv)?.mime, 'video/x-matroska')
})

Deno.test('rejects executables and scripts', () => {
  // PE executable ("MZ") renamed to .jpg
  assertEquals(detectMediaType(bytes(['MZ', [0x90, 0, 3, 0]])), null)
  // ELF binary
  assertEquals(detectMediaType(bytes([[0x7f], 'ELF'])), null)
  // Shell script
  assertEquals(detectMediaType(bytes(['#!/bin/sh -e'])), null)
  // SVG (scriptable XML, deliberately excluded)
  assertEquals(detectMediaType(bytes(['<svg xmlns="h'])), null)
})

Deno.test('rejects buffers too short to identify', () => {
  assertEquals(detectMediaType(new Uint8Array([0xff, 0xd8, 0xff]).buffer), null)
})

Deno.test('rejects unknown formats', () => {
  const detected = detectMediaType(bytes(['this is just plain text, not media at all']))
  assertEquals(detected, null)
})
