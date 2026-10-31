// "Full review" rule for the thank-you gift. Pure functions, no I/O, so the
// same checks run in Deno tests and are mirrored in
// frontend/src/lib/reviewReward.ts (both are tested against
// reward.fixtures.json). The rule never reads the star rating or the
// "recommend" answer: a harsh honest review earns the same gift as a glowing
// one.

export const MIN_OWN_UNITS = 10
export const MIN_POLARITY_TAGS = 2
const RATINGS_AREA_MIN = 4

// The three areas every gift needs: the quick ratings, the cost and the major.
// Timing and media are welcome but never count toward the gift.
export const REQUIRED_GIFT_AREAS = ['ratings', 'money', 'program'] as const

// Value reviews.degree_level takes for a language-course year (no major to name).
const LANGUAGE_COURSE_DEGREE = 'Language Course'

export type RewardMissing = 'words' | 'taps' | 'ratings' | 'money' | 'program'

// Mirror of POLARITY_TOPICS in frontend/src/lib/reviewFlow.ts. Needed to tell
// the sentence the "What stood out" taps write apart from the reviewer's own
// words. The fixtures test fails if the two drift.
const POLARITY_TOPICS = [
  {
    key: 'classes',
    pos: { tag: 'Strong academics', phrase: 'strong professors and classes' },
    neg: { tag: 'Weak teaching', phrase: 'inconsistent teaching quality' },
  },
  {
    key: 'dorms',
    pos: { tag: 'Good dorms', phrase: 'comfortable international dorms' },
    neg: { tag: 'Bad dorms', phrase: 'crowded or aging dorms' },
  },
  {
    key: 'food',
    pos: { tag: 'Great food', phrase: 'great affordable campus food' },
    neg: { tag: 'Bad food', phrase: 'limited campus food options' },
  },
  {
    key: 'admin',
    pos: {
      tag: 'Easy visa',
      phrase: 'helpful international office and visa support',
    },
    neg: {
      tag: 'Hard bureaucracy',
      phrase: 'slow bureaucracy and admin rules',
    },
  },
  {
    key: 'city',
    pos: { tag: 'Cheap city', phrase: 'affordable and convenient city life' },
    neg: { tag: 'Expensive city', phrase: 'high living costs in the city' },
  },
  {
    key: 'social',
    pos: {
      tag: 'International-friendly',
      phrase: 'a welcoming international community',
    },
    neg: { tag: 'Isolating', phrase: 'an isolating social scene' },
  },
] as const

const POLARITY_TAGS = new Set<string>(POLARITY_TOPICS.flatMap((t) => [t.pos.tag, t.neg.tag]))
const POLARITY_PHRASES = new Set<string>(
  POLARITY_TOPICS.flatMap((t) => [t.pos.phrase, t.neg.phrase])
)

const joinNatural = (parts: string[]): string => {
  if (parts.length <= 1) return parts[0] ?? ''
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}

// The sentence the taps write, rebuilt from the stored tags.
export function derivedPolarityText(tags: string[]): string {
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

export function polarityTagCount(tags: string[]): number {
  return tags.filter((t) => POLARITY_TAGS.has(t)).length
}

const splitCsv = (value: string | null | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

// Text, pros and cons with everything the taps wrote removed.
export function ownWordsText(row: {
  text: string | null
  pros: string | null
  cons: string | null
  tags: string[] | null
}): string {
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

// Words plus one unit per 2 Chinese characters, so Chinese reviews count fairly.
export function countUnits(s: string): number {
  const cjk = (s.match(CJK_RE) ?? []).length
  return latinWords(s).length + Math.floor(cjk / 2)
}

function latinWords(s: string): string[] {
  return s
    .replace(CJK_RE, ' ')
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
}

// Cheap guards against filler: repeated words and keyboard mashing.
export function looksLikeFiller(s: string): boolean {
  if (/(.)\1{5,}/u.test(s)) return true
  const words = latinWords(s).map((w) => w.toLowerCase())
  if (words.length < 10) return false
  const counts = new Map<string, number>()
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1)
  if (counts.size / words.length < 0.5) return true
  return Math.max(...counts.values()) / words.length > 0.2
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

// Which of the required gift areas the review covers, in REQUIRED_GIFT_AREAS
// order. A language-course year has no major, so the degree level stands in.
export function rewardDetailAreas(row: RewardReviewRow): string[] {
  const areas: string[] = []
  if (SUBSCORE_KEYS.filter((k) => typeof row[k] === 'number').length >= RATINGS_AREA_MIN) {
    areas.push('ratings')
  }
  if (has(row.tuition_range) || has(row.living_cost_range) || has(row.funding_type)) {
    areas.push('money')
  }
  if (has(row.program) || row.degree_level?.trim() === LANGUAGE_COURSE_DEGREE) {
    areas.push('program')
  }
  return areas
}

export interface RewardEvaluation {
  full: boolean
  missing: RewardMissing[]
  ownText: string
  ownUnits: number
  areas: string[]
}

export function evaluateReward(row: RewardReviewRow): RewardEvaluation {
  const ownText = ownWordsText(row)
  const ownUnits = countUnits(ownText)
  const areas = rewardDetailAreas(row)
  const missing: RewardMissing[] = []
  if (ownUnits < MIN_OWN_UNITS || looksLikeFiller(ownText)) missing.push('words')
  if (polarityTagCount(row.tags ?? []) < MIN_POLARITY_TAGS) missing.push('taps')
  for (const area of REQUIRED_GIFT_AREAS) {
    if (!areas.includes(area)) missing.push(area)
  }
  return {
    full: row.deleted_at === null && missing.length === 0,
    missing,
    ownText,
    ownUnits,
    areas,
  }
}

// Crockford base32 without I, L, O, U (matches the CHECK on reward_code).
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
// Shape of a code from newRewardCode(), used to validate ?ref= share links.
export const REWARD_CODE_RE = /^TRC-[0-9A-HJKMNP-TV-Z]{6}$/

export function newRewardCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return 'TRC-' + Array.from(bytes, (b) => CODE_ALPHABET[b % 32]).join('')
}

// One gift per person: gmail dots and +tags do not make a new person.
export function normalizeEmail(raw: string): string {
  const [localRaw, domainRaw = ''] = raw.trim().toLowerCase().split('@')
  const domain = domainRaw === 'googlemail.com' ? 'gmail.com' : domainRaw
  let local = localRaw.split('+')[0]
  if (domain === 'gmail.com') local = local.replace(/\./g, '')
  return `${local}@${domain}`
}

// Adds the WeChat handoff to an earned gift. A failed send still carries a
// code, so the reviewer can claim it on WeChat even when the email bounced.
// Any other state never reveals the ID.
export function withHandoff<T extends { state: string; code?: string }>(
  result: T,
  wechatId: string | undefined
): T & { wechatId?: string } {
  if (!wechatId || !result.code) return result
  if (result.state !== 'sent' && result.state !== 'failed') return result
  return { ...result, wechatId }
}
