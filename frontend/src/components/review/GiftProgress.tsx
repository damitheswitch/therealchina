import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  POLARITY_TOPICS,
  previewReviewFromFields,
  type ReviewFieldValues,
} from '../../lib/reviewFlow'
import { filledDetailAreas } from '../../lib/reviewDetail'
import type { RewardEvaluation } from '../../lib/reviewReward'
import type { MediaItem } from '../../lib/reviewSubmit'
import { giftHeadline, giftSteps } from '../../lib/giftProgress'

const POLARITY_TAGS = new Set<string>(POLARITY_TOPICS.flatMap((t) => [t.pos.tag, t.neg.tag]))

// Red-envelope progress bar at the top of the review flow and the Boost cards.
// The envelope sits at the end of the bar, shakes when one step is left and
// opens when every step is done. Tapping the bar shows the checklist and what
// is inside. Progress is announced politely; nothing opens on its own.
export const GiftProgress = ({
  values,
  media,
  evaluation,
}: {
  values: ReviewFieldValues
  media: MediaItem[]
  // Set only while the gift offer is on.
  evaluation?: RewardEvaluation
}) => {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  const steps = useMemo(
    () =>
      giftSteps({
        rating: values.rating,
        polarityTaps: values.selectedTags.filter((t) => POLARITY_TAGS.has(t)).length,
        filledAreas: filledDetailAreas(previewReviewFromFields(values, media)).length,
        evaluation,
      }),
    [values, media, evaluation]
  )

  const done = steps.filter((s) => s.done).length
  const left = steps.length - done
  const pct = (done / steps.length) * 100
  const giftOn = Boolean(evaluation)
  const state = left === 0 ? 'opened' : left === 1 ? 'close' : 'closed'

  return (
    <div className={`gift-progress gift-${state}`}>
      <button
        type="button"
        className="gift-progress-head"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="gift-progress-bar" aria-hidden="true">
          <span className="gift-progress-fill" style={{ width: `${pct}%` }} />
          {steps.map((s, i) => (
            <span
              key={s.key}
              className={`gift-progress-tick${s.done ? ' done' : ''}`}
              style={{ left: `${((i + 1) / steps.length) * 100}%` }}
            />
          ))}
        </span>
        <span className="gift-envelope" aria-hidden="true">
          {state === 'opened' ? '🎁' : '🧧'}
        </span>
        <span className="gift-progress-label" role="status">
          {giftHeadline(steps, giftOn)}
        </span>
      </button>

      {open && (
        <div id={panelId} className="gift-progress-body">
          <ul className="gift-checklist">
            {steps.map((s) => (
              <li key={s.key} className={s.done ? 'done' : ''}>
                {s.label}
              </li>
            ))}
          </ul>
          {giftOn ? (
            <>
              <p>
                <strong>Inside:</strong> a free VPN from a trusted friend of TRC. We email you the
                steps after you publish. Good or bad review, the gift is the same.
              </p>
              <p>
                One gift per person. <Link to="/editorial-policy#gifts">How gifts work</Link>
              </p>
            </>
          ) : (
            <p>
              <strong>Inside:</strong> a gold highlight that puts your review in front of more
              students.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
