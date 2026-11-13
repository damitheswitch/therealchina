import type { BoostCard } from './analytics'
import type { RewardMissing } from './reviewReward'
import { ANON_BOOST_CARDS, BOOST_CARD_ORDER } from './reviewFlow'

// ---- Review wizard state machine -----------------------------------------------
// The new-review flow (ReviewWizard) as one explicit machine. Before this, the
// same lifecycle was spread over phase/step/error/loading/showStamp/
// pendingSuccess/published plus two refs, and some combinations were reachable
// that should not be: the Publish button re-enabled under the (click-through)
// stamp overlay, so a second click could publish twice.
//
//   loadingDraft ──DRAFT_READY──▶ editing
//        │  GO_TO / INVALID / RESTORE_STEP (both states, step + banner)
//        └──────────PUBLISH──────────┐
//                                    ▼
//   editing ◀──PUBLISH_FAILED── publishing ──PUBLISHED──▶ celebrating
//                                                            │ STAMP_DONE
//                                         ┌──────────────────┴─────────┐
//                                         ▼                            ▼
//                                      success ◀─BOOST_EXITED/FINISHED─ boost
//                                         └──────────OPEN_BOOST────────▶
//
// Events that do not apply to the current state are ignored (the same state
// object is returned), so late async callbacks can dispatch without guards.
// Edit mode (ReviewEditForm) does not use this machine.

export interface PublishedReview {
  reviewId: string
  // Canonical slug for links; null when publish created a new university.
  universitySlug: string | null
  publishedAt: string
}

// Where the flow lands once the stamp animation ends.
export type PublishLanding = { to: 'success' } | { to: 'boost'; deck: BoostCard[] }

export type ReviewWizardState =
  // Draft lookup still running. The form is already interactive.
  | { status: 'loadingDraft'; step: number; error: string | null }
  | { status: 'editing'; step: number; error: string | null }
  // Submit in flight: every publish control is disabled.
  | { status: 'publishing'; step: number }
  // Review is live, stamp overlay playing. Still nothing to click.
  | {
      status: 'celebrating'
      step: number
      published: PublishedReview
      landing: PublishLanding
    }
  | { status: 'success'; published: PublishedReview }
  | { status: 'boost'; published: PublishedReview; deck: BoostCard[] }

export type ReviewWizardStatus = ReviewWizardState['status']

export type ReviewWizardEvent =
  // Draft lookup finished (found, missing or failed).
  | { type: 'DRAFT_READY' }
  // A loaded draft or URL pick puts the reviewer on a screen. Keeps the banner.
  | { type: 'RESTORE_STEP'; step: number }
  // Reviewer moved between screens (Continue, Back, gift fix-it links).
  | { type: 'GO_TO'; step: number }
  // Validation stopped the reviewer on `step` with a banner message.
  | { type: 'INVALID'; step: number; error: string }
  | { type: 'PUBLISH' }
  | { type: 'PUBLISH_FAILED' }
  | { type: 'PUBLISHED'; published: PublishedReview; landing: PublishLanding }
  | { type: 'STAMP_DONE' }
  | { type: 'OPEN_BOOST'; deck: BoostCard[] }
  | { type: 'BOOST_EXITED' }
  | { type: 'BOOST_FINISHED' }

export const initialReviewWizardState = (opts: {
  step: number
  // Edit mode and other entry points with nothing to load start in editing.
  loadDraft: boolean
}): ReviewWizardState => ({
  status: opts.loadDraft ? 'loadingDraft' : 'editing',
  step: opts.step,
  error: null,
})

export const reviewWizardReducer = (
  state: ReviewWizardState,
  event: ReviewWizardEvent
): ReviewWizardState => {
  switch (event.type) {
    case 'DRAFT_READY':
      return state.status === 'loadingDraft' ? { ...state, status: 'editing' } : state

    case 'RESTORE_STEP':
      return isFillingIn(state) ? { ...state, step: event.step } : state

    case 'GO_TO':
      return isFillingIn(state) ? { ...state, step: event.step, error: null } : state

    case 'INVALID':
      return isFillingIn(state) ? { ...state, step: event.step, error: event.error } : state

    case 'PUBLISH':
      return isFillingIn(state) ? { status: 'publishing', step: state.step } : state

    case 'PUBLISH_FAILED':
      return state.status === 'publishing'
        ? { status: 'editing', step: state.step, error: null }
        : state

    case 'PUBLISHED':
      return state.status === 'publishing'
        ? {
            status: 'celebrating',
            step: state.step,
            published: event.published,
            landing: event.landing,
          }
        : state

    case 'STAMP_DONE':
      if (state.status !== 'celebrating') return state
      return state.landing.to === 'boost'
        ? { status: 'boost', published: state.published, deck: state.landing.deck }
        : { status: 'success', published: state.published }

    case 'OPEN_BOOST':
      return state.status === 'success'
        ? { status: 'boost', published: state.published, deck: event.deck }
        : state

    case 'BOOST_EXITED':
    case 'BOOST_FINISHED':
      return state.status === 'boost' ? { status: 'success', published: state.published } : state
  }
}

// ---- Selectors -------------------------------------------------------------------

type FillingIn = Extract<ReviewWizardState, { status: 'loadingDraft' | 'editing' }>

// The reviewer can still change the form and move between screens.
export const isFillingIn = (s: ReviewWizardState): s is FillingIn =>
  s.status === 'loadingDraft' || s.status === 'editing'

// The multi-screen form is on screen (anything before success/boost).
export const showsForm = (
  s: ReviewWizardState
): s is Extract<ReviewWizardState, { step: number }> =>
  s.status !== 'success' && s.status !== 'boost'

// Publish controls are locked: a submit is in flight or already landed.
export const isPublishLocked = (s: ReviewWizardState): boolean =>
  s.status === 'publishing' || s.status === 'celebrating'

export const publishedReview = (s: ReviewWizardState): PublishedReview | null =>
  'published' in s ? s.published : null

// ---- Boost deck ------------------------------------------------------------------

// The Power-Up deck, built the same way wherever it opens (straight after the
// stamp or from the success screen). Guests never get the photo card: the
// anonymous review-boost function cannot attach media. With the thank-you gift
// on, whatever the gift still needs comes first, in deck order.
export const buildBoostDeck = (opts: {
  signedIn: boolean
  rewardOn: boolean
  missing: readonly RewardMissing[]
}): BoostCard[] => {
  const base = opts.signedIn ? BOOST_CARD_ORDER : ANON_BOOST_CARDS
  if (!opts.rewardOn) return [...base]
  const front: BoostCard[] = [
    ...(opts.missing.includes('words') ? (['words'] as BoostCard[]) : []),
    ...(['ratings', 'money', 'program'] as const).filter((c) => opts.missing.includes(c)),
  ]
  return [...front, ...base.filter((c) => !front.includes(c))]
}
