import type { ReviewForm } from '../../hooks/useReviewForm'
import { storyPlaceholder } from '../../lib/reviewFlow'
import { MIN_OWN_UNITS } from '../../lib/reviewReward'
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
  rewardUnits,
}: {
  form: ReviewForm
  promptQuestion?: string | null
  // Own-words count for the gift offer; undefined hides the counter.
  rewardUnits?: number
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
        <p className="step-sub">
          Tap at least 2 rows, ideally one good thing and one bad. Your taps write the review.
        </p>
      </>
    )}

    <PolarityMatrixField form={form} />
    <ReviewTextField form={form} story placeholder={storyPlaceholder(form.values.polarity)} />
    {rewardUnits !== undefined && (
      <p className="reward-hint" aria-live="polite">
        {rewardUnits >= MIN_OWN_UNITS
          ? 'Enough words for the gift.'
          : `${rewardUnits} of ${MIN_OWN_UNITS} words in your own words for the gift. The tapped sentence does not count.`}
      </p>
    )}
  </div>
)
