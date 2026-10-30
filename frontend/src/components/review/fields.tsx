import { useEffect, useState } from 'react'
import type { MediaItem, SubScores } from '../../lib/reviewSubmit'
import { TUITION_RANGES, LIVING_COSTS } from '../../lib/constants'
import { ENROLLMENT_OPTIONS, FUNDING_OPTIONS } from '../../lib/reviewDisplay'
import { formatLocation } from '../../lib/chinaDivisions'
import {
  DEGREE_LEVELS,
  INSTRUCTION_LANGS,
  MORE_TAGS,
  POLARITY_TOPICS,
  POPULAR_PROGRAMS,
  POPULAR_TAGS,
  RATING_VIBE,
  RECOMMEND_OPTIONS,
  SUBSCORE_INPUT_FIELDS,
  allYearOptions,
  recentYearChips,
  derivePolarityText,
  applyDegreeLevel,
  applyEndYear,
  applyPolarityPick,
  applyProgram,
  applyStartYear,
  type PolarityDir,
  type PolarityTopicKey,
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
  <div className="chip-row" role="group">
    {options.map((opt) => (
      <button
        key={opt}
        type="button"
        className={`chip ${value === opt ? 'selected' : ''}`}
        aria-pressed={value === opt}
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

export const RatingField = ({ form }: { form: ReviewForm }) => {
  const vibe = RATING_VIBE[form.values.rating]
  return (
    <div className="form-group">
      <label className="form-label">
        Your overall rating <span className="req-dot">*</span>
      </label>
      <div className={`vibe-card${vibe ? ' rated' : ''}`}>
        <StarInput value={form.values.rating} onChange={(v: number) => form.set('rating', v)} />
        <div className="vibe-line" aria-live="polite">
          {vibe ? (
            <>
              <span className="vibe-emoji" key={form.values.rating}>
                {vibe.emoji}
              </span>
              <span>{vibe.text}</span>
            </>
          ) : (
            <span className="vibe-idle">Tap a star to rate your experience</span>
          )}
        </div>
      </div>
    </div>
  )
}

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

// Hybrid program picker: the tracks most international students take are
// one-tap chips; the full list stays reachable through the autocomplete.
// applyProgram keeps the Chinese Language inference in one place.
// The search input is a filter, not the field: keystrokes narrow the list and
// only a pick (or committing typed text on blur/Enter) writes `program`.
export const ProgramField = ({ form }: { form: ReviewForm }) => {
  const [query, setQuery] = useState(form.values.program)
  useEffect(() => setQuery(form.values.program), [form.values.program])
  return (
    <div className="form-group">
      <label className="form-label" htmlFor="program">
        Major / program
      </label>
      <div className="chip-row" role="group" style={{ marginBottom: '0.5rem' }}>
        {POPULAR_PROGRAMS.map((p) => (
          <button
            key={p.value}
            type="button"
            className={`chip ${form.values.program === p.value ? 'selected' : ''}`}
            aria-pressed={form.values.program === p.value}
            onClick={() => form.applyValues((cur) => applyProgram(cur, p.value))}
          >
            {p.label}
          </button>
        ))}
      </div>
      <ProgramAutocomplete
        id="program"
        placeholder="Or search any program, e.g. Architecture, Law, Finance"
        value={query}
        onChange={setQuery}
        onSelect={(opt: { value?: string }) =>
          form.applyValues((cur) => applyProgram(cur, opt.value ?? ''))
        }
        onCommitText={(text: string) => form.applyValues((cur) => applyProgram(cur, text.trim()))}
      />
      <span className="form-hint">Tap a popular track or search the full list.</span>
    </div>
  )
}

export const DegreeField = ({ form }: { form: ReviewForm }) => (
  <div className="form-group">
    <label className="form-label">Degree / track</label>
    <ChipSelect
      options={DEGREE_LEVELS}
      value={form.values.degreeLevel}
      onSelect={(v) => form.applyValues((cur) => applyDegreeLevel(cur, v))}
    />
  </div>
)

export const EnrollmentField = ({ form }: { form: ReviewForm }) => (
  <div className="form-group" style={{ marginBottom: 0 }}>
    <label className="form-label">Enrollment status</label>
    <div className="segmented" role="group" aria-label="Enrollment status">
      {ENROLLMENT_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`seg ${form.values.enrollmentStatus === opt.value ? 'selected' : ''}`}
          aria-pressed={form.values.enrollmentStatus === opt.value}
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
  const { values } = form
  return (
    <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
      <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
        <label className="form-label">Start year</label>
        <YearChips
          value={values.startYear}
          onChange={(v) => form.applyValues((cur) => applyStartYear(cur, v))}
        />
      </div>
      <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
        <label className="form-label">
          End year <span className="form-hint-inline">if you finished</span>
        </label>
        <YearChips
          value={values.endYear}
          onChange={(v) => form.applyValues((cur) => applyEndYear(cur, v))}
          emptyLabel="Still studying"
        />
      </div>
    </div>
  )
}

// Standalone year pickers for screens that ask one question at a time.
export const StartYearField = ({ form }: { form: ReviewForm }) => (
  <div className="form-group">
    <label className="form-label">
      Start year <span className="form-hint-inline">optional</span>
    </label>
    <YearChips
      value={form.values.startYear}
      onChange={(v) => form.applyValues((cur) => applyStartYear(cur, v))}
    />
  </div>
)

export const EndYearField = ({ form }: { form: ReviewForm }) => (
  <div className="form-group">
    <label className="form-label">
      Finished year <span className="form-hint-inline">if done</span>
    </label>
    <YearChips
      value={form.values.endYear}
      onChange={(v) => form.applyValues((cur) => applyEndYear(cur, v))}
      emptyLabel="Still studying"
    />
  </div>
)

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
  // A full scholarship covers tuition, so the tuition row steps aside instead
  // of asking a question whose answer is already known.
  const tuitionCovered =
    Boolean(values.fundingType) &&
    values.fundingType !== 'self' &&
    values.fundingCoverage === 'full'
  return (
    <>
      <div className="form-group">
        <label className="form-label">Funding</label>
        <div className="segmented" role="group" aria-label="Funding">
          {FUNDING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`seg ${values.fundingType === opt.value ? 'selected' : ''}`}
              aria-pressed={values.fundingType === opt.value}
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
            <div className="segmented" role="group" aria-label="Coverage">
              <button
                type="button"
                className={`seg ${values.fundingCoverage === 'partial' ? 'selected' : ''}`}
                aria-pressed={values.fundingCoverage === 'partial'}
                onClick={() => set('fundingCoverage', 'partial')}
              >
                Partial
              </button>
              <button
                type="button"
                className={`seg ${values.fundingCoverage === 'full' ? 'selected' : ''}`}
                aria-pressed={values.fundingCoverage === 'full'}
                onClick={() => set('fundingCoverage', 'full')}
              >
                Full
              </button>
            </div>
          </div>
        )}
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
        <label className="form-label">Tuition per year</label>
        {tuitionCovered ? (
          <p className="form-hint" style={{ marginTop: 0 }}>
            Covered by your scholarship.
          </p>
        ) : (
          <ChipSelect
            options={TUITION_RANGES}
            value={values.tuitionRange}
            onSelect={(v) => set('tuitionRange', v)}
          />
        )}
      </div>
    </>
  )
}

// ---- Story ---------------------------------------------------------------------

// Six 👍 / 👎 rows covering the things students actually compare. Each tap
// fans out into tags, pros/cons, and the auto-written review below it, so the
// reader gets structured signal even when the reviewer never types a word.
export const PolarityMatrixField = ({ form }: { form: ReviewForm }) => (
  <div className="form-group">
    <span className="sr-only">What stood out. Tap a side per row.</span>
    <div className="polarity-grid">
      {POLARITY_TOPICS.map((topic) => {
        const pick = form.values.polarity[topic.key as PolarityTopicKey]
        return (
          <div className="polarity-row" key={topic.key}>
            <span className="pol-topic">
              {topic.emoji} {topic.label}
            </span>
            <div className="pol-options" role="group" aria-label={topic.label}>
              {(['pos', 'neg'] as PolarityDir[]).map((dir) => {
                const side = topic[dir]
                return (
                  <button
                    key={dir}
                    type="button"
                    className={`pol-btn ${dir}${pick === dir ? ' selected' : ''}`}
                    aria-pressed={pick === dir}
                    onClick={() =>
                      form.applyValues((cur) =>
                        applyPolarityPick(cur, topic.key as PolarityTopicKey, dir)
                      )
                    }
                  >
                    {dir === 'pos' ? '👍' : '👎'} {side.label}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  </div>
)

export const ReviewTextField = ({
  form,
  story = false,
  placeholder,
}: {
  form: ReviewForm
  // Story screen variant: reads as a small optional extra, not a rating-only warning.
  story?: boolean
  placeholder?: string
}) => {
  const { values, set } = form
  // "Written from your picks" only while the text still is what the matrix
  // produced — an edited or replaced box is the reviewer's own words.
  const autoBuilt =
    values.reviewText.length > 0 && values.reviewText === derivePolarityText(values.polarity)
  return (
    <div className="form-group">
      <label className="form-label" htmlFor="review-text">
        {story ? 'Add one thing in your own words' : 'Your review in your own words'}{' '}
        <span className="form-hint-inline">optional</span>
      </label>
      <textarea
        id="review-text"
        className="form-textarea"
        placeholder={
          placeholder ??
          'Picks above write this for you. Edit it, replace it, or leave it empty for a quick rating.'
        }
        value={values.reviewText}
        onChange={(e) => set('reviewText', e.target.value)}
      />
      <span className="form-hint">
        {autoBuilt
          ? story
            ? 'Written from your picks. Edit it freely.'
            : 'Written from your picks. Edit it freely, or clear it for a quick rating.'
          : story
            ? 'At least 10 characters if you write something.'
            : 'Leave empty for a quick rating, or write at least 10 characters.'}
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
      <div className="chip-row" role="group">
        {POPULAR_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            className={`chip ${values.selectedTags.includes(tag) ? 'selected' : ''}`}
            aria-pressed={values.selectedTags.includes(tag)}
            onClick={() => toggle(tag)}
          >
            {tag}
          </button>
        ))}
      </div>
      {showMore && (
        <div className="chip-row" role="group" style={{ marginTop: '.5rem' }}>
          {MORE_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`chip ${values.selectedTags.includes(tag) ? 'selected' : ''}`}
              aria-pressed={values.selectedTags.includes(tag)}
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
      Email <span className="form-hint-inline">optional, private backup</span>
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
      Never shown publicly or shared with any university. Only used to link this review to your
      account if you sign up later.
    </span>
  </div>
)

// Anonymous "about you" fields beyond email are gone from the fast flow: they
// never reached review columns (they live on the private reviewer_context
// row), and sign-up onboarding already collects them for signed-in users.
