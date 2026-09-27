import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useUniversityReviews, REVIEW_PAGE_SIZE } from './useUniversityReviews'

// Chainable supabase stub: every builder call returns the same chain and
// records its args; awaiting the chain resolves `result` (or the table-scoped
// override from setTableResult). `then` must stay undefined or the await
// machinery hangs.
const { calls, setResult, setTableResult, clearTableResults, supabaseMock } = vi.hoisted(() => {
  const calls: { method: string; table: string; args: unknown[] }[] = []
  let result: { data: unknown; error: unknown; count: number | null } = {
    data: [],
    error: null,
    count: 0,
  }
  const tableResults: Record<string, typeof result> = {}
  const makeChain = (table: string): object =>
    new Proxy(
      { table },
      {
        get(target, prop) {
          if (prop === 'then') return undefined
          if (prop === 'data' || prop === 'error' || prop === 'count')
            return (tableResults[target.table] ?? result)[prop as keyof typeof result]
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
    setTableResult: (table: string, r: typeof result) => {
      tableResults[table] = r
    },
    clearTableResults: () => {
      for (const k of Object.keys(tableResults)) delete tableResults[k]
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

// Newest-first, like the real prerender payload (export orders created_at
// desc). makeReview's created_at rises with its index, so ids count down.
const seededPayload = (reviewCount: number) => ({
  university: { id: 'uni-1', slug: 'tsinghua-university' },
  reviews: Array.from({ length: reviewCount }, (_, i) => makeReview(reviewCount - i)),
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
    expect(result.current.reviews[0].id).toBe('r2')
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

  it('orders by rating desc with recency + id tiebreaks for the highest sort', async () => {
    pdMock.payload = null
    calls.length = 0
    clearTableResults()
    setResult({ data: [makeReview(1)], error: null, count: 7 })

    const { result } = renderHook(() => useUniversityReviews('uni-1', 1, 'highest'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const orderCalls = calls.filter((c) => c.table === 'reviews' && c.method === 'order')
    expect(orderCalls).toContainEqual(
      expect.objectContaining({ args: ['rating', { ascending: false }] })
    )
    expect(orderCalls).toContainEqual(
      expect.objectContaining({ args: ['created_at', { ascending: false }] })
    )
    expect(orderCalls).toContainEqual(
      expect.objectContaining({ args: ['id', { ascending: false }] })
    )
  })

  it('ranks by upvote count via heads → votes → page-rows fetch for helpful', async () => {
    pdMock.payload = null
    calls.length = 0
    clearTableResults()
    const heads = [makeReview(1), makeReview(2), makeReview(3)]
    setTableResult('reviews', { data: heads, error: null, count: 3 })
    setTableResult('upvotes', {
      data: [{ review_id: 'r2' }, { review_id: 'r2' }],
      error: null,
      count: null,
    })

    const { result } = renderHook(() => useUniversityReviews('uni-1', 1, 'helpful'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Light heads query, upvotes batch for the full set, then full rows for
    // the page ids — no range/count pagination on the helpful path.
    expect(calls).toContainEqual(
      expect.objectContaining({
        table: 'reviews',
        method: 'select',
        args: ['id, rating, created_at'],
      })
    )
    expect(calls).toContainEqual(
      expect.objectContaining({
        table: 'upvotes',
        method: 'in',
        args: ['review_id', ['r1', 'r2', 'r3']],
      })
    )
    // r2 has two upvotes; r3 (newest) beats r1 among the zero-vote tail.
    expect(result.current.reviews.map((r) => r.id)).toEqual(['r2', 'r3', 'r1'])
    expect(result.current.totalCount).toBe(3)
  })

  it('sorts the hydrated payload by upvotes with one votes batch — no reviews fetch', async () => {
    pdMock.payload = seededPayload(3)
    calls.length = 0
    clearTableResults()
    setTableResult('upvotes', {
      data: [{ review_id: 'r3' }, { review_id: 'r3' }],
      error: null,
      count: null,
    })

    const { result } = renderHook(() => useUniversityReviews('uni-1', 1, 'helpful'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(calls.filter((c) => c.table === 'reviews' && c.method === 'select')).toHaveLength(0)
    expect(result.current.reviews[0].id).toBe('r3')
    expect(result.current.reviews.map((r) => r.id)).toEqual(['r3', 'r2', 'r1'])
  })
})
