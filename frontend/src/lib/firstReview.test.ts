import { describe, expect, it } from 'vitest'
import { earliestReviewId } from './firstReview'

describe('earliestReviewId', () => {
  it('returns null for no reviews', () => {
    expect(earliestReviewId([])).toBeNull()
  })

  it('picks the oldest review regardless of input order', () => {
    expect(
      earliestReviewId([
        { id: 'b', created_at: '2025-03-01T00:00:00Z' },
        { id: 'a', created_at: '2024-01-01T00:00:00Z' },
        { id: 'c', created_at: '2026-01-01T00:00:00Z' },
      ])
    ).toBe('a')
  })

  it('breaks timestamp ties by the lower id', () => {
    expect(
      earliestReviewId([
        { id: 'z', created_at: '2024-01-01T00:00:00Z' },
        { id: 'm', created_at: '2024-01-01T00:00:00Z' },
      ])
    ).toBe('m')
  })
})
