import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Tables } from '../types/database.types'

export const useCities = () => {
  const [cities, setCities] = useState<string[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const controller = new AbortController()

    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('universities')
          .select('city')
          .abortSignal(controller.signal)

        if (error) throw error
        const rows = (data || []) as Array<Pick<Tables<'universities'>, 'city'>>
        setCities([...new Set(rows.map((u) => u.city))].sort())
      } catch (err) {
        const e = err as Error
        if (e?.name === 'AbortError') return
        console.error('Error fetching cities:', e)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    run()
    return () => controller.abort()
  }, [])

  return { cities, loading }
}
