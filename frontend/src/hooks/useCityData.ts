import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePrerenderData } from '../lib/prerenderData'
import { slugify } from '../lib/seo/slugify'
import type { Tables } from '../types/database.types'

type UniRow = Tables<'universities'>

export interface CityPageData {
  city?: string
  universities?: UniRow[]
  reviewCount?: number
}

const UNI_COLS =
  'id, name, name_zh, city, country, province, uni_category, slug, logo_url, is_verified, uni_type, languages_of_instruction, website, rankings, slug_aliases'

/**
 * Resolves a /city/:slug URL to a city name + its universities. The slug is
 * matched against slugify(universities.city) — the same normalization the
 * static pipeline uses, so URL and data can never disagree.
 */
export const useCityData = (citySlug: string | undefined) => {
  const pd = usePrerenderData<CityPageData>('cityPage')
  const seeded = pd?.city && slugify(pd.city) === citySlug ? pd : null
  const [city, setCity] = useState<string | null>(seeded?.city ?? null)
  const [universities, setUniversities] = useState<UniRow[]>(seeded?.universities ?? [])
  const [reviewCount, setReviewCount] = useState<number>(seeded?.reviewCount ?? 0)
  const [loading, setLoading] = useState<boolean>(!!citySlug && !seeded)
  const [resolved, setResolved] = useState<boolean>(!!seeded)

  useEffect(() => {
    if (!citySlug) {
      setLoading(false)
      return
    }
    if (seeded) {
      setCity(seeded.city ?? null)
      setUniversities(seeded.universities ?? [])
      setReviewCount(seeded.reviewCount ?? 0)
      setLoading(false)
      setResolved(true)
      return
    }
    const controller = new AbortController()
    const run = async () => {
      setLoading(true)
      try {
        // Find candidate city names first (cheap distinct scan), then match slug
        const { data: cityRows, error: cityErr } = await supabase
          .from('universities')
          .select('city')
          .abortSignal(controller.signal)
        if (cityErr) throw cityErr
        const match = [
          ...new Set(((cityRows as { city: string }[] | null) || []).map((r) => r.city)),
        ].find((c) => slugify(c) === citySlug)
        if (!match) {
          setCity(null)
          setUniversities([])
          setReviewCount(0)
          setResolved(true)
          return
        }
        const { data: unis, error: uniErr } = await supabase
          .from('universities')
          .select(UNI_COLS)
          .eq('city', match)
          .order('name', { ascending: true })
          .abortSignal(controller.signal)
        if (uniErr) throw uniErr
        const uniList = (unis as UniRow[] | null) || []
        const { count } = await supabase
          .from('reviews')
          .select('id', { count: 'exact', head: true })
          .in(
            'university_id',
            uniList.map((u) => u.id)
          )
          .abortSignal(controller.signal)
        setCity(match)
        setUniversities(uniList)
        setReviewCount(count ?? 0)
        setResolved(true)
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        console.error('Error fetching city data:', err)
        setResolved(true)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    run()
    return () => controller.abort()
  }, [citySlug, seeded])

  return { city, universities, reviewCount, loading, resolved }
}
