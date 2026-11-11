import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useFlightListings } from './useFlightListings'

const { queries, tables, ownerPages, board, from } = vi.hoisted(() => {
  const queries: { filters: Record<string, unknown>; orders: string[] }[] = []
  const tables: string[] = []
  const ownerPages: { data: unknown[] | null; error: unknown }[] = []
  const board: { data: unknown[]; error: unknown } = { data: [], error: null }
  const from = vi.fn((table: string) => {
    tables.push(table)
    const state = { filters: {} as Record<string, unknown>, orders: [] as string[] }
    queries.push(state)
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((key: string, value: unknown) => {
        state.filters[key] = value
        return query
      }),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gt: vi.fn((key: string, value: unknown) => {
        state.filters[`after_${key}`] = value
        return query
      }),
      order: vi.fn((key: string) => {
        state.orders.push(key)
        return query
      }),
      limit: vi.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => void) =>
        Promise.resolve(
          state.filters.user_id ? (ownerPages.shift() ?? { data: [], error: null }) : board
        ).then(resolve),
    }
    return query
  })
  return { queries, tables, ownerPages, board, from }
})

vi.mock('../lib/supabaseClient', () => ({ supabase: { from } }))

beforeEach(() => {
  queries.length = 0
  tables.length = 0
  ownerPages.length = 0
  board.data = []
  board.error = null
  vi.clearAllMocks()
})

describe('owner flight pagination', () => {
  it('continues beyond short server-capped pages and deduplicates board rows', async () => {
    ownerPages.push(
      { data: [{ id: 'a' }, { id: 'b' }], error: null },
      { data: [{ id: 'c' }], error: null },
      { data: [], error: null }
    )
    board.data = [{ id: 'b' }, { id: 'public' }]
    const { result } = renderHook(() => useFlightListings({ userId: 'owner' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.listings.map((row) => row.id)).toEqual(['a', 'b', 'c', 'public'])
    const ownQueries = queries.filter((q) => q.filters.user_id)
    expect(ownQueries.map((q) => q.filters.after_id)).toEqual([undefined, 'b', 'c'])
    expect(ownQueries.every((q) => q.orders.includes('id'))).toBe(true)
  })

  it('does not query owner history for anonymous visitors', async () => {
    const { result } = renderHook(() => useFlightListings())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(queries).toHaveLength(2)
    expect(tables).toEqual(['flight_listings_public', 'flight_listings_public'])
  })

  it('maps guest rows to listings without owner or contact data', async () => {
    board.data = [{ id: 'g1', poster_label: 'Mei', notes: 'leak', user_id: 'leak' }]
    const { result } = renderHook(() => useFlightListings())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.listings).toHaveLength(1)
    expect(result.current.listings[0]).toMatchObject({
      id: 'g1',
      display_name: 'Mei',
      user_id: null,
      notes: null,
      social_handles: [],
    })
  })

  it('reads members from the profile view', async () => {
    const { result } = renderHook(() => useFlightListings({ userId: 'owner' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(tables.every((t) => t === 'flight_listings_with_profile')).toBe(true)
  })

  it('surfaces errors on later owner pages instead of silently truncating', async () => {
    const error = new Error('second page failed')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    ownerPages.push({ data: [{ id: 'a' }], error: null }, { data: null, error })
    try {
      const { result } = renderHook(() => useFlightListings({ userId: 'owner' }))
      await waitFor(() => expect(result.current.error).toBe(error))
      expect(result.current.listings).toEqual([])
    } finally {
      log.mockRestore()
    }
  })
})
