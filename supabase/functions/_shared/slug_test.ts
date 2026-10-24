import { assertEquals, assertMatch, assertNotEquals } from 'jsr:@std/assert'
import {
  GENERIC_UNIVERSITY_WORDS,
  SUFFIX_LENGTH,
  isWeakSlug,
  randomSuffix,
  slugify,
  withRandomSuffix,
} from './slug.ts'

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

Deno.test('slugify keeps the frontend transform', () => {
  assertEquals(slugify('  Zhejiang University ', 120), 'zhejiang-university')
  assertEquals(slugify('How do I open a bank account?', 120), 'how-do-i-open-a-bank-account')
  assertEquals(slugify('---a---b---', 120), 'a-b')
  // Trimming to max never leaves a trailing hyphen.
  assertEquals(slugify('abc def', 4), 'abc')
})

Deno.test('slugify returns an empty base for non-Latin text', () => {
  assertEquals(slugify('北京语言大学', 120), '')
  assertEquals(slugify('Как открыть счёт в банке?', 120), '')
  assertEquals(slugify('北京 University', 120), 'university')
})

Deno.test('isWeakSlug flags slugs that cannot identify a university', () => {
  assertEquals(isWeakSlug('', GENERIC_UNIVERSITY_WORDS), true)
  assertEquals(isWeakSlug('ab', GENERIC_UNIVERSITY_WORDS), true)
  assertEquals(isWeakSlug('university', GENERIC_UNIVERSITY_WORDS), true)
  assertEquals(isWeakSlug('university-of-china', GENERIC_UNIVERSITY_WORDS), true)
  assertEquals(isWeakSlug('the-international-college', GENERIC_UNIVERSITY_WORDS), true)
  assertEquals(isWeakSlug('zhejiang-university', GENERIC_UNIVERSITY_WORDS), false)
  assertEquals(isWeakSlug('peking', GENERIC_UNIVERSITY_WORDS), false)
})

Deno.test('isWeakSlug without generic words only rejects empty or tiny slugs', () => {
  assertEquals(isWeakSlug(''), true)
  assertEquals(isWeakSlug('a-b'), true)
  assertEquals(isWeakSlug('university'), false)
  assertEquals(isWeakSlug('how-do-i-get-a-visa'), false)
})

Deno.test('randomSuffix is lowercase alphanumeric and varies', () => {
  const a = randomSuffix()
  assertEquals(a.length, SUFFIX_LENGTH)
  assertMatch(a, /^[a-z0-9]+$/)
  const seen = new Set(Array.from({ length: 50 }, () => randomSuffix()))
  assertEquals(seen.size > 45, true)
})

Deno.test('withRandomSuffix uses the fallback for an empty base', () => {
  const slug = withRandomSuffix('', 120, 'university')
  assertMatch(slug, /^university-[a-z0-9]{6}$/)
  assertMatch(slug, SLUG_RE)
})

Deno.test('withRandomSuffix stays inside max and the slug CHECK', () => {
  const long = slugify('a'.repeat(60) + ' ' + 'b'.repeat(60) + ' ' + 'c'.repeat(60), 140)
  for (const max of [120, 140]) {
    const slug = withRandomSuffix(long, max, 'question')
    assertEquals(slug.length <= max, true)
    assertMatch(slug, SLUG_RE)
  }
  // A cut landing on a hyphen must not produce a double hyphen.
  const hyphenAtCut = 'a'.repeat(112) + '-bbbb'
  assertMatch(withRandomSuffix(hyphenAtCut, 120, 'question'), SLUG_RE)
})

Deno.test('repeated weak titles get distinct slugs', () => {
  const base = slugify('签证怎么续签？需要哪些材料', 120)
  const slugs = new Set(Array.from({ length: 20 }, () => withRandomSuffix(base, 140, 'question')))
  assertEquals(slugs.size, 20)
  assertNotEquals([...slugs][0], 'question')
})
