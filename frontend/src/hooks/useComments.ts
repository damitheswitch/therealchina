import { useEffect, useCallback } from 'react'
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
  const { state, run } = useAsyncState<CommentThread>(() =>
    initialAsyncState<CommentThread>(undefined, { enabled: false })
  )

  const load = useCallback(
    (signal?: AbortSignal) =>
      run(
        async () => {
          let query = supabase
            .from('comments')
            .select('id, review_id, user_id, parent_id, text, created_at')
            .eq('review_id', reviewId)
            .order('created_at', { ascending: true })
          if (signal) query = query.abortSignal(signal)
          const { data, error } = await query
          if (error) throw error

          const comments = (data || []) as CommentRow[]
          const userIds = [...new Set(comments.map((c) => c.user_id).filter(Boolean))] as string[]
          if (userIds.length === 0) return { comments, authorProfiles: NO_PROFILES }

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
          return { comments, authorProfiles }
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

  return {
    comments: data?.comments ?? NO_COMMENTS,
    authorProfiles: data?.authorProfiles ?? NO_PROFILES,
    loading,
    loaded,
    refetch,
  }
}
