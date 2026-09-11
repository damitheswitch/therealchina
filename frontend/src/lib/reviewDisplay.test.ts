import { describe, it, expect } from 'vitest'
import {
  buildContextLine,
  buildFactItems,
  getRecommendMeta,
  getSubScores,
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
