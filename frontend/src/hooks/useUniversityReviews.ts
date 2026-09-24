import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePrerenderData } from '../lib/prerenderData'
import type { UniversityPageData } from './useUniversity'
import type { Tables } from '../types/database.types'

type ReviewRow = Tables<'reviews'>
type AuthorProfile = Pick<Tables<'profile_public'>, 'id' | 'display_name' | 'avatar_url'>

// Kept as one literal so supabase-js can infer the row shape from the select.
const REVIEW_COLUMNS =
  'id, university_id, user_id, rating, text, program, degree_level, media, created_at, enrollment_status, start_year, end_year, language_of_instruction, tuition_range, living_cost_range, funding_type, funding_coverage, recommend, pros, cons, tags, rating_academics, rating_campus, rating_accommodation, rating_cost, rating_intl_office, rating_social, rating_extracurricular, rating_career'

export const useUniversityReviews = (universityId: string) => {
  const pd = usePrerenderData<UniversityPageData>('universityPage')
  const seeded = pd?.university?.id === universityId ? pd : null
  const [reviews, setReviews] = useState<ReviewRow[]>(seeded?.reviews ?? [])
  const [authors, setAuthors] = useState<Record<string, AuthorProfile>>(seeded?.authors ?? {})
  const [loading, setLoading] = useState<boolean>(!!universityId && !seeded)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!universityId) {
      setReviews([])
      setAuthors({})
      setLoading(false)
      return
    }
    // Hydration: reviews + author profiles came baked into the page.
    if (seeded) {
      setReviews(seeded.reviews ?? [])
      setAuthors(seeded.authors ?? {})
      setError(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()

    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: fetchError } = await supabase
          .from('reviews')
          .select(REVIEW_COLUMNS)
          .eq('university_id', universityId)
          .abortSignal(controller.signal)
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError
        const fetched = (data as ReviewRow[] | null) || []
        setReviews(fetched)

        const authorIds = [...new Set(fetched.map((r) => r.user_id).filter(Boolean))] as string[]
        if (authorIds.length > 0) {
          const { data: authorsData, error: authorsError } = await supabase
            .from('profile_public')
            .select('id, display_name, avatar_url')
            .in('id', authorIds)
            .abortSignal(controller.signal)

          if (authorsError) throw authorsError
          setAuthors(
            Object.fromEntries(
              ((authorsData as AuthorProfile[] | null) || []).map((p) => [p.id, p])
            )
          )
        } else {
          setAuthors({})
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        console.error('Error fetching reviews:', err)
        setError(err as Error)
        setReviews([])
        setAuthors({})
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    run()
    return () => controller.abort()
  }, [universityId, seeded])

  return { reviews, authors, loading, error }
}
