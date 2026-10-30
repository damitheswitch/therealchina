import { describe, expect, it, vi } from 'vitest'

// reviewFlow.ts pulls a runtime constant from reviewDrafts.ts, which imports
// the Supabase client — mock it so CI (no env vars) can load the module.
vi.mock('./supabaseClient', () => ({ supabase: {} }))
import { DRAFT_PAYLOAD_VERSION, type ReviewDraftPayload } from './reviewDrafts'
import {
  ANON_BOOST_CARDS,
  BOOST_CARD_META,
  BOOST_CARD_ORDER,
  BOOST_CARD_SHORT,
  buildBoostPatch,
  storyPlaceholder,
  buildReviewFields,
  draftPayloadFromState,
  emptyReviewFieldValues,
  fieldValuesFromDraft,
  isBoostCardDone,
  nextBoostCard,
  normalizeUniSlugParam,
  recentYearChips,
  applyDegreeLevel,
  applyEndYear,
  applyPolarityPick,
  applyProgram,
  applyStartYear,
  derivePolarityText,
  LANGUAGE_COURSE_DEGREE,
  LANGUAGE_COURSE_PROGRAM,
  LANGUAGE_COURSE_INSTRUCTION,
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
  it('covers every card exactly once, leads with ratings, and has tab labels', () => {
    expect(new Set(BOOST_CARD_ORDER).size).toBe(BOOST_CARD_ORDER.length)
    expect(BOOST_CARD_ORDER).toEqual(['ratings', 'money', 'program', 'media'])
    for (const card of BOOST_CARD_ORDER) {
      expect(BOOST_CARD_META[card]).toBeDefined()
      expect(BOOST_CARD_META[card].title.length).toBeGreaterThan(0)
      expect(BOOST_CARD_SHORT[card].label.length).toBeGreaterThan(0)
    }
  })

  it('anonymous Boost drops only the media card', () => {
    expect(ANON_BOOST_CARDS).toEqual(['ratings', 'money', 'program'])
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
      languageOfInstruction: null,
      enrollmentStatus: null,
      endYear: null,
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

describe('polarity matrix derivation', () => {
  it('one pick fans out into tag, pros, and the auto sentence', () => {
    const patch = applyPolarityPick(values(), 'classes', 'pos')
    expect(patch.polarity).toEqual({ classes: 'pos' })
    expect(patch.selectedTags).toEqual(['Strong academics'])
    expect(patch.pros).toBe('strong professors and classes')
    expect(patch.cons).toBe('')
    expect(patch.reviewText).toBe('The standouts are strong professors and classes.')
  })

  it('mixed picks join pros and cons into one honest sentence', () => {
    let v = values()
    v = { ...v, ...applyPolarityPick(v, 'classes', 'pos') }
    v = { ...v, ...applyPolarityPick(v, 'dorms', 'pos') }
    v = { ...v, ...applyPolarityPick(v, 'admin', 'neg') }
    expect(v.selectedTags).toEqual(['Strong academics', 'Good dorms', 'Hard bureaucracy'])
    expect(v.pros).toBe('strong professors and classes, comfortable international dorms')
    expect(v.cons).toBe('slow bureaucracy and admin rules')
    expect(v.reviewText).toBe(
      'Highlights include strong professors and classes and comfortable international dorms, though students should expect slow bureaucracy and admin rules.'
    )
  })

  it('joins three or more items with commas instead of chained "and"', () => {
    const text = derivePolarityText({ classes: 'pos', dorms: 'pos', food: 'pos' })
    expect(text).toBe(
      'The standouts are strong professors and classes, comfortable international dorms, and great affordable campus food.'
    )
  })

  it('tapping the active side un-picks the topic and strips its columns', () => {
    let v = values()
    v = { ...v, ...applyPolarityPick(v, 'classes', 'pos') }
    v = { ...v, ...applyPolarityPick(v, 'classes', 'pos') }
    expect(v.polarity).toEqual({})
    expect(v.selectedTags).toEqual([])
    expect(v.pros).toBe('')
    expect(v.reviewText).toBe('')
  })

  it('never overwrites text the reviewer typed themselves', () => {
    const v = values({ reviewText: 'my own words, typed by hand' })
    const patch = applyPolarityPick(v, 'classes', 'pos')
    expect(patch.reviewText).toBeUndefined()
  })

  it('overwrites its own generated text on the next pick but not manual edits', () => {
    let v = values()
    v = { ...v, ...applyPolarityPick(v, 'classes', 'pos') }
    // Still auto: text equals what the matrix produced, so it updates.
    v = { ...v, ...applyPolarityPick(v, 'dorms', 'pos') }
    expect(v.reviewText).toContain('comfortable international dorms')
    // A manual edit freezes the text for later picks.
    v = { ...v, reviewText: 'edited by the reviewer' }
    v = { ...v, ...applyPolarityPick(v, 'food', 'neg') }
    expect(v.reviewText).toBe('edited by the reviewer')
  })

  it('keeps non-polarity tags and manual pros the user already had', () => {
    const v = values({
      selectedTags: ['Safe', 'Good dorms'],
      pros: 'handwritten pro',
    })
    const patch = applyPolarityPick(v, 'classes', 'pos')
    // 'Good dorms' is a polarity tag and gets re-derived, not duplicated;
    // 'Safe' and the manual pro survive untouched.
    expect(patch.selectedTags).toEqual(['Safe', 'Strong academics'])
    expect(patch.pros).toBe('handwritten pro, strong professors and classes')
  })
})

describe('smart defaults', () => {
  it('Language Course fills program and instruction language', () => {
    const patch = applyDegreeLevel(values(), 'Language Course')
    expect(patch.program).toBe(LANGUAGE_COURSE_PROGRAM)
    expect(patch.languageOfInstruction).toBe(LANGUAGE_COURSE_INSTRUCTION)
  })

  it('rolling back from Language Course clears only its inferred values', () => {
    let v = values()
    v = { ...v, ...applyDegreeLevel(v, 'Language Course') }
    const back = applyDegreeLevel(v, 'Bachelor')
    expect(back.program).toBe('')
    expect(back.languageOfInstruction).toBe('')
    // Picking Language Course when program is already something else keeps it.
    const kept = applyDegreeLevel(values({ program: 'Law' }), 'Language Course')
    expect(kept.program).toBeUndefined()
  })

  it('Exchange pins enrollment status and releases it on switch', () => {
    const on = applyDegreeLevel(values(), 'Exchange')
    expect(on.enrollmentStatus).toBe('exchange')
    const onState = { ...values(), ...on }
    const off = applyDegreeLevel(onState, 'Bachelor')
    expect(off.enrollmentStatus).toBe('')
    // An explicit status is never overwritten.
    const kept = applyDegreeLevel(values({ enrollmentStatus: 'alumni' }), 'Exchange')
    expect(kept.enrollmentStatus).toBeUndefined()
    // A deliberate 'exchange' pick survives switching degree away.
    const deliberate = applyDegreeLevel(
      values({ degreeLevel: 'Exchange', enrollmentStatus: 'exchange' }),
      'Bachelor'
    )
    expect(deliberate.enrollmentStatus).toBeUndefined()
  })

  it('deliberate picks survive inference; inferred picks roll back', () => {
    // Deliberate 'Chinese Language (Mandarin)' program stays when degree moves
    // off Language Course — value equality alone used to erase it.
    const deliberateProgram = applyDegreeLevel(
      values({ degreeLevel: LANGUAGE_COURSE_DEGREE, program: LANGUAGE_COURSE_PROGRAM }),
      'Bachelor'
    )
    expect(deliberateProgram.program).toBeUndefined()

    // Inferred program/language do roll back when degree moves off.
    const onState = {
      ...values(),
      ...applyDegreeLevel(values(), LANGUAGE_COURSE_DEGREE),
    }
    const back = applyDegreeLevel(onState, 'Bachelor')
    expect(back.program).toBe('')
    expect(back.languageOfInstruction).toBe('')
  })

  it('deliberate enrollment status is never flipped by a year pick', () => {
    const v = values({ enrollmentStatus: 'current' })
    expect(applyEndYear(v, 2024).enrollmentStatus).toBeUndefined()
    // An inferred 'current' still rolls forward to 'alumni'.
    const inferred = {
      ...values(),
      ...applyStartYear(values(), new Date().getFullYear()),
    }
    expect(applyEndYear(inferred, 2024).enrollmentStatus).toBe('alumni')
  })

  it('clearing the finished year rolls back only an inferred alumni', () => {
    const withEnd = { ...values(), ...applyEndYear(values(), 2022) }
    expect(withEnd.enrollmentStatus).toBe('alumni')
    expect(applyEndYear(withEnd, '').enrollmentStatus).toBe('')
    // A deliberate alumni pick stays put on "Still studying".
    const deliberate = values({ enrollmentStatus: 'alumni', endYear: 2022 })
    expect(applyEndYear(deliberate, '').enrollmentStatus).toBeUndefined()
  })

  it('switching program rolls back only the inferred instruction language', () => {
    const langCourse = {
      ...values(),
      ...applyProgram(values(), LANGUAGE_COURSE_PROGRAM),
    }
    expect(langCourse.languageOfInstruction).toBe(LANGUAGE_COURSE_INSTRUCTION)
    expect(applyProgram(langCourse, 'Clinical Medicine (MBBS)').languageOfInstruction).toBe('')
    // A deliberate 'Chinese (Mandarin)' survives a program switch.
    const deliberate = values({
      program: LANGUAGE_COURSE_PROGRAM,
      languageOfInstruction: LANGUAGE_COURSE_INSTRUCTION,
    })
    expect(
      applyProgram(deliberate, 'Clinical Medicine (MBBS)').languageOfInstruction
    ).toBeUndefined()
  })

  it('recent start year infers current; end year infers alumni', () => {
    const now = new Date().getFullYear()
    expect(applyStartYear(values(), now, now).enrollmentStatus).toBe('current')
    expect(applyStartYear(values(), now - 10, now).enrollmentStatus).toBeUndefined()
    expect(
      applyStartYear(values({ enrollmentStatus: 'exchange' }), now, now).enrollmentStatus
    ).toBeUndefined()
    expect(applyEndYear(values(), 2024).enrollmentStatus).toBe('alumni')
    expect(
      applyEndYear(values({ enrollmentStatus: 'exchange' }), 2024).enrollmentStatus
    ).toBeUndefined()
  })

  it('Chinese Language program fills empty instruction language', () => {
    expect(applyProgram(values(), LANGUAGE_COURSE_PROGRAM).languageOfInstruction).toBe(
      LANGUAGE_COURSE_INSTRUCTION
    )
    expect(
      applyProgram(values({ languageOfInstruction: 'English' }), LANGUAGE_COURSE_PROGRAM)
        .languageOfInstruction
    ).toBeUndefined()
  })
})

describe('boost card completion', () => {
  it('money needs funding and living cost; program needs major and language', () => {
    const v = values({ fundingType: 'csc' })
    expect(isBoostCardDone('money', v, 0)).toBe(false)
    const v2 = values({ fundingType: 'csc', livingCostRange: '¥2k–¥4k' })
    expect(isBoostCardDone('money', v2, 0)).toBe(true)
    expect(isBoostCardDone('program', values({ program: 'Law' }), 0)).toBe(false)
    expect(
      isBoostCardDone('program', values({ program: 'Law', languageOfInstruction: 'English' }), 0)
    ).toBe(true)
    expect(isBoostCardDone('media', v2, 1)).toBe(true)
  })

  it('ratings completes at the detail-area bar of four scored aspects', () => {
    const three = { rating_academics: 4, rating_campus: 5, rating_social: 3 }
    expect(isBoostCardDone('ratings', values({ subscores: three }), 0)).toBe(false)
    const four = { ...three, rating_career: 4 }
    expect(isBoostCardDone('ratings', values({ subscores: four }), 0)).toBe(true)
  })

  it('nextBoostCard skips done cards and returns -1 when the deck is finished', () => {
    const cards = BOOST_CARD_ORDER
    const v = values({
      program: 'Law',
      languageOfInstruction: 'English',
    })
    // From money (index 1): program is already done, so media is next.
    expect(nextBoostCard(cards, 1, v, 0)).toBe(3)
    // Everything done: -1 finishes the deck.
    const allDone = values({
      fundingType: 'csc',
      livingCostRange: '¥2k–¥4k',
      program: 'Law',
      languageOfInstruction: 'English',
      subscores: {
        rating_academics: 4,
        rating_campus: 4,
        rating_social: 4,
        rating_career: 4,
      },
    })
    expect(nextBoostCard(cards, 2, allDone, 1)).toBe(-1)
  })
})

describe('recentYearChips', () => {
  it('returns the current year and six before it', () => {
    const chips = recentYearChips(2026)
    expect(chips).toEqual([2026, 2025, 2024, 2023, 2022, 2021, 2020])
  })
})

describe('normalizeUniSlugParam', () => {
  it('accepts lowercase slugs and aliases as-is', () => {
    expect(normalizeUniSlugParam('zhejiang-university')).toBe('zhejiang-university')
    expect(normalizeUniSlugParam('zju')).toBe('zju')
  })

  it('trims and lowercases before validating', () => {
    expect(normalizeUniSlugParam('  ZJU ')).toBe('zju')
  })

  it('treats anything that cannot be a slug as no param', () => {
    for (const bad of [null, undefined, '', '  ', 'a,b', 'a}b', 'a.b', '-x', 'x-', 'x--y', '_x']) {
      expect(normalizeUniSlugParam(bad)).toBe('')
    }
  })

  it('rejects overlong values the same way review-submit does', () => {
    expect(normalizeUniSlugParam('a'.repeat(121))).toBe('')
    expect(normalizeUniSlugParam('a'.repeat(120))).toBe('a'.repeat(120))
  })
})

describe('storyPlaceholder', () => {
  it('asks about the first topic marked as a problem', () => {
    expect(storyPlaceholder({ classes: 'pos', dorms: 'neg' })).toBe(
      'What should the next student know about dorms?'
    )
  })

  it('falls back to an insider-detail prompt with no negative pick', () => {
    expect(storyPlaceholder({})).toBe('One detail only a student there would know.')
    expect(storyPlaceholder({ food: 'pos' })).toBe('One detail only a student there would know.')
  })
})
