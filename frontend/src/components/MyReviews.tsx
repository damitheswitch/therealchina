import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMyReviews } from '../hooks/useMyReviews'
import { useToast } from '../contexts/ToastContext'
import { deleteReview } from '../lib/reviewManage'
import type { EditableReview } from '../lib/reviewEdit'
import { StarRating } from './StarRating'
import { SealBadge } from './SealBadge'
import { MediaGallery } from './MediaGallery'
import { Icons } from './Icons'
import { RecommendPill, ReviewContext, ReviewExtras } from './ReviewExtras'
import { ConfirmDialog } from './ConfirmDialog'
import { ReviewWizard } from './ReviewWizard'

// One review card in the "My reviews" list: the same readout as the profile
// view, plus Edit / Delete controls that only exist here — the owner's page.
const MyReviewCard = ({
  review,
  onEdit,
  onDelete,
}: {
  review: EditableReview
  onEdit: () => void
  onDelete: () => void
}) => {
  const date = new Date(review.created_at ?? '').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
  // The trigger bumps updated_at on every update — anything beyond a small
  // grace window after creation counts as edited.
  const edited =
    review.updated_at != null &&
    review.created_at != null &&
    new Date(review.updated_at).getTime() - new Date(review.created_at).getTime() > 60_000

  return (
    <div className="review-card fade-in my-review-card">
      <div className="review-header">
        <StarRating rating={review.rating} />
        <div className="review-meta">
          <RecommendPill value={review.recommend} />
          <SealBadge />
          <span>
            {date}
            {edited && ' · edited'}
          </span>
        </div>
      </div>
      <ReviewContext review={review} />
      <p className="review-text">{review.text}</p>
      <ReviewExtras review={review} />
      {Array.isArray(review.media) && review.media.length > 0 && (
        <MediaGallery media={review.media} />
      )}
      <div className="review-actions">
        <button type="button" className="edit-btn" onClick={onEdit}>
          Edit review
        </button>
        <button type="button" className="delete-btn" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  )
}

// "My reviews" section on the signed-in user's own profile page. Edit opens
// the wizard pre-filled in an overlay; delete asks for a hard confirm first.
// Server-side ownership is enforced in review-manage — these controls are
// convenience, not the security boundary.
export const MyReviews = () => {
  const { reviews, loading, error, refetch } = useMyReviews()
  const { showToast } = useToast()
  const [editing, setEditing] = useState<EditableReview | null>(null)
  const [deleting, setDeleting] = useState<EditableReview | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const editPanelRef = useRef<HTMLDivElement>(null)

  // Edit overlay behaves like a dialog: focus moves inside on open, Tab cycles
  // within it, Escape backs out without saving.
  useEffect(() => {
    if (editing) editPanelRef.current?.focus()
  }, [editing])

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditing(null)
      return
    }
    if (e.key !== 'Tab' || !editPanelRef.current) return
    const focusable = editPanelRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await deleteReview(deleting.id)
      showToast('Review deleted.', 'success')
      setDeleting(null)
      refetch()
    } catch (err) {
      console.error('Error deleting review:', err)
      showToast(err instanceof Error ? err.message : 'Could not delete the review.', 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  if (loading) return null

  return (
    <div className="profile-section" style={{ marginTop: 'var(--sp-4)' }}>
      <h3 className="profile-section-title">My reviews ({reviews.length})</h3>
      {error && <p className="form-hint">Couldn&apos;t load your reviews — try refreshing.</p>}
      {reviews.length > 0 ? (
        <div className="profile-reviews">
          {reviews.map((review) => (
            <div key={review.id} className="profile-review-item">
              {review.universities && (
                <Link
                  to={`/university/${review.universities.slug}/`}
                  className="profile-review-university"
                >
                  <Icons.Book /> {review.universities.name} — {review.universities.city}
                </Link>
              )}
              <MyReviewCard
                review={review}
                onEdit={() => setEditing(review)}
                onDelete={() => setDeleting(review)}
              />
            </div>
          ))}
        </div>
      ) : (
        !error && (
          <div className="empty-state">
            <p>
              No reviews yet. <Link to="/review">Share your experience</Link> — it takes two minutes
              and helps the next student more than you think.
            </p>
          </div>
        )
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this review?"
          body="It disappears from the university page for good — along with every upvote and comment it picked up. Once it's gone, it's gone."
          confirmLabel={deleteBusy ? 'Deleting...' : 'Delete it'}
          cancelLabel="Keep it"
          busy={deleteBusy}
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {editing && (
        <div className="review-edit-overlay">
          <div
            ref={editPanelRef}
            className="review-edit-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Edit your review"
            tabIndex={-1}
            onKeyDown={handleEditKeyDown}
          >
            <ReviewWizard
              searchParams={new URLSearchParams()}
              editReview={editing}
              onDone={(changed) => {
                setEditing(null)
                if (changed) refetch()
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
