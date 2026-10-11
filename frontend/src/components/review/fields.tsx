import { useRef, useState } from 'react'
import type { MediaItem, SubScores } from '../../lib/reviewSubmit'
import { TUITION_RANGES, LIVING_COSTS } from '../../lib/constants'
import { ENROLLMENT_OPTIONS, FUNDING_OPTIONS } from '../../lib/reviewDisplay'
import { formatLocation } from '../../lib/chinaDivisions'
import {
  DEGREE_LEVELS,
  INSTRUCTION_LANGS,
  MORE_TAGS,
  POPULAR_TAGS,
  RECOMMEND_OPTIONS,
  STORY_STARTERS,
  SUBSCORE_INPUT_FIELDS,
  allYearOptions,
  recentYearChips,
} from '../../lib/reviewFlow'
import type { ReviewForm } from '../../hooks/useReviewForm'
import { UniversityAutocomplete } from '../UniversityAutocomplete'
import { ProgramAutocomplete } from '../ProgramAutocomplete'
import { ProvinceCityPicker } from '../ProvinceCityPicker'
import { StarInput } from '../StarInput'
import { MediaUploader } from '../MediaUploader'

// Field building blocks shared by the 2-screen publish flow, the Boost card
// stack, and the one-page edit form. Every block reads/writes `form` so all
// three callers edit the same state shape. Option lists live in lib/reviewFlow
// so this file only exports components (fast refresh).

const ChipSelect = ({
  options,
  value,
  onSelect,
  allowDeselect = true,
}: {
  options: readonly string[]
  value: string
  onSelect: (value: string) => void
  allowDeselect?: boolean
}) => (
  <div className="chip-row">
    {options.map((opt) => (
      <button
        key={opt}
        type="button"
        className={`chip ${value === opt ? 'selected' : ''}`}
        onClick={() => onSelect(allowDeselect && value === opt ? '' : opt)}
      >
        {opt}
      </button>
    ))}
  </div>
)

// ---- Essentials ----------------------------------------------------------------

export const UniversityField = ({
  form,
  readOnlyLabel,
}: {
  form: ReviewForm
  // Edit mode: the reviewed university never changes, show it as fixed text.
  readOnlyLabel?: string
}) => {
  const { values, set } = form
  return (
    <>
      <div className="form-group">
        <label className="form-label" htmlFor="uni-select">
          University <span className="req-dot">*</span>
        </label>
        {readOnlyLabel !== undefined ? (
          <div className="form-input" style={{ background: 'var(--rice)' }}>
            {readOnlyLabel || 'University'}
          </div>
        ) : (
          <UniversityAutocomplete
            id="uni-select"
            value={values.selectedUniName}
            placeholder="Start typing a university..."
            onChange={(v: string) => {
              set('selectedUniName', v)
              set('selectedUni', '')
              set('showNotListed', false)
            }}
            onSelect={(
              option: {
                data?: { name?: string; slug?: string }
                value?: string
                key?: string
              } | null
            ) => {
              const data = option?.data
              set('selectedUniName', data?.name || option?.value || '')
              set('selectedUni', data?.slug || option?.key || '')
              set('showNotListed', false)
            }}
            onNotListed={() => {
              set('selectedUniName', "My university isn't listed")
              set('selectedUni', '__not_listed')
              set('showNotListed', true)
            }}
            allowNotListed={true}
          />
        )}
      </div>

      {readOnlyLabel === undefined && values.showNotListed && (
        <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
            <label className="form-label" htmlFor="new-uni-name">
              University name
            </label>
            <input
              type="text"
              id="new-uni-name"
              className="form-input"
              placeholder="e.g. East China Normal University"
              value={values.newUniName}
              onChange={(e) => set('newUniName', e.target.value)}
            />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '240px' }}>
            <label className="form-label" htmlFor="new-uni-city-province">
              City
            </label>
            <ProvinceCityPicker
              id="new-uni-city"
              value={formatLocation(values.newUniProvince, values.newUniCity)}
              onParts={(p: { province: string; city: string }) => {
                set('newUniProvince', p.province)
                set('newUniCity', p.city)
              }}
              allowOutsideChina={false}
            />
          </div>
        </div>
      )}
    </>
  )
}

export const RatingField = ({ form }: { form: ReviewForm }) => (
  <div className="form-group">
    <label className="form-label">
      Your overall rating <span className="req-dot">*</span>
    </label>
    <StarInput value={form.values.rating} onChange={(v: number) => form.set('rating', v)} />
  </div>
)

export const RecommendField = ({
  form,
  optional = false,
}: {
  form: ReviewForm
  optional?: boolean
}) => (
  <div className="form-group">
    <label className="form-label">
      Would you recommend this university to a friend?{' '}
      {optional ? (
        <span className="form-hint-inline">optional</span>
      ) : (
        <span className="req-dot">*</span>
      )}
    </label>
    <div className="recommend-row">
      {RECOMMEND_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`recommend-btn ${form.values.recommend === opt.value ? 'selected' : ''}`}
          onClick={() =>
            form.set('recommend', form.values.recommend === opt.value && optional ? '' : opt.value)
          }
        >
          <span className="emoji">{opt.emoji}</span>
          <span className="lbl">{opt.label}</span>
        </button>
      ))}
    </div>
  </div>
)

// ---- Studies & timing ------------------------------------------------------------

export const ProgramField = ({ form }: { form: ReviewForm }) => (
  <div className="form-group">
    <label className="form-label" htmlFor="program">
      Program
    </label>
    <ProgramAutocomplete
      id="program"
      placeholder="e.g. Computer Science"
      value={form.values.program}
      onChange={(v: string) => form.set('program', v)}
    />
    <span className="form-hint">Your major / program name.</span>
  </div>
)

export const DegreeField = ({ form }: { form: ReviewForm }) => (
  <div className="form-group">
    <label className="form-label">Degree level</label>
    <ChipSelect
      options={DEGREE_LEVELS}
      value={form.values.degreeLevel}
      onSelect={(v) => form.set('degreeLevel', v)}
    />
  </div>
)

export const EnrollmentField = ({ form }: { form: ReviewForm }) => (
  <div className="form-group" style={{ marginBottom: 0 }}>
    <label className="form-label">Enrollment status</label>
    <div className="segmented">
      {ENROLLMENT_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`seg ${form.values.enrollmentStatus === opt.value ? 'selected' : ''}`}
          onClick={() =>
            form.set(
              'enrollmentStatus',
              form.values.enrollmentStatus === opt.value ? '' : opt.value
            )
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
)

const YearChips = ({
  value,
  onChange,
  emptyLabel,
}: {
  value: number | ''
  onChange: (v: number | '') => void
  emptyLabel?: string
}) => {
  const [showAll, setShowAll] = useState(false)
  const recent = recentYearChips()
  const isRecent = typeof value === 'number' && recent.includes(value)

  return (
    <>
      <div className="chip-row">
        {emptyLabel !== undefined && (
          <button
            type="button"
            className={`chip ${value === '' ? 'selected' : ''}`}
            onClick={() => onChange('')}
          >
            {emptyLabel}
          </button>
        )}
        {recent.map((y) => (
          <button
            key={y}
            type="button"
            className={`chip ${value === y ? 'selected' : ''}`}
            onClick={() => onChange(y)}
          >
            {y}
          </button>
        ))}
        <button
          type="button"
          className={`chip ${showAll || (value !== '' && !isRecent) ? 'selected' : ''}`}
          onClick={() => setShowAll((s) => !s)}
        >
          Earlier…
        </button>
      </div>
      {(showAll || (value !== '' && !isRecent)) && (
        <select
          className="form-select"
          style={{ marginTop: '0.5rem' }}
          value={value}
          aria-label="Pick an earlier year"
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">Select...</option>
          {allYearOptions().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      )}
    </>
  )
}

export const YearsField = ({ form }: { form: ReviewForm }) => {
  const { values, set } = form
  return (
    <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
      <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
        <label className="form-label">Start year</label>
        <YearChips value={values.startYear} onChange={(v) => set('startYear', v)} />
      </div>
      <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
        <label className="form-label">
          End year <span className="form-hint-inline">if you finished</span>
        </label>
        <YearChips
          value={values.endYear}
          onChange={(v) => set('endYear', v)}
          emptyLabel="Still studying"
        />
      </div>
    </div>
  )
}

export const LanguageField = ({ form }: { form: ReviewForm }) => (
  <div className="form-group">
    <label className="form-label">Language of instruction</label>
    <ChipSelect
      options={INSTRUCTION_LANGS}
      value={form.values.languageOfInstruction}
      onSelect={(v) => form.set('languageOfInstruction', v)}
    />
  </div>
)

// ---- Money ---------------------------------------------------------------------

export const MoneyFields = ({ form }: { form: ReviewForm }) => {
  const { values, set } = form
  return (
    <>
      <div className="form-group">
        <label className="form-label">Tuition per year</label>
        <ChipSelect
          options={TUITION_RANGES}
          value={values.tuitionRange}
          onSelect={(v) => set('tuitionRange', v)}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Monthly living cost</label>
        <ChipSelect
          options={LIVING_COSTS}
          value={values.livingCostRange}
          onSelect={(v) => set('livingCostRange', v)}
        />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Funding</label>
        <div className="segmented">
          {FUNDING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`seg ${values.fundingType === opt.value ? 'selected' : ''}`}
              onClick={() => {
                set('fundingType', values.fundingType === opt.value ? '' : opt.value)
                if (opt.value === 'self') set('fundingCoverage', '')
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {values.fundingType && values.fundingType !== 'self' && (
          <div style={{ marginTop: '.6rem' }}>
            <label className="form-label" style={{ marginBottom: '.3rem' }}>
              Coverage
            </label>
            <div className="segmented">
              <button
                type="button"
                className={`seg ${values.fundingCoverage === 'partial' ? 'selected' : ''}`}
                onClick={() => set('fundingCoverage', 'partial')}
              >
                Partial
              </button>
              <button
                type="button"
                className={`seg ${values.fundingCoverage === 'full' ? 'selected' : ''}`}
                onClick={() => set('fundingCoverage', 'full')}
              >
                Full
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ---- Story ---------------------------------------------------------------------

export const ReviewTextField = ({
  form,
  starters = false,
}: {
  form: ReviewForm
  starters?: boolean
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { values, set } = form

  const insertStarter = (starter: string) => {
    const current = values.reviewText
    const joiner = current && !current.endsWith(' ') && !current.endsWith('\n') ? ' ' : ''
    const next = current + joiner + starter
    set('reviewText', next)
    // Caret lands after the inserted starter once React commits the new value.
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(next.length, next.length)
      }
    })
  }

  return (
    <div className="form-group">
      <label className="form-label" htmlFor="review-text">
        Your experience <span className="req-dot">*</span>
      </label>
      {starters && (
        <div className="chip-row" style={{ marginBottom: '0.5rem' }}>
          {STORY_STARTERS.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => insertStarter(s)}>
              {s.trim()}…
            </button>
          ))}
        </div>
      )}
      <textarea
        id="review-text"
        ref={textareaRef}
        className="form-textarea"
        placeholder="Tell other students about your experience. Academics, campus life, dormitories, the city, anything that matters..."
        value={values.reviewText}
        onChange={(e) => set('reviewText', e.target.value)}
      />
      <span className="form-hint">
        Min 10 characters. Tip: your phone keyboard&apos;s microphone works here.
      </span>
    </div>
  )
}

export const TagsField = ({ form }: { form: ReviewForm }) => {
  const [showMore, setShowMore] = useState(false)
  const { values, set } = form
  const toggle = (tag: string) =>
    set(
      'selectedTags',
      values.selectedTags.includes(tag)
        ? values.selectedTags.filter((t) => t !== tag)
        : [...values.selectedTags, tag]
    )

  return (
    <div className="form-group">
      <label className="form-label">
        Tags <span className="form-hint-inline">tap anything that fits</span>
      </label>
      <div className="chip-row">
        {POPULAR_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            className={`chip ${values.selectedTags.includes(tag) ? 'selected' : ''}`}
            onClick={() => toggle(tag)}
          >
            {tag}
          </button>
        ))}
      </div>
      {showMore && (
        <div className="chip-row" style={{ marginTop: '.5rem' }}>
          {MORE_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`chip ${values.selectedTags.includes(tag) ? 'selected' : ''}`}
              onClick={() => toggle(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="btn btn-ghost"
        style={{ padding: '.3rem 0', fontSize: '.8rem' }}
        onClick={() => setShowMore((s) => !s)}
      >
        {showMore ? '← Fewer tags' : 'More tags →'}
      </button>
    </div>
  )
}

export const ProsConsField = ({ form }: { form: ReviewForm }) => (
  <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
    <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
      <label className="form-label" htmlFor="pros">
        The best part <span className="form-hint-inline">pros</span>
      </label>
      <textarea
        id="pros"
        className="form-textarea"
        placeholder="e.g. Great professors, beautiful campus, cheap canteen..."
        value={form.values.pros}
        onChange={(e) => form.set('pros', e.target.value)}
      />
    </div>
    <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
      <label className="form-label" htmlFor="cons">
        The worst part <span className="form-hint-inline">cons</span>
      </label>
      <textarea
        id="cons"
        className="form-textarea"
        placeholder="e.g. Bureaucratic admin, crowded dorms, hard language barrier..."
        value={form.values.cons}
        onChange={(e) => form.set('cons', e.target.value)}
      />
    </div>
  </div>
)

// ---- Ratings -------------------------------------------------------------------

// All eight sub-scores at once (edit page, and any caller that wants the
// grid). The Boost ratings card walks them one at a time instead.
export const SubscoresField = ({
  value,
  onChange,
}: {
  value: SubScores
  onChange: (key: keyof SubScores, v: number) => void
}) => (
  <div className="subscore-grid">
    {SUBSCORE_INPUT_FIELDS.map((field) => (
      <div className="subscore" key={field.key}>
        <div className="subscore-head">
          <span className="subscore-name">{field.label}</span>
          <span className="subscore-val">
            {value[field.key] ? `${value[field.key]}/5` : 'not rated'}
          </span>
        </div>
        <StarInput value={value[field.key] || 0} onChange={(v: number) => onChange(field.key, v)} />
      </div>
    ))}
  </div>
)

// ---- Media ---------------------------------------------------------------------

export interface MediaState {
  media: MediaItem[]
  uploading: boolean
  errorCount: number
}

export const MediaField = ({
  mediaState,
  onStateChange,
  disabled,
  uploaderKey,
  hint,
}: {
  mediaState: MediaState
  onStateChange: (s: MediaState) => void
  disabled?: boolean
  uploaderKey: string
  hint?: string
}) => (
  <div className="form-group">
    <label className="form-label">
      {hint ?? 'Show the real life'} <span className="form-hint-inline">up to 5</span>
    </label>
    <MediaUploader
      key={uploaderKey}
      onStateChange={onStateChange}
      disabled={disabled}
      initialMedia={mediaState.media}
    />
  </div>
)

// ---- About you (anonymous only) ---------------------------------------------------

export const AnonEmailField = ({ form }: { form: ReviewForm }) => (
  <div className="form-group">
    <label className="form-label" htmlFor="anon-email">
      Email <span className="form-hint-inline">optional, never shown publicly</span>
    </label>
    <input
      type="email"
      id="anon-email"
      className="form-input"
      placeholder="you@example.com"
      value={form.values.anonEmail}
      onChange={(e) => form.set('anonEmail', e.target.value)}
    />
    <span className="form-hint">
      If you sign up with this email later, we can match the review to your account.
    </span>
  </div>
)

// Anonymous "about you" fields beyond email are gone from the fast flow: they
// never reached review columns (they live on the private reviewer_context
// row), and sign-up onboarding already collects them for signed-in users.
