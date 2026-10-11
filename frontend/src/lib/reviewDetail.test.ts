import { describe, it, expect } from 'vitest'
import {
  DETAIL_AREA_COUNT,
  DETAILED_THRESHOLD,
  RATINGS_AREA_MIN,
  detailScore,
  filledDetailAreas,
  isDetailedReview,
  missingDetailAreas,
} from './reviewDetail'

// Publish-minimum review: rating + text only, every optional field empty.
const bare = {
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
  media: null,
  rating_academics: null,
  rating_campus: null,
  rating_accommodation: null,
  rating_cost: null,
  rating_intl_office: null,
  rating_social: null,
  rating_extracurricular: null,
  rating_career: null,
}

describe('detailScore', () => {
  it('scores a publish-minimum review as zero', () => {
    expect(detailScore(bare)).toBe(0)
    expect(isDetailedReview(bare)).toBe(false)
  })

  it('counts each area once when filled', () => {
    const review = {
      ...bare,
      program: 'Computer Science',
      tuition_range: '¥20k-¥40k',
      pros: 'Great food',
      tags: ['safe'],
      media: ['https://cdn.example.com/a.jpg'],
      enrollment_status: 'current',
      rating_academics: 5,
      rating_campus: 4,
      rating_social: 4,
      rating_cost: 3,
    }
    expect(detailScore(review)).toBe(DETAIL_AREA_COUNT)
    expect(isDetailedReview(review)).toBe(true)
    expect(missingDetailAreas(review)).toHaveLength(0)
  })

  it('needs the minimum sub-score count before the ratings area counts', () => {
    const subscores = (n: number) => {
      const keys = [
        'rating_academics',
        'rating_campus',
        'rating_accommodation',
        'rating_cost',
        'rating_intl_office',
        'rating_social',
        'rating_extracurricular',
        'rating_career',
      ] as const
      return Object.fromEntries(keys.slice(0, n).map((k) => [k, 4]))
    }
    expect(filledDetailAreas({ ...bare, ...subscores(RATINGS_AREA_MIN - 1) })).not.toContain(
      'ratings'
    )
    expect(filledDetailAreas({ ...bare, ...subscores(RATINGS_AREA_MIN) })).toContain('ratings')
  })

  it('qualifies without photos: the media area is optional', () => {
    const review = {
      ...bare,
      degree_level: 'Master',
      living_cost_range: '¥2k-¥4k',
      cons: 'Slow wifi',
    }
    expect(detailScore(review)).toBe(3)
    expect(isDetailedReview(review)).toBe(true)
  })

  it('stays below the threshold at two areas', () => {
    const review = { ...bare, program: 'MBA', pros: 'Nice campus' }
    expect(detailScore(review)).toBe(DETAILED_THRESHOLD - 1)
    expect(isDetailedReview(review)).toBe(false)
  })

  it('treats blank strings and empty arrays as unfilled', () => {
    const review = { ...bare, program: '   ', pros: '', tags: [], media: [] }
    expect(detailScore(review)).toBe(0)
  })

  it('tolerates sparse rows: absent keys count as unfilled', () => {
    // The 'helpful' head select only fetches score columns — partial rows
    // must not throw or score phantom areas.
    expect(detailScore({ tags: ['safe'] })).toBe(1)
    expect(detailScore({})).toBe(0)
  })

  it('lists missing areas in fixed card order for the strength meter', () => {
    const review = { ...bare, pros: 'Great food', tags: ['safe'] }
    expect(missingDetailAreas(review).map((a) => a.key)).toEqual([
      'program',
      'ratings',
      'money',
      'timing',
      'media',
    ])
  })
})
