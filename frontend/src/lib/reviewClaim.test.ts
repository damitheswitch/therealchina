import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getStoredClaimToken,
  getOrCreateClaimToken,
  listClaimableReviews,
  listAnonymousOwnedIds,
  resolveClaim,
  mergeMyReviews,
} from './reviewClaim'

// supabase-js stub: functions.invoke is the only surface reviewClaim touches.
const invokeMock = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabaseClient', () => ({
  supabase: { functions: { invoke: invokeMock } },
}))

const TOKEN_KEY = 'trc_review_claim_token'
// Low-entropy fixture: a real-looking UUID secret would trip secret scanners.
const VALID_TOKEN = '00000000-0000-4000-8000-000000000001'

beforeEach(() => {
  localStorage.clear()
  invokeMock.mockReset()
})

describe('claim token', () => {
  it('mints a valid UUID once and reuses it on later calls', () => {
    const first = getOrCreateClaimToken()
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(getOrCreateClaimToken()).toBe(first)
    expect(localStorage.getItem(TOKEN_KEY)).toBe(first)
  })

  it('replaces a malformed stored token instead of trusting it', () => {
    localStorage.setItem(TOKEN_KEY, 'not-a-uuid')
    const token = getOrCreateClaimToken()
    expect(token).not.toBe('not-a-uuid')
    expect(localStorage.getItem(TOKEN_KEY)).toBe(token)
  })

  it('getStoredClaimToken never mints — null when absent or malformed', () => {
    expect(getStoredClaimToken()).toBeNull()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()

    localStorage.setItem(TOKEN_KEY, 'garbage')
    expect(getStoredClaimToken()).toBeNull()

    localStorage.setItem(TOKEN_KEY, VALID_TOKEN)
    expect(getStoredClaimToken()).toBe(VALID_TOKEN)
  })
})

describe('review-claim api', () => {
  it('list posts the stored token and returns the review set', async () => {
    localStorage.setItem(TOKEN_KEY, VALID_TOKEN)
    const reviews = [{ reviewId: 'r1', rating: 5, text: 'x', matchedBy: 'device' }]
    invokeMock.mockResolvedValue({ data: { reviews }, error: null })

    const result = await listClaimableReviews()

    expect(invokeMock).toHaveBeenCalledWith('review-claim', {
      body: { action: 'list', claimToken: VALID_TOKEN },
    })
    expect(result).toEqual(reviews)
  })

  it('list sends null token when the browser has none (email-only match)', async () => {
    invokeMock.mockResolvedValue({ data: { reviews: [] }, error: null })

    await listClaimableReviews()

    expect(invokeMock).toHaveBeenCalledWith('review-claim', {
      body: { action: 'list', claimToken: null },
    })
  })

  it('resolve sends reviewId + decision + token', async () => {
    localStorage.setItem(TOKEN_KEY, VALID_TOKEN)
    invokeMock.mockResolvedValue({ data: { resolved: true }, error: null })

    await resolveClaim('r1', 'anonymous')

    expect(invokeMock).toHaveBeenCalledWith('review-claim', {
      body: { action: 'resolve', reviewId: 'r1', decision: 'anonymous', claimToken: VALID_TOKEN },
    })
  })

  it('mine returns the owned review ids', async () => {
    invokeMock.mockResolvedValue({ data: { reviewIds: ['a', 'b'] }, error: null })

    expect(await listAnonymousOwnedIds()).toEqual(['a', 'b'])
    expect(invokeMock).toHaveBeenCalledWith('review-claim', { body: { action: 'mine' } })
  })

  it('surfaces the function error message', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: 'rate limited' } })

    await expect(listClaimableReviews()).rejects.toThrow('rate limited')
  })
})

describe('mergeMyReviews', () => {
  const row = (id: string, created_at: string | null) => ({ id, created_at })

  it('sorts the union newest-first and dedupes by id', () => {
    const own = [row('a', '2025-03-01'), row('b', '2025-01-01')]
    const claimed = [row('c', '2025-02-01'), row('a', '2025-03-01')]

    expect(mergeMyReviews(own, claimed).map((r) => r.id)).toEqual(['a', 'c', 'b'])
  })

  it('tolerates null created_at without breaking the order', () => {
    const own = [row('a', null)]
    const claimed = [row('b', '2025-02-01')]

    expect(mergeMyReviews(own, claimed).map((r) => r.id)).toEqual(['b', 'a'])
  })
})
