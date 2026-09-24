import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

// UpvoteButton component - calls toggle_upvote RPC. Pages that already
// batch-fetched upvotes pass initialCount/initialUpvoted so cards don't
// issue a query each (N+1 on review lists).
export const UpvoteButton = ({ reviewId, initialCount, initialUpvoted }) => {
  const { user } = useAuth()
  const { showToast } = useToast()
  const seeded = initialCount !== undefined
  const [upvoted, setUpvoted] = useState(!!initialUpvoted)
  const [count, setCount] = useState(initialCount ?? 0)
  const [loading, setLoading] = useState(false)

  // Seeded values can arrive async (payload counts / viewer's own votes) —
  // sync state when the props land.
  useEffect(() => {
    if (initialUpvoted !== undefined) setUpvoted(initialUpvoted)
  }, [initialUpvoted])
  useEffect(() => {
    if (initialCount !== undefined) setCount(initialCount)
  }, [initialCount])

  useEffect(() => {
    const controller = new AbortController()
    const fetchUpvotes = async () => {
      if (!seeded) {
        const { count: upvoteCount } = await supabase
          .from('upvotes')
          .select('*', { count: 'exact', head: true })
          .eq('review_id', reviewId)
          .abortSignal(controller.signal)
        if (!controller.signal.aborted) setCount(upvoteCount || 0)
      }

      if (user && initialUpvoted === undefined) {
        const { data } = await supabase
          .from('upvotes')
          .select('id')
          .eq('review_id', reviewId)
          .eq('user_id', user.id)
          .maybeSingle()
          .abortSignal(controller.signal)

        if (!controller.signal.aborted) setUpvoted(!!data)
      }
    }

    fetchUpvotes()
    return () => controller.abort()
  }, [reviewId, user, seeded, initialUpvoted])

  const handleToggle = async () => {
    if (!user) {
      showToast('Please sign in to upvote reviews', 'error')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('toggle_upvote', {
        p_review_id: reviewId,
      })

      if (error) throw error

      const result = Array.isArray(data) ? data[0] : data
      if (!result) throw new Error('toggle_upvote returned no result')
      setUpvoted(result.upvoted)
      setCount(result.upvote_count)
    } catch (error) {
      console.error('Error toggling upvote:', error)
      showToast('Failed to upvote. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`btn btn-outline ${upvoted ? 'btn-primary' : ''}`}
      style={{ marginTop: 'var(--sp-2)' }}
    >
      {upvoted ? '👍 Upvoted' : '👍 Upvote'} ({count})
    </button>
  )
}
