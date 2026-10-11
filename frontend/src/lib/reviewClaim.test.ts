import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getStoredClaimToken,
  getOrCreateClaimToken,
  createBoostToken,
  storeBoostToken,
  getBoostToken,
  listBoostTokens,
  dropBoostToken,
  BOOST_TOKEN_RE,
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

const REVIEW_ID = '11111111-2222-4333-8444-555555555555'
const BOOST_KEY = 'trc_boost_tokens'

describe('boost token', () => {
  it('mints a 43-char base64url token from the CSPRNG', () => {
    const token = createBoostToken()
    expect(token).toMatch(BOOST_TOKEN_RE)
    expect(token).not.toBe(createBoostToken()) // per-review, not reused
  })

  it('returns null instead of a weak token when Web Crypto is missing', () => {
    vi.stubGlobal('crypto', { subtle: undefined })
    expect(createBoostToken()).toBeNull()
    vi.unstubAllGlobals()
  })

  it('stores and reads tokens per review', () => {
    const a = createBoostToken()!
    const b = createBoostToken()!
    storeBoostToken(REVIEW_ID, a)
    storeBoostToken('99999999-9999-4999-8999-999999999999', b)

    expect(getBoostToken(REVIEW_ID)).toBe(a)
    expect(getBoostToken('99999999-9999-4999-8999-999999999999')).toBe(b)
    expect(getBoostToken('00000000-0000-4000-8000-000000000001')).toBeNull()
    expect(listBoostTokens().sort()).toEqual([a, b].sort())
  })

  it('rejects malformed review ids and tokens instead of storing them', () => {
    const token = createBoostToken()!
    storeBoostToken('not-a-review', token)
    storeBoostToken(REVIEW_ID, 'too-short')
    expect(getBoostToken(REVIEW_ID)).toBeNull()
    expect(listBoostTokens()).toEqual([])
  })

  it('drops poisoned storage entries without trusting them', () => {
    localStorage.setItem(
      BOOST_KEY,
      JSON.stringify({
        [REVIEW_ID]: 'bad!token',
        'not-an-id': 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        '99999999-9999-4999-8999-999999999999': 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      })
    )
    expect(getBoostToken(REVIEW_ID)).toBeNull()
    expect(listBoostTokens()).toEqual(['AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'])
  })

  it('tolerates corrupt JSON in storage', () => {
    localStorage.setItem(BOOST_KEY, '{not json')
    expect(getBoostToken(REVIEW_ID)).toBeNull()
    expect(listBoostTokens()).toEqual([])
  })

  it('drops a single review token', () => {
    storeBoostToken(REVIEW_ID, createBoostToken()!)
    storeBoostToken('99999999-9999-4999-8999-999999999999', createBoostToken()!)
    dropBoostToken(REVIEW_ID)
    expect(getBoostToken(REVIEW_ID)).toBeNull()
    expect(listBoostTokens()).toHaveLength(1)
  })
})

describe('review-claim api', () => {
  it('list posts the stored token and returns the review set', async () => {
    localStorage.setItem(TOKEN_KEY, VALID_TOKEN)
    storeBoostToken(REVIEW_ID, createBoostToken()!)
    const reviews = [{ reviewId: 'r1', rating: 5, text: 'x', matchedBy: 'device' }]
    invokeMock.mockResolvedValue({ data: { reviews }, error: null })

    const result = await listClaimableReviews()

    expect(invokeMock).toHaveBeenCalledWith('review-claim', {
      body: {
        action: 'list',
        claimToken: VALID_TOKEN,
        boostTokens: [getBoostToken(REVIEW_ID)],
      },
    })
    expect(result).toEqual(reviews)
  })

  it('list sends null token when the browser has none (email-only match)', async () => {
    invokeMock.mockResolvedValue({ data: { reviews: [] }, error: null })

    await listClaimableReviews()

    expect(invokeMock).toHaveBeenCalledWith('review-claim', {
      body: { action: 'list', claimToken: null, boostTokens: [] },
    })
  })

  it('resolve sends reviewId + decision + tokens', async () => {
    localStorage.setItem(TOKEN_KEY, VALID_TOKEN)
    const boostToken = createBoostToken()!
    storeBoostToken(REVIEW_ID, boostToken)
    invokeMock.mockResolvedValue({ data: { resolved: true }, error: null })

    await resolveClaim(REVIEW_ID, 'anonymous')

    expect(invokeMock).toHaveBeenCalledWith('review-claim', {
      body: {
        action: 'resolve',
        reviewId: REVIEW_ID,
        decision: 'anonymous',
        claimToken: VALID_TOKEN,
        boostToken,
      },
    })
    // A resolved review's capability is dead locally too.
    expect(getBoostToken(REVIEW_ID)).toBeNull()
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
