import type { ReviewForm } from '../../hooks/useReviewForm'
import { RatingField, RecommendField, ReviewTextField, UniversityField } from './fields'

// Screen 1 of the fast flow: everything a review needs to exist — which
// university, how good it is, and the one honest sentence. If the reviewer
// walks away after this screen, the draft already carries a complete review.
// Program, year, and every other detail moved to screen 2 and Boost.
export const ReviewEssentials = ({ form }: { form: ReviewForm }) => (
  <div className="wizard-step active">
    <div className="step-tagline">The essentials. One honest sentence.</div>

    <UniversityField form={form} />
    <RatingField form={form} />
    <RecommendField form={form} optional />
    <ReviewTextField form={form} starters />
  </div>
)
