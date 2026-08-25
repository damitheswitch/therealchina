import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

// UpvoteButton component - calls toggle_upvote RPC
export const UpvoteButton = ({ reviewId }) => {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [upvoted, setUpvoted] = useState(false)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Fetch initial upvote state
    const fetchUpvotes = async () => {
      // Get count
      const { count: upvoteCount } = await supabase
        .from('upvotes')
        .select('*', { count: 'exact', head: true })
        .eq('review_id', reviewId)

      setCount(upvoteCount || 0)

      // Check if current user has upvoted
      if (user) {
        const { data } = await supabase
          .from('upvotes')
          .select('id')
          .eq('review_id', reviewId)
          .eq('user_id', user.id)
          .single()

        setUpvoted(!!data)
      }
    }

    fetchUpvotes()
  }, [reviewId, user])

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

      setUpvoted(data[0].upvoted)
      setCount(data[0].upvote_count)
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
