import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Tables } from '../types/database.types'

const PAGE_SIZE = 20

const SORT_CONFIG = {
  name: { column: 'name', ascending: true },
  rating: { column: 'university_stats(avg_rating)', ascending: false },
  reviews: { column: 'university_stats(review_count)', ascending: false },
} as const

type SortBy = keyof typeof SORT_CONFIG

type UniversityRow = Pick<
  Tables<'universities'>,
  'id' | 'name' | 'name_zh' | 'city' | 'slug' | 'logo_url'
>
type UniversityStats = Pick<
  Tables<'university_stats'>,
  'avg_rating' | 'review_count' | 'has_verified_review'
>

type UniversityWithStats = UniversityRow & {
  university_stats?: UniversityStats | UniversityStats[] | null
}

type UniversityDisplay = UniversityWithStats & {
  avg_rating: number
  review_count: number
  is_verified: boolean
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
  const [universities, setUniversities] = useState<UniversityDisplay[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [pageCount, setPageCount] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const controller = new AbortController()

    const run = async () => {
      setLoading(true)
      try {
        const query = supabase
          .from('universities')
          .select(
            'id, name, name_zh, city, slug, logo_url, university_stats(avg_rating, review_count, has_verified_review)',
            { count: 'exact' }
          )

        const withSearch = search?.trim()
          ? query.or(
              `name.ilike.%${search.trim()}%,name_zh.ilike.%${search.trim()}%,city.ilike.%${search.trim()}%`
            )
          : query
        const withCity = city ? withSearch.eq('city', city) : withSearch

        const start = (page - 1) * PAGE_SIZE
        const end = start + PAGE_SIZE - 1

        const { column, ascending } = SORT_CONFIG[sortBy] || SORT_CONFIG.reviews

        const {
          data,
          error: fetchError,
          count,
        } = await withCity
          .order(column, { ascending, nullsFirst: false })
          .abortSignal(controller.signal)
          .range(start, end)

        if (fetchError) throw fetchError

        const mapped = ((data as unknown as UniversityWithStats[] | null) || []).map(
          (u): UniversityDisplay => {
            const rawStat = u.university_stats
            const stat = Array.isArray(rawStat) ? rawStat[0] : rawStat
            return {
              ...u,
              avg_rating: stat?.avg_rating || 0,
              review_count: stat?.review_count || 0,
              is_verified: stat?.has_verified_review || false,
            }
          }
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
  }, [search, city, sortBy, page])

  return { universities, totalCount, pageCount, loading }
}
