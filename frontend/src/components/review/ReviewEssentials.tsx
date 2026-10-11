import type { ReviewForm } from '../../hooks/useReviewForm'
import { RatingField, RecommendField, UniversityField } from './fields'

// Screen 1 of the fast flow: the two things a review cannot exist without
// (which university, how good it is) plus a one-tap optional recommend.
// Program, year, and every other detail moved to the post-publish Boost.
export const ReviewEssentials = ({ form }: { form: ReviewForm }) => (
  <div className="wizard-step active">
    <div className="step-tagline">The essentials. Under a minute.</div>

    <UniversityField form={form} />
    <RatingField form={form} />
    <RecommendField form={form} optional />
  </div>
)
