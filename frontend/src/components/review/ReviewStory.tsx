import type { ReviewForm } from '../../hooks/useReviewForm'
import { AnonEmailField, PolarityMatrixField, ReviewTextField } from './fields'

// Screen 2 of the tap-first flow: the verdict matrix. Six 👍 / 👎 rows build
// the review's tags, pros, cons and a ready-made sentence, so a reviewer who
// never types still leaves a full review. The text box edits or clears the
// generated sentence; empty publishes as a quick rating.
export const ReviewStory = ({ form, isAnonymous }: { form: ReviewForm; isAnonymous: boolean }) => (
  <div className="wizard-step active">
    <h2 className="step-title">Tap what stood out</h2>
    <p className="step-sub">Each pick builds your review. Typing stays optional.</p>

    <PolarityMatrixField form={form} />
    <ReviewTextField form={form} />
    {isAnonymous && <AnonEmailField form={form} />}
  </div>
)
