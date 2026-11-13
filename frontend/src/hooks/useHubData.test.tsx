import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useHubData, type HubPageData } from './useHubData'
import type { HubDef } from '../lib/seo/programs'
import type { Tables } from '../types/database.types'

// Chainable supabase stub: awaiting a chain resolves the table's result.
const { from, results } = vi.hoisted(() => {
  const results: Record<string, { data: unknown; error: unknown }> = {}
  const makeChain = (table: string): object =>
    new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') {
            // upvotes in the seeded path is consumed with .then()
            if (table !== 'upvotes') return undefined
            return (cb: (r: unknown) => unknown) =>
              Promise.resolve(results[table] ?? { data: [], error: null }).then(cb)
          }
          if (prop === 'data' || prop === 'error')
            return (results[table] ?? { data: [], error: null })[prop]
          return () => makeChain(table)
        },
      }
    )
  return { results, from: vi.fn((table: string) => makeChain(table)) }
})
const pd = vi.hoisted(() => ({ payload: undefined as HubPageData | undefined }))

vi.mock('../lib/supabaseClient', () => ({ supabase: { from } }))
vi.mock('../lib/prerenderData', () => ({ usePrerenderData: () => pd.payload }))

const HUB = { slug: 'medicine', label: 'Medicine' } as HubDef
const lookup = (slug: string) => (slug === 'medicine' ? HUB : null)
const resolve = (r: Tables<'reviews'>) => r.program ?? null
const review = { id: 'r1', university_id: 'u1', user_id: 'a1', program: 'medicine' }

beforeEach(() => {
  from.mockClear()
  pd.payload = undefined
  for (const k of Object.keys(results)) delete results[k]
})

describe('useHubData', () => {
  it('renders a matching prerender payload immediately, with no fetch for guests', () => {
    pd.payload = { kind: 'program', hub: HUB, reviews: [], universities: [], upvoteCounts: {} }
    const { result } = renderHook(() => useHubData('program', 'medicine', lookup, resolve))
    expect(result.current).toMatchObject({ hub: HUB, loading: false, resolved: true })
    expect(from).not.toHaveBeenCalled()
  })

  it('only fetches the viewer upvotes on a seeded page', async () => {
    pd.payload = {
      kind: 'program',
      hub: HUB,
      reviews: [review as Tables<'reviews'>],
      upvoteCounts: { r1: 2 },
    }
    results.upvotes = { data: [{ review_id: 'r1' }], error: null }
    const { result } = renderHook(() => useHubData('program', 'medicine', lookup, resolve, 'me'))
    expect(result.current.loading).toBe(false)
    await waitFor(() => expect(result.current.upvotedMine.has('r1')).toBe(true))
    expect(from.mock.calls.map((c) => c[0])).toEqual(['upvotes'])
    expect(result.current.upvoteCounts).toEqual({ r1: 2 })
  })

  it('reads an unknown slug as not found without a request', () => {
    const { result } = renderHook(() => useHubData('program', 'astrology', lookup, resolve))
    expect(result.current).toMatchObject({ hub: null, loading: false, resolved: true })
    expect(from).not.toHaveBeenCalled()
  })

  it('fetches and filters reviews for a hub without a payload', async () => {
    results.reviews = {
      data: [review, { ...review, id: 'r2', program: 'law' }],
      error: null,
    }
    results.universities = { data: [{ id: 'u1', name: 'Fudan' }], error: null }
    results.profile_public = { data: [{ id: 'a1', display_name: 'Ana' }], error: null }
    const { result } = renderHook(() => useHubData('program', 'medicine', lookup, resolve))
    expect(result.current).toMatchObject({ loading: true, resolved: false })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.reviews.map((r) => r.id)).toEqual(['r1'])
    expect(result.current.universities.map((u) => u.id)).toEqual(['u1'])
    expect(result.current.authors).toHaveProperty('a1')
    expect(result.current.resolved).toBe(true)
  })
})
