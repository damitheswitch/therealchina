import type { ReviewForm } from '../../hooks/useReviewForm'
import { storyPlaceholder } from '../../lib/reviewFlow'
import { PolarityMatrixField, ReviewTextField } from './fields'

// Screen 2 of the tap-first flow: the verdict matrix. Six 👍 / 👎 rows build
// the review's tags, pros, cons and a ready-made sentence, so a reviewer who
// never types still leaves a full review. The text box edits or clears the
// generated sentence; empty publishes as a quick rating.
// ?prompt=<question> swaps the heading for the ask-a-student banner; the
// matrix still builds the structured half and the box takes the answer.
export const ReviewStory = ({
  form,
  promptQuestion,
  showNudge = false,
  onSkip,
}: {
  form: ReviewForm
  promptQuestion?: string | null
  // Shown once when the reviewer taps Continue with nothing picked or written.
  showNudge?: boolean
  onSkip: () => void
}) => (
  <div className="wizard-step active">
    {promptQuestion ? (
      <>
        <div className="review-prompt-banner">
          <span className="review-prompt-eyebrow">Question from a student</span>
          <p className="review-prompt-question">&ldquo;{promptQuestion}&rdquo;</p>
          <span className="review-prompt-sub">
            Your answer helps them directly and publishes as a student review.
          </span>
        </div>
        <h2 className="step-title">Your answer</h2>
        <p className="step-sub">Tap what stood out, or write it like a group chat reply.</p>
      </>
    ) : (
      <>
        <h2 className="step-title">What stood out</h2>
        <p className="step-sub">Tap one side per row. Your picks write the review.</p>
      </>
    )}

    <PolarityMatrixField form={form} />
    <ReviewTextField form={form} story placeholder={storyPlaceholder(form.values.polarity)} />
    {showNudge && (
      <p className="story-nudge" role="status">
        {promptQuestion
          ? 'One tap or one sentence helps the student who asked.'
          : `One tap on any row tells applicants why you gave ${form.values.rating} ${form.values.rating === 1 ? 'star' : 'stars'}.`}
      </p>
    )}
    <button type="button" className="skip-link" onClick={onSkip}>
      Post my stars only
    </button>
  </div>
)
