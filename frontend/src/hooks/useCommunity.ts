import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchCommunityQuestion, fetchCommunityQuestions } from '../lib/communityApi'
import type { CommunityAnswer, CommunityQuestion } from '../lib/community'

// /community feed: every live question, newest first. Category + view
// filtering stays in the page — the same list drives the rail counts.
export const useCommunityQuestions = () => {
  const [questions, setQuestions] = useState<CommunityQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCommunityQuestions()
      if (mounted.current) setQuestions(data)
    } catch (err) {
      console.error('Error fetching community questions:', err)
      if (mounted.current) setError(err as Error)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { questions, loading, error, refetch }
}

// /community/q/:slug — one question plus its answers.
export const useCommunityQuestion = (slug: string | undefined) => {
  const [question, setQuestion] = useState<CommunityQuestion | null>(null)
  const [answers, setAnswers] = useState<CommunityAnswer[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refetch = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    setError(null)
    setNotFound(false)
    try {
      const data = await fetchCommunityQuestion(slug)
      if (!mounted.current) return
      if (data) {
        setQuestion(data.question)
        setAnswers(data.answers)
      } else {
        setNotFound(true)
      }
    } catch (err) {
      console.error('Error fetching community question:', err)
      if (mounted.current) setError(err as Error)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { question, answers, loading, notFound, error, refetch, setAnswers }
}
