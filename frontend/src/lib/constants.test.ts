import { describe, it, expect } from 'vitest'
import { COUNTRIES, LANGUAGES, CURRENT_STATUSES } from './constants'

describe('constants', () => {
  it('has no duplicate countries or languages', () => {
    expect(new Set(COUNTRIES).size).toBe(COUNTRIES.length)
    expect(new Set(LANGUAGES).size).toBe(LANGUAGES.length)
  })

  it('current_status values match the profiles CHECK constraint', () => {
    // CHECK: studying|working|internship|job_hunting|break|other
    expect(CURRENT_STATUSES.map((s) => s.value).sort()).toEqual(
      ['studying', 'working', 'internship', 'job_hunting', 'break', 'other'].sort()
    )
    for (const s of CURRENT_STATUSES) {
      expect(s.label.length).toBeGreaterThan(0)
    }
  })
})
