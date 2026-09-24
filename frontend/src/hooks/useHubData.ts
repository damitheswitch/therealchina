import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePrerenderData } from '../lib/prerenderData'
import type { HubDef } from '../lib/seo/programs'
import type { Tables } from '../types/database.types'

type UniRow = Tables<'universities'>
type ReviewRow = Tables<'reviews'>

export interface HubPageData {
  kind?: 'program' | 'degree'
  hub?: HubDef
  universities?: UniRow[]
  reviews?: ReviewRow[]
  authors?: Record<string, { id: string; display_name: string | null; avatar_url: string | null }>
}

const UNI_COLS =
  'id, name, name_zh, city, country, province, uni_category, slug, logo_url, is_verified, uni_type, languages_of_instruction, website, rankings, slug_aliases'
const REVIEW_COLS =
  'id, university_id, user_id, rating, text, program, degree_level, media, created_at, enrollment_status, start_year, end_year, language_of_instruction, tuition_range, living_cost_range, funding_type, funding_coverage, recommend, pros, cons, tags, rating_academics, rating_campus, rating_accommodation, rating_cost, rating_intl_office, rating_social, rating_extracurricular, rating_career'

/**
 * Shared fetcher for /program/:slug and /degree/:slug hubs. `resolve` maps a
 * review row to its hub slug (normalizeProgram / normalizeDegree) and
 * `lookup` returns the HubDef for the URL param.
 */
export const useHubData = (
  kind: 'program' | 'degree',
  slug: string | undefined,
  lookup: (slug: string) => HubDef | null,
  resolve: (review: ReviewRow) => string | null
) => {
  const pd = usePrerenderData<HubPageData>('hubPage')
  const seeded = pd?.kind === kind && pd.hub?.slug === slug ? pd : null
  const [hub, setHub] = useState<HubDef | null>(seeded?.hub ?? (slug ? lookup(slug) : null))
  const [universities, setUniversities] = useState<UniRow[]>(seeded?.universities ?? [])
  const [reviews, setReviews] = useState<ReviewRow[]>(seeded?.reviews ?? [])
  const [authors, setAuthors] = useState<HubPageData['authors']>(seeded?.authors ?? {})
  const [loading, setLoading] = useState<boolean>(!!slug && !!lookup(slug) && !seeded)
  const [resolved, setResolved] = useState<boolean>(!!seeded || (!!slug && !lookup(slug)))

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }
    const def = lookup(slug)
    setHub(def)
    if (!def) {
      setUniversities([])
      setReviews([])
      setAuthors({})
      setResolved(true)
      setLoading(false)
      return
    }
    if (seeded) {
      setUniversities(seeded.universities ?? [])
      setReviews(seeded.reviews ?? [])
      setAuthors(seeded.authors ?? {})
      setResolved(true)
      setLoading(false)
      return
    }
    const controller = new AbortController()
    const run = async () => {
      setLoading(true)
      try {
        const { data, error: fetchError } = await supabase
          .from('reviews')
          .select(REVIEW_COLS)
          .abortSignal(controller.signal)
        if (fetchError) throw fetchError
        const rows = ((data as ReviewRow[] | null) || []).filter((r) => resolve(r) === slug)
        const uniIds = [...new Set(rows.map((r) => r.university_id))]
        const authorIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[]
        const [uniRes, authorRes] = await Promise.all([
          uniIds.length
            ? supabase
                .from('universities')
                .select(UNI_COLS)
                .in('id', uniIds)
                .order('name')
                .abortSignal(controller.signal)
            : Promise.resolve({ data: [], error: null }),
          authorIds.length
            ? supabase
                .from('profile_public')
                .select('id, display_name, avatar_url')
                .in('id', authorIds)
                .abortSignal(controller.signal)
            : Promise.resolve({ data: [], error: null }),
        ])
        if (uniRes.error) throw uniRes.error
        if (authorRes.error) throw authorRes.error
        setReviews(rows)
        setUniversities((uniRes.data as UniRow[] | null) || [])
        setAuthors(
          Object.fromEntries(
            ((authorRes.data as { id: string }[] | null) || []).map((a) => [a.id, a])
          ) as HubPageData['authors']
        )
        setResolved(true)
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        console.error(`Error fetching ${kind} hub data:`, err)
        setResolved(true)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    run()
    return () => controller.abort()
  }, [kind, slug, lookup, resolve, seeded])

  return { hub, universities, reviews, authors, loading, resolved }
}
