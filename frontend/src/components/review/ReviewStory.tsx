import type { ReviewForm } from '../../hooks/useReviewForm'
import { AnonEmailField, HomeCountryField, TagsField } from './fields'

// Screen 2 of the fast flow: the second-priority asks — tags, the optional
// origin-country question whenever no stored country exists (always for
// anonymous reviewers; for signed-in users only when profile.home_country
// is empty), and the optional "about you" email for anonymous reviewers.
// The review itself is already complete after screen 1.
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
    <h2 className="step-title">A few more details</h2>
    <p className="step-sub">All optional. Publish whenever you&apos;re ready.</p>

    <TagsField form={form} />
    {showHomeCountry && <HomeCountryField form={form} />}
    {isAnonymous && <AnonEmailField form={form} />}
  </div>
)
