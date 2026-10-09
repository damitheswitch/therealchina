import { useEffect, useRef, useState } from 'react'
import type { SubScores } from '../../lib/reviewSubmit'
import {
  BOOST_CARD_META,
  BOOST_CARD_ORDER,
  SUBSCORE_INPUT_FIELDS,
  type ReviewFieldValues,
} from '../../lib/reviewFlow'
import type { BoostAfterCard, BoostCard } from '../../lib/analytics'
import type { ReviewForm } from '../../hooks/useReviewForm'
import { StarInput } from '../StarInput'
import {
  DegreeField,
  EnrollmentField,
  LanguageField,
  MediaField,
  MoneyFields,
  ProgramField,
  ProsConsField,
  YearsField,
  type MediaState,
} from './fields'
import type { MediaItem } from '../../lib/reviewSubmit'

// The post-publish Boost: optional detail added one card at a time, each card
// saved immediately through review-manage. The server rewrites the whole
// field set on every update, so `onSave` persists the caller's full current
// state — a card's edits reach `form` the moment they are made (the preview
// fills in live), and Skip restores the values the card had on entry rather
// than letting unsaved input leak into a later card's save.
const CARD_FIELDS: Record<BoostCard, (keyof ReviewFieldValues)[]> = {
  program: ['program', 'degreeLevel'],
  ratings: ['subscores'],
  money: ['tuitionRange', 'livingCostRange', 'fundingType', 'fundingCoverage'],
  details: ['enrollmentStatus', 'startYear', 'endYear', 'languageOfInstruction'],
  pros_cons: ['pros', 'cons'],
  media: [],
}

export const BoostCards = ({
  form,
  mediaState,
  onMediaStateChange,
  initialIndex = 0,
  onSave,
  onCardCompleted,
  onExit,
  onFinish,
}: {
  form: ReviewForm
  mediaState: MediaState
  onMediaStateChange: (s: MediaState) => void
  initialIndex?: number
  onSave: () => Promise<boolean>
  onCardCompleted: (card: BoostCard) => void
  onExit: (afterCard: BoostAfterCard, nextIndex: number) => void
  onFinish: () => void
}) => {
  const [index, setIndex] = useState(initialIndex)
  const [saving, setSaving] = useState(false)
  const lastCompletedRef = useRef<BoostAfterCard>('none')
  const snapshotRef = useRef<{ fields: Partial<ReviewFieldValues>; media: MediaItem[] } | null>(
    null
  )
  const formValuesRef = useRef(form.values)
  const mediaStateRef = useRef(mediaState)

  useEffect(() => {
    formValuesRef.current = form.values
  }, [form.values])

  useEffect(() => {
    mediaStateRef.current = mediaState
  }, [mediaState])

  const card = BOOST_CARD_ORDER[index]
  const total = BOOST_CARD_ORDER.length
  const isLast = index === total - 1

  // Snapshot this card's fields on entry: the restore point Skip returns to.
  useEffect(() => {
    snapshotRef.current = {
      fields: Object.fromEntries(
        CARD_FIELDS[card].map((k) => [k, formValuesRef.current[k]])
      ) as Partial<ReviewFieldValues>,
      media: mediaStateRef.current.media,
    }
  }, [card])

  const advance = () => {
    if (isLast) {
      onFinish()
    } else {
      setIndex((i) => i + 1)
    }
  }

  const saveCard = async () => {
    if (saving) return
    setSaving(true)
    try {
      const ok = await onSave()
      if (!ok) return // error already toasted by the caller; stay on the card
      lastCompletedRef.current = card
      onCardCompleted(card)
      advance()
    } finally {
      setSaving(false)
    }
  }

  const restoreSnapshot = () => {
    const snap = snapshotRef.current
    if (snap) {
      form.applyValues(snap.fields)
      onMediaStateChange({ ...mediaStateRef.current, media: snap.media })
    }
  }

  const skip = () => {
    restoreSnapshot()
    advance()
  }

  // Leaving mid-card discards that card's unsaved input as well — otherwise
  // the preview would show detail the review never actually saved.
  const exit = () => {
    restoreSnapshot()
    onExit(lastCompletedRef.current, index)
  }

  return (
    <div className="boost">
      <div className="boost-head">
        <div>
          <h2 className="step-title" style={{ marginBottom: 0 }}>
            Make it more useful
          </h2>
          <p className="step-sub" style={{ marginBottom: 0 }}>
            Card {index + 1} of {total}. Skip anything you don&apos;t know.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={exit} disabled={saving}>
          Done for now
        </button>
      </div>

      <div className="boost-card" key={card}>
        <h3 className="boost-card-title">{BOOST_CARD_META[card].title}</h3>
        <p className="boost-card-sub">{BOOST_CARD_META[card].sub}</p>

        {card === 'program' && (
          <>
            <ProgramField form={form} />
            <DegreeField form={form} />
          </>
        )}
        {card === 'ratings' && <RatingsCard form={form} />}
        {card === 'money' && <MoneyFields form={form} />}
        {card === 'details' && (
          <>
            <EnrollmentField form={form} />
            <YearsField form={form} />
            <LanguageField form={form} />
          </>
        )}
        {card === 'pros_cons' && <ProsConsField form={form} />}
        {card === 'media' && (
          <MediaField
            mediaState={mediaState}
            onStateChange={onMediaStateChange}
            disabled={saving}
            uploaderKey="boost-media"
            hint="Add a photo"
          />
        )}

        <div className="wizard-nav">
          <button type="button" className="btn btn-ghost" onClick={exit} disabled={saving}>
            Stop here
          </button>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={skip}
              disabled={saving || mediaState.uploading}
            >
              Skip
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={saveCard}
              disabled={saving || mediaState.uploading}
            >
              {saving ? 'Saving...' : isLast ? 'Save & finish' : 'Save & next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// The ratings card walks the eight aspects one at a time (tap a score to move
// on, "Not sure" skips it). Picks write straight into form state so the
// preview fills in live; the card's single Save persists the whole stack.
const RatingsCard = ({ form }: { form: ReviewForm }) => {
  const [aspectIndex, setAspectIndex] = useState(0)

  const scores = form.values.subscores
  const aspect = SUBSCORE_INPUT_FIELDS[aspectIndex]
  const done = aspectIndex >= SUBSCORE_INPUT_FIELDS.length

  const answer = (key: keyof SubScores, value: number) => {
    form.set('subscores', { ...scores, [key]: value })
    setAspectIndex((i) => i + 1)
  }

  if (done) {
    return (
      <div className="boost-ratings-done">
        <p className="form-hint">
          {Object.keys(scores).length > 0
            ? `${Object.keys(scores).length} of ${SUBSCORE_INPUT_FIELDS.length} rated.`
            : 'Nothing rated.'}{' '}
          Save to add them to your review.
        </p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setAspectIndex(0)}>
          Go through again
        </button>
      </div>
    )
  }

  return (
    <div className="boost-aspect">
      <div className="boost-aspect-count">
        {aspectIndex + 1} of {SUBSCORE_INPUT_FIELDS.length}
      </div>
      <div className="subscore-head" style={{ marginBottom: '0.4rem' }}>
        <span className="subscore-name" style={{ fontSize: '1rem' }}>
          {aspect.label}
        </span>
        <span className="subscore-val">
          {scores[aspect.key] ? `${scores[aspect.key]}/5` : 'not rated'}
        </span>
      </div>
      <StarInput value={scores[aspect.key] || 0} onChange={(v: number) => answer(aspect.key, v)} />
      <button
        type="button"
        className="btn btn-ghost"
        style={{ marginTop: '0.6rem', padding: '.3rem 0', fontSize: '.8rem' }}
        onClick={() => setAspectIndex((i) => i + 1)}
      >
        Not sure →
      </button>
    </div>
  )
}
