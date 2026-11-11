import { useCallback, useEffect, useRef, useState } from 'react'
import type { SubScores } from '../../lib/reviewSubmit'
import {
  BOOST_CARD_META,
  BOOST_CARD_ORDER,
  BOOST_CARD_SHORT,
  SUBSCORE_INPUT_FIELDS,
  isBoostCardDone,
  nextBoostCard,
  type ReviewFieldValues,
} from '../../lib/reviewFlow'
import type { BoostAfterCard, BoostCard } from '../../lib/analytics'
import type { ReviewForm } from '../../hooks/useReviewForm'
import {
  EndYearField,
  EnrollmentField,
  LanguageField,
  MediaField,
  MoneyFields,
  ProgramField,
  ReviewTextField,
  type MediaState,
} from './fields'
import type { MediaItem } from '../../lib/reviewSubmit'

// The post-publish deck: optional detail one card at a time, auto-cascading.
// Finishing a card's required picks saves it and slides the next card in, so
// nobody is left staring at a completed card wondering what to do next. Tabs
// across the top jump anywhere; cards already answered on screen 1 (a
// Language Course pick fills program and language, for example) show done
// and get skipped by the cascade, but stay tappable for corrections.
const CARD_FIELDS: Record<BoostCard, (keyof ReviewFieldValues)[]> = {
  words: ['reviewText'],
  ratings: ['subscores'],
  money: ['tuitionRange', 'livingCostRange', 'fundingType', 'fundingCoverage'],
  program: ['program', 'degreeLevel', 'languageOfInstruction', 'enrollmentStatus', 'endYear'],
  details: ['enrollmentStatus', 'startYear', 'endYear', 'languageOfInstruction'],
  pros_cons: ['pros', 'cons'],
  media: [],
}

interface CardSnapshot {
  fields: Partial<ReviewFieldValues>
  media: MediaItem[]
}

const snapshotsEqual = (a: CardSnapshot | undefined, b: CardSnapshot): boolean =>
  !!a &&
  JSON.stringify(a.fields) === JSON.stringify(b.fields) &&
  JSON.stringify(a.media) === JSON.stringify(b.media)

export const BoostCards = ({
  form,
  mediaState,
  onMediaStateChange,
  cards = BOOST_CARD_ORDER,
  initialIndex = 0,
  onSave,
  onCardCompleted,
  onExit,
  onFinish,
  wordsDone = false,
  wordsHint,
}: {
  form: ReviewForm
  mediaState: MediaState
  onMediaStateChange: (s: MediaState) => void
  // Which cards to walk, in order. Anonymous Boost (Phase 3) passes the subset
  // the review-boost function allowlists.
  cards?: BoostCard[]
  initialIndex?: number
  onSave: (card: BoostCard) => Promise<boolean>
  onCardCompleted: (card: BoostCard) => void
  onExit: (afterCard: BoostAfterCard, nextIndex: number) => void
  onFinish: () => void
  // The words card's done state comes from the gift rule's own-words count,
  // which the deck cannot compute without the reward module.
  wordsDone?: boolean
  wordsHint?: string
}) => {
  const [index, setIndex] = useState(initialIndex)
  const [saving, setSaving] = useState(false)
  const [cascadeMsg, setCascadeMsg] = useState<string | null>(null)
  const lastCompletedRef = useRef<BoostAfterCard>('none')
  // Per-card restore points: the saved state on entry, refreshed after every
  // successful save. Skip restores the current card; leaving restores every
  // card visited, so nothing unsaved can ride along on the preview.
  const baselinesRef = useRef<Partial<Record<BoostCard, CardSnapshot>>>({})
  // Whether the current card already met its done condition when opened. A
  // card that was complete on entry (Language Course prefill, or revisiting a
  // saved card) never auto-cascades: the reviewer is there deliberately.
  const entryCompleteRef = useRef(false)
  const advancingRef = useRef(false)
  const cascadeTimerRef = useRef<number | null>(null)
  const formValuesRef = useRef(form.values)
  const mediaStateRef = useRef(mediaState)

  useEffect(() => {
    formValuesRef.current = form.values
  }, [form.values])

  useEffect(() => {
    mediaStateRef.current = mediaState
  }, [mediaState])

  useEffect(
    () => () => {
      if (cascadeTimerRef.current !== null) window.clearTimeout(cascadeTimerRef.current)
    },
    []
  )

  const cardDone = (c: BoostCard) =>
    c === 'words' ? wordsDone : isBoostCardDone(c, form.values, mediaCount)

  const card = cards[index]
  const total = cards.length
  const isLast = index === total - 1
  const mediaCount = mediaState.media.length

  const takeSnapshot = useCallback(
    (c: BoostCard): CardSnapshot => ({
      fields: Object.fromEntries(
        CARD_FIELDS[c].map((k) => [k, formValuesRef.current[k]])
      ) as Partial<ReviewFieldValues>,
      media: mediaStateRef.current.media,
    }),
    []
  )

  // Record the restore point and the done-on-entry flag once per card visit.
  useEffect(() => {
    if (!baselinesRef.current[card]) baselinesRef.current[card] = takeSnapshot(card)
    entryCompleteRef.current = isBoostCardDone(
      card,
      formValuesRef.current,
      mediaStateRef.current.media.length
    )
  }, [card, takeSnapshot])

  const restoreCard = (c: BoostCard) => {
    const base = baselinesRef.current[c]
    if (!base) return
    form.applyValues(base.fields)
    if (c === 'media') onMediaStateChange({ ...mediaStateRef.current, media: base.media })
  }

  const restoreAllVisited = () => {
    const merged: Partial<ReviewFieldValues> = {}
    let media: MediaItem[] | null = null
    for (const c of Object.keys(baselinesRef.current) as BoostCard[]) {
      const base = baselinesRef.current[c]
      if (!base) continue
      Object.assign(merged, base.fields)
      if (c === 'media') media = base.media
    }
    form.applyValues(merged)
    if (media) onMediaStateChange({ ...mediaStateRef.current, media })
  }

  const advance = () => {
    if (isLast) {
      onFinish()
    } else {
      setIndex((i) => i + 1)
    }
  }

  // Manual navigation wins over the cascade, including while a card save is
  // still in flight: bumping the generation makes the pending navigation a
  // no-op once the save resolves, so a tab tap or Back is never overridden
  // by a setIndex fired half a second later.
  const cascadeGenRef = useRef(0)
  const cancelCascade = () => {
    cascadeGenRef.current += 1
    advancingRef.current = false
    if (cascadeTimerRef.current !== null) {
      window.clearTimeout(cascadeTimerRef.current)
      cascadeTimerRef.current = null
      setCascadeMsg(null)
    }
  }

  // The cascade: wait a beat so the completing tap's state update flushes
  // before the patch is built — a save fired synchronously in the same
  // click handler would read stale values and drop the last tap — then
  // save, flash the notice, and land on the next card that still needs
  // answers (skipping anything already done, like a prefilled program
  // card). If every remaining card is done, the deck finishes.
  const runCascade = useCallback(
    (fromCard: BoostCard) => {
      if (advancingRef.current) return
      advancingRef.current = true
      const gen = ++cascadeGenRef.current
      cascadeTimerRef.current = window.setTimeout(() => {
        cascadeTimerRef.current = null
        const after = (refreshBaseline = true) => {
          if (refreshBaseline) baselinesRef.current[fromCard] = takeSnapshot(fromCard)
          const next = nextBoostCard(
            cards,
            index,
            formValuesRef.current,
            mediaStateRef.current.media.length
          )
          advancingRef.current = false
          if (gen !== cascadeGenRef.current) return // manual navigation won
          if (next === -1) {
            onFinish()
          } else {
            setIndex(next)
          }
        }

        // Only save when this visit actually changed the card's fields — an
        // all-skipped ratings walk or a pre-filled card has nothing to write.
        const dirty = !snapshotsEqual(baselinesRef.current[fromCard], takeSnapshot(fromCard))
        if (!dirty) {
          after()
          return
        }
        setSaving(true)
        void onSave(fromCard).then((ok) => {
          setSaving(false)
          if (!ok) {
            advancingRef.current = false
            return // error already toasted by the caller; stay on the card
          }
          // Completion means a real save, so the card only counts as
          // completed (and the notice only shows) once the write landed.
          // Pin the baseline to the saved state now — anything tapped during
          // the notice is new unsaved input, not part of this save.
          lastCompletedRef.current = fromCard
          onCardCompleted(fromCard)
          baselinesRef.current[fromCard] = takeSnapshot(fromCard)
          setCascadeMsg(`✓ ${BOOST_CARD_SHORT[fromCard].label} saved`)
          cascadeTimerRef.current = window.setTimeout(() => {
            cascadeTimerRef.current = null
            setCascadeMsg(null)
            after(false)
          }, 480)
        })
      }, 520)
    },
    [cards, index, onSave, onCardCompleted, onFinish, takeSnapshot]
  )

  // Auto-cascade for the two chip-driven cards: the tap that completes the
  // required picks saves and moves on, no extra button press in between.
  // Ratings cascades on its own walk-finished event; media stays manual
  // because uploads are multi-file and should not cut off after the first.
  const completeNow = (card === 'money' || card === 'program') && cardDone(card)
  useEffect(() => {
    if (!completeNow || entryCompleteRef.current || saving || advancingRef.current) return
    runCascade(card)
  }, [completeNow, card, saving, runCascade])

  const saveCard = async () => {
    if (saving) return
    setSaving(true)
    try {
      const ok = await onSave(card)
      if (!ok) return // error already toasted by the caller; stay on the card
      lastCompletedRef.current = card
      onCardCompleted(card)
      baselinesRef.current[card] = takeSnapshot(card)
      advance()
    } finally {
      setSaving(false)
    }
  }

  const skip = () => {
    cancelCascade()
    restoreCard(card)
    advance()
  }

  // Back stays inside the deck: previous card, never the pre-publish screens
  // (the review is already live). Both Back and tab jumps restore the
  // current card first — unsaved input must not linger in form state, or the
  // next signed-in full-field save would silently persist it.
  const back = () => {
    cancelCascade()
    restoreCard(card)
    setIndex((i) => Math.max(i - 1, 0))
  }

  const exit = () => {
    cancelCascade()
    restoreAllVisited()
    onExit(lastCompletedRef.current, index)
  }

  const prevCard = index > 0 ? cards[index - 1] : null

  return (
    <div className="boost">
      <div className="boost-head">
        <div>
          <h2 className="step-title" style={{ marginBottom: 0 }}>
            Keep the streak going
          </h2>
          <p className="step-sub" style={{ marginBottom: 0 }}>
            Cards save as you finish them. Tap any to jump ahead.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={exit} disabled={saving}>
          Done for now
        </button>
      </div>

      <div className="boost-tabs" role="group" aria-label="Review detail cards">
        {cards.map((c, i) => {
          const done = cardDone(c)
          return (
            <button
              key={c}
              type="button"
              aria-current={i === index ? 'step' : undefined}
              className={`boost-tab${i === index ? ' active' : ''}${done ? ' done' : ''}`}
              onClick={() => {
                cancelCascade()
                restoreCard(card)
                setIndex(i)
              }}
              disabled={saving}
            >
              {done ? '✓' : BOOST_CARD_SHORT[c].emoji} {BOOST_CARD_SHORT[c].label}
            </button>
          )
        })}
      </div>

      {cascadeMsg && (
        <div className="boost-cascade" role="status">
          <span>{cascadeMsg}</span>
          <span aria-hidden="true">→</span>
        </div>
      )}

      <div className="boost-card" key={card}>
        <h3 className="boost-card-title">{BOOST_CARD_META[card].title}</h3>
        <p className="boost-card-sub">{BOOST_CARD_META[card].sub}</p>

        {card === 'words' && (
          <>
            <ReviewTextField form={form} story />
            {wordsHint && (
              <p className="reward-hint" aria-live="polite">
                {wordsHint}
              </p>
            )}
          </>
        )}
        {card === 'ratings' && <RatingsCard form={form} onDone={() => runCascade('ratings')} />}
        {card === 'money' && <MoneyFields form={form} />}
        {card === 'program' && (
          <>
            <ProgramField form={form} />
            <LanguageField form={form} />
            <EnrollmentField form={form} />
            <EndYearField form={form} />
          </>
        )}
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
          {prevCard ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={back}
              disabled={saving || mediaState.uploading}
            >
              ← {BOOST_CARD_SHORT[prevCard].label}
            </button>
          ) : (
            <span />
          )}
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

const TAP_LABELS = ['Poor', 'Fair', 'Okay', 'Good', 'Great']

// The ratings card walks the eight aspects one at a time on a thumb-sized
// 1–5 tap bar: tap a score to move on, "Not sure" passes, dots jump back.
// Reaching the last aspect fires onDone, which cascades into the next card —
// the fix for the old dead end where nothing happened after the final rating.
export const RatingsCard = ({ form, onDone }: { form: ReviewForm; onDone: () => void }) => {
  const scores = form.values.subscores
  const total = SUBSCORE_INPUT_FIELDS.length

  // Resume at the first unrated aspect; a fully-rated revisit lands on the
  // summary instead of forcing another walk.
  const firstUnrated = SUBSCORE_INPUT_FIELDS.findIndex((f) => scores[f.key] === undefined)
  const [aspectIndex, setAspectIndex] = useState(firstUnrated === -1 ? total : firstUnrated)

  const done = aspectIndex >= total
  const aspect = done ? null : SUBSCORE_INPUT_FIELDS[aspectIndex]
  const ratedCount = Object.keys(scores).length

  const moveOn = (key?: keyof SubScores, value?: number) => {
    if (key && typeof value === 'number') {
      form.set('subscores', { ...scores, [key]: value })
    }
    if (aspectIndex >= total - 1) {
      setAspectIndex(total)
      onDone()
    } else {
      setAspectIndex((i) => i + 1)
    }
  }

  if (done || !aspect) {
    return (
      <div className="boost-ratings-done">
        <p className="form-hint">
          {ratedCount > 0 ? `${ratedCount} of ${total} rated.` : 'Nothing rated yet.'} Tap the dots
          to change any score.
        </p>
        <div className="aspect-dots">
          {SUBSCORE_INPUT_FIELDS.map((f, i) => (
            <button
              key={f.key}
              type="button"
              aria-label={`${f.label}: ${scores[f.key] ? `${scores[f.key]}/5` : 'not rated'}`}
              className={`aspect-dot${scores[f.key] ? ' done' : ''}`}
              onClick={() => setAspectIndex(i)}
            />
          ))}
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setAspectIndex(0)}>
          Go through again
        </button>
      </div>
    )
  }

  return (
    <div className="boost-aspect">
      <div className="aspect-dots">
        {SUBSCORE_INPUT_FIELDS.map((f, i) => (
          <button
            key={f.key}
            type="button"
            aria-label={`${f.label}: ${scores[f.key] ? `${scores[f.key]}/5` : 'not rated'}`}
            className={`aspect-dot${scores[f.key] ? ' done' : ''}${i === aspectIndex ? ' active' : ''}`}
            onClick={() => setAspectIndex(i)}
          />
        ))}
      </div>
      <div className="boost-aspect-count">
        Aspect {aspectIndex + 1} of {total} · {ratedCount} rated
      </div>
      <div className="subscore-head" style={{ marginBottom: '0.4rem' }}>
        <span className="subscore-name" style={{ fontSize: '1rem' }}>
          {aspect.label}
        </span>
        <span className="subscore-val">
          {scores[aspect.key] ? `${scores[aspect.key]}/5` : 'not rated'}
        </span>
      </div>
      <div className="tap-score-row" role="group" aria-label={aspect.label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={scores[aspect.key] === n}
            className={`tap-score${scores[aspect.key] === n ? ' selected' : ''}`}
            onClick={() => moveOn(aspect.key, n)}
          >
            {n}
            <span>{TAP_LABELS[n - 1]}</span>
          </button>
        ))}
      </div>
      <div className="aspect-nav">
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '.3rem 0', fontSize: '.8rem' }}
          disabled={aspectIndex === 0}
          onClick={() => setAspectIndex((i) => Math.max(i - 1, 0))}
        >
          ← Prev
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '.3rem 0', fontSize: '.8rem' }}
          onClick={() => moveOn()}
        >
          Not sure →
        </button>
      </div>
    </div>
  )
}
