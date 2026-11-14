import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useComments } from '../hooks/useComments'
import { Icons } from './Icons'
import { CommentItem } from './CommentItem'

export const CommentSection = ({ reviewId, initialCount }) => {
  const { user } = useAuth()
  return (
    <ScopedCommentSection
      key={`${reviewId}:${user?.id ?? 'guest'}`}
      reviewId={reviewId}
      initialCount={initialCount}
      user={user}
    />
  )
}

const ScopedCommentSection = ({ reviewId, initialCount, user }) => {
  const { showToast } = useToast()
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [posting, setPosting] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const composerRef = useRef(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const {
    comments,
    authorProfiles,
    loaded: commentsLoaded,
    refetch: refetchComments,
    applyComment,
  } = useComments(reviewId, { enabled: expanded })
  const commentCount = commentsLoaded
    ? comments.filter((comment) => !comment.deleted_at).length
    : (initialCount ?? 0)

  const openComposer = () => {
    if (!expanded) setExpanded(true)
    requestAnimationFrame(() => composerRef.current?.focus())
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
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
      if (!mountedRef.current) return
      showToast('Comment added!', 'success')
      setNewComment('')
      setReplyTo(null)
      void refetchComments()
    } catch (error) {
      if (mountedRef.current) {
        console.error('Error adding comment:', error)
        showToast(error.message || 'Failed to add comment', 'error')
      }
    } finally {
      if (mountedRef.current) setPosting(false)
    }
  }

  const topLevelComments = comments.filter((comment) => !comment.parent_id)
  const repliesByParent = comments.reduce((acc, comment) => {
    if (comment.parent_id) {
      if (!acc[comment.parent_id]) acc[comment.parent_id] = []
      acc[comment.parent_id].push(comment)
    }
    return acc
  }, {})
  const handleChanged = (comment) => {
    if (!mountedRef.current) return
    applyComment(comment)
    void refetchComments()
  }

  return (
    <>
      <div className="comment-controls">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={`comment-toggle${expanded ? ' open' : ''}`}
          aria-expanded={expanded}
          aria-controls={expanded ? `comments-${reviewId}` : undefined}
        >
          <Icons.Chat />
          <span>Comments{commentCount > 0 ? ` (${commentCount})` : ''}</span>
          <Icons.Chevron />
        </button>
        <button type="button" onClick={openComposer} className="comment-add">
          <Icons.Pen />
          <span>Write</span>
        </button>
      </div>
      {!expanded ? null : (
        <div id={`comments-${reviewId}`} className="comment-expanded">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {topLevelComments.map((comment) => (
              <div key={comment.id} style={{ paddingLeft: 0 }}>
                <CommentItem
                  comment={comment}
                  profile={authorProfiles[comment.user_id]}
                  isOwner={user?.id === comment.user_id}
                  canReply={Boolean(user) && !replyTo && !comment.deleted_at}
                  onReply={() => setReplyTo(comment.id)}
                  onChanged={handleChanged}
                />
                {repliesByParent[comment.id] && (
                  <div style={{ paddingLeft: 'var(--sp-3)', marginTop: 'var(--sp-1)' }}>
                    {repliesByParent[comment.id].map((reply) => (
                      <div key={reply.id} style={{ marginBottom: 'var(--sp-1)' }}>
                        <CommentItem
                          comment={reply}
                          profile={authorProfiles[reply.user_id]}
                          isOwner={user?.id === reply.user_id}
                          onChanged={handleChanged}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {replyTo === comment.id && (
                  <form
                    onSubmit={handleSubmit}
                    style={{ paddingLeft: 'var(--sp-3)', marginTop: 'var(--sp-1)' }}
                  >
                    <textarea
                      value={newComment}
                      onChange={(event) => setNewComment(event.target.value)}
                      placeholder="Write a reply..."
                      aria-label="Write a reply"
                      className="form-textarea"
                      rows="3"
                      maxLength={2000}
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
          {!replyTo && (
            <form onSubmit={handleSubmit} style={{ marginTop: 'var(--sp-2)' }}>
              <textarea
                ref={composerRef}
                value={newComment}
                onChange={(event) => setNewComment(event.target.value)}
                placeholder={user ? 'Write a comment...' : 'Sign in to leave a comment'}
                aria-label={user ? 'Write a comment' : 'Sign in to leave a comment'}
                className="form-textarea"
                rows="3"
                maxLength={2000}
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
    </>
  )
}
