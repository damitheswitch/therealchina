import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import { updateComment, deleteComment } from '../lib/commentManage'
import type { Tables } from '../types/database.types'
import { ConfirmDialog } from './ConfirmDialog'
import { ReportButton } from './ReportButton'
import { SealAvatar } from './SealAvatar'

type Comment = Tables<'comments'>
type Profile = Pick<Tables<'profile_public'>, 'display_name'> | undefined

type Props = {
  comment: Comment
  profile: Profile
  isOwner: boolean
  canReply?: boolean
  onReply?: () => void
  onChanged: (comment: Comment) => void
}

export const CommentItem = ({
  comment,
  profile,
  isOwner,
  canReply = false,
  onReply,
  onChanged,
}: Props) => {
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.text)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const mountedRef = useRef(false)
  const inFlightRef = useRef(false)
  const editTriggerRef = useRef<HTMLButtonElement>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)
  const editFieldRef = useRef<HTMLTextAreaElement>(null)
  const deleted = Boolean(comment.deleted_at)
  const displayName = profile?.display_name

  useEffect(() => {
    if (editing) editFieldRef.current?.focus()
  }, [editing])

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (inFlightRef.current) return
    const text = draft.trim()
    if (!text) {
      showToast('Comment cannot be empty', 'error')
      return
    }
    inFlightRef.current = true
    setBusy(true)
    try {
      const updated = await updateComment(comment.id, text)
      // The thread may have collapsed while saving. Its scoped parent still
      // owns the committed result and ignores it if the account/review changed.
      onChanged(updated)
      if (!mountedRef.current) return
      setEditing(false)
      showToast('Comment updated', 'success')
    } catch (error) {
      if (mountedRef.current)
        showToast(error instanceof Error ? error.message : 'Failed to update comment', 'error')
    } finally {
      inFlightRef.current = false
      if (mountedRef.current) setBusy(false)
    }
  }

  const remove = async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setBusy(true)
    try {
      const updated = await deleteComment(comment.id)
      onChanged(updated)
      if (!mountedRef.current) return
      setConfirmingDelete(false)
      showToast('Comment deleted', 'success')
    } catch (error) {
      if (mountedRef.current)
        showToast(error instanceof Error ? error.message : 'Failed to delete comment', 'error')
    } finally {
      inFlightRef.current = false
      if (mountedRef.current) setBusy(false)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  return (
    <div
      style={{
        padding: 'var(--sp-2)',
        background: 'var(--rice-warm)',
        borderRadius: 'var(--r-md)',
      }}
    >
      {deleted ? (
        <p>Comment deleted</p>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-1)',
              marginBottom: 'var(--sp-1)',
            }}
          >
            {displayName ? (
              <Link
                to={`/profile/${comment.user_id}`}
                style={{
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-1)',
                }}
              >
                <SealAvatar displayName={displayName} size={20} />
                <strong style={{ color: 'var(--ink)', fontSize: '0.9rem' }}>{displayName}</strong>
              </Link>
            ) : (
              <strong>Anonymous</strong>
            )}
          </div>
          {editing ? (
            <form onSubmit={save}>
              <textarea
                aria-label="Edit comment"
                ref={editFieldRef}
                className="form-textarea"
                rows={3}
                maxLength={2000}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                disabled={busy}
              />
              <div style={{ display: 'flex', gap: 'var(--sp-1)', marginTop: 'var(--sp-1)' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={busy}
                  onClick={() => {
                    setDraft(comment.text)
                    setEditing(false)
                    editTriggerRef.current?.focus()
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <p style={{ marginTop: 'var(--sp-1)' }}>
              {comment.text}
              {comment.edited_at && <small> (edited)</small>}
            </p>
          )}
          {!editing && <ReportButton targetType="comment" targetId={comment.id} />}
          {!editing && isOwner && (
            <div style={{ display: 'flex', gap: 'var(--sp-1)', marginTop: 'var(--sp-1)' }}>
              <button
                type="button"
                className="btn btn-outline"
                aria-label="Edit comment"
                ref={editTriggerRef}
                onClick={() => {
                  setDraft(comment.text)
                  setEditing(true)
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn-outline"
                aria-label="Delete comment"
                ref={deleteTriggerRef}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </button>
            </div>
          )}
          {canReply && onReply && (
            <button
              type="button"
              onClick={onReply}
              className="btn btn-outline"
              style={{ marginTop: 'var(--sp-1)', fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
            >
              Reply
            </button>
          )}
        </>
      )}
      {confirmingDelete && (
        <ConfirmDialog
          title="Delete comment?"
          body="Delete this comment? Your text will be removed. Replies will stay."
          confirmLabel={busy ? 'Deleting...' : 'Delete'}
          danger
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => {
            setConfirmingDelete(false)
            deleteTriggerRef.current?.focus()
          }}
        />
      )}
    </div>
  )
}
