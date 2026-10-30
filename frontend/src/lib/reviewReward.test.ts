import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

// reviewFlow.ts pulls in reviewDrafts.ts, which imports the Supabase client;
// mock it so CI (no env vars) can load the module.
vi.mock('./supabaseClient', () => ({ supabase: {} }))
import {
  describeMissing,
  evaluateReward,
  rewardConfirmation,
  suggestEmailFix,
  type RewardReviewRow,
} from './reviewReward'

interface Fixture {
  name: string
  row: RewardReviewRow
  expect: { full: boolean; missing: string[] }
}

// The same fixtures the Deno tests run, so the client mirror cannot drift from
// the server rule.
const fixtures: { cases: Fixture[] } = JSON.parse(
  readFileSync(resolve(process.cwd(), '../supabase/functions/_shared/reward.fixtures.json'), 'utf8')
)

describe('full-review rule mirrors the server', () => {
  for (const c of fixtures.cases) {
    it(c.name, () => {
      const result = evaluateReward(c.row)
      expect(result.full).toBe(c.expect.full)
      expect(result.missing).toEqual(c.expect.missing)
    })
  }
})

describe('describeMissing', () => {
  it('joins the missing parts in plain words', () => {
    expect(describeMissing(['taps'])).toBe('2 taps on What stood out')
    expect(describeMissing(['words', 'taps'])).toBe(
      'more of your own words and 2 taps on What stood out'
    )
  })
})

describe('suggestEmailFix', () => {
  it('fixes a near miss on a common domain', () => {
    expect(suggestEmailFix('li@gmial.com')).toBe('li@gmail.com')
    expect(suggestEmailFix('wei@qq.cm')).toBe('wei@qq.com')
  })

  it('leaves correct or unrelated addresses alone', () => {
    expect(suggestEmailFix('li@gmail.com')).toBeNull()
    expect(suggestEmailFix('li@my-university.edu.cn')).toBeNull()
    expect(suggestEmailFix('not an email')).toBeNull()
  })
})

describe('rewardConfirmation', () => {
  it('includes the gift code once the email is sent', () => {
    expect(rewardConfirmation({ state: 'sent', code: 'TRC-7K3F2A' }, 'a@b.c')).toContain(
      'TRC-7K3F2A'
    )
  })

  it('tells a waiting reviewer what to add', () => {
    expect(rewardConfirmation({ state: 'waiting', missing: ['taps'] }, 'a@b.c')).toContain(
      '2 taps on What stood out'
    )
  })

  it('stays silent when the offer is off', () => {
    expect(rewardConfirmation({ state: 'off' }, 'a@b.c')).toBeNull()
    expect(rewardConfirmation(undefined, 'a@b.c')).toBeNull()
  })

  it('has no em or en dashes in any message', () => {
    const states = [
      'sent',
      'waiting',
      'email_used',
      'email_blocked',
      'failed',
      'paused',
      'declined',
    ] as const
    for (const state of states) {
      const line = rewardConfirmation({ state, code: 'TRC-AAAAAA' }, 'a@b.c') ?? ''
      expect(/[–—]/.test(line)).toBe(false)
    }
  })
})
