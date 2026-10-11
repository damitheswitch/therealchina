import type { ReviewForm } from '../../hooks/useReviewForm'
import {
  DegreeField,
  EnrollmentField,
  LanguageField,
  MediaField,
  MoneyFields,
  ProgramField,
  SubscoresField,
  YearsField,
  type MediaState,
} from './fields'

// Screen 2's "speak up" expansion: every optional detail a review can carry,
// grouped like the edit form. All of it stays optional — the reviewer can
// still publish with just the story. Values write into the same form state
// as the Boost cards, so they go out with the initial publish payload.
export const ReviewDetails = ({
  form,
  mediaState,
  onMediaStateChange,
}: {
  form: ReviewForm
  mediaState: MediaState
  onMediaStateChange: (s: MediaState) => void
}) => {
  const { values } = form
  return (
    <div className="speak-up-details">
      <div className="field-card">
        <div className="field-card-title">What did you study?</div>
        <ProgramField form={form} />
        <DegreeField form={form} />
      </div>

      <div className="field-card">
        <div className="field-card-title">Rate the details</div>
        <SubscoresField
          value={values.subscores}
          onChange={(key, v) => form.set('subscores', { ...values.subscores, [key]: v })}
        />
      </div>

      <div className="field-card">
        <div className="field-card-title">Your time there</div>
        <EnrollmentField form={form} />
        <YearsField form={form} />
        <LanguageField form={form} />
      </div>

      <div className="field-card">
        <div className="field-card-title">💰 Cost</div>
        <MoneyFields form={form} />
      </div>

      <MediaField
        mediaState={mediaState}
        onStateChange={onMediaStateChange}
        uploaderKey="speak-up-media"
        hint="Dorm, campus, canteen. Real photos beat every rating."
      />
    </div>
  )
}
