import { describe, it, expect } from 'vitest'
import {
  compareReviews,
  countByReviewId,
  isReviewSort,
  isServerSortable,
  sortReviews,
} from './reviewSort'

const r = (id: string, rating: number, created_at: string | null) => ({ id, rating, created_at })

// Deliberately unsorted fixture: r1 newest, r2 oldest, r3 middle.
const reviews = [
  r('r2', 5, '2025-01-01T00:00:00Z'),
  r('r3', 1, '2025-03-01T00:00:00Z'),
  r('r1', 3, '2025-05-01T00:00:00Z'),
]

describe('sortReviews', () => {
  it('newest sorts by created_at desc', () => {
    expect(sortReviews(reviews, 'newest').map((x) => x.id)).toEqual(['r1', 'r3', 'r2'])
  })

  it('highest sorts by rating desc with recency tiebreak', () => {
    const tied = [
      r('a', 4, '2025-02-01T00:00:00Z'),
      r('b', 4, '2025-04-01T00:00:00Z'),
      r('c', 2, '2025-06-01T00:00:00Z'),
    ]
    expect(sortReviews(tied, 'highest').map((x) => x.id)).toEqual(['b', 'a', 'c'])
  })

  it('lowest sorts by rating asc', () => {
    expect(sortReviews(reviews, 'lowest').map((x) => x.id)).toEqual(['r3', 'r1', 'r2'])
  })

  it('helpful sorts by upvote count, falling back to recency on ties and zeros', () => {
    const counts = { r2: 5, r1: 5 } // r3 has none
    expect(sortReviews(reviews, 'helpful', counts).map((x) => x.id)).toEqual(['r1', 'r2', 'r3'])
  })

  it('uses id desc as the final deterministic tiebreak', () => {
    const sameTime = [r('a', 3, '2025-01-01T00:00:00Z'), r('b', 3, '2025-01-01T00:00:00Z')]
    expect(sortReviews(sameTime, 'newest').map((x) => x.id)).toEqual(['b', 'a'])
  })

  it('does not mutate the input array', () => {
    const input = [...reviews]
    sortReviews(input, 'lowest')
    expect(input.map((x) => x.id)).toEqual(['r2', 'r3', 'r1'])
  })

  it('tolerates null created_at', () => {
    const withNull = [r('n', 3, null), r('m', 3, '2025-01-01T00:00:00Z')]
    expect(sortReviews(withNull, 'newest').map((x) => x.id)).toEqual(['m', 'n'])
    expect(compareReviews(withNull[0], withNull[1], 'helpful', {})).toBeGreaterThan(0)
  })
})

describe('isReviewSort / isServerSortable', () => {
  it('validates sort values', () => {
    expect(isReviewSort('helpful')).toBe(true)
    expect(isReviewSort('bogus')).toBe(false)
  })

  it('marks only helpful as client-ranked', () => {
    expect(isServerSortable('helpful')).toBe(false)
    expect(isServerSortable('highest')).toBe(true)
  })
})

describe('countByReviewId', () => {
  it('counts rows per review_id and handles empty input', () => {
    expect(
      countByReviewId([{ review_id: 'r1' }, { review_id: 'r2' }, { review_id: 'r1' }])
    ).toEqual({ r1: 2, r2: 1 })
    expect(countByReviewId(null)).toEqual({})
  })
})
