import { describe, it, expect } from 'vitest'
import { indexableByReviews, isSubstantiveReview, SUBSTANTIVE_REVIEW_CHARS } from './indexable'

const longText = 'x'.repeat(SUBSTANTIVE_REVIEW_CHARS)

describe('isSubstantiveReview', () => {
  it('needs at least 200 trimmed chars', () => {
    expect(isSubstantiveReview(longText)).toBe(true)
    expect(isSubstantiveReview('x'.repeat(SUBSTANTIVE_REVIEW_CHARS - 1))).toBe(false)
    expect(isSubstantiveReview(null)).toBe(false)
    expect(isSubstantiveReview(undefined)).toBe(false)
    expect(isSubstantiveReview('')).toBe(false)
  })
})

describe('indexableByReviews', () => {
  it('is false for empty or missing reviews', () => {
    expect(indexableByReviews([])).toBe(false)
    expect(indexableByReviews(null)).toBe(false)
    expect(indexableByReviews(undefined)).toBe(false)
  })

  it('indexes on two substantive reviews', () => {
    const reviews = [{ text: longText }, { text: longText }]
    expect(indexableByReviews(reviews)).toBe(true)
  })

  it('indexes on three reviews with written text', () => {
    const reviews = [{ text: 'short but real' }, { text: 'also real' }, { text: 'and this' }]
    expect(indexableByReviews(reviews)).toBe(true)
  })

  it('does not count quick ratings (null text) toward any threshold', () => {
    const quick = { text: null, review_kind: 'quick' }
    expect(indexableByReviews([quick, quick, quick, quick])).toBe(false)
    // Two substantive + two quick: only the substantive threshold can qualify.
    expect(indexableByReviews([{ text: longText }, { text: longText }, quick, quick])).toBe(true)
    // Two short-text + two quick would previously pass the 3-row count.
    expect(indexableByReviews([{ text: 'real' }, { text: 'real too' }, quick, quick])).toBe(false)
  })

  it('treats whitespace-only text as no text', () => {
    expect(indexableByReviews([{ text: '   ' }, { text: '\n\t' }, { text: ' ' }])).toBe(false)
  })

  it('reads review_kind as the text signal on slim aggregate rows', () => {
    // Client-side aggregate rows carry review_kind instead of text.
    const slim = [{ review_kind: 'full' }, { review_kind: 'full' }, { review_kind: 'full' }]
    expect(indexableByReviews(slim)).toBe(true)
    const mixed = [{ review_kind: 'full' }, { review_kind: 'quick' }, { review_kind: 'quick' }]
    expect(indexableByReviews(mixed)).toBe(false)
  })

  it('does not index one substantive plus two quick ratings', () => {
    expect(
      indexableByReviews([
        { text: longText, review_kind: 'full' },
        { text: null, review_kind: 'quick' },
        { text: null, review_kind: 'quick' },
      ])
    ).toBe(false)
  })
})
