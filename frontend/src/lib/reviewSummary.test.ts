import { describe, it, expect } from 'vitest'
import { buildReviewSummary, getRecommendYesPct } from './reviewSummary'
import type { ReviewDisplayData } from './reviewDisplay'

type ReviewInput = ReviewDisplayData & { rating: number }

const base: ReviewInput = {
  rating: 4,
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

describe('buildReviewSummary', () => {
  it('returns a zeroed summary for an empty array', () => {
    const s = buildReviewSummary([])
    expect(s.reviewCount).toBe(0)
    expect(s.avgRating).toBe(0)
    expect(s.ratingDist).toEqual([
      { stars: 5, count: 0 },
      { stars: 4, count: 0 },
      { stars: 3, count: 0 },
      { stars: 2, count: 0 },
      { stars: 1, count: 0 },
    ])
    expect(s.recommend).toEqual({
      yes: 0,
      maybe: 0,
      no: 0,
      answered: 0,
      yesPct: 0,
      maybePct: 0,
      noPct: 0,
    })
    expect(s.subscores).toEqual([])
    expect(s.topTags).toEqual([])
    expect(s.enrollment).toEqual([])
    expect(s.modalLivingCost).toBeNull()
    expect(s.modalTuition).toBeNull()
  })

  it('builds a 5→1 histogram and averages ratings', () => {
    const s = buildReviewSummary([
      { ...base, rating: 5 },
      { ...base, rating: 5 },
      { ...base, rating: 2 },
      { ...base, rating: 1 },
    ])
    expect(s.reviewCount).toBe(4)
    expect(s.avgRating).toBeCloseTo(3.25)
    expect(s.ratingDist).toEqual([
      { stars: 5, count: 2 },
      { stars: 4, count: 0 },
      { stars: 3, count: 0 },
      { stars: 2, count: 1 },
      { stars: 1, count: 1 },
    ])
  })

  it('treats NULL recommends as unanswered with zeroed percentages', () => {
    const s = buildReviewSummary([{ ...base }, { ...base }])
    expect(s.recommend.answered).toBe(0)
    expect(s.recommend.yesPct).toBe(0)
    expect(s.recommend.maybePct).toBe(0)
    expect(s.recommend.noPct).toBe(0)
  })

  it('counts recommend answers and rounds shares of answered only', () => {
    const s = buildReviewSummary([
      { ...base, recommend: 'yes' },
      { ...base, recommend: 'yes' },
      { ...base, recommend: 'maybe' },
      { ...base, recommend: 'no' },
      { ...base }, // legacy NULL — excluded from the denominator
    ])
    expect(s.recommend).toEqual({
      yes: 2,
      maybe: 1,
      no: 1,
      answered: 4,
      yesPct: 50,
      maybePct: 25,
      noPct: 25,
    })
  })

  it('averages sub-scores over non-null only, omits unrated, keeps wizard order', () => {
    const s = buildReviewSummary([
      { ...base, rating_academics: 4 },
      { ...base, rating_academics: 2, rating_social: 5 },
      { ...base },
    ])
    expect(s.subscores).toEqual([
      { key: 'rating_academics', label: 'Academics', avg: 3, count: 2 },
      { key: 'rating_social', label: 'Social life', avg: 5, count: 1 },
    ])
  })

  it('counts tags, filters falsy, caps at 8, tiebreaks by name', () => {
    const s = buildReviewSummary([
      { ...base, tags: ['b', 'a', 'x1', 'x2'] },
      { ...base, tags: ['a', 'b', 'x3', 'x4', ''] },
      { ...base, tags: ['a', 'x5', 'x6', 'x7'] },
      { ...base, tags: null },
    ])
    // a:3, b:2, then seven single-occurrence tags — the 8-slot cap drops x7.
    expect(s.topTags).toEqual([
      { tag: 'a', count: 3 },
      { tag: 'b', count: 2 },
      { tag: 'x1', count: 1 },
      { tag: 'x2', count: 1 },
      { tag: 'x3', count: 1 },
      { tag: 'x4', count: 1 },
      { tag: 'x5', count: 1 },
      { tag: 'x6', count: 1 },
    ])
  })

  it('counts enrollment statuses, count desc, keeping raw values', () => {
    const s = buildReviewSummary([
      { ...base, enrollment_status: 'current' },
      { ...base, enrollment_status: 'current' },
      { ...base, enrollment_status: 'alumni' },
      { ...base },
    ])
    expect(s.enrollment).toEqual([
      { status: 'current', count: 2 },
      { status: 'alumni', count: 1 },
    ])
  })

  it('picks the modal cost range and breaks ties alphabetically', () => {
    const s = buildReviewSummary([
      { ...base, living_cost_range: '¥4k–¥8k', tuition_range: '¥20k–¥40k' },
      { ...base, living_cost_range: '¥4k–¥8k', tuition_range: '¥10k–¥20k' },
      { ...base, living_cost_range: '¥8k–¥12k', tuition_range: '¥20k–¥40k' },
    ])
    expect(s.modalLivingCost).toBe('¥4k–¥8k')
    expect(s.modalTuition).toBe('¥20k–¥40k')

    const tie = buildReviewSummary([
      { ...base, living_cost_range: 'b-range' },
      { ...base, living_cost_range: 'a-range' },
    ])
    expect(tie.modalLivingCost).toBe('a-range')
  })
})

describe('getRecommendYesPct', () => {
  it('returns null when nobody answered', () => {
    expect(getRecommendYesPct(0, 0, 0)).toBeNull()
  })

  it('rounds the yes share of answered', () => {
    expect(getRecommendYesPct(2, 1, 1)).toBe(50)
    expect(getRecommendYesPct(1, 0, 2)).toBe(33)
    expect(getRecommendYesPct(3, 0, 0)).toBe(100)
  })
})
