import { assertEquals, assertThrows } from 'jsr:@std/assert'
import { validateReviewFields, validateBoostPatch, validateMedia } from './reviewFields.ts'

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

// ---- validateBoostPatch (anonymous Boost partial updates) ----------------------

Deno.test('boost patch maps allowed fields to column names', () => {
  const patch = validateBoostPatch({
    program: '  CS  ',
    degreeLevel: 'Bachelor',
    startYear: 2023,
    pros: 'Great food',
  })
  assertEquals(patch, {
    program: 'CS',
    degree_level: 'Bachelor',
    start_year: 2023,
    pros: 'Great food',
  })
})

Deno.test('boost patch supports partial subscores and null clears', () => {
  const patch = validateBoostPatch({ subscores: { rating_cost: 4, rating_social: null } })
  assertEquals(patch, { rating_cost: 4, rating_social: null })
})

Deno.test('boost patch rejects every protected field', () => {
  for (const key of [
    'rating',
    'text',
    'universityId',
    'universitySlug',
    'userId',
    'user_id',
    'university_id',
    'ownerId',
    'owner_id',
    'deletedAt',
    'deleted_at',
    'media',
    'tags',
    'recommend',
    'createdAt',
    'claimToken',
    'boostToken',
    'reviewId',
  ]) {
    assertThrows(
      () => validateBoostPatch({ [key]: 1 }),
      Error,
      'cannot be changed',
      `expected ${key} to be rejected`
    )
  }
})

Deno.test('boost patch rejects empty and non-object payloads', () => {
  assertThrows(() => validateBoostPatch({}), Error, 'No fields')
  assertThrows(() => validateBoostPatch({ subscores: {} }), Error, 'No fields')
  assertThrows(() => validateBoostPatch(null as never), Error)
  assertThrows(() => validateBoostPatch([] as never), Error)
  assertThrows(() => validateBoostPatch('x' as never), Error)
})

Deno.test('boost patch rejects invalid values with the same rules as full validation', () => {
  assertThrows(() => validateBoostPatch({ enrollmentStatus: 'wizard' }))
  assertThrows(() => validateBoostPatch({ fundingType: 'rich-uncle' }))
  assertThrows(() => validateBoostPatch({ fundingCoverage: 'everything' }))
  assertThrows(() => validateBoostPatch({ startYear: 1800 }))
  assertThrows(() => validateBoostPatch({ subscores: { rating_cost: 9 } }))
  assertThrows(() => validateBoostPatch({ program: 'x'.repeat(121) }))
})
