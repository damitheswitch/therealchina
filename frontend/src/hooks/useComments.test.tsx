import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useComments } from './useComments'

// Chainable supabase stub: awaiting a chain resolves the table's result.
const { from, results } = vi.hoisted(() => {
  const results: Record<string, { data: unknown; error: unknown }> = {}
  const makeChain = (table: string): object =>
    new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') return undefined
          if (prop === 'data' || prop === 'error')
            return (results[table] ?? { data: [], error: null })[prop]
          return () => makeChain(table)
        },
      }
    )
  return { results, from: vi.fn((table: string) => makeChain(table)) }
})
vi.mock('../lib/supabaseClient', () => ({ supabase: { from } }))

const comment = { id: 'c1', review_id: 'r1', user_id: 'u1', parent_id: null, text: 'hi' }

beforeEach(() => {
  from.mockClear()
  vi.restoreAllMocks()
  for (const k of Object.keys(results)) delete results[k]
})

describe('useComments', () => {
  it('fetches nothing until enabled', () => {
    const { result } = renderHook(() => useComments('r1'))
    expect(result.current).toMatchObject({ loading: false, loaded: false, comments: [] })
    expect(from).not.toHaveBeenCalled()
  })

  it('loads comments and author names together once enabled', async () => {
    results.comments = { data: [comment], error: null }
    results.profile_public = { data: [{ id: 'u1', display_name: 'Lin' }], error: null }
    const { result, rerender } = renderHook(({ enabled }) => useComments('r1', { enabled }), {
      initialProps: { enabled: false },
    })
    rerender({ enabled: true })
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.comments).toEqual([comment])
    expect(result.current.authorProfiles.u1.display_name).toBe('Lin')
    expect(result.current.loading).toBe(false)

    // Collapsing and reopening does not refetch a loaded thread.
    rerender({ enabled: false })
    rerender({ enabled: true })
    expect(from.mock.calls.filter((c) => c[0] === 'comments')).toHaveLength(1)
  })

  it('stays loaded with the old thread when a refetch fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    results.comments = { data: [comment], error: null }
    const { result } = renderHook(() => useComments('r1', { enabled: true }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    results.comments = { data: null, error: new Error('offline') }
    await act(() => result.current.refetch())
    expect(result.current).toMatchObject({ loaded: true, loading: false })
    expect(result.current.comments).toEqual([comment])
  })

  it('does not retry a failed first fetch in a loop', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    results.comments = { data: null, error: new Error('offline') }
    const { result } = renderHook(() => useComments('r1', { enabled: true }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {})
    expect(result.current.loaded).toBe(false)
    expect(from.mock.calls.filter((c) => c[0] === 'comments')).toHaveLength(1)
  })
})
