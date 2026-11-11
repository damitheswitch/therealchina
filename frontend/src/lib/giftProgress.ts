import { DETAILED_THRESHOLD } from './reviewDetail'
import { MIN_OWN_UNITS, MIN_POLARITY_TAGS, type RewardEvaluation } from './reviewReward'

// Steps on the red-envelope bar at the top of the review flow. The first step
// ("Started") is always done, so the bar never opens empty: people finish
// what they feel they already began. With the gift offer on, the steps are the
// server's "full review" rule; with it off, they lead to the gold highlight.

export interface GiftStep {
  key: 'started' | 'rating' | 'taps' | 'words' | 'details' | 'ratings' | 'money' | 'program'
  label: string
  done: boolean
}

export interface GiftProgressInput {
  rating: number
  polarityTaps: number
  filledAreas: number
  // Present only while the gift offer is on.
  evaluation?: RewardEvaluation
}

export const giftSteps = ({
  rating,
  polarityTaps,
  filledAreas,
  evaluation,
}: GiftProgressInput): GiftStep[] => {
  const steps: GiftStep[] = [
    { key: 'started', label: 'Started', done: true },
    { key: 'rating', label: 'Star rating', done: rating > 0 },
  ]
  if (evaluation) {
    const has = (m: string) => !(evaluation.missing as string[]).includes(m)
    steps.push(
      { key: 'taps', label: `${MIN_POLARITY_TAGS} taps on What stood out`, done: has('taps') },
      {
        key: 'words',
        label: `${MIN_OWN_UNITS} words of your own (${Math.min(evaluation.ownUnits, MIN_OWN_UNITS)}/${MIN_OWN_UNITS})`,
        done: has('words'),
      },
      { key: 'ratings', label: 'Quick ratings', done: has('ratings') },
      { key: 'money', label: 'The cost', done: has('money') },
      { key: 'program', label: 'Your major', done: has('program') }
    )
  } else {
    steps.push(
      {
        key: 'taps',
        label: `${MIN_POLARITY_TAGS} taps on What stood out`,
        done: polarityTaps >= MIN_POLARITY_TAGS,
      },
      {
        key: 'details',
        label: `${DETAILED_THRESHOLD} details (${Math.min(filledAreas, DETAILED_THRESHOLD)}/${DETAILED_THRESHOLD})`,
        done: filledAreas >= DETAILED_THRESHOLD,
      }
    )
  }
  return steps
}

export const giftHeadline = (steps: GiftStep[], giftOn: boolean): string => {
  const done = steps.filter((s) => s.done).length
  const left = steps.length - done
  if (left === 0) {
    return giftOn
      ? 'Opened: your free VPN gift is ready.'
      : 'Opened: your review gets the gold highlight.'
  }
  if (left === 1) return 'One step left to open your red envelope.'
  return `${done} of ${steps.length} done. Finish to open your red envelope.`
}
