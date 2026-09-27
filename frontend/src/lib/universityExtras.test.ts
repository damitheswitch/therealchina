import { describe, it, expect } from 'vitest'
import { buildUniversityExtras } from './universityExtras'
import type { ReviewDisplayData } from './reviewDisplay'

type ReviewInput = ReviewDisplayData & { media?: unknown }

const base: ReviewInput = {
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

describe('buildUniversityExtras', () => {
  it('returns empty aggregates for no reviews', () => {
    const e = buildUniversityExtras([])
    expect(e.topPrograms).toEqual([])
    expect(e.programCount).toBe(0)
    expect(e.degreeLevels).toEqual([])
    expect(e.funding).toEqual([])
    expect(e.fundingAnswered).toBe(0)
    expect(e.scholarshipPct).toBeNull()
    expect(e.reportedLanguages).toEqual([])
    expect(e.photos).toEqual([])
  })

  it('ranks programs by count and collects their degree levels', () => {
    const e = buildUniversityExtras([
      { ...base, program: 'Computer Science', degree_level: 'Master' },
      { ...base, program: 'Economics', degree_level: 'Bachelor' },
      { ...base, program: 'Computer Science', degree_level: 'PhD' },
      { ...base, program: 'Computer Science', degree_level: 'Master' },
      { ...base, program: '  ', degree_level: 'Bachelor' },
      { ...base, program: null },
    ])
    expect(e.programCount).toBe(2)
    expect(e.topPrograms[0]).toEqual({
      name: 'Computer Science',
      count: 3,
      levels: ['Master', 'PhD'],
    })
    expect(e.topPrograms[1]).toEqual({ name: 'Economics', count: 1, levels: ['Bachelor'] })
    expect(e.degreeLevels.map((d) => d.level)).toEqual(['Bachelor', 'Master', 'PhD'])
  })

  it('computes funding mix, coverage share, and scholarship percentage', () => {
    const e = buildUniversityExtras([
      { ...base, funding_type: 'csc', funding_coverage: 'full' },
      { ...base, funding_type: 'csc', funding_coverage: 'partial' },
      { ...base, funding_type: 'school', funding_coverage: 'full' },
      { ...base, funding_type: 'self' },
      { ...base }, // no answer — excluded from percentages
    ])
    expect(e.fundingAnswered).toBe(4)
    expect(e.scholarshipPct).toBe(75)
    expect(e.funding[0]).toMatchObject({ type: 'csc', count: 2, pct: 50, fullPct: 50 })
    expect(e.funding.map((f) => f.type)).toEqual(['csc', 'school', 'self'])
  })

  it('reports languages ordered by frequency', () => {
    const e = buildUniversityExtras([
      { ...base, language_of_instruction: 'Chinese (Mandarin)' },
      { ...base, language_of_instruction: 'English' },
      { ...base, language_of_instruction: 'English' },
    ])
    expect(e.reportedLanguages).toEqual(['English', 'Chinese (Mandarin)'])
  })

  it('flattens image media, skips videos and malformed items, caps at 8', () => {
    const media = [
      { url: 'https://x/1.jpg', type: 'image', name: 'a' },
      { url: 'https://x/2.mp4', type: 'video', name: 'v' },
      'https://x/3.png',
      'https://x/clip.mov',
      { nope: true },
    ]
    const e = buildUniversityExtras([
      { ...base, media },
      ...Array.from({ length: 8 }, (_, i) => ({
        ...base,
        media: [{ url: `https://x/extra-${i}.jpg`, type: 'image' }],
      })),
    ])
    expect(e.photos[0]).toEqual({ url: 'https://x/1.jpg', name: 'a' })
    expect(e.photos[1]).toEqual({ url: 'https://x/3.png', name: '' })
    expect(e.photos).toHaveLength(8)
  })
})
