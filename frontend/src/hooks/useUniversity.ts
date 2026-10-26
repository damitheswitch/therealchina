import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePrerenderData } from '../lib/prerenderData'
import { UNI_COLUMNS } from '../lib/queryColumns'
import { normalizeUniSlugParam } from '../lib/reviewFlow'
import type { Tables } from '../types/database.types'

// Prerender payload written by scripts/prerender.tsx into the page.
export interface UniversityPageData {
  university?: Tables<'universities'>
  reviews?: Tables<'reviews'>[]
  authors?: Record<string, { id: string; display_name: string | null; avatar_url: string | null }>
  stats?: Tables<'university_stats'> | null
  // review_id → public upvote count at export time (voter identity is never
  // exported). Drives the seeded 'helpful' rank with zero extra queries;
  // absent in payloads built before Phase 4, treated as all-zero counts.
  upvoteCounts?: Record<string, number>
}

export const useUniversity = (slug: string | undefined) => {
  // Slugs can arrive raw from a route or ?uni param — normalize before they
  // reach the .or() filter, which would break on anything but slug syntax.
  const safeSlug = normalizeUniSlugParam(slug) || undefined
  const pd = usePrerenderData<UniversityPageData>('universityPage')
  const seeded = pd?.university && pd.university.slug === safeSlug ? pd.university : null
  // The slug the current `university` row answers. On a mounted ?uni=A→B
  // navigation the row for A would otherwise be returned for one render as
  // if it were B's — and consumers key draft reads/writes off it.
  const [fetchedSlug, setFetchedSlug] = useState<string | undefined>(seeded ? safeSlug : undefined)
  const [university, setUniversity] = useState<Tables<'universities'> | null>(seeded ?? null)
  const [loading, setLoading] = useState<boolean>(!!safeSlug && !seeded)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!safeSlug) {
      setUniversity(null)
      setFetchedSlug(undefined)
      setError(null)
      setLoading(false)
      return
    }
    // Hydration: the page was rendered with this university's data already.
    if (seeded) {
      setUniversity(seeded)
      setFetchedSlug(safeSlug)
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
          .select(UNI_COLUMNS)
          .or(`slug.eq.${safeSlug},slug_aliases.cs.{${safeSlug}}`)
          .abortSignal(controller.signal)
          // maybeSingle: an unresolved slug is a null row, not an error.
          .maybeSingle()

        if (fetchError) throw fetchError
        if (controller.signal.aborted) return
        setUniversity((data as Tables<'universities'>) ?? null)
        setFetchedSlug(safeSlug)
      } catch (err) {
        // supabase-js surfaces aborts as { message: 'AbortError: ...' } with no
        // .name — check both so StrictMode double-mounts stay quiet.
        const e = err as { name?: string; message?: string }
        if (e?.name === 'AbortError' || e?.message?.startsWith('AbortError')) return
        console.error('Error fetching university:', err)
        setError(err as Error)
        setUniversity(null)
        // The lookup answered — with failure — for this slug.
        setFetchedSlug(safeSlug)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    run()
    return () => controller.abort()
  }, [safeSlug, seeded])

  const stale = fetchedSlug !== safeSlug
  return {
    university: stale ? null : university,
    loading: stale || loading,
    error: stale ? null : error,
  }
}
