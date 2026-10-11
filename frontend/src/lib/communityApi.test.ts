import { describe, it, expect, vi } from 'vitest'
import { timeAgo, bodyToParagraphs } from './communityApi'

// communityApi imports supabaseClient at module load; stub it so the lib can
// be unit-tested without env vars.
vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() } },
}))

describe('timeAgo', () => {
  const now = new Date('2026-10-11T12:00:00Z').getTime()

  it('says "just now" under an hour', () => {
    expect(timeAgo('2026-10-11T11:45:00Z', now)).toBe('just now')
  })

  it('uses hours under a day', () => {
    expect(timeAgo('2026-10-11T09:00:00Z', now)).toBe('3h ago')
  })

  it('uses days under a month', () => {
    expect(timeAgo('2026-10-09T12:00:00Z', now)).toBe('2d ago')
  })

  it('uses months under a year', () => {
    expect(timeAgo('2026-08-11T12:00:00Z', now)).toBe('2mo ago')
  })

  it('uses years beyond that', () => {
    expect(timeAgo('2024-10-01T12:00:00Z', now)).toBe('2y ago')
  })

  it('never goes negative on clock skew', () => {
    expect(timeAgo('2026-10-12T12:00:00Z', now)).toBe('just now')
  })
})

describe('bodyToParagraphs', () => {
  it('splits on blank lines and trims', () => {
    expect(bodyToParagraphs('First part.\n\n\n  Second part.  \n\nThird.')).toEqual([
      'First part.',
      'Second part.',
      'Third.',
    ])
  })

  it('keeps single newlines inside a paragraph', () => {
    expect(bodyToParagraphs('line one\nline two')).toEqual(['line one\nline two'])
  })

  it('returns an empty array for blank input', () => {
    expect(bodyToParagraphs('   \n\n  ')).toEqual([])
  })
})
