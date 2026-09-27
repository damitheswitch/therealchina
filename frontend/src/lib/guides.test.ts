import { describe, it, expect } from 'vitest'
import { GUIDES, guideBySlug, guideReadTime } from './guides'

describe('guides', () => {
  it('every guide is well-formed and findable by slug', () => {
    for (const g of GUIDES) {
      expect(g.slug).toBeTruthy()
      expect(g.title).toBeTruthy()
      expect(g.description).toBeTruthy()
      expect(g.sections.length).toBeGreaterThan(0)
      expect(guideBySlug(g.slug)).toBe(g)
    }
  })

  it('read time is a positive integer', () => {
    for (const g of GUIDES) {
      const t = guideReadTime(g)
      expect(Number.isInteger(t)).toBe(true)
      expect(t).toBeGreaterThanOrEqual(1)
    }
  })

  it('read time scales with word count and floors at 1', () => {
    const tiny = {
      ...GUIDES[0],
      sections: [{ h: 'x', id: 'x', body: ['one two three'] }],
    }
    expect(guideReadTime(tiny)).toBe(1)

    const words = 'word '.repeat(600).trim()
    const long = { ...GUIDES[0], sections: [{ h: 'x', id: 'x', body: [words] }] }
    expect(guideReadTime(long)).toBe(3)
  })
})
