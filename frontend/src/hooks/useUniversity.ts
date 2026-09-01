import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Tables } from '../types/database.types'

export const useUniversity = (slug: string) => {
  const [university, setUniversity] = useState<Tables<'universities'> | null>(null)
  const [loading, setLoading] = useState<boolean>(!!slug)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!slug) {
      setUniversity(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()

    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: fetchError } = await supabase
          .from('universities')
          .select('id, name, name_zh, city, slug, logo_url, is_verified')
          .eq('slug', slug)
          .abortSignal(controller.signal)
          .single()

        if (fetchError) throw fetchError
        setUniversity(data as Tables<'universities'>)
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        console.error('Error fetching university:', err)
        setError(err as Error)
        setUniversity(null)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    run()
    return () => controller.abort()
  }, [slug])

  return { university, loading, error }
}
