import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Tables } from '../types/database.types'

export const useUniversityStats = (universityId: string) => {
  const [stats, setStats] = useState<Tables<'university_stats'> | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

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
        setStats(fetchError ? null : (data as Tables<'university_stats'>))
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        console.error('Error fetching university stats:', err)
        setError(err as Error)
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
