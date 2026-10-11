import { useState, type ReactNode } from 'react'
import type { ReviewFieldValues } from '../../lib/reviewFlow'
import type { ReviewForm, ReviewFormSet } from '../../hooks/useReviewForm'
import { RatingsCard } from './BoostCards'
import {
  DegreeField,
  EnrollmentField,
  FundingField,
  LanguageField,
  LivingCostField,
  MediaField,
  ProgramField,
  TuitionField,
  YearsField,
  type MediaState,
} from './fields'

// The speak-up flow: every optional datapoint on its own page, walked one at
// a time. Answering a tap-input (chip, star, segment) moves straight to the
// next datapoint after a beat so the selected state registers; there is no
// Save anywhere — values land in the shared form and publish with the review.
// Back revisits the previous datapoint, Skip moves past an unknown.
type SpeakUpPage = {
  key: string
  title: string
  sub?: string
  // Intercepted on every form.set from this page's inputs. True means the
  // tap just answered the datapoint and the pager moves on by itself.
  advanceOn?: (key: keyof ReviewFieldValues, value: unknown) => boolean
  // Free-form inputs (text, photos) get a Next/Done button instead.
  manual?: boolean
  render: (
    form: ReviewForm,
    media: { state: MediaState; set: (s: MediaState) => void }
  ) => ReactNode
}

const PAGES: SpeakUpPage[] = [
  {
    key: 'program',
    title: 'What did you study?',
    manual: true,
    render: (form) => <ProgramField form={form} />,
  },
  {
    key: 'degree',
    title: 'Degree level',
    advanceOn: (k, v) => k === 'degreeLevel' && Boolean(v),
    render: (form) => <DegreeField form={form} />,
  },
  {
    key: 'ratings',
    title: 'Rate the details',
    sub: 'Tap a score for each. Takes about 15 seconds.',
    manual: true,
    render: (form) => <RatingsCard form={form} doneHint="Tap Next to keep going." />,
  },
  {
    key: 'enrollment',
    title: 'Are you still there?',
    advanceOn: (k, v) => k === 'enrollmentStatus' && Boolean(v),
    render: (form) => <EnrollmentField form={form} />,
  },
  {
    key: 'years',
    title: 'When were you there?',
    manual: true,
    // An end year (including "Still studying") is a full answer and advances;
    // start year alone needs Next, since the end question is still open.
    advanceOn: (k) => k === 'endYear',
    render: (form) => <YearsField form={form} />,
  },
  {
    key: 'language',
    title: 'Language of instruction',
    advanceOn: (k, v) => k === 'languageOfInstruction' && Boolean(v),
    render: (form) => <LanguageField form={form} />,
  },
  {
    key: 'tuition',
    title: 'Tuition per year',
    advanceOn: (k, v) => k === 'tuitionRange' && Boolean(v),
    render: (form) => <TuitionField form={form} />,
  },
  {
    key: 'living',
    title: 'Monthly living cost',
    advanceOn: (k, v) => k === 'livingCostRange' && Boolean(v),
    render: (form) => <LivingCostField form={form} />,
  },
  {
    key: 'funding',
    title: 'How was it funded?',
    // "Self-funded" is complete on its own; anything else asks coverage next.
    advanceOn: (k, v) =>
      (k === 'fundingType' && v === 'self') || (k === 'fundingCoverage' && Boolean(v)),
    render: (form) => <FundingField form={form} />,
  },
  {
    key: 'media',
    title: 'Got a photo?',
    sub: 'Dorm, campus, canteen. Real photos beat every rating.',
    manual: true,
    render: (form, media) => (
      <MediaField
        mediaState={media.state}
        onStateChange={media.set}
        uploaderKey="speak-up-media"
        hint="Photos"
      />
    ),
  },
]

const ADVANCE_DELAY_MS = 220

export const SpeakUpPages = ({
  form,
  mediaState,
  onMediaStateChange,
  onExit,
}: {
  form: ReviewForm
  mediaState: MediaState
  onMediaStateChange: (s: MediaState) => void
  onExit: () => void
}) => {
  const [index, setIndex] = useState(0)
  const page = PAGES[index]
  const isLast = index === PAGES.length - 1

  const goNext = () => {
    if (isLast) onExit()
    else setIndex((i) => i + 1)
  }

  const goBack = () => {
    if (index === 0) onExit()
    else setIndex((i) => i - 1)
  }

  // Brief pause so the tapped chip visibly lands before the page swaps. The
  // captured page index makes the timer fizzle if the pager already moved —
  // double taps, Back, or Next inside the delay can never skip a page.
  const scheduleAdvance = () => {
    const from = index
    setTimeout(() => {
      setIndex((i) => (i === from ? Math.min(i + 1, PAGES.length - 1) : i))
    }, ADVANCE_DELAY_MS)
  }

  // The page's inputs write through this wrapper: every truthy answer that
  // satisfies the page's advanceOn predicate moves the pager on. There is no
  // save step — the value is already in the shared form state.
  const pageForm: ReviewForm = {
    ...form,
    set: ((key, value) => {
      form.set(key, value)
      if (page.advanceOn?.(key, value)) scheduleAdvance()
    }) as ReviewFormSet,
  }

  return (
    <div className="speak-up-page" key={page.key}>
      <p className="speak-up-count">
        {index + 1} of {PAGES.length}
      </p>
      <h2 className="step-title" style={{ marginBottom: page.sub ? undefined : 0 }}>
        {page.title}
      </h2>
      {page.sub && <p className="step-sub">{page.sub}</p>}

      <div
        className="speak-up-input"
        onKeyDown={
          page.key === 'program' ? (e) => e.key === 'Enter' && scheduleAdvance() : undefined
        }
      >
        {page.render(pageForm, { state: mediaState, set: onMediaStateChange })}
      </div>

      <div className="wizard-nav">
        <button type="button" className="btn btn-ghost" onClick={goBack}>
          ← Back
        </button>
        <div className="wizard-nav-actions">
          <button type="button" className="btn btn-ghost" onClick={isLast ? onExit : goNext}>
            {isLast ? 'No photo' : 'Skip'}
          </button>
          {page.manual && (
            <button type="button" className="btn btn-primary" onClick={isLast ? onExit : goNext}>
              {isLast ? 'Done' : 'Next →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
