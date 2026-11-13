import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCityData, type CityPageData } from './useCityData'

// Chainable supabase stub (same shape as useUniversities.test.tsx): awaiting
// any chain resolves `result`; every `from()` is recorded.
const { from, result } = vi.hoisted(() => {
  const result: { data: unknown; error: unknown; count: number | null } = {
    data: [],
    error: null,
    count: 0,
  }
  const chain: object = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return undefined
        if (prop === 'data' || prop === 'error' || prop === 'count')
          return result[prop as keyof typeof result]
        return () => chain
      },
    }
  )
  return { result, from: vi.fn(() => chain) }
})
const pd = vi.hoisted(() => ({ payload: undefined as CityPageData | undefined }))

vi.mock('../lib/supabaseClient', () => ({ supabase: { from } }))
vi.mock('../lib/prerenderData', () => ({ usePrerenderData: () => pd.payload }))

beforeEach(() => {
  from.mockClear()
  pd.payload = undefined
  Object.assign(result, { data: [], error: null, count: 0 })
})

describe('useCityData', () => {
  it('renders a matching prerender payload immediately, with no fetch', () => {
    pd.payload = { city: 'Hangzhou', universities: [], reviewCount: 4 }
    const { result: hook } = renderHook(() => useCityData('hangzhou'))
    expect(hook.current).toMatchObject({
      city: 'Hangzhou',
      reviewCount: 4,
      loading: false,
      resolved: true,
    })
    expect(from).not.toHaveBeenCalled()
  })

  it('fetches when the payload is for another city', async () => {
    pd.payload = { city: 'Beijing', universities: [], reviewCount: 1 }
    result.data = [{ id: 'u1', name: 'Zhejiang University', city: 'Hangzhou' }]
    result.count = 7
    const { result: hook } = renderHook(() => useCityData('hangzhou'))
    expect(hook.current).toMatchObject({ loading: true, resolved: false, city: null })
    await waitFor(() => expect(hook.current.loading).toBe(false))
    expect(hook.current).toMatchObject({ city: 'Hangzhou', reviewCount: 7, resolved: true })
    expect(hook.current.universities.map((u) => u.id)).toEqual(['u1'])
  })

  it('settles with no city for an unknown slug', async () => {
    result.data = [{ city: 'Hangzhou' }]
    const { result: hook } = renderHook(() => useCityData('atlantis'))
    await waitFor(() => expect(hook.current.loading).toBe(false))
    expect(hook.current).toMatchObject({ city: null, resolved: true, universities: [] })
  })

  it('settles (not loading) when the query fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    result.error = new Error('db down')
    const { result: hook } = renderHook(() => useCityData('hangzhou'))
    await waitFor(() => expect(hook.current.loading).toBe(false))
    expect(hook.current).toMatchObject({ city: null, resolved: true })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('stays idle without a slug', () => {
    const { result: hook } = renderHook(() => useCityData(undefined))
    expect(hook.current).toMatchObject({ loading: false, resolved: false })
    expect(from).not.toHaveBeenCalled()
  })
})
