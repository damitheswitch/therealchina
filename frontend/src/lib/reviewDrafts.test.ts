import { describe, it, expect, beforeEach, vi } from 'vitest'

// The module imports the Supabase client, which requires env vars; mock it so
// the pure helpers and localStorage fallback can be tested without them.
vi.mock('./supabaseClient', () => ({ supabase: {} }))
import {
  isDraftWorthSaving,
  draftUniversityLabel,
  draftProgressLabel,
  loadLocalDraft,
  saveLocalDraft,
  clearLocalDraft,
  hasLocalDraftForUniversity,
  type ReviewDraft,
  type ReviewDraftPayload,
} from './reviewDrafts'

const makeDraft = (
  overrides: Partial<Omit<ReviewDraft, 'payload'>> & { payload?: ReviewDraftPayload }
): ReviewDraft =>
  ({
    id: 'draft-1',
    user_id: 'user-1',
    university_id: null,
    payload: {},
    progress: 1,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    ...overrides,
  }) as unknown as ReviewDraft

const emptyPayload: ReviewDraftPayload = {
  step: 1,
  selectedUni: '',
  selectedUniName: '',
  showNotListed: false,
  newUniName: '',
  newUniProvince: '',
  newUniCity: '',
  rating: 0,
  recommend: '',
  program: '',
  subscores: {},
  enrollmentStatus: '',
  startYear: '',
  endYear: '',
  languageOfInstruction: '',
  degreeLevel: '',
  tuitionRange: '',
  livingCostRange: '',
  fundingType: '',
  fundingCoverage: '',
  selectedTags: [],
  pros: '',
  cons: '',
  reviewText: '',
  media: [],
  homeCountry: '',
  currentStatus: '',
  languagesSpoken: [],
  emailConsent: false,
  anonEmail: '',
}

describe('isDraftWorthSaving', () => {
  it('returns false for null and empty drafts', () => {
    expect(isDraftWorthSaving(null)).toBe(false)
    expect(isDraftWorthSaving(emptyPayload)).toBe(false)
  })

  it('returns true when the user has typed content', () => {
    expect(isDraftWorthSaving({ ...emptyPayload, rating: 3 })).toBe(true)
    expect(isDraftWorthSaving({ ...emptyPayload, reviewText: 'Great place' })).toBe(true)
    expect(isDraftWorthSaving({ ...emptyPayload, program: 'MBBS' })).toBe(true)
    expect(isDraftWorthSaving({ ...emptyPayload, selectedUni: 'tsinghua' })).toBe(true)
    expect(isDraftWorthSaving({ ...emptyPayload, selectedUniName: 'Tsinghua' })).toBe(true)
    expect(isDraftWorthSaving({ ...emptyPayload, newUniName: 'New uni' })).toBe(true)
    expect(isDraftWorthSaving({ ...emptyPayload, subscores: { rating_campus: 4 } })).toBe(true)
    expect(isDraftWorthSaving({ ...emptyPayload, step: 2 })).toBe(true)
  })
})

describe('draft labels', () => {
  it('prefers the joined university name, then payload names', () => {
    const draft = makeDraft({
      payload: emptyPayload,
      universities: { name: 'Tsinghua University', slug: 'tsinghua', city: 'Beijing' },
      progress: 2,
    })
    expect(draftUniversityLabel(draft)).toBe('Tsinghua University')
    expect(draftProgressLabel(draft)).toBe('Step 2 of 5')
  })

  it('falls back to payload names and a safe label', () => {
    const named = makeDraft({
      payload: { ...emptyPayload, selectedUniName: 'Fudan' },
      universities: null,
      progress: 4,
    })
    expect(draftUniversityLabel(named)).toBe('Fudan')
    expect(draftProgressLabel(named)).toBe('Step 4 of 5')

    const empty = makeDraft({
      payload: emptyPayload,
      universities: null,
      progress: 0,
    })
    expect(draftUniversityLabel(empty)).toBe('Unknown university')
    expect(draftProgressLabel(empty)).toBe('Step 1 of 5')
  })
})

describe('local draft fallback', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips a payload through localStorage', () => {
    saveLocalDraft({ ...emptyPayload, rating: 4, reviewText: 'Loved it' })
    const loaded = loadLocalDraft()
    expect(loaded?.rating).toBe(4)
    expect(loaded?.reviewText).toBe('Loved it')
  })

  it('returns null after clear and on invalid JSON', () => {
    saveLocalDraft({ ...emptyPayload, rating: 4 })
    clearLocalDraft()
    expect(loadLocalDraft()).toBeNull()

    localStorage.setItem('trc_review_draft', 'not-json')
    expect(loadLocalDraft()).toBeNull()
  })

  it('matches a draft to its university slug', () => {
    saveLocalDraft({ ...emptyPayload, selectedUni: 'tsinghua', rating: 5 })
    expect(hasLocalDraftForUniversity('tsinghua')).toBe(true)
    expect(hasLocalDraftForUniversity('fudan')).toBe(false)
  })
})
