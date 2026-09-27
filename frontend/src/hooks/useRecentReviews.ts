import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePrerenderData } from '../lib/prerenderData'
import {
  countByReviewId,
  sortReviews,
  DEFAULT_REVIEW_SORT,
  REVIEW_SERVER_ORDER,
  type ReviewSort,
  type ReviewSortable,
} from '../lib/reviewSort'
import type { Tables } from '../types/database.types'

export type RecentReview = Tables<'reviews'>
export type UniLite = { id: string; name: string; slug: string }
export type AuthorLite = { id: string; display_name: string | null; avatar_url: string | null }

export interface ReviewsPageData {
  reviews: RecentReview[]
  universities: Record<string, UniLite>
  authors: Record<string, AuthorLite>
  // review_id → public upvote count (batch — cards must not query per-row)
  upvoteCounts?: Record<string, number>
}

const REVIEW_COLUMNS =
  'id, university_id, user_id, rating, text, program, degree_level, media, created_at, enrollment_status, start_year, end_year, language_of_instruction, tuition_range, living_cost_range, funding_type, funding_coverage, recommend, pros, cons, tags, rating_academics, rating_campus, rating_accommodation, rating_cost, rating_intl_office, rating_social, rating_extracurricular, rating_career'

const REVIEW_HEAD_COLUMNS = 'id, rating, created_at'

const PAGE_SIZE = 50

// The /reviews feed. `sort` follows the shared ReviewSort model: the prerender
// payload only matches the default 'newest' order, so any other sort bypasses
// hydration and fetches. Column sorts ORDER BY server-side before the page
// cap; 'helpful' ranks the whole corpus client-side (PostgREST can't ORDER BY
// an upvote count) so the result is a true global top-N, not "best of the
// latest 50".
export const useRecentReviews = (userId?: string | null, sort: ReviewSort = 'newest') => {
  const pd = usePrerenderData<ReviewsPageData>('reviewsPage')
  const seeded = sort === DEFAULT_REVIEW_SORT ? pd : null
  const [reviews, setReviews] = useState<RecentReview[]>(seeded?.reviews ?? [])
  const [universities, setUniversities] = useState<Record<string, UniLite>>(
    seeded?.universities ?? {}
  )
  const [authors, setAuthors] = useState<Record<string, AuthorLite>>(seeded?.authors ?? {})
  const [upvoteCounts, setUpvoteCounts] = useState<Record<string, number>>(
    seeded?.upvoteCounts ?? {}
  )
  const [upvotedMine, setUpvotedMine] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<boolean>(!seeded)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (seeded) {
      setReviews(seeded.reviews)
      setUniversities(seeded.universities)
      setAuthors(seeded.authors)
      setUpvoteCounts(seeded.upvoteCounts ?? {})
      setError(null)
      setLoading(false)
      // Payload can't know the viewer — fetch own upvotes in one query.
      if (userId && seeded.reviews.length) {
        const c = new AbortController()
        supabase
          .from('upvotes')
          .select('review_id')
          .eq('user_id', userId)
          .in(
            'review_id',
            seeded.reviews.map((r) => r.id)
          )
          .abortSignal(c.signal)
          .then(({ data }) => {
            if (!c.signal.aborted && data) {
              setUpvotedMine(new Set(data.map((r) => r.review_id as string)))
            }
          })
        return () => c.abort()
      }
      return
    }
    const controller = new AbortController()
    const run = async () => {
      setLoading(true)
      try {
        let rows: RecentReview[]
        // 'helpful' computes counts across the corpus up front — reused below
        // so the visible page doesn't need a second upvotes batch.
        let helpfulCounts: Record<string, number> | null = null

        if (sort === 'helpful') {
          const [headsRes, votesRes] = await Promise.all([
            supabase.from('reviews').select(REVIEW_HEAD_COLUMNS).abortSignal(controller.signal),
            supabase.from('upvotes').select('review_id').abortSignal(controller.signal),
          ])
          if (headsRes.error) throw headsRes.error
          if (votesRes.error) throw votesRes.error
          helpfulCounts = countByReviewId(votesRes.data as { review_id: string }[] | null)
          const topIds = sortReviews(
            (headsRes.data as ReviewSortable[] | null) || [],
            'helpful',
            helpfulCounts
          )
            .slice(0, PAGE_SIZE)
            .map((h) => h.id)
          const { data, error: rowsError } = topIds.length
            ? await supabase
                .from('reviews')
                .select(REVIEW_COLUMNS)
                .in('id', topIds)
                .abortSignal(controller.signal)
            : { data: [] as RecentReview[], error: null }
          if (rowsError) throw rowsError
          const byId = new Map(((data as RecentReview[] | null) || []).map((r) => [r.id, r]))
          rows = topIds.map((id) => byId.get(id)).filter((r): r is RecentReview => !!r)
        } else {
          const { column, ascending } = REVIEW_SERVER_ORDER[sort]
          let query = supabase.from('reviews').select(REVIEW_COLUMNS).order(column, { ascending })
          // Recency + id tiebreaks — deterministic top-N at equal ratings.
          if (column !== 'created_at') query = query.order('created_at', { ascending: false })
          const { data, error: fetchError } = await query
            .order('id', { ascending: false })
            .limit(PAGE_SIZE)
            .abortSignal(controller.signal)
          if (fetchError) throw fetchError
          rows = (data as RecentReview[] | null) || []
        }
        setReviews(rows)

        const uniIds = [...new Set(rows.map((r) => r.university_id))]
        const authorIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[]
        const reviewIds = rows.map((r) => r.id)
        const [uniRes, authorRes, upRes, mineRes] = await Promise.all([
          supabase
            .from('universities')
            .select('id, name, slug')
            .in('id', uniIds)
            .abortSignal(controller.signal),
          authorIds.length
            ? supabase
                .from('profile_public')
                .select('id, display_name, avatar_url')
                .in('id', authorIds)
                .abortSignal(controller.signal)
            : Promise.resolve({ data: [], error: null }),
          !helpfulCounts && reviewIds.length
            ? supabase
                .from('upvotes')
                .select('review_id')
                .in('review_id', reviewIds)
                .abortSignal(controller.signal)
            : Promise.resolve({ data: [], error: null }),
          userId && reviewIds.length
            ? supabase
                .from('upvotes')
                .select('review_id')
                .eq('user_id', userId)
                .in('review_id', reviewIds)
                .abortSignal(controller.signal)
            : Promise.resolve({ data: [], error: null }),
        ])
        if (uniRes.error) throw uniRes.error
        if (authorRes.error) throw authorRes.error
        setUpvoteCounts(
          helpfulCounts ?? countByReviewId(upRes.data as { review_id: string }[] | null)
        )
        setUpvotedMine(
          new Set(((mineRes.data as { review_id: string }[] | null) || []).map((r) => r.review_id))
        )
        setUniversities(
          Object.fromEntries(((uniRes.data as UniLite[] | null) || []).map((u) => [u.id, u]))
        )
        setAuthors(
          Object.fromEntries(((authorRes.data as AuthorLite[] | null) || []).map((a) => [a.id, a]))
        )
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        console.error('Error fetching recent reviews:', err)
        setError(err as Error)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    run()
    return () => controller.abort()
  }, [seeded, userId, sort])

  return { reviews, universities, authors, upvoteCounts, upvotedMine, loading, error }
}
