import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePrerenderData } from '../lib/prerenderData'
import { useAuth } from '../contexts/AuthContext'
import {
  countByReviewId,
  sortReviews,
  REVIEW_SERVER_ORDER,
  type ReviewSort,
  type ReviewSortable,
} from '../lib/reviewSort'
import type { UniversityPageData } from './useUniversity'
import type { Tables } from '../types/database.types'

type ReviewRow = Tables<'reviews'>
type AuthorProfile = Pick<Tables<'profile_public'>, 'id' | 'display_name' | 'avatar_url'>
export type ReviewUpvote = { count: number; upvoted: boolean }

export const REVIEW_PAGE_SIZE = 5

// Kept as one literal so supabase-js can infer the row shape from the select.
const REVIEW_COLUMNS =
  'id, university_id, user_id, rating, text, program, degree_level, media, created_at, enrollment_status, start_year, end_year, language_of_instruction, tuition_range, living_cost_range, funding_type, funding_coverage, recommend, pros, cons, tags, rating_academics, rating_campus, rating_accommodation, rating_cost, rating_intl_office, rating_social, rating_extracurricular, rating_career'

// Light row shape for ranking 'helpful' — enough to order, cheap to fetch for
// the full set before hydrating a single page of full rows.
const REVIEW_HEAD_COLUMNS = 'id, rating, created_at'

// Paginated fetch of one university's reviews. `sort` is the ReviewSort model
// from lib/reviewSort: column-backed sorts run as server ORDER BYs with an
// `id` desc tail so ties can't drift across page boundaries; 'helpful' is
// ranked client-side in a two-phase fetch (PostgREST can't ORDER BY a
// related-row count). `refetch` re-runs the current page (error retry).
// Hydrated pages ship ALL reviews in the prerender payload, so the seeded
// path sorts/slices client-side — no extra request for column sorts, and the
// prerendered HTML keeps its full content for SEO.
export const useUniversityReviews = (
  universityId: string,
  page: number,
  sort: ReviewSort = 'newest'
) => {
  const pd = usePrerenderData<UniversityPageData>('universityPage')
  const seeded = pd?.university?.id === universityId ? pd : null
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [reviews, setReviews] = useState<ReviewRow[]>(() =>
    (seeded?.reviews ?? []).slice((page - 1) * REVIEW_PAGE_SIZE, page * REVIEW_PAGE_SIZE)
  )
  const [authors, setAuthors] = useState<Record<string, AuthorProfile>>(seeded?.authors ?? {})
  const [totalCount, setTotalCount] = useState<number>(seeded?.reviews?.length ?? 0)
  const [pageCount, setPageCount] = useState<number>(() =>
    Math.max(1, Math.ceil((seeded?.reviews?.length ?? 0) / REVIEW_PAGE_SIZE))
  )
  const [loading, setLoading] = useState<boolean>(!!universityId && !seeded)
  const [error, setError] = useState<Error | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [upvotes, setUpvotes] = useState<Record<string, ReviewUpvote>>({})

  useEffect(() => {
    if (!universityId) {
      setReviews([])
      setAuthors({})
      setTotalCount(0)
      setPageCount(1)
      setLoading(false)
      setError(null)
      return
    }

    const all = seeded?.reviews ?? []
    const start = (page - 1) * REVIEW_PAGE_SIZE

    // Hydration + a column-backed sort: reviews + author profiles came baked
    // into the page and the payload holds them all — sort and slice purely
    // client-side, no fetch. 'helpful' still needs an upvotes batch (the
    // payload doesn't ship vote counts), so it falls through to run().
    if (seeded && sort !== 'helpful') {
      const sorted = sortReviews(all, sort)
      setReviews(sorted.slice(start, start + REVIEW_PAGE_SIZE))
      setAuthors(seeded.authors ?? {})
      setTotalCount(all.length)
      setPageCount(Math.max(1, Math.ceil(all.length / REVIEW_PAGE_SIZE)))
      setError(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()

    // Batched author-profile lookup for the resolved page rows (N+1 guard —
    // same convention as before, shared by both fetch paths).
    const loadAuthors = async (rows: ReviewRow[]) => {
      const authorIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[]
      if (authorIds.length === 0) {
        setAuthors({})
        return
      }
      const { data, error: authorsError } = await supabase
        .from('profile_public')
        .select('id, display_name, avatar_url')
        .in('id', authorIds)
        .abortSignal(controller.signal)
      if (authorsError) throw authorsError
      setAuthors(Object.fromEntries(((data as AuthorProfile[] | null) || []).map((p) => [p.id, p])))
    }

    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        if (sort === 'helpful') {
          // Rank every review by upvotes, then hydrate only the page slice.
          // Seeded pages reuse the payload rows as heads, so the single extra
          // request is the upvotes batch for this university's reviews.
          const heads: ReviewSortable[] = seeded
            ? all
            : await (async () => {
                const { data, error: headError } = await supabase
                  .from('reviews')
                  .select(REVIEW_HEAD_COLUMNS)
                  .eq('university_id', universityId)
                  .abortSignal(controller.signal)
                if (headError) throw headError
                return (data as ReviewSortable[] | null) || []
              })()

          const headIds = heads.map((h) => h.id)
          const { data: voteRows, error: voteError } = headIds.length
            ? await supabase
                .from('upvotes')
                .select('review_id')
                .in('review_id', headIds)
                .abortSignal(controller.signal)
            : { data: [] as { review_id: string }[], error: null }
          if (voteError) throw voteError

          const ordered = sortReviews(heads, 'helpful', countByReviewId(voteRows))
          const pageIds = ordered.slice(start, start + REVIEW_PAGE_SIZE).map((h) => h.id)

          let rows: ReviewRow[]
          if (seeded) {
            const byId = new Map(all.map((r) => [r.id, r]))
            rows = pageIds.map((id) => byId.get(id)).filter((r): r is ReviewRow => !!r)
            setAuthors(seeded.authors ?? {})
          } else {
            const { data, error: rowsError } = pageIds.length
              ? await supabase
                  .from('reviews')
                  .select(REVIEW_COLUMNS)
                  .in('id', pageIds)
                  .abortSignal(controller.signal)
              : { data: [] as ReviewRow[], error: null }
            if (rowsError) throw rowsError
            const byId = new Map(((data as ReviewRow[] | null) || []).map((r) => [r.id, r]))
            rows = pageIds.map((id) => byId.get(id)).filter((r): r is ReviewRow => !!r)
            await loadAuthors(rows)
          }

          setReviews(rows)
          setTotalCount(ordered.length)
          setPageCount(Math.max(1, Math.ceil(ordered.length / REVIEW_PAGE_SIZE)))
          return
        }

        const end = start + REVIEW_PAGE_SIZE - 1
        const { column, ascending } = REVIEW_SERVER_ORDER[sort]
        let query = supabase
          .from('reviews')
          .select(REVIEW_COLUMNS, { count: 'exact' })
          .eq('university_id', universityId)
          .order(column, { ascending })
        // Recency tiebreak so equal-rating pages are deterministic — skipped
        // when the primary column already is created_at.
        if (column !== 'created_at') query = query.order('created_at', { ascending: false })

        const {
          data,
          error: fetchError,
          count,
        } = await query
          .order('id', { ascending: false })
          .abortSignal(controller.signal)
          .range(start, end)

        if (fetchError) throw fetchError
        const fetched = (data as ReviewRow[] | null) || []
        setReviews(fetched)
        setTotalCount(count || 0)
        setPageCount(Math.max(1, Math.ceil((count || 0) / REVIEW_PAGE_SIZE)))
        await loadAuthors(fetched)
      } catch (err) {
        // supabase-js surfaces aborts as { message: 'AbortError: ...' } with no
        // .name — check both so StrictMode double-mounts stay quiet.
        const e = err as { name?: string; message?: string }
        if (e?.name === 'AbortError' || e?.message?.startsWith('AbortError')) return
        console.error('Error fetching reviews:', err)
        setError(err as Error)
        setReviews([])
        setAuthors({})
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    run()
    return () => controller.abort()
  }, [universityId, page, sort, seeded, reloadTick])

  // Engagement counts for the visible page — batched `.in()` queries so the
  // cards show "Comments (n)" / "Upvote (n)" without each fetching per-row
  // (same convention as useRecentReviews; cards must not query per-row).
  useEffect(() => {
    const ids = reviews.map((r) => r.id)
    if (ids.length === 0) {
      setCommentCounts({})
      setUpvotes({})
      return
    }
    const controller = new AbortController()
    const run = async () => {
      const [commentsRes, votesRes, mineRes] = await Promise.all([
        supabase
          .from('comments')
          .select('review_id')
          .in('review_id', ids)
          .abortSignal(controller.signal),
        supabase
          .from('upvotes')
          .select('review_id')
          .in('review_id', ids)
          .abortSignal(controller.signal),
        userId
          ? supabase
              .from('upvotes')
              .select('review_id')
              .eq('user_id', userId)
              .in('review_id', ids)
              .abortSignal(controller.signal)
          : Promise.resolve({ data: [] as { review_id: string }[], error: null }),
      ])
      if (controller.signal.aborted) return
      if (commentsRes.error || votesRes.error || mineRes.error) {
        console.error(
          'Error fetching engagement counts:',
          commentsRes.error ?? votesRes.error ?? mineRes.error
        )
        return
      }
      const commentCountMap: Record<string, number> = {}
      for (const row of (commentsRes.data as { review_id: string }[] | null) ?? []) {
        commentCountMap[row.review_id] = (commentCountMap[row.review_id] ?? 0) + 1
      }
      setCommentCounts(commentCountMap)

      const voteCountMap: Record<string, number> = {}
      for (const row of (votesRes.data as { review_id: string }[] | null) ?? []) {
        voteCountMap[row.review_id] = (voteCountMap[row.review_id] ?? 0) + 1
      }
      const mine = new Set(
        ((mineRes.data as { review_id: string }[] | null) ?? []).map((r) => r.review_id)
      )
      setUpvotes(
        Object.fromEntries(
          ids.map((id) => [id, { count: voteCountMap[id] ?? 0, upvoted: mine.has(id) }])
        )
      )
    }
    run()
    return () => controller.abort()
  }, [reviews, userId])

  return {
    reviews,
    authors,
    totalCount,
    pageCount,
    loading,
    error,
    commentCounts,
    upvotes,
    refetch: () => setReloadTick((tick) => tick + 1),
  }
}
