import { describe, it, expect } from 'vitest'
import {
  buildContextLine,
  buildFactItems,
  formatEnrollmentLabel,
  formatReviewerMix,
  getRecommendMeta,
  getReviewTeaserItems,
  getSubScores,
  hasReviewExtras,
  normalizeMediaItems,
  type ReviewCardData,
  type ReviewDisplayData,
} from './reviewDisplay'

const base: ReviewDisplayData = {
  program: null,
  degree_level: null,
  enrollment_status: null,
  start_year: null,
  end_year: null,
  language_of_instruction: null,
  tuition_range: null,
  living_cost_range: null,
  funding_type: null,
  funding_coverage: null,
  recommend: null,
  pros: null,
  cons: null,
  tags: null,
  rating_academics: null,
  rating_campus: null,
  rating_accommodation: null,
  rating_cost: null,
  rating_intl_office: null,
  rating_social: null,
  rating_extracurricular: null,
  rating_career: null,
}

describe('getSubScores', () => {
  it('returns an empty array when all sub-scores are null', () => {
    expect(getSubScores(base)).toEqual([])
  })

  it('returns only the rated scores in a fixed order', () => {
    const scores = getSubScores({ ...base, rating_social: 5, rating_academics: 4 })
    expect(scores).toEqual([
      { key: 'rating_academics', label: 'Academics', value: 4 },
      { key: 'rating_social', label: 'Social life', value: 5 },
    ])
  })
})

describe('buildContextLine', () => {
  it('is empty for a legacy review with no context fields', () => {
    expect(buildContextLine(base)).toBe('')
  })

  it('joins all non-null parts', () => {
    const line = buildContextLine({
      ...base,
      program: 'Computer Science',
      degree_level: 'Master',
      enrollment_status: 'alumni',
      start_year: 2019,
      end_year: 2022,
    })
    expect(line).toBe('Studied Computer Science · Master · Alumni · 2019–2022')
  })

  it('uses "present" when end_year is null', () => {
    expect(buildContextLine({ ...base, start_year: 2023 })).toBe('2023–present')
  })

  it('handles a lone end_year', () => {
    expect(buildContextLine({ ...base, end_year: 2020 })).toBe('until 2020')
  })

  it('falls back to the raw value for unknown enrollment_status', () => {
    expect(buildContextLine({ ...base, enrollment_status: 'weird' })).toBe('weird')
  })
})

describe('buildFactItems', () => {
  it('is empty when no fact fields are set', () => {
    expect(buildFactItems(base)).toEqual([])
  })

  it('labels instruction, tuition, and living cost with their periods', () => {
    expect(
      buildFactItems({
        ...base,
        language_of_instruction: 'English',
        tuition_range: '¥20k–¥40k',
        living_cost_range: '¥4k–¥8k',
      })
    ).toEqual(['Instruction: English', 'Tuition: ¥20k–¥40k/yr', 'Living cost: ¥4k–¥8k/mo'])
  })

  it('appends coverage to a known funding type', () => {
    expect(buildFactItems({ ...base, funding_type: 'csc', funding_coverage: 'full' })).toEqual([
      'Funding: CSC / Government (full coverage)',
    ])
  })

  it('omits coverage when it is not set', () => {
    expect(buildFactItems({ ...base, funding_type: 'self' })).toEqual(['Funding: Self-funded'])
  })
})

describe('getRecommendMeta', () => {
  it('returns null for null/undefined/unknown values', () => {
    expect(getRecommendMeta(null)).toBeNull()
    expect(getRecommendMeta(undefined)).toBeNull()
    expect(getRecommendMeta('bogus')).toBeNull()
  })

  it('maps each allowed value to a label', () => {
    expect(getRecommendMeta('yes')?.label).toBe('Recommends')
    expect(getRecommendMeta('maybe')?.label).toBe('Neutral')
    expect(getRecommendMeta('no')?.label).toBe("Doesn't recommend")
  })
})

describe('formatEnrollmentLabel', () => {
  it('uses the singular form for count 1 and plural otherwise', () => {
    expect(formatEnrollmentLabel('current', 1)).toBe('1 current student')
    expect(formatEnrollmentLabel('current', 3)).toBe('3 current students')
    expect(formatEnrollmentLabel('alumni', 1)).toBe('1 alum')
    expect(formatEnrollmentLabel('alumni', 2)).toBe('2 alumni')
    expect(formatEnrollmentLabel('exchange', 1)).toBe('1 exchange student')
    expect(formatEnrollmentLabel('exchange', 4)).toBe('4 exchange students')
    expect(formatEnrollmentLabel('applicant', 2)).toBe('2 applicants')
  })

  it('falls back to the raw status for unknown values', () => {
    expect(formatEnrollmentLabel('weird', 1)).toBe('1 weird')
    expect(formatEnrollmentLabel('weird', 5)).toBe('5 weird')
  })
})

describe('formatReviewerMix', () => {
  it('joins enrollment parts in order', () => {
    expect(
      formatReviewerMix([
        { status: 'current', count: 3 },
        { status: 'alumni', count: 1 },
      ])
    ).toBe('3 current students · 1 alum')
  })

  it('is empty when nothing is known', () => {
    expect(formatReviewerMix([])).toBe('')
    expect(formatReviewerMix([{ status: 'exchange', count: 2 }])).toBe('2 exchange students')
  })
})

const baseCard: ReviewCardData = { ...base, media: null }

describe('normalizeMediaItems', () => {
  it('returns [] for null/undefined/non-array media', () => {
    expect(normalizeMediaItems(null)).toEqual([])
    expect(normalizeMediaItems(undefined)).toEqual([])
    expect(normalizeMediaItems('not-an-array')).toEqual([])
  })

  it('infers type from the extension for legacy string urls', () => {
    expect(
      normalizeMediaItems(['https://cdn/x.jpg', 'https://cdn/y.mp4', 'https://cdn/z.MOV'])
    ).toEqual([
      { url: 'https://cdn/x.jpg', type: 'image', name: '' },
      { url: 'https://cdn/y.mp4', type: 'video', name: '' },
      { url: 'https://cdn/z.MOV', type: 'video', name: '' },
    ])
  })

  it('passes object items through with sane defaults', () => {
    expect(
      normalizeMediaItems([
        { url: 'https://cdn/a.png', type: 'image', name: 'dorm' },
        { url: 'https://cdn/b.png' },
      ])
    ).toEqual([
      { url: 'https://cdn/a.png', type: 'image', name: 'dorm' },
      { url: 'https://cdn/b.png', type: 'image', name: '' },
    ])
  })

  it('drops entries without a usable url', () => {
    expect(
      normalizeMediaItems([{ type: 'image' }, 42, null, { url: 'https://cdn/ok.png' }])
    ).toEqual([{ url: 'https://cdn/ok.png', type: 'image', name: '' }])
  })
})

describe('hasReviewExtras', () => {
  it('is false when a review has nothing beyond the visible preview', () => {
    expect(hasReviewExtras(baseCard)).toBe(false)
  })

  it('is true for pros, cons, sub-scores, tags, or media alone', () => {
    expect(hasReviewExtras({ ...baseCard, pros: 'great food' })).toBe(true)
    expect(hasReviewExtras({ ...baseCard, cons: 'loud dorms' })).toBe(true)
    expect(hasReviewExtras({ ...baseCard, rating_campus: 4 })).toBe(true)
    expect(hasReviewExtras({ ...baseCard, tags: ['safe'] })).toBe(true)
    expect(hasReviewExtras({ ...baseCard, media: ['https://cdn/x.jpg'] })).toBe(true)
  })

  it('ignores empty tags and empty/invalid media', () => {
    expect(hasReviewExtras({ ...baseCard, tags: [null as unknown as string] })).toBe(false)
    expect(hasReviewExtras({ ...baseCard, media: [] })).toBe(false)
    expect(hasReviewExtras({ ...baseCard, media: [{ nope: 1 }] })).toBe(false)
  })
})

describe('getReviewTeaserItems', () => {
  it('returns [] when the review hides nothing', () => {
    expect(getReviewTeaserItems(baseCard)).toEqual([])
  })

  it('branches the pros/cons label correctly', () => {
    expect(getReviewTeaserItems({ ...baseCard, pros: 'x' })).toEqual(['Pros'])
    expect(getReviewTeaserItems({ ...baseCard, cons: 'x' })).toEqual(['Cons'])
    expect(getReviewTeaserItems({ ...baseCard, pros: 'x', cons: 'y' })).toEqual(['Pros & cons'])
  })

  it('uses singular forms for a count of one', () => {
    expect(getReviewTeaserItems({ ...baseCard, rating_academics: 5 })).toEqual([
      '1 category rating',
    ])
    expect(getReviewTeaserItems({ ...baseCard, media: ['https://cdn/x.jpg'] })).toEqual(['1 photo'])
    expect(getReviewTeaserItems({ ...baseCard, tags: ['safe'] })).toEqual(['1 tag'])
  })

  it('says "media items" when a video is present', () => {
    expect(
      getReviewTeaserItems({
        ...baseCard,
        media: ['https://cdn/a.jpg', 'https://cdn/b.mp4'],
      })
    ).toEqual(['2 media items'])
  })

  it('lists items in a fixed order: pros/cons, ratings, media, tags', () => {
    expect(
      getReviewTeaserItems({
        ...baseCard,
        tags: ['a', 'b'],
        media: ['https://cdn/x.jpg'],
        rating_academics: 5,
        rating_social: 4,
        pros: 'x',
        cons: 'y',
      })
    ).toEqual(['Pros & cons', '2 category ratings', '1 photo', '2 tags'])
  })
})
