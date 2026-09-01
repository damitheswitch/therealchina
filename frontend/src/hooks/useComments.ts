import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Tables } from '../types/database.types'

type CommentRow = Tables<'comments'>
type PublicProfile = Pick<Tables<'profile_public'>, 'id' | 'display_name'>

export const useComments = (reviewId: string, { enabled = false }: { enabled?: boolean } = {}) => {
  const [comments, setComments] = useState<CommentRow[]>([])
  const [authorProfiles, setAuthorProfiles] = useState<Record<string, PublicProfile>>({})
  const [loading, setLoading] = useState<boolean>(false)
  const [loaded, setLoaded] = useState<boolean>(false)
  const mounted = useRef<boolean>(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const fetchComments = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('id, review_id, user_id, parent_id, text, created_at')
        .eq('review_id', reviewId)
        .order('created_at', { ascending: true })

      if (error) throw error

      const fetched = (data || []) as CommentRow[]
      if (!mounted.current) return
      setComments(fetched)

      const userIds = [...new Set(fetched.map((c) => c.user_id).filter(Boolean))] as string[]

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profile_public')
          .select('id, display_name')
          .in('id', userIds)

        if (!mounted.current) return
        const map = ((profiles || []) as PublicProfile[]).reduce<Record<string, PublicProfile>>(
          (acc, p) => {
            acc[p.id as string] = p
            return acc
          },
          {}
        )
        setAuthorProfiles(map)
      } else {
        setAuthorProfiles({})
      }
      setLoaded(true)
    } catch (err) {
      console.error('Error fetching comments:', err)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [reviewId])

  useEffect(() => {
    if (enabled && !loaded) {
      fetchComments()
    }
  }, [enabled, loaded, fetchComments])

  return { comments, authorProfiles, loading, loaded, refetch: fetchComments }
}
