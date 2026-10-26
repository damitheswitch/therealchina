import type { ReviewForm } from '../../hooks/useReviewForm'
import { AnonEmailField, ReviewTextField, TagsField } from './fields'

// Screen 2 of the fast flow: one thing you'd tell a friend. One real sentence
// is the only requirement; starter chips keep the page from ever being blank.
export const ReviewStory = ({
  form,
  isAnonymous,
  promptQuestion,
}: {
  form: ReviewForm
  isAnonymous: boolean
  promptQuestion?: string | null
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
        <p className="step-sub">Write it just like you would reply in a group chat.</p>
      </>
    ) : (
      <>
        <h2 className="step-title">One thing you&apos;d tell a friend</h2>
        <p className="step-sub">A sentence is enough. Detail can wait.</p>
      </>
    )}

    <ReviewTextField form={form} starters={!promptQuestion} />
    <TagsField form={form} />
    {isAnonymous && <AnonEmailField form={form} />}
  </div>
)
