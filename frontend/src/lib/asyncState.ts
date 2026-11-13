import { useCallback, useMemo, useReducer, useRef } from 'react'

// ---- Async data state machine ---------------------------------------------------
// One explicit lifecycle for data hooks. Before this, each hook in src/hooks kept
// `data + loading + error` plus its own `resolved` / `notFound` / `loaded` flag,
// set by hand in every branch, so combinations like `loading && error` or
// `resolved && loading` were reachable and every hook re-implemented seeding.
//
//            ┌──────────────── START (refetch keeps data) ───────────────┐
//            ▼                                                           │
//   idle ─START─▶ loading ─SUCCEEDED─▶ ready ──UPDATED (ready only)      │
//                    │ ─NOT_FOUND─▶ notFound                             │
//                    └─FAILED─────▶ error (keeps data from before) ──────┘
//
//   SEEDED (any state) ─▶ ready   prerender payload or data known synchronously
//   RESET  (any state) ─▶ idle
//
// SUCCEEDED / NOT_FOUND / FAILED only apply while loading; anything else is
// ignored (the same state object is returned, so React skips the render).
// `useAsyncState().run` also drops results from superseded runs, so the newest
// request wins even when an older one resolves later.

export type AsyncState<T> =
  // Nothing requested yet (lazy hooks, missing route param).
  | { status: 'idle' }
  // A request is in flight. `data` is the previous result on a refetch.
  | { status: 'loading'; data?: T }
  | { status: 'ready'; data: T }
  | { status: 'notFound' }
  // The last request failed. `data` is the previous result, if there was one.
  | { status: 'error'; error: Error; data?: T }

export type AsyncStatus = AsyncState<unknown>['status']

export type AsyncEvent<T> =
  | { type: 'START' }
  | { type: 'SUCCEEDED'; data: T }
  | { type: 'NOT_FOUND' }
  | { type: 'FAILED'; error: Error }
  | { type: 'SEEDED'; data: T }
  | { type: 'UPDATED'; update: (data: T) => T }
  | { type: 'RESET' }

/**
 * Starting state for a hook. A prerender seed (anything but `undefined`) starts
 * in `ready`, so seeded pages render their data on the server and hydrate with
 * no fetch and no loading flash. Otherwise `loading` when the hook will fetch
 * on mount, `idle` when it waits (lazy or missing input).
 */
export const initialAsyncState = <T>(
  seed: T | undefined,
  { enabled = true }: { enabled?: boolean } = {}
): AsyncState<T> => {
  if (seed !== undefined) return { status: 'ready', data: seed }
  return enabled ? { status: 'loading' } : { status: 'idle' }
}

/** The data a state holds: current in `ready`, previous in `loading` / `error`. */
export const dataOf = <T>(state: AsyncState<T>): T | undefined =>
  state.status === 'ready' || state.status === 'loading' || state.status === 'error'
    ? state.data
    : undefined

export const asyncReducer = <T>(state: AsyncState<T>, event: AsyncEvent<T>): AsyncState<T> => {
  switch (event.type) {
    case 'START':
      if (state.status === 'loading') return state
      return { status: 'loading', data: dataOf(state) }
    case 'SUCCEEDED':
      return state.status === 'loading' ? { status: 'ready', data: event.data } : state
    case 'NOT_FOUND':
      return state.status === 'loading' ? { status: 'notFound' } : state
    case 'FAILED':
      return state.status === 'loading'
        ? { status: 'error', error: event.error, data: state.data }
        : state
    case 'SEEDED':
      if (state.status === 'ready' && state.data === event.data) return state
      return { status: 'ready', data: event.data }
    case 'UPDATED':
      return state.status === 'ready' ? { status: 'ready', data: event.update(state.data) } : state
    case 'RESET':
      return state.status === 'idle' ? state : { status: 'idle' }
  }
}

/**
 * The legacy flag view hooks return to pages: `loading` and `error` as before,
 * `settled` for the old `resolved` flags (ready, notFound or error).
 */
export const asyncFlags = <T>(state: AsyncState<T>) => ({
  data: dataOf(state),
  loading: state.status === 'loading',
  error: state.status === 'error' ? state.error : null,
  notFound: state.status === 'notFound',
  settled: state.status === 'ready' || state.status === 'notFound' || state.status === 'error',
})

/** Return this from a `run` task when the requested thing does not exist. */
export const NOT_FOUND: unique symbol = Symbol('asyncState.notFound')

export interface RunOptions {
  // Aborting drops the result (no state change). Pass the effect's controller.
  signal?: AbortSignal
  // Logged with console.error on a genuine failure.
  errorLabel?: string
}

export interface AsyncStateApi<T> {
  state: AsyncState<T>
  /** START, await `task`, then SUCCEEDED / NOT_FOUND / FAILED unless aborted or superseded. */
  run: (task: () => Promise<T | typeof NOT_FOUND>, options?: RunOptions) => Promise<void>
  seed: (data: T) => void
  update: (update: (data: T) => T) => void
  reset: () => void
}

/**
 * Reducer-backed async state for one hook instance. `initial` is evaluated once
 * (use `initialAsyncState(seed)`); later seeds go through `seed()` in an effect.
 */
export const useAsyncState = <T>(initial: () => AsyncState<T>): AsyncStateApi<T> => {
  const [state, dispatch] = useReducer(
    asyncReducer as (s: AsyncState<T>, e: AsyncEvent<T>) => AsyncState<T>,
    undefined,
    initial
  )
  // Id of the newest run. Only mutated inside run(), which callers invoke from
  // effects and event handlers.
  const latestRun = useRef(0)

  const run = useCallback(
    async (task: () => Promise<T | typeof NOT_FOUND>, { signal, errorLabel }: RunOptions = {}) => {
      const id = ++latestRun.current
      dispatch({ type: 'START' })
      const current = () => !signal?.aborted && id === latestRun.current
      try {
        const result = await task()
        if (!current()) return
        dispatch(result === NOT_FOUND ? { type: 'NOT_FOUND' } : { type: 'SUCCEEDED', data: result })
      } catch (err) {
        if (!current()) return
        if (errorLabel) console.error(errorLabel, err)
        dispatch({ type: 'FAILED', error: err as Error })
      }
    },
    []
  )
  const seed = useCallback((data: T) => dispatch({ type: 'SEEDED', data }), [])
  const update = useCallback((fn: (data: T) => T) => dispatch({ type: 'UPDATED', update: fn }), [])
  const reset = useCallback(() => dispatch({ type: 'RESET' }), [])

  return useMemo(() => ({ state, run, seed, update, reset }), [state, run, seed, update, reset])
}
