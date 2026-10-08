import { PROD_ORIGIN } from './seo/site'

type EnvRecord = Record<string, string | undefined>

const env = import.meta.env as EnvRecord

const DEFAULT_SCRIPT_URL = 'https://cloud.umami.is/script.js'
const DEFAULT_ALLOWED_HOSTNAMES = new URL(PROD_ORIGIN).hostname
const BEFORE_SEND_HANDLER = 'trcAnalyticsBeforeSend'

export type ReviewFlow = 'legacy_5' | 'fast_2'
export type ReviewEntry = 'new' | 'resumed' | 'unknown'
export type ReviewAuth = 'anonymous' | 'signed_in'
export type ReviewStep = 1 | 2 | 3 | 4 | 5
export type ReviewStage = 'basics' | 'ratings' | 'details' | 'story' | 'about_you'
export type ReviewFailureReason =
  | 'turnstile_client'
  | 'turnstile_server'
  | 'server_input'
  | 'rate_limited'
  | 'auth_or_onboarding'
  | 'network_or_unknown'
  | 'server_error'
export type PublishDurationBand = 'under_1m' | '1_to_2m' | '2_to_5m' | 'over_5m' | 'unknown'

type AnalyticsPrimitive = string | number | boolean

export interface ReviewEventData {
  flow?: ReviewFlow
  entry?: ReviewEntry
  auth?: ReviewAuth
  step?: ReviewStep
  stage?: ReviewStage
  reason?: ReviewFailureReason
  duration_band?: PublishDurationBand
  card?: string
  after_card?: string
}

export type ReviewEventName =
  | 'review_started'
  | 'review_step_1_viewed'
  | 'review_step_2_viewed'
  | 'review_step_3_viewed'
  | 'review_step_4_viewed'
  | 'review_step_5_viewed'
  | 'review_story_viewed'
  | 'review_validation_failed'
  | 'review_submit_attempted'
  | 'review_submit_failed'
  | 'review_published'
  | 'boost_card_completed'
  | 'boost_exited'

export interface ReviewAnalyticsEvent {
  name: ReviewEventName
  data: ReviewEventData
}

interface UmamiPayload {
  website: string
  url: '/review'
  name: ReviewEventName
  data: ReviewEventData
}

type BeforeSendResult = UmamiPayload | false
type BeforeSendHandler = (type: string, payload: unknown) => BeforeSendResult

interface UmamiTracker {
  track: (payload: UmamiPayload) => void
}

declare global {
  interface Window {
    umami?: UmamiTracker
    trcAnalyticsBeforeSend?: BeforeSendHandler
  }
}

const EVENT_NAMES = new Set<ReviewEventName>([
  'review_started',
  'review_step_1_viewed',
  'review_step_2_viewed',
  'review_step_3_viewed',
  'review_step_4_viewed',
  'review_step_5_viewed',
  'review_story_viewed',
  'review_validation_failed',
  'review_submit_attempted',
  'review_submit_failed',
  'review_published',
  'boost_card_completed',
  'boost_exited',
])

const REQUIRED_DATA_KEYS: Record<ReviewEventName, (keyof ReviewEventData)[]> = {
  review_started: ['flow', 'entry', 'auth'],
  review_step_1_viewed: ['flow', 'entry', 'auth', 'step', 'stage'],
  review_step_2_viewed: ['flow', 'entry', 'auth', 'step', 'stage'],
  review_step_3_viewed: ['flow', 'entry', 'auth', 'step', 'stage'],
  review_step_4_viewed: ['flow', 'entry', 'auth', 'step', 'stage'],
  review_step_5_viewed: ['flow', 'entry', 'auth', 'step', 'stage'],
  review_story_viewed: ['flow', 'entry', 'auth'],
  review_validation_failed: ['flow', 'auth', 'step', 'stage'],
  review_submit_attempted: ['flow', 'entry', 'auth'],
  review_submit_failed: ['flow', 'entry', 'auth', 'reason'],
  review_published: ['flow', 'entry', 'auth', 'duration_band'],
  boost_card_completed: ['flow', 'auth', 'card'],
  boost_exited: ['flow', 'auth', 'after_card'],
}

const DATA_VALIDATORS: Record<keyof ReviewEventData, (value: AnalyticsPrimitive) => boolean> = {
  flow: (value) => value === 'legacy_5' || value === 'fast_2',
  entry: (value) => value === 'new' || value === 'resumed' || value === 'unknown',
  auth: (value) => value === 'anonymous' || value === 'signed_in',
  step: (value) => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5,
  stage: (value) =>
    value === 'basics' ||
    value === 'ratings' ||
    value === 'details' ||
    value === 'story' ||
    value === 'about_you',
  reason: (value) =>
    value === 'turnstile_client' ||
    value === 'turnstile_server' ||
    value === 'server_input' ||
    value === 'rate_limited' ||
    value === 'auth_or_onboarding' ||
    value === 'network_or_unknown' ||
    value === 'server_error',
  duration_band: (value) =>
    value === 'under_1m' ||
    value === '1_to_2m' ||
    value === '2_to_5m' ||
    value === 'over_5m' ||
    value === 'unknown',
  card: (value) => typeof value === 'string' && /^[a-z0-9_]{1,50}$/.test(value),
  after_card: (value) => typeof value === 'string' && /^[a-z0-9_]{1,50}$/.test(value),
}

const isPrimitive = (value: unknown): value is AnalyticsPrimitive =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'

const parseHostnames = (value: string): string[] =>
  value
    .split(',')
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean)

const analyticsConfig = () => ({
  websiteId: env.VITE_UMAMI_WEBSITE_ID?.trim() ?? '',
  scriptUrl: env.VITE_UMAMI_SCRIPT_URL?.trim() || DEFAULT_SCRIPT_URL,
  hostUrl: env.VITE_UMAMI_HOST_URL?.trim() || '',
  allowedHostnames: parseHostnames(env.VITE_UMAMI_ALLOWED_HOSTNAMES ?? DEFAULT_ALLOWED_HOSTNAMES),
})

export const isAnalyticsConfigured = (hostname = window.location.hostname): boolean => {
  const config = analyticsConfig()
  return Boolean(
    config.websiteId && config.allowedHostnames.includes(hostname.trim().toLowerCase())
  )
}

const validateEvent = (event: ReviewAnalyticsEvent): boolean => {
  if (!EVENT_NAMES.has(event.name)) return false
  if (!event.data || typeof event.data !== 'object' || Array.isArray(event.data)) return false

  for (const key of REQUIRED_DATA_KEYS[event.name]) {
    if (!(key in event.data)) return false
  }

  return Object.entries(event.data).every(([key, value]) => {
    const validator = DATA_VALIDATORS[key as keyof ReviewEventData]
    return Boolean(validator && isPrimitive(value) && validator(value))
  })
}

export const buildUmamiPayload = (event: ReviewAnalyticsEvent): UmamiPayload | null => {
  const { websiteId } = analyticsConfig()
  if (!websiteId || !validateEvent(event)) return null
  return { website: websiteId, url: '/review', name: event.name, data: { ...event.data } }
}

const installBeforeSend = (): void => {
  window[BEFORE_SEND_HANDLER] = (type, payload) => {
    if (type !== 'event' || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return false
    }
    const candidate = payload as Partial<UmamiPayload>
    if (candidate.url !== '/review' || typeof candidate.name !== 'string') return false
    return (
      buildUmamiPayload({
        name: candidate.name as ReviewEventName,
        data: (candidate.data ?? {}) as ReviewEventData,
      }) ?? false
    )
  }
}

let trackerPromise: Promise<boolean> | null = null

const ensureTracker = (): Promise<boolean> => {
  if (trackerPromise) return trackerPromise
  if (!isAnalyticsConfigured()) return Promise.resolve(false)
  installBeforeSend()
  if (typeof window.umami?.track === 'function') return Promise.resolve(true)

  const config = analyticsConfig()
  trackerPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement('script')
    script.defer = true
    script.src = config.scriptUrl
    script.dataset.websiteId = config.websiteId
    script.dataset.autoTrack = 'false'
    script.dataset.domains = config.allowedHostnames.join(',')
    script.dataset.excludeSearch = 'true'
    script.dataset.excludeHash = 'true'
    script.dataset.doNotTrack = 'true'
    script.dataset.beforeSend = BEFORE_SEND_HANDLER
    if (config.hostUrl) script.dataset.hostUrl = config.hostUrl
    script.onload = () => resolve(typeof window.umami?.track === 'function')
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  }).then((loaded) => {
    if (!loaded) trackerPromise = null
    return loaded
  })
  return trackerPromise
}

export const trackReviewEvent = async (event: ReviewAnalyticsEvent): Promise<void> => {
  const payload = buildUmamiPayload(event)
  if (!payload || !(await ensureTracker()) || typeof window.umami?.track !== 'function') return
  try {
    window.umami.track(payload)
  } catch {
    return
  }
}

export const resolveReviewEntry = ({
  loaded,
  requested,
  lookupFailed,
}: {
  loaded: boolean
  requested: boolean
  lookupFailed: boolean
}): ReviewEntry => {
  if (loaded) return 'resumed'
  if (requested || lookupFailed) return 'unknown'
  return 'new'
}

export const publishDurationBand = (startedAt: number | null, finishedAt = Date.now()) => {
  if (startedAt === null || !Number.isFinite(startedAt) || finishedAt < startedAt) {
    return 'unknown' as const
  }
  const elapsedSeconds = (finishedAt - startedAt) / 1000
  if (elapsedSeconds < 60) return 'under_1m' as const
  if (elapsedSeconds < 120) return '1_to_2m' as const
  if (elapsedSeconds < 300) return '2_to_5m' as const
  return 'over_5m' as const
}

export const classifyReviewSubmitFailure = (
  status: number | undefined,
  isAnonymous: boolean
): ReviewFailureReason => {
  if (status === 429) return 'rate_limited'
  if (status === 401 || (status === 403 && !isAnonymous)) return 'auth_or_onboarding'
  if (status === 403 && isAnonymous) return 'turnstile_server'
  if (status !== undefined && status >= 500) return 'server_error'
  if (status !== undefined && status >= 400) return 'server_input'
  return 'network_or_unknown'
}
