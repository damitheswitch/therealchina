import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePrerenderData } from '../lib/prerenderData'
import type { UniversityPageData } from './useUniversity'
import type { ReviewSummaryInput } from '../lib/reviewSummary'
import type { UniversityExtrasInput } from '../lib/universityExtras'
import type { Tables } from '../types/database.types'

// Slim aggregate row — the union of everything buildReviewSummary and
// buildUniversityExtras read. `text` and `user_id` stay out, so the verdict
// and sidebar aggregates stay cheap even as review counts grow.
export type ReviewAggregateRow = ReviewSummaryInput & UniversityExtrasInput

const AGGREGATE_COLUMNS =
  'rating, recommend, rating_academics, rating_campus, rating_accommodation, rating_cost, rating_intl_office, rating_social, rating_extracurricular, rating_career, tags, enrollment_status, tuition_range, living_cost_range, program, degree_level, funding_type, funding_coverage, language_of_instruction, media'

// PostgREST caps responses at max-rows (default 1000). The aggregates are
// computed client-side over ALL reviews, so we page through in chunks
// instead of silently truncating at the cap.
const SUMMARY_CHUNK = 1000

// Fetches the aggregate row set for the "Student verdict" card and the
// university sidebar on the university page. `loadedUniversityId` records
// which university the rows belong to — it is assigned on EVERY terminal
// path (success, error, empty, no-id), so a consumer's
// `loadedUniversityId === universityId` gate resolves on failure too and can
// never stick the page on a loader.
//
// Hydrated pages already carry every review in the prerender payload —
// those rows are reused verbatim (they're a superset of the slim row) and
// also exposed as `hydratedReviews`/`hydratedAuthors` so the page can build
// SEO markup without a second source of truth.
export const useUniversityReviewSummary = (universityId: string | undefined) => {
  const pd = usePrerenderData<UniversityPageData>('universityPage')
  const seeded = pd?.university?.id === universityId ? pd : null

  const [summaryRows, setSummaryRows] = useState<ReviewAggregateRow[]>(seeded?.reviews ?? [])
  const [loading, setLoading] = useState<boolean>(!!universityId && !seeded)
  const [loadedUniversityId, setLoadedUniversityId] = useState<string | undefined>(
    seeded ? universityId : undefined
  )

  useEffect(() => {
    if (!universityId) {
      setSummaryRows([])
      setLoading(false)
      setLoadedUniversityId(universityId)
      return
    }
    // Hydration: the full set is already here — project it onto the slim row
    // (a superset satisfies the Pick) and skip the network entirely.
    if (seeded) {
      setSummaryRows(seeded.reviews ?? [])
      setLoading(false)
      setLoadedUniversityId(universityId)
      return
    }

    const controller = new AbortController()

    const run = async () => {
      setLoading(true)
      const rows: ReviewAggregateRow[] = []
      try {
        for (let offset = 0; ; offset += SUMMARY_CHUNK) {
          const { data, error: fetchError } = await supabase
            .from('reviews')
            .select(AGGREGATE_COLUMNS)
            .eq('university_id', universityId)
            .order('created_at', { ascending: false })
            .abortSignal(controller.signal)
            .range(offset, offset + SUMMARY_CHUNK - 1)

          if (fetchError) throw fetchError
          rows.push(...((data as ReviewAggregateRow[] | null) || []))
          if (controller.signal.aborted) return
          if (!data || data.length < SUMMARY_CHUNK) break
        }
        setSummaryRows(rows)
      } catch (err) {
        const e = err as { name?: string; message?: string }
        if (e?.name === 'AbortError' || e?.message?.startsWith('AbortError')) return
        console.error('Error fetching review summary:', err)
        // Degrade gracefully: no verdict card, but the page still renders.
        setSummaryRows([])
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setLoadedUniversityId(universityId)
        }
      }
    }

    run()
    return () => controller.abort()
  }, [universityId, seeded])

  return {
    summaryRows,
    loading,
    loadedUniversityId,
    hydratedReviews: seeded?.reviews ?? null,
    hydratedAuthors: seeded?.authors ?? {},
  }
}
