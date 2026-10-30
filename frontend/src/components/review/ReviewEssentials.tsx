import type { ReviewForm } from '../../hooks/useReviewForm'
import { useUniversityReviewCount } from '../../hooks/useUniversityReviewCount'
import { DegreeField, RatingField, RecommendField, StartYearField, UniversityField } from './fields'

// Screen 1 of the tap-first flow: the two things a review cannot exist
// without (which university, how good it is) plus one-tap context. Degree and
// start year used to live in a Boost card nobody reached; here they are a
// single tap each, and they carry smart defaults (a Language Course pick
// fills program and instruction language; Exchange pins enrollment status).
// ?prompt=<question> swaps the tagline for the ask-a-student banner.
export const ReviewEssentials = ({
  form,
  promptQuestion,
}: {
  form: ReviewForm
  promptQuestion?: string | null
}) => {
  const { selectedUni, selectedUniName } = form.values
  const reviewCount = useUniversityReviewCount(selectedUni)
  return (
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
        <div className="step-tagline">Anonymous by default. Takes about a minute.</div>
      )}

      <UniversityField form={form} />
      {reviewCount !== null && reviewCount > 0 && (
        <p className="social-proof">
          {reviewCount} {reviewCount === 1 ? 'student has' : 'students have'} reviewed{' '}
          {selectedUniName}. Your take helps the next applicant.
        </p>
      )}
      <RatingField form={form} />
      <RecommendField form={form} optional />

      <div className="context-row">
        <DegreeField form={form} />
        <StartYearField form={form} />
      </div>
    </div>
  )
}
