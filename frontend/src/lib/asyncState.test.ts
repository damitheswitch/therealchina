import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  NOT_FOUND,
  asyncFlags,
  asyncReducer,
  dataOf,
  initialAsyncState,
  useAsyncState,
  type AsyncState,
} from './asyncState'

const loading: AsyncState<number> = { status: 'loading' }
const ready: AsyncState<number> = { status: 'ready', data: 1 }
const failure = new Error('boom')

describe('initialAsyncState', () => {
  it('starts ready with a prerender seed, so seeded pages never fetch or flash', () => {
    expect(initialAsyncState({ city: 'Hangzhou' })).toEqual({
      status: 'ready',
      data: { city: 'Hangzhou' },
    })
  })

  it('treats falsy seeds other than undefined as data', () => {
    expect(initialAsyncState(0)).toEqual({ status: 'ready', data: 0 })
    expect(initialAsyncState(null)).toEqual({ status: 'ready', data: null })
  })

  it('starts loading without a seed, idle when disabled', () => {
    expect(initialAsyncState(undefined)).toEqual({ status: 'loading' })
    expect(initialAsyncState(undefined, { enabled: false })).toEqual({ status: 'idle' })
  })
})

describe('asyncReducer', () => {
  it('runs idle → loading → ready', () => {
    const started = asyncReducer<number>({ status: 'idle' }, { type: 'START' })
    expect(started).toEqual({ status: 'loading', data: undefined })
    expect(asyncReducer(started, { type: 'SUCCEEDED', data: 5 })).toEqual({
      status: 'ready',
      data: 5,
    })
  })

  it('keeps the previous data while refetching and after a failed refetch', () => {
    const refetching = asyncReducer(ready, { type: 'START' })
    expect(refetching).toEqual({ status: 'loading', data: 1 })
    expect(asyncReducer(refetching, { type: 'FAILED', error: failure })).toEqual({
      status: 'error',
      error: failure,
      data: 1,
    })
  })

  it('drops data on NOT_FOUND', () => {
    const refetching = asyncReducer(ready, { type: 'START' })
    expect(asyncReducer(refetching, { type: 'NOT_FOUND' })).toEqual({ status: 'notFound' })
  })

  it('retries from error and notFound', () => {
    const failed: AsyncState<number> = { status: 'error', error: failure }
    expect(asyncReducer(failed, { type: 'START' }).status).toBe('loading')
    expect(asyncReducer<number>({ status: 'notFound' }, { type: 'START' }).status).toBe('loading')
  })

  it('ignores results that arrive outside loading', () => {
    const states: AsyncState<number>[] = [
      { status: 'idle' },
      ready,
      { status: 'notFound' },
      { status: 'error', error: failure },
    ]
    for (const s of states) {
      expect(asyncReducer(s, { type: 'SUCCEEDED', data: 9 })).toBe(s)
      expect(asyncReducer(s, { type: 'NOT_FOUND' })).toBe(s)
      expect(asyncReducer(s, { type: 'FAILED', error: failure })).toBe(s)
    }
  })

  it('returns the same object for a START while already loading', () => {
    expect(asyncReducer(loading, { type: 'START' })).toBe(loading)
  })

  it('SEEDED lands in ready from any state and is a no-op for the same data', () => {
    expect(asyncReducer(loading, { type: 'SEEDED', data: 3 })).toEqual({
      status: 'ready',
      data: 3,
    })
    expect(asyncReducer(ready, { type: 'SEEDED', data: 1 })).toBe(ready)
  })

  it('UPDATED only edits ready data', () => {
    expect(asyncReducer(ready, { type: 'UPDATED', update: (n) => n + 1 })).toEqual({
      status: 'ready',
      data: 2,
    })
    expect(asyncReducer(loading, { type: 'UPDATED', update: (n) => n + 1 })).toBe(loading)
  })

  it('RESET goes back to idle', () => {
    expect(asyncReducer(ready, { type: 'RESET' })).toEqual({ status: 'idle' })
    const idle: AsyncState<number> = { status: 'idle' }
    expect(asyncReducer(idle, { type: 'RESET' })).toBe(idle)
  })
})

describe('asyncFlags', () => {
  it('derives the legacy flags, never loading and error at once', () => {
    expect(asyncFlags(loading)).toEqual({
      data: undefined,
      loading: true,
      error: null,
      notFound: false,
      settled: false,
    })
    expect(asyncFlags<number>({ status: 'error', error: failure, data: 4 })).toEqual({
      data: 4,
      loading: false,
      error: failure,
      notFound: false,
      settled: true,
    })
    expect(asyncFlags<number>({ status: 'notFound' })).toMatchObject({
      notFound: true,
      settled: true,
    })
    expect(asyncFlags<number>({ status: 'idle' })).toMatchObject({
      loading: false,
      settled: false,
    })
  })

  it('dataOf returns nothing for idle and notFound', () => {
    expect(dataOf<number>({ status: 'idle' })).toBeUndefined()
    expect(dataOf<number>({ status: 'notFound' })).toBeUndefined()
  })
})

// Promise the test resolves by hand, to control ordering between runs.
const deferred = <T>() => {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useAsyncState', () => {
  afterEach(() => vi.restoreAllMocks())

  it('starts from the seed without running anything', () => {
    const { result } = renderHook(() => useAsyncState(() => initialAsyncState([1, 2])))
    expect(result.current.state).toEqual({ status: 'ready', data: [1, 2] })
  })

  it('run moves through loading to ready', async () => {
    const { result } = renderHook(() =>
      useAsyncState<string>(() => initialAsyncState<string>(undefined, { enabled: false }))
    )
    const d = deferred<string>()
    let done!: Promise<void>
    act(() => {
      done = result.current.run(() => d.promise)
    })
    expect(result.current.state.status).toBe('loading')
    await act(async () => {
      d.resolve('ok')
      await done
    })
    expect(result.current.state).toEqual({ status: 'ready', data: 'ok' })
  })

  it('maps NOT_FOUND and failures', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() =>
      useAsyncState<string>(() => initialAsyncState<string>(undefined))
    )
    await act(() => result.current.run(async () => NOT_FOUND))
    expect(result.current.state).toEqual({ status: 'notFound' })

    await act(() =>
      result.current.run(
        async () => {
          throw failure
        },
        { errorLabel: 'Error fetching thing:' }
      )
    )
    expect(result.current.state).toEqual({ status: 'error', error: failure, data: undefined })
    expect(error).toHaveBeenCalledWith('Error fetching thing:', failure)
  })

  it('ignores results after the signal aborts, without logging', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() =>
      useAsyncState<string>(() => initialAsyncState<string>(undefined))
    )
    const controller = new AbortController()
    const d = deferred<string>()
    let done!: Promise<void>
    act(() => {
      done = result.current.run(() => d.promise, { signal: controller.signal, errorLabel: 'x' })
    })
    controller.abort()
    await act(async () => {
      d.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      await done
    })
    expect(result.current.state.status).toBe('loading')
    expect(error).not.toHaveBeenCalled()
  })

  it('lets the newest run win when an older one resolves later', async () => {
    const { result } = renderHook(() =>
      useAsyncState<string>(() => initialAsyncState<string>(undefined))
    )
    const first = deferred<string>()
    const second = deferred<string>()
    let a!: Promise<void>
    let b!: Promise<void>
    act(() => {
      a = result.current.run(() => first.promise)
      b = result.current.run(() => second.promise)
    })
    await act(async () => {
      second.resolve('new')
      await b
    })
    await act(async () => {
      first.resolve('old')
      await a
    })
    expect(result.current.state).toEqual({ status: 'ready', data: 'new' })
  })

  it('seed and update keep the api functions stable', () => {
    const { result } = renderHook(() =>
      useAsyncState<number>(() => initialAsyncState<number>(undefined))
    )
    const { run, seed, update, reset } = result.current
    act(() => seed(1))
    act(() => update((n) => n + 1))
    expect(result.current.state).toEqual({ status: 'ready', data: 2 })
    act(() => reset())
    expect(result.current.state).toEqual({ status: 'idle' })
    expect(result.current.run).toBe(run)
    expect(result.current.seed).toBe(seed)
    expect(result.current.update).toBe(update)
    expect(result.current.reset).toBe(reset)
  })
})
