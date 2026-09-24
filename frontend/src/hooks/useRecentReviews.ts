import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePrerenderData } from '../lib/prerenderData'
import type { Tables } from '../types/database.types'

export type RecentReview = Tables<'reviews'>
export type UniLite = { id: string; name: string; slug: string }
export type AuthorLite = { id: string; display_name: string | null; avatar_url: string | null }

export interface ReviewsPageData {
  reviews: RecentReview[]
  universities: Record<string, UniLite>
  authors: Record<string, AuthorLite>
}

const REVIEW_COLUMNS =
  'id, university_id, user_id, rating, text, program, degree_level, media, created_at, enrollment_status, start_year, end_year, language_of_instruction, tuition_range, living_cost_range, funding_type, funding_coverage, recommend, pros, cons, tags, rating_academics, rating_campus, rating_accommodation, rating_cost, rating_intl_office, rating_social, rating_extracurricular, rating_career'

const PAGE_SIZE = 50

export const useRecentReviews = () => {
  const pd = usePrerenderData<ReviewsPageData>('reviewsPage')
  const [reviews, setReviews] = useState<RecentReview[]>(pd?.reviews ?? [])
  const [universities, setUniversities] = useState<Record<string, UniLite>>(
    pd?.universities ?? {}
  )
  const [authors, setAuthors] = useState<Record<string, AuthorLite>>(pd?.authors ?? {})
  const [loading, setLoading] = useState<boolean>(!pd)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (pd) {
      setReviews(pd.reviews)
      setUniversities(pd.universities)
      setAuthors(pd.authors)
      setError(null)
      setLoading(false)
      return
    }
    const controller = new AbortController()
    const run = async () => {
      setLoading(true)
      try {
        const { data, error: fetchError } = await supabase
          .from('reviews')
          .select(REVIEW_COLUMNS)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE)
          .abortSignal(controller.signal)
        if (fetchError) throw fetchError
        const rows = (data as RecentReview[] | null) || []
        setReviews(rows)

        const uniIds = [...new Set(rows.map((r) => r.university_id))]
        const authorIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[]
        const [uniRes, authorRes] = await Promise.all([
          supabase
            .from('universities')
            .select('id, name, slug')
            .in('id', uniIds)
            .abortSignal(controller.signal),
          authorIds.length
            ? supabase
                .from('profile_public')
                .select('id, display_name, avatar_url')
                .in('id', authorIds)
                .abortSignal(controller.signal)
            : Promise.resolve({ data: [], error: null }),
        ])
        if (uniRes.error) throw uniRes.error
        if (authorRes.error) throw authorRes.error
        setUniversities(
          Object.fromEntries(((uniRes.data as UniLite[] | null) || []).map((u) => [u.id, u]))
        )
        setAuthors(
          Object.fromEntries(((authorRes.data as AuthorLite[] | null) || []).map((a) => [a.id, a]))
        )
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        console.error('Error fetching recent reviews:', err)
        setError(err as Error)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    run()
    return () => controller.abort()
  }, [pd])

  return { reviews, universities, authors, loading, error }
}
