import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePrerenderData } from '../lib/prerenderData'
import { useAuth } from '../contexts/AuthContext'
import type { UniversityPageData } from './useUniversity'
import type { Tables } from '../types/database.types'

type ReviewRow = Tables<'reviews'>
type AuthorProfile = Pick<Tables<'profile_public'>, 'id' | 'display_name' | 'avatar_url'>
export type ReviewUpvote = { count: number; upvoted: boolean }

export const REVIEW_PAGE_SIZE = 5

// Kept as one literal so supabase-js can infer the row shape from the select.
const REVIEW_COLUMNS =
  'id, university_id, user_id, rating, text, program, degree_level, media, created_at, enrollment_status, start_year, end_year, language_of_instruction, tuition_range, living_cost_range, funding_type, funding_coverage, recommend, pros, cons, tags, rating_academics, rating_campus, rating_accommodation, rating_cost, rating_intl_office, rating_social, rating_extracurricular, rating_career'

// Paginated fetch of one university's reviews, newest first. `id` is a
// secondary sort key so reviews sharing a created_at timestamp can't drift
// across page boundaries. `refetch` re-runs the current page (error retry).
// Hydrated pages ship ALL reviews in the prerender payload, so the seeded
// path just slices client-side — no extra request, and the prerendered HTML
// keeps its full content for SEO.
export const useUniversityReviews = (universityId: string, page: number) => {
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
    // Hydration: reviews + author profiles came baked into the page. Slice
    // the requested page out of the seeded set — the payload holds them all.
    if (seeded) {
      const all = seeded.reviews ?? []
      const start = (page - 1) * REVIEW_PAGE_SIZE
      setReviews(all.slice(start, start + REVIEW_PAGE_SIZE))
      setAuthors(seeded.authors ?? {})
      setTotalCount(all.length)
      setPageCount(Math.max(1, Math.ceil(all.length / REVIEW_PAGE_SIZE)))
      setError(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()

    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const start = (page - 1) * REVIEW_PAGE_SIZE
        const end = start + REVIEW_PAGE_SIZE - 1

        const {
          data,
          error: fetchError,
          count,
        } = await supabase
          .from('reviews')
          .select(REVIEW_COLUMNS, { count: 'exact' })
          .eq('university_id', universityId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .abortSignal(controller.signal)
          .range(start, end)

        if (fetchError) throw fetchError
        const fetched = (data as ReviewRow[] | null) || []
        setReviews(fetched)
        setTotalCount(count || 0)
        setPageCount(Math.max(1, Math.ceil((count || 0) / REVIEW_PAGE_SIZE)))

        const authorIds = [...new Set(fetched.map((r) => r.user_id).filter(Boolean))] as string[]
        if (authorIds.length > 0) {
          const { data: authorsData, error: authorsError } = await supabase
            .from('profile_public')
            .select('id, display_name, avatar_url')
            .in('id', authorIds)
            .abortSignal(controller.signal)

          if (authorsError) throw authorsError
          setAuthors(
            Object.fromEntries(
              ((authorsData as AuthorProfile[] | null) || []).map((p) => [p.id, p])
            )
          )
        } else {
          setAuthors({})
        }
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
  }, [universityId, page, seeded, reloadTick])

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
