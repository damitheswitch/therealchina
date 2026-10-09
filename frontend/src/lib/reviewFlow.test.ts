import { describe, expect, it, vi } from 'vitest'

// reviewFlow.ts pulls a runtime constant from reviewDrafts.ts, which imports
// the Supabase client — mock it so CI (no env vars) can load the module.
vi.mock('./supabaseClient', () => ({ supabase: {} }))
import { DRAFT_PAYLOAD_VERSION, type ReviewDraftPayload } from './reviewDrafts'
import {
  ANON_BOOST_CARDS,
  BOOST_CARD_META,
  BOOST_CARD_ORDER,
  buildBoostPatch,
  buildReviewFields,
  draftPayloadFromState,
  emptyReviewFieldValues,
  fieldValuesFromDraft,
  recentYearChips,
  STORY_STARTERS,
  type ReviewFieldValues,
} from './reviewFlow'

const values = (overrides: Partial<ReviewFieldValues> = {}): ReviewFieldValues => ({
  ...emptyReviewFieldValues,
  ...overrides,
})

const legacyPayload = (overrides: Partial<ReviewDraftPayload> = {}): ReviewDraftPayload => ({
  step: 1,
  selectedUni: '',
  selectedUniName: '',
  showNotListed: false,
  newUniName: '',
  newUniProvince: '',
  newUniCity: '',
  rating: 0,
  recommend: '',
  program: '',
  subscores: {},
  enrollmentStatus: '',
  startYear: '',
  endYear: '',
  languageOfInstruction: '',
  degreeLevel: '',
  tuitionRange: '',
  livingCostRange: '',
  fundingType: '',
  fundingCoverage: '',
  selectedTags: [],
  pros: '',
  cons: '',
  reviewText: '',
  media: [],
  homeCountry: '',
  currentStatus: '',
  languagesSpoken: [],
  emailConsent: false,
  anonEmail: '',
  ...overrides,
})

describe('buildReviewFields', () => {
  it('normalizes empty inputs into "not provided"', () => {
    const fields = buildReviewFields(
      values({ rating: 4, reviewText: '  Great place, honestly.  ' }),
      []
    )
    expect(fields).toEqual({
      rating: 4,
      text: 'Great place, honestly.',
      media: [],
      subscores: {},
      program: undefined,
      degreeLevel: undefined,
      enrollmentStatus: undefined,
      startYear: undefined,
      endYear: undefined,
      languageOfInstruction: undefined,
      tuitionRange: undefined,
      livingCostRange: undefined,
      fundingType: undefined,
      fundingCoverage: undefined,
      recommend: undefined,
      pros: undefined,
      cons: undefined,
      tags: undefined,
    })
  })

  it('keeps provided optional fields and trims free text', () => {
    const fields = buildReviewFields(
      values({
        rating: 5,
        reviewText: 'Loved it',
        program: '  MBBS  ',
        recommend: 'yes',
        startYear: 2023,
        selectedTags: ['Safe', 'Cheap city'],
        pros: '  Friendly staff ',
      }),
      [{ url: 'https://example.com/a.jpg', type: 'image' }]
    )
    expect(fields.program).toBe('MBBS')
    expect(fields.recommend).toBe('yes')
    expect(fields.startYear).toBe(2023)
    expect(fields.tags).toEqual(['Safe', 'Cheap city'])
    expect(fields.pros).toBe('Friendly staff')
    expect(fields.media).toHaveLength(1)
  })

  it('drops funding coverage for self-funded reviews', () => {
    const fields = buildReviewFields(
      values({
        rating: 3,
        reviewText: 'ok ok ok ok ok',
        fundingType: 'self',
        fundingCoverage: 'full',
      }),
      []
    )
    expect(fields.fundingType).toBe('self')
    expect(fields.fundingCoverage).toBeUndefined()
  })
})

describe('draft payload versioning', () => {
  it('writes v2 payloads with the current screen', () => {
    const p = draftPayloadFromState(values({ rating: 4 }), [], 2)
    expect(p.v).toBe(DRAFT_PAYLOAD_VERSION)
    expect(p.step).toBe(2)
    expect(p.rating).toBe(4)
  })

  it('strips version, step, and media when rehydrating form values', () => {
    const legacy = legacyPayload({
      v: 2,
      step: 2,
      rating: 5,
      program: 'MBBS',
      media: [{ url: 'https://x/y.jpg', type: 'image' }],
      homeCountry: 'Nigeria',
    })
    const fields = fieldValuesFromDraft(legacy)
    expect(fields).not.toHaveProperty('v')
    expect(fields).not.toHaveProperty('step')
    expect(fields).not.toHaveProperty('media')
    // Legacy about-you answers ride along so a resumed v1 draft does not
    // silently drop data it collected.
    expect(fields.homeCountry).toBe('Nigeria')
    expect(fields.rating).toBe(5)
    expect(fields.program).toBe('MBBS')
  })
})

describe('boost card ordering', () => {
  it('covers every card exactly once and leads with program', () => {
    expect(new Set(BOOST_CARD_ORDER).size).toBe(BOOST_CARD_ORDER.length)
    expect(BOOST_CARD_ORDER[0]).toBe('program')
    for (const card of BOOST_CARD_ORDER) {
      expect(BOOST_CARD_META[card]).toBeDefined()
      expect(BOOST_CARD_META[card].title.length).toBeGreaterThan(0)
    }
  })

  it('anonymous Boost drops only the media card', () => {
    expect(ANON_BOOST_CARDS).toEqual(['program', 'ratings', 'money', 'details', 'pros_cons'])
  })
})

describe('buildBoostPatch', () => {
  it('sends only the fields the card owns', () => {
    const v = values({
      program: ' MBBS ',
      degreeLevel: 'Bachelor',
      startYear: 2023,
      tuitionRange: 'mid',
      pros: 'nice',
      rating: 5,
      reviewText: 'long enough text',
      selectedTags: ['Safe'],
    })
    expect(buildBoostPatch(v, 'program')).toEqual({
      program: 'MBBS',
      degreeLevel: 'Bachelor',
    })
    expect(buildBoostPatch(v, 'details')).toEqual({
      enrollmentStatus: null,
      startYear: 2023,
      endYear: null,
      languageOfInstruction: null,
    })
    // Never carries the protected fields.
    expect(buildBoostPatch(v, 'pros_cons')).toEqual({ pros: 'nice', cons: null })
  })

  it('self-funded clears coverage the same way buildReviewFields does', () => {
    const patch = buildBoostPatch(values({ fundingType: 'self', fundingCoverage: 'full' }), 'money')
    expect(patch).toEqual({
      tuitionRange: null,
      livingCostRange: null,
      fundingType: 'self',
      fundingCoverage: null,
    })
  })

  it('produces no patch for cards outside the allowlist', () => {
    expect(buildBoostPatch(values(), 'media')).toEqual({})
  })
})

describe('story starters', () => {
  it('ends with a space so text can continue the sentence', () => {
    for (const s of STORY_STARTERS) expect(s.endsWith(' ')).toBe(true)
  })
})

describe('recentYearChips', () => {
  it('returns the current year and six before it', () => {
    const chips = recentYearChips(2026)
    expect(chips).toEqual([2026, 2025, 2024, 2023, 2022, 2021, 2020])
  })
})
