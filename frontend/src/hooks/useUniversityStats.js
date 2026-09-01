import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export const useUniversityStats = (universityId) => {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!universityId) {
      setStats(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()

    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: fetchError } = await supabase
          .from('university_stats')
          .select('avg_rating, review_count, has_verified_review')
          .eq('university_id', universityId)
          .abortSignal(controller.signal)
          .single()

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError
        setStats(fetchError ? null : data)
      } catch (err) {
        if (err?.name === 'AbortError') return
        console.error('Error fetching university stats:', err)
        setError(err)
        setStats(null)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    run()
    return () => controller.abort()
  }, [universityId])

  return { stats, loading, error }
}
