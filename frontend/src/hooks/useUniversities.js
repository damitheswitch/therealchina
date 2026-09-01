import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const PAGE_SIZE = 20

const SORT_CONFIG = {
  name: { column: 'name', ascending: true },
  rating: { column: 'university_stats(avg_rating)', ascending: false },
  reviews: { column: 'university_stats(review_count)', ascending: false },
}

export const useUniversities = ({ search, city, sortBy, page }) => {
  const [universities, setUniversities] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    const run = async () => {
      setLoading(true)
      try {
        let query = supabase
          .from('universities')
          .select(
            'id, name, name_zh, city, slug, logo_url, university_stats(avg_rating, review_count, has_verified_review)',
            { count: 'exact' }
          )

        if (search?.trim()) {
          const trimmed = search.trim()
          query = query.or(
            `name.ilike.%${trimmed}%,name_zh.ilike.%${trimmed}%,city.ilike.%${trimmed}%`
          )
        }

        if (city) {
          query = query.eq('city', city)
        }

        const start = (page - 1) * PAGE_SIZE
        const end = start + PAGE_SIZE - 1

        const { column, ascending } = SORT_CONFIG[sortBy] || SORT_CONFIG.reviews

        const {
          data,
          error: fetchError,
          count,
        } = await query
          .order(column, { ascending, nullsFirst: false })
          .abortSignal(controller.signal)
          .range(start, end)

        if (fetchError) throw fetchError

        const mapped = (data || []).map((u) => {
          const rawStat = u.university_stats
          const stat = Array.isArray(rawStat) ? rawStat[0] : rawStat
          return {
            ...u,
            avg_rating: stat?.avg_rating || 0,
            review_count: stat?.review_count || 0,
            is_verified: stat?.has_verified_review || false,
          }
        })

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
