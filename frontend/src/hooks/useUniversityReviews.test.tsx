import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useUniversityReviews, REVIEW_PAGE_SIZE } from './useUniversityReviews'

// Chainable supabase stub: every builder call returns the same chain and
// records its args; awaiting the chain resolves `result`. `then` must stay
// undefined or the await machinery hangs.
const { calls, setResult, supabaseMock } = vi.hoisted(() => {
  const calls: { method: string; table: string; args: unknown[] }[] = []
  let result: { data: unknown; error: unknown; count: number | null } = {
    data: [],
    error: null,
    count: 0,
  }
  const makeChain = (table: string): object =>
    new Proxy(
      { table },
      {
        get(target, prop) {
          if (prop === 'then') return undefined
          if (prop === 'data' || prop === 'error' || prop === 'count')
            return result[prop as keyof typeof result]
          if (prop === 'table') return target.table
          const method = String(prop)
          return vi.fn((...args: unknown[]) => {
            calls.push({ method, table: target.table, args })
            return makeChain(table)
          })
        },
      }
    )
  return {
    calls,
    setResult: (r: typeof result) => {
      result = r
    },
    supabaseMock: { from: vi.fn((table: string) => makeChain(table)) },
  }
})

const pdMock = vi.hoisted(() => ({ payload: null as unknown }))

vi.mock('../lib/supabaseClient', () => ({ supabase: supabaseMock }))
vi.mock('../lib/prerenderData', () => ({
  usePrerenderData: () => pdMock.payload,
}))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))

const makeReview = (i: number) => ({
  id: `r${i}`,
  university_id: 'uni-1',
  user_id: null,
  rating: 4,
  created_at: `2025-0${Math.min(i, 9)}-01T00:00:00Z`,
})

const seededPayload = (reviewCount: number) => ({
  university: { id: 'uni-1', slug: 'tsinghua-university' },
  reviews: Array.from({ length: reviewCount }, (_, i) => makeReview(i + 1)),
  authors: {},
  stats: null,
})

describe('useUniversityReviews', () => {
  it('slices the hydrated payload client-side for the requested page — no fetch', async () => {
    pdMock.payload = seededPayload(7)
    calls.length = 0
    const { result } = renderHook(() => useUniversityReviews('uni-1', 2))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.reviews).toHaveLength(2)
    expect(result.current.reviews[0].id).toBe('r6')
    expect(result.current.totalCount).toBe(7)
    expect(result.current.pageCount).toBe(2)
    // The whole point of the seeded path: zero review queries fire.
    expect(calls.filter((c) => c.table === 'reviews')).toHaveLength(0)
  })

  it('fetches non-hydrated pages with range + exact count + id tiebreak', async () => {
    pdMock.payload = null
    calls.length = 0
    setResult({ data: [makeReview(11)], error: null, count: 21 })

    const { result } = renderHook(() => useUniversityReviews('uni-1', 3))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(calls).toContainEqual(
      expect.objectContaining({
        table: 'reviews',
        method: 'range',
        args: [(3 - 1) * REVIEW_PAGE_SIZE, 3 * REVIEW_PAGE_SIZE - 1],
      })
    )
    expect(calls).toContainEqual(
      expect.objectContaining({
        table: 'reviews',
        method: 'order',
        args: ['id', { ascending: false }],
      })
    )
    expect(result.current.totalCount).toBe(21)
    expect(result.current.pageCount).toBe(Math.ceil(21 / REVIEW_PAGE_SIZE))
  })

  it('batches comment and upvote lookups for the visible ids', async () => {
    pdMock.payload = null
    calls.length = 0
    setResult({ data: [makeReview(1), makeReview(2)], error: null, count: 2 })

    const { result } = renderHook(() => useUniversityReviews('uni-1', 1))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(result.current.upvotes['r1']).toEqual({ count: 0, upvoted: false }))

    const inCalls = calls.filter((c) => c.method === 'in')
    expect(inCalls).toContainEqual(
      expect.objectContaining({ table: 'comments', args: ['review_id', ['r1', 'r2']] })
    )
    expect(inCalls).toContainEqual(
      expect.objectContaining({ table: 'upvotes', args: ['review_id', ['r1', 'r2']] })
    )
  })
})
