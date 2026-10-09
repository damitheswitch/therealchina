import type { ReviewForm } from '../../hooks/useReviewForm'
import { AnonEmailField, ReviewTextField, TagsField } from './fields'

// Screen 2 of the fast flow: one thing you'd tell a friend. One real sentence
// is the only requirement; starter chips keep the page from ever being blank.
export const ReviewStory = ({ form, isAnonymous }: { form: ReviewForm; isAnonymous: boolean }) => (
  <div className="wizard-step active">
    <h2 className="step-title">One thing you&apos;d tell a friend</h2>
    <p className="step-sub">A sentence is enough. Detail can wait.</p>

    <ReviewTextField form={form} starters />
    <TagsField form={form} />
    {isAnonymous && <AnonEmailField form={form} />}
  </div>
)
