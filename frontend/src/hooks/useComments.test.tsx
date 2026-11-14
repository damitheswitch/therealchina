import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useComments } from './useComments'
import type { Tables } from '../types/database.types'

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

const comment: Tables<'comments'> = {
  id: 'c1',
  review_id: 'r1',
  user_id: 'u1',
  parent_id: null,
  text: 'hi',
  created_at: null,
  edited_at: null,
  deleted_at: null,
}

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

  it('keeps a committed edit through stale and failed refreshes, then accepts a newer edit', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    results.comments = { data: [comment], error: null }
    const { result } = renderHook(() => useComments('r1', { enabled: true }))
    await waitFor(() => expect(result.current.loaded).toBe(true))
    const edited = { ...comment, text: 'saved', edited_at: '2026-11-14T10:00:00Z' }
    act(() => result.current.applyComment(edited))
    await act(() => result.current.refetch())
    expect(result.current.comments[0]).toEqual(edited)
    results.comments = { data: null, error: new Error('offline') }
    await act(() => result.current.refetch())
    expect(result.current.comments[0]).toEqual(edited)
    const newer = { ...edited, text: 'another device', edited_at: '2026-11-14T11:00:00Z' }
    results.comments = { data: [newer], error: null }
    await act(() => result.current.refetch())
    expect(result.current.comments[0]).toEqual(newer)
  })

  it('never resurrects committed deletions and ignores rows belonging to another review', async () => {
    results.comments = { data: [comment], error: null }
    const { result } = renderHook(() => useComments('r1', { enabled: true }))
    await waitFor(() => expect(result.current.loaded).toBe(true))
    act(() => result.current.applyComment({ ...comment, review_id: 'other', text: 'wrong thread' }))
    expect(result.current.comments[0]).toEqual(comment)
    const deleted = { ...comment, text: 'Comment deleted', deleted_at: '2026-11-14T10:00:00Z' }
    act(() => result.current.applyComment(deleted))
    await act(() => result.current.refetch())
    expect(result.current.comments[0]).toEqual(deleted)
    results.comments = { data: [deleted], error: null }
    await act(() => result.current.refetch())
    expect(result.current.comments[0]).toEqual(deleted)
  })
})
