import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePrerenderData } from '../lib/prerenderData'
import { useAuth } from '../contexts/AuthContext'
import {
  countByReviewId,
  resolveAutoSort,
  sortReviews,
  REVIEW_SERVER_ORDER,
  type ReviewSort,
  type ReviewSortChoice,
  type ReviewSortable,
} from '../lib/reviewSort'
import { REVIEW_COLUMNS, REVIEW_DETAIL_COLUMNS } from '../lib/queryColumns'
import type { UniversityPageData } from './useUniversity'
import type { Tables } from '../types/database.types'

type ReviewRow = Tables<'reviews'>
type AuthorProfile = Pick<Tables<'profile_public'>, 'id' | 'display_name' | 'avatar_url'>
export type ReviewUpvote = { count: number; upvoted: boolean }

export const REVIEW_PAGE_SIZE = 5

// Paginated fetch of one university's reviews. `sort` is the ReviewSort
// model from lib/reviewSort plus 'auto' (D4.3): the page default, which
// resolves to 'helpful' at HELPFUL_DEFAULT_MIN_REVIEWS+ reviews and
// 'newest' below. Column-backed sorts run as server ORDER BYs with an `id`
// desc tail; 'helpful' is ranked client-side (PostgREST can't ORDER BY a
// related-row count) over REVIEW_DETAIL_COLUMNS heads. `resolvedSort`
// reports what 'auto' landed on so the picker can show the real order.
// Hydrated pages ship ALL reviews plus exported upvoteCounts, so the seeded
// path sorts/slices client-side for every sort — zero requests, and the
// prerendered HTML keeps its full content for SEO.
export const useUniversityReviews = (
  universityId: string,
  page: number,
  sort: ReviewSortChoice = 'auto'
) => {
  const pd = usePrerenderData<UniversityPageData>('universityPage')
  const seeded = pd?.university?.id === universityId ? pd : null
  // useMemo keeps `all` referentially stable across renders — a fresh []
  // fallback per render would retrigger the fetch effect in a loop.
  const all = useMemo(() => seeded?.reviews ?? [], [seeded])
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [reviews, setReviews] = useState<ReviewRow[]>(() =>
    all.slice((page - 1) * REVIEW_PAGE_SIZE, page * REVIEW_PAGE_SIZE)
  )
  const [authors, setAuthors] = useState<Record<string, AuthorProfile>>(seeded?.authors ?? {})
  const [totalCount, setTotalCount] = useState<number>(all.length)
  const [pageCount, setPageCount] = useState<number>(() =>
    Math.max(1, Math.ceil(all.length / REVIEW_PAGE_SIZE))
  )
  const [loading, setLoading] = useState<boolean>(!!universityId && !seeded)
  const [error, setError] = useState<Error | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [upvotes, setUpvotes] = useState<Record<string, ReviewUpvote>>({})
  // Set once an unseeded 'auto' fetch measures the corpus — seeded pages
  // resolve synchronously and never need it.
  const [autoResolved, setAutoResolved] = useState<ReviewSort | null>(null)
  const resolvedSort: ReviewSort =
    sort !== 'auto'
      ? sort
      : seeded
        ? resolveAutoSort('auto', all.length)
        : (autoResolved ?? 'newest')

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

    const start = (page - 1) * REVIEW_PAGE_SIZE

    // Seeded pages resolve every sort client-side: the payload ships all
    // rows plus the exported upvoteCounts, so 'helpful' ranks by build-time
    // counts (same convention as hub pages — votes cast since the last
    // deploy still display on cards, only the rank is as-of-build).
    if (seeded) {
      const resolved = resolveAutoSort(sort, all.length)
      const sorted = sortReviews(all, resolved, seeded.upvoteCounts)
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
        // Ranking path for 'helpful' and unresolved 'auto': pull light
        // detail-bearing heads, count the corpus, then hydrate only the
        // page slice. 'auto' lands on 'newest' under the threshold and
        // skips the votes batch entirely.
        if (sort === 'helpful' || sort === 'auto') {
          const { data: headRows, error: headError } = await supabase
            .from('reviews')
            .select(REVIEW_DETAIL_COLUMNS)
            .eq('university_id', universityId)
            .abortSignal(controller.signal)
          if (headError) throw headError
          const heads = (headRows as ReviewSortable[] | null) || []

          const resolved = resolveAutoSort(sort, heads.length)
          setAutoResolved(resolved)

          let counts: Record<string, number> = {}
          if (resolved === 'helpful' && heads.length) {
            const { data: voteRows, error: voteError } = await supabase
              .from('upvotes')
              .select('review_id')
              .in(
                'review_id',
                heads.map((h) => h.id)
              )
              .abortSignal(controller.signal)
            if (voteError) throw voteError
            counts = countByReviewId(voteRows)
          }

          const ordered = sortReviews(heads, resolved, counts)
          const pageIds = ordered.slice(start, start + REVIEW_PAGE_SIZE).map((h) => h.id)

          const { data, error: rowsError } = pageIds.length
            ? await supabase
                .from('reviews')
                .select(REVIEW_COLUMNS)
                .in('id', pageIds)
                .abortSignal(controller.signal)
            : { data: [] as ReviewRow[], error: null }
          if (rowsError) throw rowsError
          const byId = new Map(((data as ReviewRow[] | null) || []).map((r) => [r.id, r]))
          const rows = pageIds.map((id) => byId.get(id)).filter((r): r is ReviewRow => !!r)

          setReviews(rows)
          setTotalCount(ordered.length)
          setPageCount(Math.max(1, Math.ceil(ordered.length / REVIEW_PAGE_SIZE)))
          await loadAuthors(rows)
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
  }, [universityId, page, sort, seeded, all, reloadTick])

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
    resolvedSort,
    refetch: () => setReloadTick((tick) => tick + 1),
  }
}
