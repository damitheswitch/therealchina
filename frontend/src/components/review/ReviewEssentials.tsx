import type { ReviewForm } from '../../hooks/useReviewForm'
import { RatingField, RecommendField, UniversityField } from './fields'

// Screen 1 of the fast flow: the two things a review cannot exist without
// (which university, how good it is) plus a one-tap optional recommend.
// Program, year, and every other detail moved to the post-publish Boost.
export const ReviewEssentials = ({
  form,
  promptQuestion,
}: {
  form: ReviewForm
  promptQuestion?: string | null
}) => (
  <div className="wizard-step active">
    {promptQuestion ? (
      <div className="review-prompt-banner">
        <span className="review-prompt-eyebrow">Answering a peer question</span>
        <p className="review-prompt-question">&ldquo;{promptQuestion}&rdquo;</p>
        <span className="review-prompt-sub">
          Quick star rating first, then your answer on the next screen.
        </span>
      </div>
    ) : (
      <div className="step-tagline">The essentials. Under a minute.</div>
    )}

    <UniversityField form={form} />
    <RatingField form={form} />
    <RecommendField form={form} optional />
  </div>
)
