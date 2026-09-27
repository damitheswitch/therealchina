import { assertEquals, assertThrows } from 'jsr:@std/assert'
import { validateReviewFields, validateMedia } from './reviewFields.ts'

const PREFIX = 'https://example.supabase.co/storage/v1/object/public/review-media/'

const baseBody = {
  rating: 4,
  text: 'Great program, tough grading, loved the campus food.',
}

Deno.test('accepts a minimal valid payload', () => {
  const fields = validateReviewFields({ ...baseBody }, PREFIX)
  assertEquals(fields.rating, 4)
  assertEquals(fields.media, [])
  assertEquals(fields.tags, [])
  assertEquals(fields.program, null)
})

Deno.test('rejects non-integer rating and short text', () => {
  assertThrows(() => validateReviewFields({ ...baseBody, rating: 4.5 }, PREFIX))
  assertThrows(() => validateReviewFields({ ...baseBody, text: 'too short' }, PREFIX))
})

Deno.test('rejects media URLs outside our bucket', () => {
  assertThrows(() =>
    validateReviewFields(
      { ...baseBody, media: [{ url: 'https://evil.example.com/x.jpg', type: 'image' }] },
      PREFIX
    )
  )
})

Deno.test('accepts in-bucket media and strips unknown fields', () => {
  const media = validateMedia(
    [{ url: `${PREFIX}a/b.jpg`, type: 'image', name: 'dorm', hacker: 'ignored' }],
    PREFIX
  )
  assertEquals(media[0].url, `${PREFIX}a/b.jpg`)
  assertEquals('hacker' in media[0], false)
})

Deno.test('rejects invalid enums and bad year ranges', () => {
  assertThrows(() =>
    validateReviewFields({ ...baseBody, enrollmentStatus: 'wizard' }, PREFIX)
  )
  assertThrows(() =>
    validateReviewFields({ ...baseBody, fundingType: 'rich-uncle' }, PREFIX)
  )
  assertThrows(() =>
    validateReviewFields({ ...baseBody, startYear: 2024, endYear: 2020 }, PREFIX)
  )
})

Deno.test('drops funding coverage for self-funded reviews', () => {
  const fields = validateReviewFields(
    { ...baseBody, fundingType: 'self', fundingCoverage: 'full' },
    PREFIX
  )
  assertEquals(fields.funding_type, 'self')
  assertEquals(fields.funding_coverage, null)
})

Deno.test('result never carries ownership columns', () => {
  const fields = validateReviewFields(
    { ...baseBody, user_id: 'someone-else', university_id: 'other-uni' } as never,
    PREFIX
  )
  assertEquals('user_id' in fields, false)
  assertEquals('university_id' in fields, false)
  assertEquals('id' in fields, false)
})
