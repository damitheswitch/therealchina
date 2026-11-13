import { useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePrerenderData } from '../lib/prerenderData'
import { asyncFlags, initialAsyncState, useAsyncState } from '../lib/asyncState'
import { STATS_EMBED, withStats, type StatsEmbed, type UniStatFields } from '../lib/universityStats'
import { REVIEW_COLUMNS, UNI_COLUMNS } from '../lib/queryColumns'
import { upvoteCountsFromRows } from '../lib/reviewSort'
import type { HubDef } from '../lib/seo/programs'
import type { Tables } from '../types/database.types'

type UniRow = Tables<'universities'>
type ReviewRow = Tables<'reviews'>
export type UniDisplayRow = UniRow & UniStatFields

export interface HubPageData {
  kind?: 'program' | 'degree'
  hub?: HubDef
  universities?: UniDisplayRow[]
  reviews?: ReviewRow[]
  authors?: Record<string, { id: string; display_name: string | null; avatar_url: string | null }>
  upvoteCounts?: Record<string, number>
}

// What the hook holds: the prerender payload shape plus the viewer's own
// upvotes, which the public payload can never know.
type HubData = HubPageData & { upvotedMine?: Set<string> }

const NO_UNIS: UniDisplayRow[] = []
const NO_REVIEWS: ReviewRow[] = []
const NO_AUTHORS: NonNullable<HubPageData['authors']> = {}
const NO_COUNTS: Record<string, number> = {}
const NO_UPVOTES: Set<string> = new Set()
const UNKNOWN_HUB = asyncFlags<HubData>({ status: 'notFound' })

/**
 * Shared fetcher for /program/:slug and /degree/:slug hubs. `resolve` maps a
 * review row to its hub slug (normalizeProgram / normalizeDegree) and
 * `lookup` returns the HubDef for the URL param.
 *
 * State lives in one AsyncState (lib/asyncState.ts). A matching prerender
 * payload starts in `ready` with no fetch. An unknown slug is known
 * synchronously from `lookup`, so it reads as notFound without a request.
 */
export const useHubData = (
  kind: 'program' | 'degree',
  slug: string | undefined,
  lookup: (slug: string) => HubDef | null,
  resolve: (review: ReviewRow) => string | null,
  userId?: string | null
) => {
  const pd = usePrerenderData<HubPageData>('hubPage')
  const seeded = pd?.kind === kind && pd.hub?.slug === slug ? pd : undefined
  const hub = seeded?.hub ?? (slug ? lookup(slug) : null)
  const { state, run, seed, update, reset } = useAsyncState<HubData>(() =>
    initialAsyncState<HubData>(seeded, { enabled: !!slug && !!lookup(slug) })
  )

  useEffect(() => {
    if (!slug || !lookup(slug)) {
      reset()
      return
    }
    if (seeded) {
      seed(seeded)
      // Payload can't know the viewer — fetch own upvotes in one query.
      const rows = seeded.reviews ?? []
      if (userId && rows.length) {
        const c = new AbortController()
        supabase
          .from('upvotes')
          .select('review_id')
          .eq('user_id', userId)
          .in(
            'review_id',
            rows.map((r) => r.id)
          )
          .abortSignal(c.signal)
          .then(({ data }) => {
            if (!c.signal.aborted && data) {
              const mine = new Set(data.map((r) => r.review_id as string))
              update((d) => ({ ...d, upvotedMine: mine }))
            }
          })
        return () => c.abort()
      }
      return
    }
    const controller = new AbortController()
    void run(
      async () => {
        const { data, error: fetchError } = await supabase
          .from('reviews')
          .select(REVIEW_COLUMNS)
          .abortSignal(controller.signal)
        if (fetchError) throw fetchError
        const rows = ((data as ReviewRow[] | null) || []).filter((r) => resolve(r) === slug)
        const uniIds = [...new Set(rows.map((r) => r.university_id))]
        const authorIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[]
        const reviewIds = rows.map((r) => r.id)
        const [uniRes, authorRes, mineRes] = await Promise.all([
          uniIds.length
            ? supabase
                .from('universities')
                .select(`${UNI_COLUMNS}, ${STATS_EMBED}`)
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
        return {
          reviews: rows,
          universities: (
            (uniRes.data as
              (UniRow & { university_stats?: StatsEmbed | StatsEmbed[] | null })[] | null) || []
          ).map(withStats),
          authors: Object.fromEntries(
            ((authorRes.data as { id: string }[] | null) || []).map((a) => [a.id, a])
          ) as HubPageData['authors'],
          // Rows carry the trigger-maintained upvote_count (migration 050).
          upvoteCounts: upvoteCountsFromRows(rows),
          upvotedMine: new Set(
            ((mineRes.data as { review_id: string }[] | null) || []).map((r) => r.review_id)
          ),
        }
      },
      { signal: controller.signal, errorLabel: `Error fetching ${kind} hub data:` }
    )
    return () => controller.abort()
  }, [kind, slug, lookup, resolve, seeded, userId, run, seed, update, reset])

  const { data, loading, settled } = slug && !hub ? UNKNOWN_HUB : asyncFlags(state)
  return {
    hub,
    universities: data?.universities ?? NO_UNIS,
    reviews: data?.reviews ?? NO_REVIEWS,
    authors: data?.authors ?? NO_AUTHORS,
    upvoteCounts: data?.upvoteCounts ?? NO_COUNTS,
    upvotedMine: data?.upvotedMine ?? NO_UPVOTES,
    loading,
    resolved: settled,
  }
}
