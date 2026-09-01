import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export const useUniversityReviews = (universityId) => {
  const [reviews, setReviews] = useState([])
  const [authors, setAuthors] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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
        setReviews(data || [])

        const authorIds = [...new Set((data || []).map((r) => r.user_id).filter(Boolean))]
        if (authorIds.length > 0) {
          const { data: authorsData, error: authorsError } = await supabase
            .from('profile_public')
            .select('id, display_name, avatar_url')
            .in('id', authorIds)
            .abortSignal(controller.signal)

          if (authorsError) throw authorsError
          setAuthors(Object.fromEntries((authorsData || []).map((p) => [p.id, p])))
        } else {
          setAuthors({})
        }
      } catch (err) {
        if (err?.name === 'AbortError') return
        console.error('Error fetching reviews:', err)
        setError(err)
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
