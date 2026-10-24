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
  mapDraftStepToScreen,
  withLiveMedia,
  DRAFT_PAYLOAD_VERSION,
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
    expect(draftProgressLabel(draft)).toBe('Step 1 of 2')
  })

  it('falls back to payload names and a safe label', () => {
    const named = makeDraft({
      payload: { ...emptyPayload, selectedUniName: 'Fudan' },
      universities: null,
      progress: 4,
    })
    expect(draftUniversityLabel(named)).toBe('Fudan')
    expect(draftProgressLabel(named)).toBe('Step 2 of 2')

    const empty = makeDraft({
      payload: emptyPayload,
      universities: null,
      progress: 0,
    })
    expect(draftUniversityLabel(empty)).toBe('Unknown university')
    expect(draftProgressLabel(empty)).toBe('Step 1 of 2')
  })
})

describe('mapDraftStepToScreen', () => {
  it('maps legacy 5-step drafts onto the two screens', () => {
    expect(mapDraftStepToScreen({ step: 1 })).toBe(1)
    expect(mapDraftStepToScreen({ step: 3 })).toBe(1)
    expect(mapDraftStepToScreen({ step: 4 })).toBe(2)
    expect(mapDraftStepToScreen({ step: 5 })).toBe(2)
  })

  it('resumes v2 drafts on their own screen', () => {
    expect(mapDraftStepToScreen({ step: 1, v: DRAFT_PAYLOAD_VERSION })).toBe(1)
    expect(mapDraftStepToScreen({ step: 2, v: DRAFT_PAYLOAD_VERSION })).toBe(2)
    expect(mapDraftStepToScreen({ step: 5, v: DRAFT_PAYLOAD_VERSION })).toBe(1)
  })

  it('treats missing or malformed payloads as screen 1', () => {
    expect(mapDraftStepToScreen(null)).toBe(1)
    expect(mapDraftStepToScreen(undefined)).toBe(1)
    expect(mapDraftStepToScreen({})).toBe(1)
    expect(mapDraftStepToScreen({ step: Number.NaN })).toBe(1)
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

describe('withLiveMedia', () => {
  const url = (name: string) =>
    `https://x.supabase.co/storage/v1/object/public/review-media/reviews/${name}`
  const withMedia = (...names: string[]): ReviewDraftPayload => ({
    ...emptyPayload,
    media: names.map((n) => ({ url: url(n), type: 'image' as const })),
  })

  it('drops uploads storage reports as gone and keeps the rest', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const href = String(input)
      if (href.endsWith('gone.jpg')) return new Response(null, { status: 404 })
      if (href.endsWith('old.jpg')) return new Response(null, { status: 400 })
      return new Response(null, { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { payload, dropped } = await withLiveMedia(withMedia('ok.jpg', 'gone.jpg', 'old.jpg'))
    expect(dropped).toBe(2)
    expect(payload.media.map((m) => m.url)).toEqual([url('ok.jpg')])
    expect(fetchMock).toHaveBeenCalledWith(
      url('ok.jpg'),
      expect.objectContaining({ method: 'HEAD' })
    )
    vi.unstubAllGlobals()
  })

  it('keeps media when the check itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network down')
      })
    )
    const draft = withMedia('a.jpg')
    expect(await withLiveMedia(draft)).toEqual({ payload: draft, dropped: 0 })
    vi.unstubAllGlobals()
  })

  it('skips the network when the draft has no media', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await withLiveMedia(emptyPayload)).toEqual({ payload: emptyPayload, dropped: 0 })
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
