import { describe, it, expect } from 'vitest'
import { reviewToWizardState, type EditableReview } from './reviewEdit'

const baseReview: EditableReview = {
  id: 'r1',
  university_id: 'u1',
  user_id: 'me',
  rating: 4,
  text: 'Solid program, brutal winters.',
  program: 'Computer Science',
  degree_level: 'Bachelor',
  media: [
    { url: 'https://x.supabase.co/storage/v1/object/public/review-media/a.jpg', type: 'image' },
  ],
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  deleted_at: null,
  enrollment_status: 'current',
  start_year: 2022,
  end_year: null,
  language_of_instruction: 'English',
  tuition_range: '10k–20k CNY',
  living_cost_range: '2k–4k CNY',
  funding_type: 'self',
  funding_coverage: null,
  recommend: 'yes',
  pros: 'Great labs',
  cons: 'Slow admin',
  tags: ['Strong CS'],
  rating_academics: 5,
  rating_campus: null,
  rating_accommodation: 3,
  rating_cost: null,
  rating_intl_office: null,
  rating_social: null,
  rating_extracurricular: null,
  rating_career: 4,
  universities: { name: 'Tsinghua University', city: 'Beijing', slug: 'tsinghua-university' },
} as EditableReview

describe('reviewToWizardState', () => {
  it('maps stored fields into wizard state', () => {
    const s = reviewToWizardState(baseReview)
    expect(s.rating).toBe(4)
    expect(s.reviewText).toBe('Solid program, brutal winters.')
    expect(s.program).toBe('Computer Science')
    expect(s.enrollmentStatus).toBe('current')
    expect(s.startYear).toBe(2022)
    expect(s.tags).toEqual(['Strong CS'])
    expect(s.media).toHaveLength(1)
    expect(s.universityLabel).toBe('Tsinghua University — Beijing')
  })

  it('keeps only set subscores', () => {
    const s = reviewToWizardState(baseReview)
    expect(s.subscores).toEqual({
      rating_academics: 5,
      rating_accommodation: 3,
      rating_career: 4,
    })
    expect(s.subscores).not.toHaveProperty('rating_campus')
  })

  it('maps nulls to empty wizard values — never fabricates them', () => {
    const s = reviewToWizardState({
      ...baseReview,
      end_year: 2026,
      pros: null,
      tags: null,
      media: null,
      universities: null,
    } as EditableReview)
    expect(s.endYear).toBe(2026)
    expect(s.pros).toBe('')
    expect(s.tags).toEqual([])
    expect(s.media).toEqual([])
    expect(s.universityLabel).toBe('')
  })
})
