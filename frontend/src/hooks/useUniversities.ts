import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePrerenderData } from '../lib/prerenderData'
import { STATS_EMBED, withStats, type StatsEmbed, type UniStatFields } from '../lib/universityStats'
import { UNI_COLUMNS } from '../lib/queryColumns'
import type { Tables } from '../types/database.types'

const PAGE_SIZE = 20

const SORT_CONFIG = {
  name: { column: 'name', ascending: true },
  rating: { column: 'university_stats(avg_rating)', ascending: false },
  reviews: { column: 'university_stats(review_count)', ascending: false },
  // `->` (jsonb) not `->>` (text) so Postgres compares rank numbers numerically.
  rank: { column: 'rankings->shanghai_national', ascending: true },
  rank_desc: { column: 'rankings->shanghai_national', ascending: false },
} as const

export type SortBy = keyof typeof SORT_CONFIG

type UniversityRow = Pick<
  Tables<'universities'>,
  | 'id'
  | 'name'
  | 'name_zh'
  | 'city'
  | 'country'
  | 'province'
  | 'uni_category'
  | 'slug'
  | 'logo_url'
  | 'is_verified'
  | 'uni_type'
  | 'languages_of_instruction'
  | 'website'
  | 'rankings'
  | 'slug_aliases'
>

type UniversityWithStats = UniversityRow & {
  university_stats?: StatsEmbed | StatsEmbed[] | null
}

type UniversityDisplay = UniversityRow & UniStatFields

// Prerender payload written by scripts/generate_static.ts — matches the page's
// initial query so hydration shows identical content without re-fetching.
export interface UniversitiesPageData {
  for: { search: string; city: string; sortBy: string; page: number }
  rows: UniversityDisplay[]
  totalCount: number
  pageCount: number
}

export const useUniversities = ({
  search,
  city,
  sortBy,
  page,
}: {
  search?: string
  city?: string
  sortBy: SortBy
  page: number
}) => {
  const pd = usePrerenderData<UniversitiesPageData>('universitiesPage')
  const seeded =
    pd &&
    pd.for.page === page &&
    pd.for.sortBy === sortBy &&
    (pd.for.search ?? '') === (search ?? '') &&
    (pd.for.city ?? '') === (city ?? '')
      ? pd
      : null
  const [universities, setUniversities] = useState<UniversityDisplay[]>(seeded?.rows ?? [])
  const [totalCount, setTotalCount] = useState<number>(seeded?.totalCount ?? 0)
  const [pageCount, setPageCount] = useState<number>(seeded?.pageCount ?? 1)
  const [loading, setLoading] = useState<boolean>(!seeded)

  useEffect(() => {
    if (seeded) {
      setUniversities(seeded.rows)
      setTotalCount(seeded.totalCount)
      setPageCount(seeded.pageCount)
      setLoading(false)
      return
    }
    const controller = new AbortController()

    const run = async () => {
      setLoading(true)
      try {
        const query = supabase
          .from('universities')
          .select(`${UNI_COLUMNS}, ${STATS_EMBED}`, { count: 'exact' })

        // The `or(...)` string is parsed, not parameterized: commas, parens,
        // quotes and wildcard chars in raw input break the filter or widen the
        // match beyond what the user typed. Strip them before interpolating.
        const term = (search ?? '')
          .replace(/[%,()."*\\]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

        const withSearch = term
          ? query.or(
              `name.ilike.%${term}%,name_zh.ilike.%${term}%,city.ilike.%${term}%,province.ilike.%${term}%`
            )
          : query
        // 'prov:X' filters by province (the grouped select emits these);
        // anything else is a city value.
        const withCity = city?.startsWith('prov:')
          ? withSearch.eq('province', city.slice(5))
          : city
            ? withSearch.eq('city', city)
            : withSearch

        const start = (page - 1) * PAGE_SIZE
        const end = start + PAGE_SIZE - 1

        const { column, ascending } = SORT_CONFIG[sortBy] || SORT_CONFIG.reviews

        const {
          data,
          error: fetchError,
          count,
        } = await withCity
          .order(column, { ascending, nullsFirst: false })
          .order('name', { ascending: true }) // stable tiebreak — deterministic pagination
          .abortSignal(controller.signal)
          .range(start, end)

        if (fetchError) throw fetchError

        const mapped = ((data as unknown as UniversityWithStats[] | null) || []).map(
          (u): UniversityDisplay => withStats(u)
        )

        setUniversities(mapped)
        setTotalCount(count || 0)
        setPageCount(Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)))
      } catch (err) {
        if (controller.signal.aborted) return
        console.error('Error fetching universities:', err)
        setUniversities([])
        setTotalCount(0)
        setPageCount(1)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    run()
    return () => controller.abort()
  }, [search, city, sortBy, page, seeded])

  return { universities, totalCount, pageCount, loading }
}
