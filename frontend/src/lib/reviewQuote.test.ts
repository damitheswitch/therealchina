import { describe, expect, it } from 'vitest'
import { pickNewestQuote, pickTopQuote, truncateQuote } from './reviewQuote'

const r = (id: string, text: string | null, votes: number, created_at: string) => ({
  id,
  rating: 4,
  text,
  upvote_count: votes,
  created_at,
})
const LONG = 'The dorms were clean and the teachers were helpful.'

describe('truncateQuote', () => {
  it('leaves short text alone', () => {
    expect(truncateQuote('Short and sweet.', 140)).toBe('Short and sweet.')
  })

  it('cuts at a word boundary with an ellipsis', () => {
    const out = truncateQuote('word '.repeat(60), 50)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(51)
    expect(out).not.toMatch(/wor…$/)
  })
})

describe('pickTopQuote', () => {
  it('prefers the most upvoted review with text', () => {
    const top = pickTopQuote([
      r('a', LONG, 1, '2025-01-01'),
      r('b', LONG, 5, '2024-01-01'),
      r('c', null, 9, '2026-01-01'),
    ])
    expect(top?.id).toBe('b')
  })

  it('falls back to the newest on equal votes', () => {
    const top = pickTopQuote([r('a', LONG, 0, '2025-01-01'), r('b', LONG, 0, '2026-01-01')])
    expect(top?.id).toBe('b')
  })

  it('returns null when nothing has text', () => {
    expect(pickTopQuote([r('a', null, 3, '2025-01-01'), r('b', 'ok', 1, '2025-01-02')])).toBeNull()
  })
})

describe('pickNewestQuote', () => {
  it('skips reviews without text', () => {
    expect(
      pickNewestQuote([r('a', LONG, 0, '2025-01-01'), r('b', null, 0, '2026-01-01')])?.id
    ).toBe('a')
  })
})
