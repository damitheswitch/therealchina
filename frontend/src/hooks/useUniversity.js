import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export const useUniversity = (slug) => {
  const [university, setUniversity] = useState(null)
  const [loading, setLoading] = useState(!!slug)
  const [error, setError] = useState(null)

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
        setUniversity(data)
      } catch (err) {
        if (err?.name === 'AbortError') return
        console.error('Error fetching university:', err)
        setError(err)
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
