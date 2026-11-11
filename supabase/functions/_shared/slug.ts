// URL slugs for rows the Edge Functions create (universities from the "not
// listed" flow, community questions). The base transform mirrors
// frontend/src/lib/seo/slugify.ts — keep them in sync. Slugs satisfy the DB
// CHECK ^[a-z0-9]+(-[a-z0-9]+)*$.
//
// The transform drops everything outside [a-z0-9], so a title or name with no
// Latin characters (e.g. 北京语言大学) produces an empty base, and a name made
// only of generic words produces something like "university". Those weak
// bases must never be treated as identifying: they get a random suffix and
// are never reused as a match for an existing row.

export function slugify(text: string, max: number): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '')
}

// Words that say what kind of place something is, not which one.
export const GENERIC_UNIVERSITY_WORDS = new Set([
  'university',
  'college',
  'institute',
  'school',
  'academy',
  'of',
  'the',
  'and',
  'in',
  'china',
  'chinese',
  'international',
])

// True when the slug can't identify anything: empty, under 3 characters, or
// made only of generic words.
export function isWeakSlug(slug: string, genericWords: Set<string> = new Set()): boolean {
  if (slug.replace(/-/g, '').length < 3) return true
  return slug.split('-').every((token) => genericWords.has(token))
}

const SUFFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
export const SUFFIX_LENGTH = 6

export function randomSuffix(length = SUFFIX_LENGTH): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  // 256 % 36 bias is irrelevant here: this is collision avoidance, not a secret.
  return Array.from(bytes, (b) => SUFFIX_ALPHABET[b % SUFFIX_ALPHABET.length]).join('')
}

// base + "-" + random suffix, trimmed so the result stays within max.
export function withRandomSuffix(base: string, max: number, fallback: string): string {
  const room = max - SUFFIX_LENGTH - 1
  const head = (base || fallback).slice(0, room).replace(/-+$/g, '') || fallback.slice(0, room)
  return `${head}-${randomSuffix()}`
}
