import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useCommunityQuestion, useCommunityQuestions, useUniversityQuestions } from './useCommunity'
import type { CommunityAnswer, CommunityQuestion } from '../lib/community'

const api = vi.hoisted(() => ({
  fetchCommunityQuestions: vi.fn(),
  fetchCommunityQuestion: vi.fn(),
  fetchUniversityQuestions: vi.fn(),
}))
vi.mock('../lib/communityApi', () => api)

const q = (slug: string) => ({ id: slug, slug }) as unknown as CommunityQuestion
const a = (id: string) => ({ id }) as unknown as CommunityAnswer

beforeEach(() => {
  vi.restoreAllMocks()
  for (const fn of Object.values(api)) fn.mockReset()
})

describe('useCommunityQuestions', () => {
  it('loads, then keeps the list while a failed refetch reports its error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    api.fetchCommunityQuestions.mockResolvedValueOnce([q('one')])
    const { result } = renderHook(() => useCommunityQuestions())
    expect(result.current).toMatchObject({ loading: true, error: null, questions: [] })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.questions).toEqual([q('one')])

    const boom = new Error('offline')
    api.fetchCommunityQuestions.mockRejectedValueOnce(boom)
    await act(() => result.current.refetch())
    expect(result.current).toMatchObject({ loading: false, error: boom })
    expect(result.current.questions).toEqual([q('one')])
  })
})

describe('useCommunityQuestion', () => {
  it('reports notFound for a missing question, never together with loading', async () => {
    api.fetchCommunityQuestion.mockResolvedValueOnce(null)
    const { result } = renderHook(() => useCommunityQuestion('nope'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current).toMatchObject({ notFound: true, error: null, question: null })
  })

  it('loads the thread and lets setAnswers edit it', async () => {
    api.fetchCommunityQuestion.mockResolvedValueOnce({ question: q('x'), answers: [a('1')] })
    const { result } = renderHook(() => useCommunityQuestion('x'))
    await waitFor(() => expect(result.current.question).toEqual(q('x')))
    act(() => result.current.setAnswers((prev) => [...prev, a('2')]))
    expect(result.current.answers).toEqual([a('1'), a('2')])
  })

  it('ignores the old slug when it resolves after a navigation', async () => {
    let resolveOld!: (v: unknown) => void
    api.fetchCommunityQuestion
      .mockImplementationOnce(() => new Promise((r) => (resolveOld = r)))
      .mockResolvedValueOnce({ question: q('new'), answers: [] })
    const { result, rerender } = renderHook(({ slug }) => useCommunityQuestion(slug), {
      initialProps: { slug: 'old' },
    })
    rerender({ slug: 'new' })
    await waitFor(() => expect(result.current.question).toEqual(q('new')))
    await act(async () => resolveOld({ question: q('old'), answers: [] }))
    expect(result.current.question).toEqual(q('new'))
  })
})

describe('useUniversityQuestions', () => {
  it('is empty and settled without a university id', async () => {
    const { result } = renderHook(() => useUniversityQuestions(undefined))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.questions).toEqual([])
    expect(api.fetchUniversityQuestions).not.toHaveBeenCalled()
  })

  it('passes the abort signal through and loads', async () => {
    api.fetchUniversityQuestions.mockResolvedValueOnce([q('u')])
    const { result } = renderHook(() => useUniversityQuestions('uni-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.questions).toEqual([q('u')])
    expect(api.fetchUniversityQuestions.mock.calls[0][1]).toBeInstanceOf(AbortSignal)
  })
})
