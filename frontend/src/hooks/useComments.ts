import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { asyncFlags, initialAsyncState, useAsyncState } from '../lib/asyncState'
import type { Tables } from '../types/database.types'

type CommentRow = Tables<'comments'>
type PublicProfile = Pick<Tables<'profile_public'>, 'id' | 'display_name'>

interface CommentThread {
  comments: CommentRow[]
  authorProfiles: Record<string, PublicProfile>
}

const NO_COMMENTS: CommentRow[] = []
const NO_PROFILES: Record<string, PublicProfile> = {}

/**
 * Lazy comment thread for one review: `idle` until `enabled`, then one
 * AsyncState (lib/asyncState.ts). Comments and author names land together.
 * `loaded` means a thread has been fetched at least once; it stays true
 * through refetches and failed refetches, as before.
 */
export const useComments = (reviewId: string, { enabled = false }: { enabled?: boolean } = {}) => {
  const { state, run, update } = useAsyncState<CommentThread>(() =>
    initialAsyncState<CommentThread>(undefined, { enabled: false })
  )
  // A read started before a successful write must not restore old text. Keep
  // a high-water mark for each edited row until this thread unmounts.
  const committedRows = useRef(new Map<string, CommentRow>())

  const load = useCallback(
    (signal?: AbortSignal) =>
      run(
        async () => {
          let query = supabase
            .from('comments')
            .select('id, review_id, user_id, parent_id, text, created_at, edited_at, deleted_at')
            .eq('review_id', reviewId)
            .order('created_at', { ascending: true })
          if (signal) query = query.abortSignal(signal)
          const { data, error } = await query
          if (error) throw error

          const comments = (data || []) as CommentRow[]
          const reconcile = () =>
            comments.map((row) => {
              const committed = committedRows.current.get(row.id)
              if (!committed) return row
              if (
                row.deleted_at ||
                (!committed.deleted_at && (row.edited_at ?? '') >= (committed.edited_at ?? ''))
              ) {
                committedRows.current.set(row.id, row)
                return row
              }
              return committed
            })
          const userIds = [...new Set(comments.filter((c) => !c.deleted_at).map((c) => c.user_id))]
          if (userIds.length === 0) return { comments: reconcile(), authorProfiles: NO_PROFILES }

          let profileQuery = supabase
            .from('profile_public')
            .select('id, display_name')
            .in('id', userIds)
          if (signal) profileQuery = profileQuery.abortSignal(signal)
          // Missing author names fall back to "Anonymous"; not an error.
          const { data: profiles } = await profileQuery
          const authorProfiles = ((profiles || []) as PublicProfile[]).reduce<
            Record<string, PublicProfile>
          >((acc, p) => {
            acc[p.id as string] = p
            return acc
          }, {})

          return { comments: reconcile(), authorProfiles }
        },
        { signal, errorLabel: 'Error fetching comments:' }
      ),
    [reviewId, run]
  )

  const { data, loading } = asyncFlags(state)
  const loaded = data !== undefined
  // First fetch only. A failed first fetch retries the next time the thread
  // is opened, not in a loop.
  const shouldLoad = enabled && !loaded

  useEffect(() => {
    if (!shouldLoad) return
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [shouldLoad, load])

  const refetch = useCallback(() => load(), [load])
  const applyComment = useCallback(
    (row: CommentRow) => {
      if (row.review_id !== reviewId) return
      committedRows.current.set(row.id, row)
      update((thread) => ({
        ...thread,
        comments: thread.comments.map((comment) => (comment.id === row.id ? row : comment)),
      }))
    },
    [reviewId, update]
  )

  return {
    comments: data?.comments ?? NO_COMMENTS,
    authorProfiles: data?.authorProfiles ?? NO_PROFILES,
    loading,
    loaded,
    refetch,
    applyComment,
  }
}
