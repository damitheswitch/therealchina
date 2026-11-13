import { useEffect, useCallback, type Dispatch, type SetStateAction } from 'react'
import {
  fetchCommunityQuestion,
  fetchCommunityQuestions,
  fetchUniversityQuestions,
} from '../lib/communityApi'
import { NOT_FOUND, asyncFlags, initialAsyncState, useAsyncState } from '../lib/asyncState'
import type { CommunityAnswer, CommunityQuestion } from '../lib/community'

// Each hook keeps one AsyncState (lib/asyncState.ts). Refetches keep the
// previous data until the new result lands, and a superseded or aborted
// request can never overwrite a newer one.

const NO_QUESTIONS: CommunityQuestion[] = []
const NO_ANSWERS: CommunityAnswer[] = []

// /community feed: every live question, newest first. Category + view
// filtering stays in the page — the same list drives the rail counts.
export const useCommunityQuestions = () => {
  const { state, run } = useAsyncState<CommunityQuestion[]>(() =>
    initialAsyncState<CommunityQuestion[]>(undefined)
  )

  const load = useCallback(
    (signal?: AbortSignal) =>
      run(fetchCommunityQuestions, { signal, errorLabel: 'Error fetching community questions:' }),
    [run]
  )

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const refetch = useCallback(() => load(), [load])
  const { data, loading, error } = asyncFlags(state)
  return { questions: data ?? NO_QUESTIONS, loading, error, refetch }
}

interface QuestionThread {
  question: CommunityQuestion
  answers: CommunityAnswer[]
}

// /community/q/:slug — one question plus its answers.
export const useCommunityQuestion = (slug: string | undefined) => {
  const { state, run, update } = useAsyncState<QuestionThread>(() =>
    initialAsyncState<QuestionThread>(undefined)
  )

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!slug) return
      await run(async () => (await fetchCommunityQuestion(slug)) ?? NOT_FOUND, {
        signal,
        errorLabel: 'Error fetching community question:',
      })
    },
    [slug, run]
  )

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const refetch = useCallback(() => load(), [load])
  const setAnswers: Dispatch<SetStateAction<CommunityAnswer[]>> = useCallback(
    (next) =>
      update((thread) => ({
        ...thread,
        answers: typeof next === 'function' ? next(thread.answers) : next,
      })),
    [update]
  )

  const { data, loading, notFound, error } = asyncFlags(state)
  return {
    question: data?.question ?? null,
    answers: data?.answers ?? NO_ANSWERS,
    loading,
    notFound,
    error,
    refetch,
    setAnswers,
  }
}

// University page: live questions asked about a specific university.
export const useUniversityQuestions = (universityId: string | undefined) => {
  const { state, run, seed } = useAsyncState<CommunityQuestion[]>(() =>
    initialAsyncState<CommunityQuestion[]>(undefined)
  )

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!universityId) {
        seed(NO_QUESTIONS)
        return
      }
      await run(() => fetchUniversityQuestions(universityId, signal), {
        signal,
        errorLabel: 'Error fetching university questions:',
      })
    },
    [universityId, run, seed]
  )

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const refetch = useCallback(() => load(), [load])
  const { data, loading, error } = asyncFlags(state)
  return { questions: data ?? NO_QUESTIONS, loading, error, refetch }
}
