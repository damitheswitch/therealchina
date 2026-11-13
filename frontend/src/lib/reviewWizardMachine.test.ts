import { describe, expect, it, vi } from 'vitest'

// reviewFlow.ts (deck constants) pulls in the Supabase client via
// reviewDrafts.ts — mock it so CI (no env vars) can load the module.
vi.mock('./supabaseClient', () => ({ supabase: {} }))
import { ANON_BOOST_CARDS, BOOST_CARD_ORDER } from './reviewFlow'
import {
  buildBoostDeck,
  initialReviewWizardState,
  isFillingIn,
  isPublishLocked,
  publishedReview,
  reviewWizardReducer as reduce,
  showsForm,
  type PublishedReview,
  type ReviewWizardEvent,
  type ReviewWizardState,
} from './reviewWizardMachine'

const published: PublishedReview = {
  reviewId: 'r1',
  universitySlug: 'pku',
  publishedAt: '2026-11-13T00:00:00.000Z',
}

const run = (state: ReviewWizardState, ...events: ReviewWizardEvent[]) =>
  events.reduce(reduce, state)

const editing = (step = 6): ReviewWizardState => ({ status: 'editing', step, error: null })

describe('initialReviewWizardState', () => {
  it('starts loading the draft unless there is nothing to load', () => {
    expect(initialReviewWizardState({ step: 1, loadDraft: true })).toEqual({
      status: 'loadingDraft',
      step: 1,
      error: null,
    })
    expect(initialReviewWizardState({ step: 2, loadDraft: false }).status).toBe('editing')
  })
})

describe('filling in the form', () => {
  it('keeps the form usable while the draft loads', () => {
    const s = run(initialReviewWizardState({ step: 1, loadDraft: true }), {
      type: 'GO_TO',
      step: 2,
    })
    expect(s).toEqual({ status: 'loadingDraft', step: 2, error: null })
  })

  it('DRAFT_READY moves to editing once and keeps step and banner', () => {
    const loading: ReviewWizardState = { status: 'loadingDraft', step: 3, error: 'x' }
    const s = run(loading, { type: 'DRAFT_READY' })
    expect(s).toEqual({ status: 'editing', step: 3, error: 'x' })
    expect(reduce(s, { type: 'DRAFT_READY' })).toBe(s)
  })

  it('INVALID shows the banner on the screen that fixes it; GO_TO clears it', () => {
    const invalid = run(editing(6), { type: 'INVALID', step: 1, error: 'Pick a rating' })
    expect(invalid).toEqual({ status: 'editing', step: 1, error: 'Pick a rating' })
    expect(reduce(invalid, { type: 'GO_TO', step: 2 })).toEqual(editing(2))
  })

  it('RESTORE_STEP moves the screen without touching the banner', () => {
    const s = run({ status: 'editing', step: 1, error: 'keep' }, { type: 'RESTORE_STEP', step: 2 })
    expect(s).toEqual({ status: 'editing', step: 2, error: 'keep' })
  })
})

describe('publishing', () => {
  it('locks the form while the submit is in flight', () => {
    const s = run(editing(6), { type: 'PUBLISH' })
    expect(s).toEqual({ status: 'publishing', step: 6 })
    expect(isPublishLocked(s)).toBe(true)
    expect(isFillingIn(s)).toBe(false)
  })

  it('a failed submit returns to editing on the same screen', () => {
    const s = run(editing(6), { type: 'PUBLISH' }, { type: 'PUBLISH_FAILED' })
    expect(s).toEqual(editing(6))
  })

  it('ignores a second PUBLISH while one is in flight or already landed', () => {
    const inFlight = run(editing(6), { type: 'PUBLISH' })
    expect(reduce(inFlight, { type: 'PUBLISH' })).toBe(inFlight)
    const landed = run(inFlight, {
      type: 'PUBLISHED',
      published,
      landing: { to: 'success' },
    })
    expect(reduce(landed, { type: 'PUBLISH' })).toBe(landed)
  })

  it('stays locked during the stamp, so the button cannot publish twice', () => {
    const s = run(
      editing(6),
      { type: 'PUBLISH' },
      { type: 'PUBLISHED', published, landing: { to: 'success' } }
    )
    expect(s.status).toBe('celebrating')
    expect(isPublishLocked(s)).toBe(true)
    expect(showsForm(s)).toBe(true)
    expect(publishedReview(s)).toEqual(published)
  })

  it('late form events after publish are ignored', () => {
    const s = run(
      editing(6),
      { type: 'PUBLISH' },
      { type: 'PUBLISHED', published, landing: { to: 'success' } }
    )
    for (const e of [
      { type: 'GO_TO', step: 1 },
      { type: 'INVALID', step: 1, error: 'x' },
      { type: 'RESTORE_STEP', step: 2 },
      { type: 'DRAFT_READY' },
      { type: 'PUBLISH_FAILED' },
    ] as ReviewWizardEvent[]) {
      expect(reduce(s, e)).toBe(s)
    }
  })
})

describe('after the stamp', () => {
  const celebrate = (landing: Extract<ReviewWizardEvent, { type: 'PUBLISHED' }>['landing']) =>
    run(editing(6), { type: 'PUBLISH' }, { type: 'PUBLISHED', published, landing })

  it('lands on success', () => {
    expect(reduce(celebrate({ to: 'success' }), { type: 'STAMP_DONE' })).toEqual({
      status: 'success',
      published,
    })
  })

  it('lands on the boost deck it was given', () => {
    const s = reduce(celebrate({ to: 'boost', deck: ['ratings'] }), { type: 'STAMP_DONE' })
    expect(s).toEqual({ status: 'boost', published, deck: ['ratings'] })
    expect(showsForm(s)).toBe(false)
  })

  it('success and boost go back and forth', () => {
    const success = reduce(celebrate({ to: 'success' }), { type: 'STAMP_DONE' })
    const boost = reduce(success, { type: 'OPEN_BOOST', deck: ['money', 'program'] })
    expect(boost).toEqual({ status: 'boost', published, deck: ['money', 'program'] })
    expect(reduce(boost, { type: 'BOOST_EXITED' })).toEqual(success)
    expect(reduce(boost, { type: 'BOOST_FINISHED' })).toEqual(success)
  })

  it('STAMP_DONE outside celebrating is a no-op', () => {
    const s = editing(6)
    expect(reduce(s, { type: 'STAMP_DONE' })).toBe(s)
  })
})

describe('buildBoostDeck', () => {
  it('never gives guests the photo card', () => {
    expect(buildBoostDeck({ signedIn: false, rewardOn: false, missing: [] })).toEqual(
      ANON_BOOST_CARDS
    )
    expect(buildBoostDeck({ signedIn: false, rewardOn: true, missing: ['money'] })).not.toContain(
      'media'
    )
  })

  it('gives signed-in reviewers the full deck', () => {
    expect(buildBoostDeck({ signedIn: true, rewardOn: false, missing: ['money'] })).toEqual(
      BOOST_CARD_ORDER
    )
  })

  it('puts what the gift still needs first, in deck order', () => {
    expect(
      buildBoostDeck({ signedIn: true, rewardOn: true, missing: ['program', 'words', 'ratings'] })
    ).toEqual(['words', 'ratings', 'program', 'money', 'media'])
  })

  it('ignores gift items that have no card', () => {
    expect(buildBoostDeck({ signedIn: true, rewardOn: true, missing: ['taps'] })).toEqual(
      BOOST_CARD_ORDER
    )
  })
})
