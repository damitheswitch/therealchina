import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useUniversities } from './useUniversities'

// Same chainable supabase stub as useUniversityReviews.test.tsx: every builder
// call records its args and returns the chain; awaiting resolves `result`.
const { calls, supabaseMock } = vi.hoisted(() => {
  const calls: { method: string; table: string; args: unknown[] }[] = []
  const result: { data: unknown; error: unknown; count: number | null } = {
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
          return vi.fn((...args: unknown[]) => {
            calls.push({ method: String(prop), table: target.table, args })
            return makeChain(table)
          })
        },
      }
    )
  return {
    calls,
    supabaseMock: { from: vi.fn((table: string) => makeChain(table)) },
  }
})

vi.mock('../lib/supabaseClient', () => ({ supabase: supabaseMock }))
vi.mock('../lib/prerenderData', () => ({ usePrerenderData: () => null }))

const orderArgs = () =>
  calls.filter((c) => c.table === 'universities' && c.method === 'order').map((c) => c.args)

describe('useUniversities rank sort', () => {
  it('orders by rankings->shanghai_national ascending for sortBy=rank', async () => {
    calls.length = 0
    const { result } = renderHook(() => useUniversities({ sortBy: 'rank', page: 1 }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // `->` (not `->>`) keeps Postgres comparing rank numbers numerically.
    expect(orderArgs()).toContainEqual([
      'rankings->shanghai_national',
      { ascending: true, nullsFirst: false },
    ])
    // name stays the deterministic tiebreak for stable pagination
    expect(orderArgs()).toContainEqual(['name', { ascending: true }])
  })

  it('orders by rankings->shanghai_national descending for sortBy=rank_desc', async () => {
    calls.length = 0
    const { result } = renderHook(() => useUniversities({ sortBy: 'rank_desc', page: 1 }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(orderArgs()).toContainEqual([
      'rankings->shanghai_national',
      { ascending: false, nullsFirst: false },
    ])
  })
})
