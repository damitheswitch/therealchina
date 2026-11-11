import { describe, expect, it, vi } from 'vitest'

// reviewDetail pulls in the Supabase client, which throws on import without
// env vars (CI has none). The helpers under test never touch it.
vi.mock('./supabaseClient', () => ({ supabase: {} }))
import { giftHeadline, giftSteps } from './giftProgress'
import type { RewardEvaluation } from './reviewReward'

const evaluation = (missing: RewardEvaluation['missing'], ownUnits = 0): RewardEvaluation => ({
  full: missing.length === 0,
  missing,
  ownUnits,
  areas: [],
})

describe('giftSteps', () => {
  it('starts with one step already done', () => {
    const steps = giftSteps({ rating: 0, polarityTaps: 0, filledAreas: 0 })
    expect(steps.filter((s) => s.done).map((s) => s.key)).toEqual(['started'])
  })

  it('follows the server rule when the gift is on', () => {
    const steps = giftSteps({
      rating: 4,
      polarityTaps: 0,
      filledAreas: 0,
      evaluation: evaluation(['words', 'money'] as RewardEvaluation['missing'], 4),
    })
    expect(steps.map((s) => [s.key, s.done])).toEqual([
      ['started', true],
      ['rating', true],
      ['taps', true],
      ['words', false],
      ['ratings', true],
      ['money', false],
      ['program', true],
    ])
    expect(steps.find((s) => s.key === 'words')?.label).toContain('(4/')
  })

  it('leads to the gold highlight when the gift is off', () => {
    const steps = giftSteps({ rating: 5, polarityTaps: 2, filledAreas: 3 })
    expect(steps.every((s) => s.done)).toBe(true)
  })
})

describe('giftHeadline', () => {
  it('counts down to the last step', () => {
    const steps = giftSteps({ rating: 5, polarityTaps: 2, filledAreas: 1 })
    expect(giftHeadline(steps, false)).toBe('One step left to open your red envelope.')
  })

  it('names the gift once everything is done', () => {
    const steps = giftSteps({ rating: 5, polarityTaps: 2, filledAreas: 3 })
    expect(giftHeadline(steps, true)).toBe('Opened: your free VPN gift is ready.')
    expect(giftHeadline(steps, false)).toBe('Opened: your review gets the gold highlight.')
  })
})
