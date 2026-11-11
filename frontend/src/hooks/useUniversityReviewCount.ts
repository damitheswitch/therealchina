import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Cheap head-only count of the reviews for one university (by slug), used for
// the "N students have reviewed X" nudge on the first review screen. Returns
// null while loading, on error, or when no real university is selected, so
// callers show nothing instead of a made-up number.
export const useUniversityReviewCount = (slug: string): number | null => {
  const [state, setState] = useState<{ slug: string; count: number | null }>({
    slug: '',
    count: null,
  })

  useEffect(() => {
    if (!slug || slug === '__not_listed') return
    const controller = new AbortController()
    const run = async () => {
      const { count, error } = await supabase
        .from('reviews')
        .select('id, universities!inner(slug)', { count: 'exact', head: true })
        .eq('universities.slug', slug)
        .abortSignal(controller.signal)
      if (controller.signal.aborted) return
      setState({ slug, count: error ? null : (count ?? null) })
    }
    run()
    return () => controller.abort()
  }, [slug])

  return state.slug === slug ? state.count : null
}
