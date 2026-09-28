import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useReviewDraftForUniversity } from '../hooks/useReviewDraftForUniversity'
import { deleteReviewDraftForUniversity, clearLocalDraft } from '../lib/reviewDrafts'
import { ConfirmDialog } from './ConfirmDialog'
import { Icons } from './Icons'
import type { Tables } from '../types/database.types'

interface DraftReminderProps {
  university: Tables<'universities'>
}

// Non-blocking prompt on a university page when the visitor has a saved draft
// for it. The draft itself is private; deleting it here removes the reminder
// everywhere too.
export const DraftReminder = ({ university }: DraftReminderProps) => {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { draft, loading } = useReviewDraftForUniversity(university.id, university.slug)
  const [dismissed, setDismissed] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  if (loading || !draft || dismissed) return null

  const isLocal = draft.id === 'local'
  const continueTo = isLocal ? `/review?uni=${university.slug}` : `/review?draft=${draft.id}`

  const handleDelete = async () => {
    setDeleteBusy(true)
    try {
      if (isLocal) {
        clearLocalDraft()
      } else {
        await deleteReviewDraftForUniversity(user!.id, university.id)
      }
      setDismissed(true)
      showToast('Draft deleted.', 'success')
    } catch (err) {
      console.error('Error deleting draft:', err)
      showToast(err instanceof Error ? err.message : 'Could not delete the draft.', 'error')
    } finally {
      setDeleteBusy(false)
      setShowConfirm(false)
    }
  }

  return (
    <div className="draft-reminder fade-in">
      <div className="draft-reminder-copy">
        <Icons.Pen />
        <span>
          You started a review for <strong>{university.name}</strong>. Pick up where you left off?
        </span>
      </div>
      <div className="draft-reminder-actions">
        <Link to={continueTo} className="btn btn-primary btn-sm">
          Continue
        </Link>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setShowConfirm(true)}
          disabled={deleteBusy}
        >
          Delete draft
        </button>
      </div>

      {showConfirm && (
        <ConfirmDialog
          title="Delete this draft?"
          body="The saved progress for this university goes away. This only removes the draft."
          confirmLabel={deleteBusy ? 'Deleting...' : 'Delete it'}
          cancelLabel="Keep it"
          busy={deleteBusy}
          danger
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}
