import { useState } from 'react'
import { updateReview } from '../../lib/reviewManage'
import type { EditableReview } from '../../lib/reviewEdit'
import { buildReviewFields } from '../../lib/reviewFlow'
import type { ReviewForm } from '../../hooks/useReviewForm'
import { useToast } from '../../contexts/ToastContext'
import { ConfirmDialog } from '../ConfirmDialog'
import {
  DegreeField,
  EnrollmentField,
  LanguageField,
  MediaField,
  MoneyFields,
  ProgramField,
  ProsConsField,
  RatingField,
  RecommendField,
  ReviewTextField,
  SubscoresField,
  TagsField,
  UniversityField,
  YearsField,
  type MediaState,
} from './fields'

// Edit mode: one long page with every section (D2.6). Editing isn't a
// first-time flow, so seeing everything beats step-by-step pacing. Saves go
// through review-manage; the server re-checks ownership and validates the
// full field set on every update.
export const ReviewEditForm = ({
  form,
  mediaState,
  onMediaStateChange,
  editReview,
  onDone,
}: {
  form: ReviewForm
  mediaState: MediaState
  onMediaStateChange: (s: MediaState) => void
  editReview: EditableReview
  onDone?: (changed: boolean) => void
}) => {
  const { showToast } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const { values } = form

  const validate = (): string | null => {
    if (!values.rating) return 'Pick a star rating.'
    if (values.reviewText.trim().length < 10) return 'Your review needs at least a sentence.'
    if (values.endYear && values.startYear && values.endYear < values.startYear) {
      return "Your end year can't be before your start year."
    }
    if (mediaState.uploading) return 'Please wait for your media to finish uploading.'
    if (mediaState.errorCount > 0) return 'Please retry or remove failed media attachments.'
    return null
  }

  // Validate first — the confirm dialog only opens once the form is
  // known-good, so an error never hides behind the modal.
  const requestUpdate = () => {
    const err = validate()
    if (err) {
      setError(err)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setError(null)
    setShowConfirm(true)
  }

  // Hands off to review-manage — ownership is enforced server-side.
  const handleUpdate = async () => {
    setLoading(true)
    try {
      await updateReview(editReview.id, buildReviewFields(values, mediaState.media))
      showToast('Review updated.', 'success')
      onDone?.(true)
    } catch (err) {
      console.error('Error updating review:', err)
      showToast(err instanceof Error ? err.message : 'Failed to update review', 'error')
    } finally {
      setLoading(false)
      setShowConfirm(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: '700px' }}>
      <div className="section">
        <button
          type="button"
          className="btn btn-outline"
          style={{ marginBottom: 'var(--sp-2)' }}
          onClick={() => onDone?.(false)}
        >
          ← Back
        </button>
        <h1 className="section-title">Edit your review</h1>

        {error && (
          <div className="error-banner show">
            <span className="eb-icon">⚠</span>
            <span className="eb-msg">{error}</span>
          </div>
        )}

        <div className="wizard-step active">
          <UniversityField
            form={form}
            readOnlyLabel={
              editReview.universities
                ? [editReview.universities.name, editReview.universities.city]
                    .filter(Boolean)
                    .join(' — ')
                : ''
            }
          />
          <RatingField form={form} />
          <RecommendField form={form} optional />
        </div>

        <div className="field-card">
          <div className="field-card-title">What did you study?</div>
          <ProgramField form={form} />
          <DegreeField form={form} />
        </div>

        <div className="field-card">
          <div className="field-card-title">Rate the details</div>
          <SubscoresField
            value={values.subscores}
            onChange={(key, v) => form.set('subscores', { ...values.subscores, [key]: v })}
          />
        </div>

        <div className="field-card">
          <div className="field-card-title">Your time there</div>
          <EnrollmentField form={form} />
          <YearsField form={form} />
          <LanguageField form={form} />
        </div>

        <div className="field-card">
          <div className="field-card-title">💰 Cost</div>
          <MoneyFields form={form} />
        </div>

        <TagsField form={form} />
        <ProsConsField form={form} />
        <ReviewTextField form={form} />
        <MediaField
          mediaState={mediaState}
          onStateChange={onMediaStateChange}
          disabled={loading}
          uploaderKey={`edit-${editReview.id}`}
        />

        <div className="wizard-nav">
          <button type="button" className="btn btn-ghost" onClick={() => onDone?.(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={loading || mediaState.uploading}
            onClick={requestUpdate}
          >
            {loading ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      {showConfirm && (
        <ConfirmDialog
          title="Update your review?"
          body="Saving swaps in this version for the one that's live now. The old wording isn't kept."
          confirmLabel={loading ? 'Saving...' : 'Post update'}
          cancelLabel="Keep editing"
          busy={loading}
          onConfirm={handleUpdate}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}
