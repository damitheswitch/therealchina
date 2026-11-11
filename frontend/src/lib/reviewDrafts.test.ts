import { describe, it, expect, beforeEach, vi } from 'vitest'

// The module imports the Supabase client, which requires env vars; mock it so
// the pure helpers and localStorage fallback can be tested without them.
vi.mock('./supabaseClient', () => ({ supabase: {} }))
import {
  isDraftWorthSaving,
  draftUniversityLabel,
  draftProgressLabel,
  loadLocalDraft,
  loadLocalDraftWithAlias,
  saveLocalDraft,
  clearLocalDraft,
  listLocalDrafts,
  hasDraftSubstance,
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
    vi.useRealTimers()
  })

  it('round-trips a payload through localStorage', () => {
    saveLocalDraft('', { ...emptyPayload, rating: 4, reviewText: 'Loved it' })
    const loaded = loadLocalDraft()
    expect(loaded?.payload.rating).toBe(4)
    expect(loaded?.payload.reviewText).toBe('Loved it')
    expect(loaded?.slug).toBe('none')
  })

  it('returns null after clear and on invalid JSON', () => {
    saveLocalDraft('', { ...emptyPayload, rating: 4 })
    clearLocalDraft('')
    expect(loadLocalDraft()).toBeNull()

    localStorage.setItem('trc_review_draft', 'not-json')
    expect(loadLocalDraft()).toBeNull()
    expect(localStorage.getItem('trc_review_draft')).toBeNull()
  })

  it('keeps the payload university in lockstep with the slot slug', () => {
    // A caller that resolved an alias passes the canonical slug — the stored
    // payload must not keep the raw param and break resume checks.
    saveLocalDraft('zhejiang-university', { ...emptyPayload, selectedUni: 'zju', rating: 5 })
    const entry = loadLocalDraft('zhejiang-university')
    expect(entry?.slug).toBe('zhejiang-university')
    expect(entry?.payload.selectedUni).toBe('zhejiang-university')
  })

  it('matches a draft to its university slug', () => {
    saveLocalDraft('tsinghua', { ...emptyPayload, selectedUni: 'tsinghua', rating: 5 })
    expect(hasLocalDraftForUniversity('tsinghua')).toBe(true)
    expect(hasLocalDraftForUniversity('fudan')).toBe(false)
  })

  it('keeps drafts for different universities in separate slots', () => {
    saveLocalDraft('fudan', { ...emptyPayload, selectedUni: 'fudan', rating: 5, reviewText: 'A' })
    saveLocalDraft('peking', { ...emptyPayload, selectedUni: 'peking', rating: 2 })
    expect(loadLocalDraft('fudan')?.payload.rating).toBe(5)
    expect(loadLocalDraft('peking')?.payload.rating).toBe(2)
    // Saving the peking draft did not overwrite fudan's text.
    expect(loadLocalDraft('fudan')?.payload.reviewText).toBe('A')
  })

  it('clears only the matching university slot', () => {
    saveLocalDraft('fudan', { ...emptyPayload, selectedUni: 'fudan', rating: 5 })
    saveLocalDraft('peking', { ...emptyPayload, selectedUni: 'peking', rating: 2 })
    clearLocalDraft('fudan')
    expect(loadLocalDraft('fudan')).toBeNull()
    expect(loadLocalDraft('peking')?.payload.rating).toBe(2)
  })

  it('returns the most recently saved draft when no slug is given', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    saveLocalDraft('fudan', { ...emptyPayload, selectedUni: 'fudan', rating: 5 })
    vi.setSystemTime(2000)
    saveLocalDraft('peking', { ...emptyPayload, selectedUni: 'peking', rating: 2 })
    expect(loadLocalDraft()?.payload.selectedUni).toBe('peking')
    expect(listLocalDrafts().map((d) => d.slug)).toEqual(['peking', 'fudan'])
  })

  it('migrates the legacy single-slot draft into a per-university key', () => {
    localStorage.setItem(
      'trc_review_draft',
      JSON.stringify({ ...emptyPayload, selectedUni: 'fudan', rating: 5 })
    )
    expect(loadLocalDraft('fudan')?.payload.rating).toBe(5)
    expect(localStorage.getItem('trc_review_draft')).toBeNull()
    expect(localStorage.getItem('trc_review_draft:fudan')).not.toBeNull()
  })

  it('does not clobber a same-slug slot written by newer code', () => {
    saveLocalDraft('fudan', { ...emptyPayload, selectedUni: 'fudan', rating: 5, reviewText: 'new' })
    localStorage.setItem(
      'trc_review_draft',
      JSON.stringify({ ...emptyPayload, selectedUni: 'fudan', rating: 1, reviewText: 'old' })
    )
    const entry = loadLocalDraft('fudan')
    expect(entry?.payload.reviewText).toBe('new')
    expect(localStorage.getItem('trc_review_draft')).toBeNull()
  })

  it('keeps the legacy draft when the replacement write fails', () => {
    const legacy = JSON.stringify({ ...emptyPayload, selectedUni: 'fudan', rating: 5 })
    localStorage.setItem('trc_review_draft', legacy)
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string) => {
      if (key === 'trc_review_draft:fudan') throw new DOMException('quota', 'QuotaExceededError')
      return Storage.prototype.setItem.call(localStorage, key, '')
    })
    try {
      loadLocalDraft('fudan')
      // The write failed, so the legacy key survives for the next call.
      expect(localStorage.getItem('trc_review_draft')).toBe(legacy)
    } finally {
      setItem.mockRestore()
    }
    expect(loadLocalDraft('fudan')?.payload.rating).toBe(5)
  })

  it('migrates a legacy draft with no university into the none slot', () => {
    localStorage.setItem('trc_review_draft', JSON.stringify({ ...emptyPayload, rating: 4 }))
    expect(loadLocalDraft()?.payload.rating).toBe(4)
    expect(localStorage.getItem('trc_review_draft:none')).not.toBeNull()
  })

  it('lists drafts for other universities but skips empty storage and junk', () => {
    saveLocalDraft('fudan', { ...emptyPayload, selectedUni: 'fudan', rating: 5 })
    localStorage.setItem('trc_review_draft:junk', 'not-json')
    localStorage.setItem('unrelated', '{}')
    const slugs = listLocalDrafts().map((d) => d.slug)
    expect(slugs).toEqual(['fudan'])
  })

  describe('loadLocalDraftWithAlias', () => {
    it('reads the raw-param slot when the canonical one is empty', () => {
      // A draft saved while the ?uni lookup was failing lives under the
      // alias — the resolved read must still find it.
      saveLocalDraft('zju', { ...emptyPayload, selectedUni: 'zju', rating: 5 })
      const entry = loadLocalDraftWithAlias('zhejiang-university', 'zju')
      expect(entry?.slug).toBe('zju')
      expect(entry?.payload.rating).toBe(5)
    })

    it('recovers a legacy draft migrated under an alias', () => {
      localStorage.setItem(
        'trc_review_draft',
        JSON.stringify({ ...emptyPayload, selectedUni: 'zju', rating: 4 })
      )
      const entry = loadLocalDraftWithAlias('zhejiang-university', 'zju')
      expect(entry?.slug).toBe('zju')
      expect(entry?.payload.rating).toBe(4)
    })

    it('prefers the newer of the two slots and retires the loser', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1000)
      saveLocalDraft('zju', { ...emptyPayload, selectedUni: 'zju', rating: 1 })
      vi.setSystemTime(2000)
      saveLocalDraft('zhejiang-university', {
        ...emptyPayload,
        selectedUni: 'zhejiang-university',
        rating: 5,
      })
      const entry = loadLocalDraftWithAlias('zhejiang-university', 'zju')
      expect(entry?.slug).toBe('zhejiang-university')
      expect(loadLocalDraft('zju')).toBeNull()
      expect(loadLocalDraft('zhejiang-university')?.payload.rating).toBe(5)
    })

    it('prefers a substantive older draft over a newer skeleton', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1000)
      saveLocalDraft('zju', { ...emptyPayload, selectedUni: 'zju', rating: 3 })
      vi.setSystemTime(2000)
      // Newer write, but only a bare prefill skeleton.
      saveLocalDraft('zhejiang-university', {
        ...emptyPayload,
        selectedUni: 'zhejiang-university',
      })
      const entry = loadLocalDraftWithAlias('zhejiang-university', 'zju')
      expect(entry?.slug).toBe('zju')
      expect(loadLocalDraft('zhejiang-university')).toBeNull()
    })

    it('behaves like loadLocalDraft when there is no alias to check', () => {
      saveLocalDraft('fudan', { ...emptyPayload, selectedUni: 'fudan', rating: 4 })
      expect(loadLocalDraftWithAlias('fudan', 'fudan')?.payload.rating).toBe(4)
      expect(loadLocalDraftWithAlias('fudan', '')?.payload.rating).toBe(4)
      expect(loadLocalDraftWithAlias('fudan', 'tsinghua')?.payload.rating).toBe(4)
    })

    it('does not clear the picked slot when both reads hit it', () => {
      // loadLocalDraft() with no slug returns the most recent entry — which
      // can be the raw-param slot itself.
      saveLocalDraft('zju', { ...emptyPayload, selectedUni: 'zju', rating: 5 })
      const entry = loadLocalDraftWithAlias(undefined, 'zju')
      expect(entry?.slug).toBe('zju')
      expect(loadLocalDraft('zju')).not.toBeNull()
    })
  })
})

describe('hasDraftSubstance', () => {
  it('treats a bare ?uni skeleton as no real progress', () => {
    expect(hasDraftSubstance(null)).toBe(false)
    expect(hasDraftSubstance(emptyPayload)).toBe(false)
    expect(
      hasDraftSubstance({
        ...emptyPayload,
        selectedUni: 'peking',
        selectedUniName: 'Peking University',
      })
    ).toBe(false)
  })

  it('counts typed content, ratings, and tags as progress', () => {
    expect(hasDraftSubstance({ ...emptyPayload, rating: 3 })).toBe(true)
    expect(hasDraftSubstance({ ...emptyPayload, reviewText: 'Great' })).toBe(true)
    expect(hasDraftSubstance({ ...emptyPayload, program: 'MBBS' })).toBe(true)
    expect(hasDraftSubstance({ ...emptyPayload, selectedTags: ['Safe'] })).toBe(true)
    expect(hasDraftSubstance({ ...emptyPayload, subscores: { rating_campus: 4 } })).toBe(true)
  })

  it('does not count a screen advance with nothing written', () => {
    expect(hasDraftSubstance({ ...emptyPayload, selectedUni: 'peking', step: 2 })).toBe(false)
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
