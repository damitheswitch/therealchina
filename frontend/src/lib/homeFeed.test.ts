import { describe, it, expect } from 'vitest'
import { pickFirstReviewCandidates, reviewedOnly } from './homeFeed'

const uni = (name: string, review_count: number, rank?: number) => ({
  name,
  review_count,
  rankings: rank === undefined ? null : { shanghai_national: rank },
})

describe('reviewedOnly', () => {
  it('drops universities without reviews', () => {
    const rows = [uni('A', 3), uni('B', 0), uni('C', 1)]
    expect(reviewedOnly(rows).map((u) => u.name)).toEqual(['A', 'C'])
  })

  it('falls back to every row when nothing is reviewed yet', () => {
    const rows = [uni('A', 0), uni('B', 0)]
    expect(reviewedOnly(rows)).toHaveLength(2)
  })
})

describe('pickFirstReviewCandidates', () => {
  it('keeps only unreviewed universities, best national rank first', () => {
    const rows = [uni('Unranked', 0), uni('Reviewed', 5, 1), uni('Rank9', 0, 9), uni('Rank2', 0, 2)]
    expect(pickFirstReviewCandidates(rows).map((u) => u.name)).toEqual([
      'Rank2',
      'Rank9',
      'Unranked',
    ])
  })

  it('respects the limit', () => {
    const rows = Array.from({ length: 10 }, (_, i) => uni(`U${i}`, 0, i + 1))
    expect(pickFirstReviewCandidates(rows, 4)).toHaveLength(4)
  })
})
