import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export const useCities = () => {
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('universities')
          .select('city')
          .abortSignal(controller.signal)

        if (error) throw error
        setCities([...new Set((data || []).map((u) => u.city))].sort())
      } catch (err) {
        if (err?.name === 'AbortError') return
        console.error('Error fetching cities:', err)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    run()
    return () => controller.abort()
  }, [])

  return { cities, loading }
}
