import { useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePrerenderData } from '../lib/prerenderData'
import { NOT_FOUND, asyncFlags, initialAsyncState, useAsyncState } from '../lib/asyncState'
import { slugify } from '../lib/seo/slugify'
import { STATS_EMBED, withStats, type StatsEmbed, type UniStatFields } from '../lib/universityStats'
import { UNI_COLUMNS } from '../lib/queryColumns'
import type { Tables } from '../types/database.types'

type UniRow = Tables<'universities'>
export type CityUni = UniRow & UniStatFields

export interface CityPageData {
  city?: string
  universities?: CityUni[]
  reviewCount?: number
}

const NO_UNIS: CityUni[] = []

/**
 * Resolves a /city/:slug URL to a city name + its universities. The slug is
 * matched against slugify(universities.city) — the same normalization the
 * static pipeline uses, so URL and data can never disagree.
 *
 * State lives in one AsyncState (lib/asyncState.ts): a matching prerender
 * payload starts in `ready` with no fetch; an unknown city ends in `notFound`.
 */
export const useCityData = (citySlug: string | undefined) => {
  const pd = usePrerenderData<CityPageData>('cityPage')
  const seeded = pd?.city && slugify(pd.city) === citySlug ? pd : undefined
  const { state, run, seed, reset } = useAsyncState<CityPageData>(() =>
    initialAsyncState(seeded, { enabled: !!citySlug })
  )

  useEffect(() => {
    if (!citySlug) {
      reset()
      return
    }
    if (seeded) {
      seed(seeded)
      return
    }
    const controller = new AbortController()
    void run(
      async () => {
        // Find candidate city names first (cheap distinct scan), then match slug
        const { data: cityRows, error: cityErr } = await supabase
          .from('universities')
          .select('city')
          .abortSignal(controller.signal)
        if (cityErr) throw cityErr
        const match = [
          ...new Set(
            ((cityRows as { city: string | null }[] | null) || [])
              .map((r) => r.city)
              .filter((c): c is string => Boolean(c))
          ),
        ].find((c) => slugify(c) === citySlug)
        if (!match) return NOT_FOUND
        const { data: unis, error: uniErr } = await supabase
          .from('universities')
          .select(`${UNI_COLUMNS}, ${STATS_EMBED}`)
          .eq('city', match)
          .order('name', { ascending: true })
          .abortSignal(controller.signal)
        if (uniErr) throw uniErr
        const uniList = (
          (unis as (UniRow & { university_stats?: StatsEmbed | StatsEmbed[] | null })[] | null) ||
          []
        ).map(withStats)
        const { count } = await supabase
          .from('reviews')
          .select('id', { count: 'exact', head: true })
          .in(
            'university_id',
            uniList.map((u) => u.id)
          )
          .abortSignal(controller.signal)
        return { city: match, universities: uniList, reviewCount: count ?? 0 }
      },
      { signal: controller.signal, errorLabel: 'Error fetching city data:' }
    )
    return () => controller.abort()
  }, [citySlug, seeded, run, seed, reset])

  const { data, loading, settled } = asyncFlags(state)
  return {
    city: data?.city ?? null,
    universities: data?.universities ?? NO_UNIS,
    reviewCount: data?.reviewCount ?? 0,
    loading,
    resolved: settled,
  }
}
