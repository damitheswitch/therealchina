import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadAnalytics = async () => {
  vi.resetModules()
  return import('./analytics')
}

const validStartEvent = {
  name: 'review_started',
  data: { flow: 'legacy_5', entry: 'new', auth: 'anonymous' },
} as const

describe('review analytics privacy boundary', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    document.head.innerHTML = ''
    delete window.umami
    delete window.trcAnalyticsBeforeSend
  })

  it('builds only the explicit /review payload', async () => {
    vi.stubEnv('VITE_UMAMI_WEBSITE_ID', 'umami-site-id')
    const { buildUmamiPayload } = await loadAnalytics()

    expect(buildUmamiPayload(validStartEvent)).toEqual({
      website: 'umami-site-id',
      url: '/review',
      name: 'review_started',
      data: { flow: 'legacy_5', entry: 'new', auth: 'anonymous' },
    })
  })

  it('rejects unexpected event names and personal or identifier properties', async () => {
    vi.stubEnv('VITE_UMAMI_WEBSITE_ID', 'umami-site-id')
    const { buildUmamiPayload } = await loadAnalytics()

    expect(
      buildUmamiPayload({
        name: 'not_allowed',
        data: validStartEvent.data,
      } as never)
    ).toBeNull()
    expect(
      buildUmamiPayload({
        name: 'review_started',
        data: {
          ...validStartEvent.data,
          draftId: 'draft-id',
          email: 'person@example.com',
          text: 'review text',
        },
      } as never)
    ).toBeNull()
    expect(
      buildUmamiPayload({
        name: 'review_started',
        data: { ...validStartEvent.data, step: 1, stage: 'basics' },
      } as never)
    ).toBeNull()
    expect(
      buildUmamiPayload({
        name: 'boost_card_completed',
        data: { flow: 'legacy_5', auth: 'anonymous', card: 'unknown_future_card' },
      } as never)
    ).toBeNull()
  })

  it('enforces each event property set exactly', async () => {
    vi.stubEnv('VITE_UMAMI_WEBSITE_ID', 'umami-site-id')
    const { buildUmamiPayload } = await loadAnalytics()

    expect(
      buildUmamiPayload({
        name: 'review_step_1_viewed',
        data: {
          flow: 'legacy_5',
          entry: 'new',
          auth: 'anonymous',
          step: 1,
          stage: 'basics',
        },
      })
    ).not.toBeNull()
    expect(
      buildUmamiPayload({
        name: 'review_step_1_viewed',
        data: {
          flow: 'legacy_5',
          entry: 'new',
          auth: 'anonymous',
          step: 1,
          stage: 'basics',
          reason: 'server_input',
        },
      } as never)
    ).toBeNull()
    expect(
      buildUmamiPayload({
        name: 'review_validation_failed',
        data: {
          flow: 'legacy_5',
          entry: 'new',
          auth: 'anonymous',
          step: 1,
          stage: 'basics',
        },
      } as never)
    ).toBeNull()
    expect(
      buildUmamiPayload({
        name: 'review_published',
        data: {
          flow: 'legacy_5',
          entry: 'new',
          auth: 'anonymous',
          duration_band: 'under_1m',
          step: 5,
        },
      } as never)
    ).toBeNull()
  })

  it('only enables the tracker on an explicitly allowed hostname', async () => {
    vi.stubEnv('VITE_UMAMI_WEBSITE_ID', 'umami-site-id')
    vi.stubEnv('VITE_UMAMI_ALLOWED_HOSTNAMES', 'staging.example.net')
    const { isAnalyticsConfigured } = await loadAnalytics()

    expect(isAnalyticsConfigured('staging.example.net')).toBe(true)
    expect(isAnalyticsConfigured('localhost')).toBe(false)
    expect(isAnalyticsConfigured('deploy-preview-1--site.netlify.app')).toBe(false)
  })

  it('installs a tracker that sends manual events only', async () => {
    vi.stubEnv('VITE_UMAMI_WEBSITE_ID', 'umami-site-id')
    vi.stubEnv('VITE_UMAMI_ALLOWED_HOSTNAMES', 'localhost')
    const track = vi.fn()
    const { trackReviewEvent } = await loadAnalytics()
    ;(window as unknown as { umami: { track: typeof track } }).umami = { track }

    await trackReviewEvent(validStartEvent)

    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith({
      website: 'umami-site-id',
      url: '/review',
      name: 'review_started',
      data: { flow: 'legacy_5', entry: 'new', auth: 'anonymous' },
    })
  })

  it('does not reject when the tracker itself throws', async () => {
    vi.stubEnv('VITE_UMAMI_WEBSITE_ID', 'umami-site-id')
    vi.stubEnv('VITE_UMAMI_ALLOWED_HOSTNAMES', 'localhost')
    const { trackReviewEvent } = await loadAnalytics()
    ;(window as unknown as { umami: { track: () => void } }).umami = {
      track: () => {
        throw new Error('tracker failed')
      },
    }

    await expect(trackReviewEvent(validStartEvent)).resolves.toBeUndefined()
  })

  it('adds the cloud script with manual tracking, domain, and privacy attributes', async () => {
    vi.stubEnv('VITE_UMAMI_WEBSITE_ID', 'umami-site-id')
    vi.stubEnv('VITE_UMAMI_ALLOWED_HOSTNAMES', 'localhost')
    const track = vi.fn()
    const { trackReviewEvent } = await loadAnalytics()

    const pending = trackReviewEvent(validStartEvent)
    const script = document.head.querySelector('script')

    expect(script?.src).toBe('https://cloud.umami.is/script.js')
    expect(script?.dataset.websiteId).toBe('umami-site-id')
    expect(script?.dataset.autoTrack).toBe('false')
    expect(script?.dataset.domains).toBe('localhost')
    expect(script?.dataset.excludeSearch).toBe('true')
    expect(script?.dataset.excludeHash).toBe('true')
    expect(script?.dataset.doNotTrack).toBe('true')
    expect(script?.dataset.beforeSend).toBe('trcAnalyticsBeforeSend')

    ;(window as unknown as { umami: { track: typeof track } }).umami = { track }
    script?.dispatchEvent(new Event('load'))
    await pending
    expect(track).toHaveBeenCalledTimes(1)
  })

  it('beforeSend drops pageviews, arbitrary events, and non-schema data', async () => {
    vi.stubEnv('VITE_UMAMI_WEBSITE_ID', 'umami-site-id')
    vi.stubEnv('VITE_UMAMI_ALLOWED_HOSTNAMES', 'localhost')
    const { trackReviewEvent } = await loadAnalytics()
    const pending = trackReviewEvent(validStartEvent)
    const script = document.head.querySelector('script')
    ;(window as unknown as { umami: { track: ReturnType<typeof vi.fn> } }).umami = {
      track: vi.fn(),
    }
    script?.dispatchEvent(new Event('load'))
    await pending

    const beforeSend = window.trcAnalyticsBeforeSend
    expect(beforeSend).toBeTypeOf('function')
    expect(beforeSend?.('event', { website: 'x', url: '/review?draft=id' })).toBe(false)
    expect(
      beforeSend?.('event', {
        website: 'x',
        url: '/review',
        name: 'custom_event',
        data: {},
      })
    ).toBe(false)
    expect(
      beforeSend?.('event', {
        website: 'x',
        url: '/review',
        name: 'review_started',
        data: { ...validStartEvent.data, user_id: 'user-id' },
      })
    ).toBe(false)
    expect(
      beforeSend?.('event', {
        website: 'wrong',
        url: '/review',
        name: 'review_started',
        data: validStartEvent.data,
      })
    ).toEqual({
      website: 'umami-site-id',
      url: '/review',
      name: 'review_started',
      data: validStartEvent.data,
    })
  })
})

describe('review analytics helpers', () => {
  it('classifies new, resumed, and unknown entries', async () => {
    const { resolveReviewEntry } = await loadAnalytics()

    expect(resolveReviewEntry({ loaded: true, requested: false, lookupFailed: false })).toBe(
      'resumed'
    )
    expect(resolveReviewEntry({ loaded: false, requested: false, lookupFailed: false })).toBe('new')
    expect(resolveReviewEntry({ loaded: false, requested: true, lookupFailed: false })).toBe(
      'unknown'
    )
    expect(resolveReviewEntry({ loaded: false, requested: false, lookupFailed: true })).toBe(
      'unknown'
    )
  })

  it('bands publish duration coarsely', async () => {
    const { publishDurationBand } = await loadAnalytics()

    expect(publishDurationBand(1_000, 30_000)).toBe('under_1m')
    expect(publishDurationBand(1_000, 70_000)).toBe('1_to_2m')
    expect(publishDurationBand(1_000, 200_000)).toBe('2_to_5m')
    expect(publishDurationBand(1_000, 400_000)).toBe('over_5m')
    expect(publishDurationBand(null, 400_000)).toBe('unknown')
  })

  it('maps submission statuses to fixed failure categories', async () => {
    const { classifyReviewSubmitFailure } = await loadAnalytics()

    expect(classifyReviewSubmitFailure(403, true)).toBe('turnstile_server')
    expect(classifyReviewSubmitFailure(403, false)).toBe('auth_or_onboarding')
    expect(classifyReviewSubmitFailure(401, false)).toBe('auth_or_onboarding')
    expect(classifyReviewSubmitFailure(400, true)).toBe('server_input')
    expect(classifyReviewSubmitFailure(404, true)).toBe('server_input')
    expect(classifyReviewSubmitFailure(429, false)).toBe('rate_limited')
    expect(classifyReviewSubmitFailure(500, true)).toBe('server_error')
    expect(classifyReviewSubmitFailure(undefined, true)).toBe('network_or_unknown')
  })
})
