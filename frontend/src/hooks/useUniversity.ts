import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePrerenderData } from '../lib/prerenderData'
import type { Tables } from '../types/database.types'

// Prerender payload written by scripts/prerender.tsx into the page.
export interface UniversityPageData {
  university?: Tables<'universities'>
  reviews?: Tables<'reviews'>[]
  authors?: Record<string, { id: string; display_name: string | null; avatar_url: string | null }>
  stats?: Tables<'university_stats'> | null
}

export const useUniversity = (slug: string | undefined) => {
  const pd = usePrerenderData<UniversityPageData>('universityPage')
  const seeded = pd?.university && pd.university.slug === slug ? pd.university : null
  const [university, setUniversity] = useState<Tables<'universities'> | null>(seeded ?? null)
  const [loading, setLoading] = useState<boolean>(!!slug && !seeded)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!slug) {
      setUniversity(null)
      setLoading(false)
      return
    }
    // Hydration: the page was rendered with this university's data already.
    if (seeded) {
      setUniversity(seeded)
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
          .from('universities')
          .select(
            'id, name, name_zh, city, country, province, uni_category, slug, logo_url, is_verified, uni_type, languages_of_instruction, website, rankings, slug_aliases'
          )
          .or(`slug.eq.${slug},slug_aliases.cs.{${slug}}`)
          .abortSignal(controller.signal)
          .single()

        if (fetchError) throw fetchError
        setUniversity(data as Tables<'universities'>)
      } catch (err) {
        // supabase-js surfaces aborts as { message: 'AbortError: ...' } with no
        // .name — check both so StrictMode double-mounts stay quiet.
        const e = err as { name?: string; message?: string }
        if (e?.name === 'AbortError' || e?.message?.startsWith('AbortError')) return
        console.error('Error fetching university:', err)
        setError(err as Error)
        setUniversity(null)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    run()
    return () => controller.abort()
  }, [slug, seeded])

  return { university, loading, error }
}
