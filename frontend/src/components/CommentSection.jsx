import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useComments } from '../hooks/useComments'
import { SealAvatar } from './SealAvatar'

// CommentSection component
export const CommentSection = ({ reviewId }) => {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [posting, setPosting] = useState(false)
  // Comments are fetched lazily: nothing is queried until the section is
  // expanded, so a page of review cards doesn't fire one query per card.
  const [expanded, setExpanded] = useState(false)

  const {
    comments,
    authorProfiles,
    loaded: commentsLoaded,
    refetch: refetchComments,
  } = useComments(reviewId, { enabled: expanded })

  const toggleExpanded = () => {
    setExpanded((prev) => !prev)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!user) {
      showToast('Please sign in to comment', 'error')
      return
    }

    if (!newComment.trim()) {
      showToast('Comment cannot be empty', 'error')
      return
    }

    setPosting(true)
    try {
      const { error } = await supabase.from('comments').insert({
        review_id: reviewId,
        user_id: user.id,
        parent_id: replyTo,
        text: newComment.trim(),
      })

      if (error) throw error

      showToast('Comment added!', 'success')
      setNewComment('')
      setReplyTo(null)
      refetchComments()
    } catch (error) {
      console.error('Error adding comment:', error)
      showToast(error.message || 'Failed to add comment', 'error')
    } finally {
      setPosting(false)
    }
  }

  // Group comments by parent_id
  const topLevelComments = comments.filter((c) => !c.parent_id)
  const repliesByParent = comments.reduce((acc, comment) => {
    if (comment.parent_id) {
      if (!acc[comment.parent_id]) acc[comment.parent_id] = []
      acc[comment.parent_id].push(comment)
    }
    return acc
  }, {})

  return (
    <div style={{ marginTop: 'var(--sp-3)' }}>
      <button
        type="button"
        onClick={toggleExpanded}
        className="btn btn-outline"
        style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}
        aria-expanded={expanded}
        aria-controls={`comments-${reviewId}`}
      >
        {expanded
          ? `Hide comments${commentsLoaded ? ` (${comments.length})` : ''}`
          : `Show comments${commentsLoaded ? ` (${comments.length})` : ''}`}
      </button>

      {!expanded ? null : (
        <div id={`comments-${reviewId}`} style={{ marginTop: 'var(--sp-2)' }}>
          {/* Comment list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {topLevelComments.map((comment) => (
              <div key={comment.id} style={{ paddingLeft: 0 }}>
                <div
                  style={{
                    padding: 'var(--sp-2)',
                    background: 'var(--rice-warm)',
                    borderRadius: 'var(--r-md)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--sp-1)',
                      marginBottom: 'var(--sp-1)',
                    }}
                  >
                    {authorProfiles[comment.user_id]?.display_name && (
                      <Link
                        to={`/profile/${comment.user_id}`}
                        style={{
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--sp-1)',
                        }}
                      >
                        <SealAvatar
                          displayName={authorProfiles[comment.user_id].display_name}
                          size={20}
                        />
                        <strong style={{ color: 'var(--ink)', fontSize: '0.9rem' }}>
                          {authorProfiles[comment.user_id].display_name}
                        </strong>
                      </Link>
                    )}
                    {!authorProfiles[comment.user_id]?.display_name && <strong>Anonymous</strong>}
                  </div>
                  <p style={{ marginTop: 'var(--sp-1)' }}>{comment.text}</p>
                  {user && !replyTo && (
                    <button
                      onClick={() => setReplyTo(comment.id)}
                      className="btn btn-outline"
                      style={{
                        marginTop: 'var(--sp-1)',
                        fontSize: '0.85rem',
                        padding: '0.4rem 0.8rem',
                      }}
                    >
                      Reply
                    </button>
                  )}
                </div>

                {/* Replies */}
                {repliesByParent[comment.id] && (
                  <div style={{ paddingLeft: 'var(--sp-3)', marginTop: 'var(--sp-1)' }}>
                    {repliesByParent[comment.id].map((reply) => (
                      <div
                        key={reply.id}
                        style={{
                          padding: 'var(--sp-2)',
                          background: '#fff',
                          borderRadius: 'var(--r-md)',
                          marginBottom: 'var(--sp-1)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--sp-1)',
                            marginBottom: 'var(--sp-1)',
                          }}
                        >
                          {authorProfiles[reply.user_id]?.display_name && (
                            <Link
                              to={`/profile/${reply.user_id}`}
                              style={{
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--sp-1)',
                              }}
                            >
                              <SealAvatar
                                displayName={authorProfiles[reply.user_id].display_name}
                                size={20}
                              />
                              <strong style={{ color: 'var(--ink)', fontSize: '0.9rem' }}>
                                {authorProfiles[reply.user_id].display_name}
                              </strong>
                            </Link>
                          )}
                          {!authorProfiles[reply.user_id]?.display_name && (
                            <strong>Anonymous</strong>
                          )}
                        </div>
                        <p style={{ marginTop: 'var(--sp-1)' }}>{reply.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply form */}
                {replyTo === comment.id && (
                  <form
                    onSubmit={handleSubmit}
                    style={{ paddingLeft: 'var(--sp-3)', marginTop: 'var(--sp-1)' }}
                  >
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write a reply..."
                      className="form-textarea"
                      rows="3"
                    />
                    <div style={{ display: 'flex', gap: 'var(--sp-1)', marginTop: 'var(--sp-1)' }}>
                      <button type="submit" disabled={posting} className="btn btn-primary">
                        {posting ? 'Posting...' : 'Post Reply'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyTo(null)}
                        className="btn btn-outline"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>

          {/* Add comment form */}
          {!replyTo && (
            <form onSubmit={handleSubmit} style={{ marginTop: 'var(--sp-2)' }}>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={user ? 'Write a comment...' : 'Sign in to leave a comment'}
                className="form-textarea"
                rows="3"
                disabled={!user}
              />
              <button
                type="submit"
                disabled={posting || !user}
                className="btn btn-primary"
                style={{ marginTop: 'var(--sp-1)' }}
              >
                {posting ? 'Posting...' : 'Add Comment'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
