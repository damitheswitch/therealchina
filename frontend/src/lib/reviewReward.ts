import { POLARITY_TOPICS, type ReviewFieldValues } from './reviewFlow'
import type { MediaItem } from './reviewSubmit'

// Client mirror of supabase/functions/_shared/reward.ts: the "full review"
// rule for the thank-you gift. The server is the authority; this copy only
// drives the teaser, the word counter and the last-chance nudge. Both are
// tested against the same fixtures (supabase/functions/_shared/reward.fixtures.json).

// Build flag. Off by default, so nothing about the offer shows until the owner
// turns it on (the server has its own REWARD_ENABLED switch).
export const REWARD_UI_ENABLED = import.meta.env.VITE_REVIEW_REWARD === 'on'

export const MIN_OWN_UNITS = 40
export const MIN_POLARITY_TAGS = 2
export const MIN_DETAIL_AREAS = 4
const RATINGS_AREA_MIN = 4

export type RewardMissing = 'words' | 'taps' | 'details'

export type RewardState =
  'off' | 'waiting' | 'sent' | 'email_used' | 'email_blocked' | 'failed' | 'paused' | 'declined'

export interface RewardResult {
  state: RewardState
  code?: string
  missing?: RewardMissing[]
}

export interface RewardReviewRow {
  deleted_at: string | null
  text: string | null
  pros: string | null
  cons: string | null
  tags: string[] | null
  program: string | null
  degree_level: string | null
  rating_academics: number | null
  rating_campus: number | null
  rating_accommodation: number | null
  rating_cost: number | null
  rating_intl_office: number | null
  rating_social: number | null
  rating_extracurricular: number | null
  rating_career: number | null
  tuition_range: string | null
  living_cost_range: string | null
  funding_type: string | null
  enrollment_status: string | null
  start_year: number | null
  end_year: number | null
  language_of_instruction: string | null
  media: unknown
}

const POLARITY_TAGS = new Set<string>(POLARITY_TOPICS.flatMap((t) => [t.pos.tag, t.neg.tag]))
const POLARITY_PHRASES = new Set<string>(
  POLARITY_TOPICS.flatMap((t) => [t.pos.phrase, t.neg.phrase])
)

const joinNatural = (parts: string[]): string => {
  if (parts.length <= 1) return parts[0] ?? ''
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}

const derivedPolarityText = (tags: string[]): string => {
  const pos: string[] = []
  const neg: string[] = []
  for (const t of POLARITY_TOPICS) {
    if (tags.includes(t.pos.tag)) pos.push(t.pos.phrase)
    else if (tags.includes(t.neg.tag)) neg.push(t.neg.phrase)
  }
  if (pos.length && neg.length) {
    return `Highlights include ${joinNatural(pos)}, though students should expect ${joinNatural(neg)}.`
  }
  if (pos.length) return `The standouts are ${joinNatural(pos)}.`
  if (neg.length) return `The main challenges are ${joinNatural(neg)}.`
  return ''
}

const splitCsv = (value: string | null | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

export const ownWordsText = (row: Pick<RewardReviewRow, 'text' | 'pros' | 'cons' | 'tags'>) => {
  const tags = row.tags ?? []
  let text = row.text ?? ''
  const derived = derivedPolarityText(tags)
  if (derived) text = text.split(derived).join(' ')
  const extra = [...splitCsv(row.pros), ...splitCsv(row.cons)].filter(
    (p) => !POLARITY_PHRASES.has(p)
  )
  return [text, ...extra].join(' ').replace(/\s+/g, ' ').trim()
}

const CJK_RE = /[㐀-鿿]/g

const latinWords = (s: string): string[] =>
  s
    .replace(CJK_RE, ' ')
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w))

export const countUnits = (s: string): number =>
  latinWords(s).length + Math.floor((s.match(CJK_RE) ?? []).length / 2)

export const looksLikeFiller = (s: string): boolean => {
  if (/(.)\1{5,}/u.test(s)) return true
  const words = latinWords(s).map((w) => w.toLowerCase())
  if (words.length < 10) return false
  const counts = new Map<string, number>()
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1)
  if (counts.size / words.length < 0.5) return true
  return Math.max(...counts.values()) / words.length > 0.2
}

const has = (v: string | null | undefined) => Boolean(v && v.trim())

const SUBSCORE_KEYS = [
  'rating_academics',
  'rating_campus',
  'rating_accommodation',
  'rating_cost',
  'rating_intl_office',
  'rating_social',
  'rating_extracurricular',
  'rating_career',
] as const

export const rewardDetailAreas = (row: RewardReviewRow): string[] => {
  const areas: string[] = []
  if (has(row.program) || has(row.degree_level)) areas.push('program')
  if (SUBSCORE_KEYS.filter((k) => typeof row[k] === 'number').length >= RATINGS_AREA_MIN) {
    areas.push('ratings')
  }
  if (has(row.tuition_range) || has(row.living_cost_range) || has(row.funding_type)) {
    areas.push('money')
  }
  if (
    has(row.enrollment_status) ||
    typeof row.start_year === 'number' ||
    typeof row.end_year === 'number' ||
    has(row.language_of_instruction)
  ) {
    areas.push('timing')
  }
  if (Array.isArray(row.media) && row.media.length > 0) areas.push('media')
  return areas
}

export interface RewardEvaluation {
  full: boolean
  missing: RewardMissing[]
  ownUnits: number
  areas: string[]
}

export const evaluateReward = (row: RewardReviewRow): RewardEvaluation => {
  const ownText = ownWordsText(row)
  const ownUnits = countUnits(ownText)
  const areas = rewardDetailAreas(row)
  const missing: RewardMissing[] = []
  if (ownUnits < MIN_OWN_UNITS || looksLikeFiller(ownText)) missing.push('words')
  const tapCount = (row.tags ?? []).filter((t) => POLARITY_TAGS.has(t)).length
  if (tapCount < MIN_POLARITY_TAGS) missing.push('taps')
  if (areas.length < MIN_DETAIL_AREAS) missing.push('details')
  return { full: row.deleted_at === null && missing.length === 0, missing, ownUnits, areas }
}

// What the review would look like on the server if it were published now.
export const rewardRowFromFields = (
  values: ReviewFieldValues,
  media: MediaItem[]
): RewardReviewRow => ({
  deleted_at: null,
  text: values.reviewText.trim() || null,
  pros: values.pros.trim() || null,
  cons: values.cons.trim() || null,
  tags: values.selectedTags,
  program: values.program.trim() || null,
  degree_level: values.degreeLevel || null,
  rating_academics: values.subscores.rating_academics ?? null,
  rating_campus: values.subscores.rating_campus ?? null,
  rating_accommodation: values.subscores.rating_accommodation ?? null,
  rating_cost: values.subscores.rating_cost ?? null,
  rating_intl_office: values.subscores.rating_intl_office ?? null,
  rating_social: values.subscores.rating_social ?? null,
  rating_extracurricular: values.subscores.rating_extracurricular ?? null,
  rating_career: values.subscores.rating_career ?? null,
  tuition_range: values.tuitionRange || null,
  living_cost_range: values.livingCostRange || null,
  funding_type: values.fundingType || null,
  enrollment_status: values.enrollmentStatus || null,
  start_year: values.startYear || null,
  end_year: values.endYear || null,
  language_of_instruction: values.languageOfInstruction || null,
  media,
})

export const evaluateRewardFields = (
  values: ReviewFieldValues,
  media: MediaItem[]
): RewardEvaluation => evaluateReward(rewardRowFromFields(values, media))

const MISSING_LABEL: Record<RewardMissing, string> = {
  words: 'more of your own words',
  taps: '2 taps on What stood out',
  details: 'a few more details (major, ratings, costs, dates or a photo)',
}

// "more of your own words and 2 taps on What stood out"
export const describeMissing = (missing: RewardMissing[]): string => {
  const parts = missing.map((m) => MISSING_LABEL[m])
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

// ---- Email typo hint ----------------------------------------------------------

const COMMON_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
  'qq.com',
  '163.com',
  '126.com',
  'foxmail.com',
  'sina.com',
]

const editDistance = (a: string, b: string): number => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
  }
  return dp[a.length][b.length]
}

// True when two adjacent letters swapped turn a into b ("gmial" to "gmail").
const isSwap = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length - 1; i++) {
    if (a.slice(0, i) + a[i + 1] + a[i] + a.slice(i + 2) === b) return true
  }
  return false
}

// "name@gmial.com" -> "name@gmail.com". Null when nothing close matches.
export const suggestEmailFix = (email: string): string | null => {
  const at = email.trim().lastIndexOf('@')
  if (at < 1) return null
  const local = email.trim().slice(0, at)
  const domain = email
    .trim()
    .slice(at + 1)
    .toLowerCase()
  if (!domain || COMMON_DOMAINS.includes(domain)) return null
  const match = COMMON_DOMAINS.find((d) => editDistance(domain, d) <= 1 || isSwap(domain, d))
  return match ? `${local}@${match}` : null
}

// ---- Confirmation line ------------------------------------------------------------

export const rewardConfirmation = (
  reward: RewardResult | undefined,
  contactEmail: string
): string | null => {
  if (!reward) return null
  switch (reward.state) {
    case 'sent':
      return `Gift email sent. Check your inbox and spam folder. Your gift code is ${reward.code}.`
    case 'waiting':
      return reward.missing?.length
        ? `Your email is saved. Add ${describeMissing(reward.missing)} and we will send your free VPN steps.`
        : 'Your email is saved. We will send your free VPN steps as soon as your review is full.'
    case 'email_used':
      return 'This email already got a gift. It is one gift per person.'
    case 'email_blocked':
      return `That email cannot get gifts. Write to ${contactEmail} with a normal email.`
    case 'failed':
      return `We could not send the email. Write to ${contactEmail} and we will help.`
    case 'paused':
      return 'Gifts are paused right now. Your email is saved.'
    case 'declined':
      return `We could not give a gift for this review. Questions: ${contactEmail}.`
    default:
      return null
  }
}
