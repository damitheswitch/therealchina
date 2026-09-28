import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useReviewDrafts } from '../hooks/useReviewDrafts'
import { useToast } from '../contexts/ToastContext'
import { ConfirmDialog } from './ConfirmDialog'
import { draftProgressLabel, draftUniversityLabel, type ReviewDraft } from '../lib/reviewDrafts'
import { Icons } from './Icons'

// Signed-in user's saved review drafts. Resume opens the wizard pre-filled;
// delete removes the row after a confirmation. RLS enforces ownership
// server-side — these controls are convenience, not the security boundary.
export const MyDrafts = () => {
  const { drafts, loading, error, removeDraft } = useReviewDrafts()
  const { showToast } = useToast()
  const [deleting, setDeleting] = useState<ReviewDraft | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await removeDraft(deleting.id)
      showToast('Draft deleted.', 'success')
      setDeleting(null)
    } catch (err) {
      console.error('Error deleting draft:', err)
      showToast(err instanceof Error ? err.message : 'Could not delete the draft.', 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  if (loading) return null
  if (drafts.length === 0 && !error) return null

  return (
    <div className="profile-section" style={{ marginTop: 'var(--sp-4)' }}>
      <h3 className="profile-section-title">Draft reviews ({drafts.length})</h3>
      {error && <p className="form-hint">Couldn&apos;t load your drafts. Try refreshing.</p>}
      <div className="profile-reviews">
        {drafts.map((draft) => {
          const updated = draft.updated_at
            ? new Date(draft.updated_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC',
              })
            : ''
          return (
            <div key={draft.id} className="profile-review-item">
              <div className="review-card my-review-card draft-card">
                <div className="review-header">
                  <div>
                    <strong>{draftUniversityLabel(draft)}</strong>
                    <div className="muted" style={{ fontSize: '.8rem', marginTop: '2px' }}>
                      {draftProgressLabel(draft)} · saved {updated}
                    </div>
                  </div>
                  <span className="draft-badge">Draft</span>
                </div>
                <div className="review-actions">
                  <Link to={`/review?draft=${draft.id}`} className="btn btn-primary btn-sm">
                    <Icons.Pen /> Finish it
                  </Link>
                  <button type="button" className="delete-btn" onClick={() => setDeleting(draft)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {deleting && (
        <ConfirmDialog
          title="Delete this draft?"
          body="The saved progress goes away. This only removes the draft. No live review is touched."
          confirmLabel={deleteBusy ? 'Deleting...' : 'Delete it'}
          cancelLabel="Keep it"
          busy={deleteBusy}
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
