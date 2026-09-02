import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Tables } from '../types/database.types'

type ReviewRow = Tables<'reviews'>
type AuthorProfile = Pick<Tables<'profile_public'>, 'id' | 'display_name' | 'avatar_url'>

export const useUniversityReviews = (universityId: string) => {
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [authors, setAuthors] = useState<Record<string, AuthorProfile>>({})
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!universityId) {
      setReviews([])
      setAuthors({})
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
          .select(
            'id, university_id, user_id, rating, text, program, degree_level, media, created_at'
          )
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
  }, [universityId])

  return { reviews, authors, loading, error }
}
