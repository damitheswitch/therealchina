import type { ReviewForm } from '../../hooks/useReviewForm'
import { AnonEmailField, HomeCountryField, ReviewTextField, TagsField } from './fields'

// Screen 2 of the fast flow: one thing you'd tell a friend. One real sentence
// is the only requirement; starter chips keep the page from ever being blank.
// The origin-country question shows whenever the reviewer has no stored
// country (always anonymous; signed-in only when profile.home_country is
// empty).
export const ReviewStory = ({
  form,
  isAnonymous,
  showHomeCountry = false,
}: {
  form: ReviewForm
  isAnonymous: boolean
  showHomeCountry?: boolean
}) => (
  <div className="wizard-step active">
    <h2 className="step-title">One thing you&apos;d tell a friend</h2>
    <p className="step-sub">A sentence is enough. Detail can wait.</p>

    <ReviewTextField form={form} starters />
    <TagsField form={form} />
    {showHomeCountry && <HomeCountryField form={form} />}
    {isAnonymous && <AnonEmailField form={form} />}
  </div>
)
