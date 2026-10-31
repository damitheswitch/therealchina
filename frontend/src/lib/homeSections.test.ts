import { describe, it, expect, vi } from 'vitest'

// reviewReward pulls in modules that import the Supabase client, which throws
// without env vars (CI has none).
vi.mock('./supabaseClient', () => ({ supabase: {} }))

import {
  nearestSlide,
  pickLandingReviews,
  pickLogoStrip,
  slideStops,
  stepIndex,
  pickOpenQuestions,
  reviewContextParts,
  type HomeQuestionRow,
  type HomeReviewRow,
} from './homeSections'

const LONG =
  'The dorm was clean and the staff at the international office answered every question I had about my visa and residence permit before I even arrived in the city.'

const review = (over: Partial<HomeReviewRow> & { id: string }): HomeReviewRow => ({
  university_id: `u-${over.id}`,
  rating: 5,
  text: LONG,
  pros: null,
  cons: null,
  tags: null,
  upvote_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  degree_level: null,
  start_year: null,
  end_year: null,
  ...over,
})

describe('pickLandingReviews', () => {
  it('drops reviews whose own words are too short', () => {
    const picks = pickLandingReviews([
      review({ id: 'a', text: 'Great place, loved it so much.' }),
      review({ id: 'b' }),
    ])
    expect(picks.map((p) => p.row.id)).toEqual(['b'])
  })

  it('strips the sentence built from tapped highlights before counting', () => {
    const generated = 'The standouts are strong professors and classes.'
    const picks = pickLandingReviews([
      review({ id: 'a', text: generated, tags: ['Strong academics'] }),
      review({ id: 'b', text: `${LONG} ${generated}`, tags: ['Strong academics'] }),
    ])
    expect(picks).toHaveLength(1)
    expect(picks[0].row.id).toBe('b')
    expect(picks[0].body).not.toContain('standouts')
  })

  it('keeps one review per university', () => {
    const picks = pickLandingReviews([
      review({ id: 'a', university_id: 'u1', upvote_count: 1 }),
      review({ id: 'b', university_id: 'u1', upvote_count: 5 }),
      review({ id: 'c', university_id: 'u2' }),
    ])
    expect(picks.map((p) => p.row.id)).toEqual(['b', 'c'])
  })

  it('ranks by upvotes, then recency', () => {
    const picks = pickLandingReviews([
      review({ id: 'old', created_at: '2025-01-01T00:00:00Z' }),
      review({ id: 'new', created_at: '2026-06-01T00:00:00Z' }),
      review({ id: 'voted', upvote_count: 3, created_at: '2024-01-01T00:00:00Z' }),
    ])
    expect(picks.map((p) => p.row.id)).toEqual(['voted', 'new', 'old'])
  })

  it('caps the set at the requested size', () => {
    const rows = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => review({ id }))
    expect(pickLandingReviews(rows, 4)).toHaveLength(4)
  })

  it('swaps in a 4 or 5 star review when the top picks are all negative', () => {
    const rows = [
      review({ id: 'n1', rating: 1, upvote_count: 9 }),
      review({ id: 'n2', rating: 2, upvote_count: 8 }),
      review({ id: 'n3', rating: 2, upvote_count: 7 }),
      review({ id: 'n4', rating: 3, upvote_count: 6 }),
      review({ id: 'p1', rating: 5, upvote_count: 0 }),
    ]
    const ids = pickLandingReviews(rows, 4).map((p) => p.row.id)
    expect(ids).toHaveLength(4)
    expect(ids).toContain('p1')
    expect(ids).toEqual(['n1', 'n2', 'n3', 'p1'])
  })

  it('leaves an all-negative set alone when no positive review exists', () => {
    const rows = [review({ id: 'n1', rating: 1 }), review({ id: 'n2', rating: 2 })]
    expect(pickLandingReviews(rows)).toHaveLength(2)
  })

  it('returns nothing when no review qualifies', () => {
    expect(pickLandingReviews([review({ id: 'a', text: null })])).toEqual([])
  })
})

describe('reviewContextParts', () => {
  it('lists degree and years when present', () => {
    expect(
      reviewContextParts({ degree_level: "Master's", start_year: 2019, end_year: 2023 })
    ).toEqual(["Master's", '2019 to 2023'])
  })
  it('handles a single year and empty rows', () => {
    expect(reviewContextParts({ degree_level: null, start_year: 2022, end_year: null })).toEqual([
      '2022',
    ])
    expect(reviewContextParts({ degree_level: null, start_year: null, end_year: null })).toEqual([])
  })
})

const question = (over: Partial<HomeQuestionRow> & { id: string }): HomeQuestionRow => ({
  slug: `q-${over.id}`,
  title: `Question ${over.id}`,
  city: null,
  university_name: null,
  university_slug: null,
  answer_count: 0,
  upvote_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  ...over,
})

describe('pickOpenQuestions', () => {
  it('keeps only unanswered questions', () => {
    const picks = pickOpenQuestions([question({ id: 'a', answer_count: 2 }), question({ id: 'b' })])
    expect(picks.map((q) => q.id)).toEqual(['b'])
  })

  it('orders by votes, then newest, and caps at three', () => {
    const picks = pickOpenQuestions([
      question({ id: 'old', created_at: '2025-01-01T00:00:00Z' }),
      question({ id: 'new', created_at: '2026-05-01T00:00:00Z' }),
      question({ id: 'voted', upvote_count: 4 }),
      question({ id: 'extra', created_at: '2024-01-01T00:00:00Z' }),
    ])
    expect(picks.map((q) => q.id)).toEqual(['voted', 'new', 'old'])
  })

  it('returns an empty list when everything is answered', () => {
    expect(pickOpenQuestions([question({ id: 'a', answer_count: 1 })])).toEqual([])
  })
})

describe('pickLogoStrip', () => {
  const row = (id: string, logo_url: string | null) => ({
    id,
    name: `Uni ${id}`,
    slug: `uni-${id}`,
    logo_url,
  })
  const sr = (n: number) => `https://www.shanghairanking.cn/_uni/logo/${n}.png`

  it('keeps only mirrored logos, drops duplicates and caps the list', () => {
    const out = pickLogoStrip(
      [
        row('a', sr(1)),
        row('b', null),
        row('c', 'https://example.com/x.png'),
        row('d', sr(1)),
        row('e', sr(2)),
      ],
      2
    )
    expect(out.map((l) => l.id)).toEqual(['a', 'e'])
    expect(out[0].src).toContain('/logos/1.png')
  })
})

describe('carousel helpers', () => {
  it('steps and wraps in both directions', () => {
    expect(stepIndex(0, 1, 4)).toBe(1)
    expect(stepIndex(3, 1, 4)).toBe(0)
    expect(stepIndex(0, -1, 4)).toBe(3)
    expect(stepIndex(0, 1, 0)).toBe(0)
  })

  it('collapses slides past the scroll range into one final stop', () => {
    expect(slideStops([0, 300, 600, 900], 300)).toEqual([0, 300])
    expect(slideStops([0, 300, 600, 900], 900)).toEqual([0, 300, 600, 900])
    expect(slideStops([0, 300], 0)).toEqual([0])
  })

  it('finds the slide nearest the scroll position', () => {
    const stops = [0, 300, 600, 700]
    expect(nearestSlide(0, 700, stops)).toBe(0)
    expect(nearestSlide(170, 700, stops)).toBe(1)
    expect(nearestSlide(699, 700, stops)).toBe(3)
    expect(nearestSlide(5, 0, [0])).toBe(0)
  })
})
