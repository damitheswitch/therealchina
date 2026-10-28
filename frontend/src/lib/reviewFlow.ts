import type { MediaItem, SubScores } from './reviewSubmit'
import type { ReviewCardData } from './reviewDisplay'
import type { ReviewEditPayload } from './reviewManage'
import type { BoostFields } from './reviewBoost'
import { DRAFT_PAYLOAD_VERSION, type ReviewDraftPayload } from './reviewDrafts'
import { RATINGS_AREA_MIN } from './reviewDetail'
import type { BoostCard } from './analytics'

// ---- Tap-first review flow (v2) --------------------------------------------------
// Two publish screens: essentials (university + rating + one-tap context) then
// the verdict screen (polarity picks + optional text). Structured picks write
// real columns as they happen: tags, pros, cons, and a ready-made sentence.
// Everything else is optional and moves to the post-publish Boost card deck.
// The server minimum is university + rating (see _shared/reviewFields.ts) —
// text is optional, and a textless review lands as a "quick rating".

// University slugs as they may appear in URL params. review-submit keeps its
// own copy of this check (Deno can't import this file) — keep them in sync.
export const UNI_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const UNI_SLUG_MAX_LEN = 120

// Anything that can't be a slug is treated as no param at all — an empty
// field beats a broken lookup and a dead-end publish.
export const normalizeUniSlugParam = (raw: string | null | undefined): string => {
  const s = (raw || '').trim().toLowerCase()
  return UNI_SLUG_RE.test(s) && s.length <= UNI_SLUG_MAX_LEN ? s : ''
}

// The inline rate widget passes its picks through the URL. Anything outside
// 1-5 is not a rating — 0 means "no star picked", which is also what the
// form stores for an untouched rating.
export const parseRatingParam = (raw: string | null | undefined): number => {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 0
}

export const parseRecommendParam = (
  raw: string | null | undefined
): 'yes' | 'no' | 'maybe' | '' => {
  const s = (raw || '').trim().toLowerCase()
  return s === 'yes' || s === 'no' || s === 'maybe' ? s : ''
}

// Every field a review can carry, as the wizard holds it. One shape feeds the
// submit payload, the edit/update payload, and each Boost save — the server
// writes the whole validated field set on every call, so callers always send
// the full merged state rather than a per-card patch.
export interface ReviewFieldValues {
  selectedUni: string
  selectedUniName: string
  showNotListed: boolean
  newUniName: string
  newUniProvince: string
  newUniCity: string
  rating: number
  recommend: string
  program: string
  subscores: SubScores
  enrollmentStatus: string
  startYear: number | ''
  endYear: number | ''
  languageOfInstruction: string
  degreeLevel: string
  tuitionRange: string
  livingCostRange: string
  fundingType: string
  fundingCoverage: string
  selectedTags: string[]
  pros: string
  cons: string
  reviewText: string
  polarity: PolarityPicks
  homeCountry: string
  currentStatus: string
  languagesSpoken: string[]
  emailConsent: boolean
  anonEmail: string
  // Fields last written by inference rather than the reviewer. Smart-default
  // helpers fill empty fields and roll back only what they set, so a
  // deliberate pick is never clobbered. Internal only: payload builders pick
  // fields explicitly, so this never reaches the server or a draft.
  inferred: ReadonlySet<string>
}

export const emptyReviewFieldValues: ReviewFieldValues = {
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
  polarity: {},
  homeCountry: '',
  currentStatus: '',
  languagesSpoken: [],
  emailConsent: false,
  anonEmail: '',
  inferred: new Set(),
}

// Strips the draft-only keys (v, step, media, savedAt) so the rest can be
// applied to form state directly. Media is handled separately by the uploader.
// The loosely-typed `polarity` record is narrowed to the topic-key map here —
// only valid keys/directions were ever written.
export const fieldValuesFromDraft = (p: ReviewDraftPayload): Partial<ReviewFieldValues> => {
  const { v: _v, step: _step, media: _media, savedAt: _savedAt, polarity, ...fields } = p
  return {
    ...fields,
    ...(polarity ? { polarity: polarity as ReviewFieldValues['polarity'] } : {}),
  }
}

export const draftPayloadFromState = (
  values: ReviewFieldValues,
  media: MediaItem[],
  step: number
): ReviewDraftPayload => {
  // `inferred` is provenance for live inference, not review content: it never
  // enters the draft, and a resumed draft treats every value as deliberate.
  const { inferred: _inferred, ...fields } = values
  return { ...fields, media, step, v: DRAFT_PAYLOAD_VERSION }
}

// The writable review columns, shaped for submit and review-manage update
// bodies. Server-side validation re-checks everything; this only normalizes
// empty input into "not provided".
export const buildReviewFields = (v: ReviewFieldValues, media: MediaItem[]): ReviewEditPayload => ({
  rating: v.rating,
  text: v.reviewText.trim(),
  program: v.program.trim() || undefined,
  degreeLevel: v.degreeLevel || undefined,
  media,
  subscores: v.subscores,
  enrollmentStatus: v.enrollmentStatus || undefined,
  startYear: v.startYear || undefined,
  endYear: v.endYear || undefined,
  languageOfInstruction: v.languageOfInstruction || undefined,
  tuitionRange: v.tuitionRange || undefined,
  livingCostRange: v.livingCostRange || undefined,
  fundingType: v.fundingType || undefined,
  fundingCoverage: v.fundingType !== 'self' ? v.fundingCoverage || undefined : undefined,
  recommend: v.recommend || undefined,
  pros: v.pros.trim() || undefined,
  cons: v.cons.trim() || undefined,
  tags: v.selectedTags.length > 0 ? v.selectedTags : undefined,
})

// ---- Boost ---------------------------------------------------------------------

// The post-publish deck, ordered the way the tap flow cascades: rapid-fire
// ratings first (easiest), then cost, then program, then photo. Pros/cons and
// tags are already covered by the verdict matrix on screen 2; enrollment,
// degree, years and language fold into the program card or are inferred.
export const BOOST_CARD_ORDER: BoostCard[] = ['ratings', 'money', 'program', 'media']

// Anonymous Boost (Phase 3) can only write the columns the review-boost
// function allowlists — no media card (uploads are a separate surface).
export const ANON_BOOST_CARDS: BoostCard[] = BOOST_CARD_ORDER.filter((c) => c !== 'media')

// Short tab labels for the deck switcher. Keys cover the whole BoostCard union
// so the map stays total even where a card is not in the current order.
export const BOOST_CARD_SHORT: Record<BoostCard, { emoji: string; label: string }> = {
  ratings: { emoji: '⭐', label: 'Ratings' },
  money: { emoji: '💰', label: 'Cost' },
  program: { emoji: '🎓', label: 'Major' },
  media: { emoji: '📸', label: 'Photo' },
  details: { emoji: '🗓', label: 'Timing' },
  pros_cons: { emoji: '⚖️', label: 'Pros' },
}

// A card counts as done when its required picks exist on the live values.
// Ratings uses the same bar as the detail-area rule (RATINGS_AREA_MIN of 4);
// media means at least one attached item. Degree/language already answered on
// screen 1 leave 'program' done before the deck even opens (e.g. a Language
// Course pick infers both), which is exactly what lets the cascade skip it.
export const isBoostCardDone = (
  card: BoostCard,
  v: ReviewFieldValues,
  mediaCount: number
): boolean => {
  switch (card) {
    case 'ratings':
      return (
        SUBSCORE_INPUT_FIELDS.filter((f) => typeof v.subscores[f.key] === 'number').length >=
        RATINGS_AREA_MIN
      )
    case 'money':
      return Boolean(v.fundingType && v.livingCostRange)
    case 'program':
      return Boolean(v.program.trim() && v.languageOfInstruction)
    case 'media':
      return mediaCount > 0
    default:
      return false
  }
}

// The card the cascade should open next: the first not-done card after
// `fromIndex`, else -1 meaning the deck is finished.
export const nextBoostCard = (
  cards: BoostCard[],
  fromIndex: number,
  v: ReviewFieldValues,
  mediaCount: number
): number => {
  for (let i = fromIndex + 1; i < cards.length; i++) {
    if (!isBoostCardDone(cards[i], v, mediaCount)) return i
  }
  return -1
}

// Per-card request fields for the anonymous path — the client sends exactly
// the card's current values, so a stale draft can never rewrite columns a
// later card owns.
export const buildBoostPatch = (values: ReviewFieldValues, card: BoostCard): BoostFields => {
  switch (card) {
    case 'program':
      return {
        program: values.program.trim() || null,
        degreeLevel: values.degreeLevel || null,
        languageOfInstruction: values.languageOfInstruction || null,
        enrollmentStatus: values.enrollmentStatus || null,
        endYear: values.endYear === '' ? null : values.endYear,
      }
    case 'ratings':
      return { subscores: values.subscores }
    case 'money':
      return {
        tuitionRange: values.tuitionRange || null,
        livingCostRange: values.livingCostRange || null,
        fundingType: values.fundingType || null,
        fundingCoverage: values.fundingType !== 'self' ? values.fundingCoverage || null : null,
      }
    case 'details':
      return {
        enrollmentStatus: values.enrollmentStatus || null,
        startYear: values.startYear === '' ? null : values.startYear,
        endYear: values.endYear === '' ? null : values.endYear,
        languageOfInstruction: values.languageOfInstruction || null,
      }
    case 'pros_cons':
      return {
        pros: values.pros.trim() || null,
        cons: values.cons.trim() || null,
      }
    default:
      return {}
  }
}

export const BOOST_CARD_META: Record<BoostCard, { title: string; sub: string }> = {
  ratings: {
    title: 'Rate the details',
    sub: 'One tap each. Takes about 15 seconds.',
  },
  money: {
    title: 'The money question',
    sub: 'What does it actually cost to study here?',
  },
  program: {
    title: 'What did you study?',
    sub: 'Students searching your program will find this review.',
  },
  media: {
    title: 'Got a photo?',
    sub: 'Dorm, campus, canteen. Real photos beat every rating.',
  },
  details: {
    title: 'When were you there?',
    sub: 'So students know how current your experience is.',
  },
  pros_cons: {
    title: 'Best and worst',
    sub: 'One line each is plenty.',
  },
}

// ---- Verdict matrix (screen 2) --------------------------------------------------
// Six topics with a 👍 / 👎 side each. A pick writes three kinds of columns at
// once: a canonical tag, a phrase into pros or cons, and a clause in the
// auto-built review sentence. Phrases stay comma-free so pros/cons can be
// split back on ", " without losing user-typed parts.

export type PolarityDir = 'pos' | 'neg'
export type PolarityTopicKey = 'classes' | 'dorms' | 'food' | 'admin' | 'city' | 'social'
export type PolarityPicks = Partial<Record<PolarityTopicKey, PolarityDir>>

export interface PolaritySide {
  label: string
  tag: string
  phrase: string
}

export interface PolarityTopic {
  key: PolarityTopicKey
  label: string
  emoji: string
  pos: PolaritySide
  neg: PolaritySide
}

export const POLARITY_TOPICS: PolarityTopic[] = [
  {
    key: 'classes',
    label: 'Classes',
    emoji: '📚',
    pos: { label: 'Strong', tag: 'Strong academics', phrase: 'strong professors and classes' },
    neg: { label: 'Weak', tag: 'Weak teaching', phrase: 'inconsistent teaching quality' },
  },
  {
    key: 'dorms',
    label: 'Dorms',
    emoji: '🏠',
    pos: { label: 'Modern', tag: 'Good dorms', phrase: 'comfortable international dorms' },
    neg: { label: 'Old or strict', tag: 'Bad dorms', phrase: 'crowded or aging dorms' },
  },
  {
    key: 'food',
    label: 'Canteen',
    emoji: '🍜',
    pos: { label: 'Great food', tag: 'Great food', phrase: 'great affordable campus food' },
    neg: { label: 'Limited', tag: 'Bad food', phrase: 'limited campus food options' },
  },
  {
    key: 'admin',
    label: 'Admin and visa',
    emoji: '🛂',
    pos: {
      label: 'Helpful',
      tag: 'Easy visa',
      phrase: 'helpful international office and visa support',
    },
    neg: {
      label: 'Bureaucratic',
      tag: 'Hard bureaucracy',
      phrase: 'slow bureaucracy and admin rules',
    },
  },
  {
    key: 'city',
    label: 'City life',
    emoji: '🚇',
    pos: { label: 'Affordable', tag: 'Cheap city', phrase: 'affordable and convenient city life' },
    neg: { label: 'Expensive', tag: 'Expensive city', phrase: 'high living costs in the city' },
  },
  {
    key: 'social',
    label: 'Social',
    emoji: '🌏',
    pos: {
      label: 'Welcoming',
      tag: 'International-friendly',
      phrase: 'a welcoming international community',
    },
    neg: { label: 'Isolating', tag: 'Isolating', phrase: 'an isolating social scene' },
  },
]

const POLARITY_TAG_SET = new Set(POLARITY_TOPICS.flatMap((t) => [t.pos.tag, t.neg.tag]))
const POLARITY_PHRASE_SET = new Set(POLARITY_TOPICS.flatMap((t) => [t.pos.phrase, t.neg.phrase]))

const joinNatural = (parts: string[]): string => {
  if (parts.length <= 1) return parts[0] ?? ''
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}

// The auto-written review sentence for a set of picks. Reads in declaration
// order regardless of tap order, so the same picks always build the same text.
export const derivePolarityText = (picks: PolarityPicks): string => {
  const pos: string[] = []
  const neg: string[] = []
  for (const t of POLARITY_TOPICS) {
    const dir = picks[t.key]
    if (dir === 'pos') pos.push(t.pos.phrase)
    else if (dir === 'neg') neg.push(t.neg.phrase)
  }
  if (pos.length && neg.length) {
    return `Highlights include ${joinNatural(pos)}, though students should expect ${joinNatural(neg)}.`
  }
  if (pos.length) return `The standouts are ${joinNatural(pos)}.`
  if (neg.length) return `The main challenges are ${joinNatural(neg)}.`
  return ''
}

const splitCsv = (value: string): string[] =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

// The form patch for one matrix tap. Tapping the active side un-picks the
// topic. Derived columns rebuild from scratch each time: tags, pros and cons
// keep any non-polarity parts the user (or an older draft) already had, and
// the review text is only rewritten while it still equals what the matrix
// last produced — once the reviewer types their own words it is left alone.
export const applyPolarityPick = (
  v: ReviewFieldValues,
  topic: PolarityTopicKey,
  dir: PolarityDir
): Partial<ReviewFieldValues> => {
  const picks: PolarityPicks = { ...v.polarity }
  if (picks[topic] === dir) delete picks[topic]
  else picks[topic] = dir

  const tags: string[] = []
  const posPhrases: string[] = []
  const negPhrases: string[] = []
  for (const t of POLARITY_TOPICS) {
    const pick = picks[t.key]
    if (!pick) continue
    const side = t[pick]
    tags.push(side.tag)
    ;(pick === 'pos' ? posPhrases : negPhrases).push(side.phrase)
  }

  const manualTags = v.selectedTags.filter((t) => !POLARITY_TAG_SET.has(t))
  const manualPros = splitCsv(v.pros).filter((p) => !POLARITY_PHRASE_SET.has(p))
  const manualCons = splitCsv(v.cons).filter((p) => !POLARITY_PHRASE_SET.has(p))

  const previousAutoText = derivePolarityText(v.polarity)
  const textIsAuto = v.reviewText === '' || v.reviewText === previousAutoText

  return markInferred(
    v,
    {
      polarity: picks,
      selectedTags: [...manualTags, ...tags],
      pros: [...manualPros, ...posPhrases].join(', '),
      cons: [...manualCons, ...negPhrases].join(', '),
      ...(textIsAuto ? { reviewText: derivePolarityText(picks) } : {}),
    },
    'polarity'
  )
}

// ---- Smart defaults -------------------------------------------------------------
// One tap on screen 1 answers questions the old flow asked again later. The
// degree-level options carry strong defaults: a Language Course year is
// Chinese-taught Chinese language by definition, and Exchange pins enrollment
// status. Inferred values only fill empty fields (or roll back values they
// set), so a deliberate pick is never clobbered.

export const LANGUAGE_COURSE_DEGREE = 'Language Course'
export const LANGUAGE_COURSE_PROGRAM = 'Chinese Language (Mandarin)'
export const LANGUAGE_COURSE_INSTRUCTION = 'Chinese (Mandarin)'
export const EXCHANGE_DEGREE = 'Exchange'

// `primary` is the field the user's action wrote directly; every other field
// in the patch is inference-owned until a deliberate write clears the flag.
// Rollback guards read the flag, not the value, so a user who typed the same
// words an inference would have written keeps their pick.
const markInferred = (
  v: ReviewFieldValues,
  patch: Partial<ReviewFieldValues>,
  primary: keyof ReviewFieldValues
): Partial<ReviewFieldValues> => {
  const inferred = new Set(v.inferred)
  inferred.delete(primary)
  for (const key of Object.keys(patch)) {
    if (key !== primary && key !== 'inferred') inferred.add(key)
  }
  return { ...patch, inferred }
}

export const applyDegreeLevel = (
  v: ReviewFieldValues,
  next: string
): Partial<ReviewFieldValues> => {
  const patch: Partial<ReviewFieldValues> = { degreeLevel: next }

  const wasLangCourse = v.degreeLevel === LANGUAGE_COURSE_DEGREE
  const isLangCourse = next === LANGUAGE_COURSE_DEGREE
  if (isLangCourse && !wasLangCourse) {
    if (!v.program || v.inferred.has('program')) {
      patch.program = LANGUAGE_COURSE_PROGRAM
    }
    if (!v.languageOfInstruction || v.inferred.has('languageOfInstruction')) {
      patch.languageOfInstruction = LANGUAGE_COURSE_INSTRUCTION
    }
  } else if (wasLangCourse && !isLangCourse) {
    if (v.program === LANGUAGE_COURSE_PROGRAM && v.inferred.has('program')) patch.program = ''
    if (
      v.languageOfInstruction === LANGUAGE_COURSE_INSTRUCTION &&
      v.inferred.has('languageOfInstruction')
    ) {
      patch.languageOfInstruction = ''
    }
  }

  if (
    next === EXCHANGE_DEGREE &&
    v.degreeLevel !== EXCHANGE_DEGREE &&
    (!v.enrollmentStatus || v.inferred.has('enrollmentStatus'))
  ) {
    patch.enrollmentStatus = 'exchange'
  } else if (
    v.degreeLevel === EXCHANGE_DEGREE &&
    next !== EXCHANGE_DEGREE &&
    v.enrollmentStatus === 'exchange' &&
    v.inferred.has('enrollmentStatus')
  ) {
    patch.enrollmentStatus = ''
  }

  return markInferred(v, patch, 'degreeLevel')
}

// A recent start year on a blank enrollment status almost always means the
// reviewer is still there; an end year means they finished. Start year only
// fills an empty status; end year flips an inferred 'current' to 'alumni',
// clears an inferred 'alumni' back out when the pick is removed, and never
// touches a deliberate choice.
export const applyStartYear = (
  v: ReviewFieldValues,
  year: number | '',
  now = new Date().getFullYear()
): Partial<ReviewFieldValues> =>
  markInferred(
    v,
    {
      startYear: year,
      ...(!v.enrollmentStatus && typeof year === 'number' && year >= now - 3
        ? { enrollmentStatus: 'current' }
        : {}),
    },
    'startYear'
  )

export const applyEndYear = (v: ReviewFieldValues, year: number | ''): Partial<ReviewFieldValues> =>
  markInferred(
    v,
    {
      endYear: year,
      ...(typeof year === 'number' &&
      (!v.enrollmentStatus ||
        (v.enrollmentStatus === 'current' && v.inferred.has('enrollmentStatus')))
        ? { enrollmentStatus: 'alumni' }
        : year === '' && v.enrollmentStatus === 'alumni' && v.inferred.has('enrollmentStatus')
          ? { enrollmentStatus: '' }
          : {}),
    },
    'endYear'
  )

// A program pick carries its own inference: Chinese Language (Mandarin) is
// taught in Mandarin. Fills the language field while it is empty or still
// inference-owned, and rolls its own value back when the program moves on.
export const applyProgram = (v: ReviewFieldValues, program: string): Partial<ReviewFieldValues> =>
  markInferred(
    v,
    {
      program,
      ...(program === LANGUAGE_COURSE_PROGRAM &&
      (!v.languageOfInstruction || v.inferred.has('languageOfInstruction'))
        ? { languageOfInstruction: LANGUAGE_COURSE_INSTRUCTION }
        : v.program === LANGUAGE_COURSE_PROGRAM &&
            program !== LANGUAGE_COURSE_PROGRAM &&
            v.languageOfInstruction === LANGUAGE_COURSE_INSTRUCTION &&
            v.inferred.has('languageOfInstruction')
          ? { languageOfInstruction: '' }
          : {}),
    },
    'program'
  )

// ---- Reactive rating ------------------------------------------------------------

export const RATING_VIBE: Record<number, { emoji: string; text: string }> = {
  1: { emoji: '😬', text: 'Rough experience. Your honesty warns the next student.' },
  2: { emoji: '😕', text: 'Below expectations. The details will help.' },
  3: { emoji: '😐', text: 'Decent overall, with trade-offs.' },
  4: { emoji: '😊', text: 'A solid choice for international students.' },
  5: { emoji: '🤩', text: 'You loved it. Tell the next student why.' },
}

// ---- Popular program quick picks ------------------------------------------------
// The majors most international students in China actually take, as one-tap
// chips on the program card. The autocomplete below them covers the rest.

export const POPULAR_PROGRAMS: { label: string; value: string }[] = [
  { label: '🩺 MBBS', value: 'Clinical Medicine (MBBS)' },
  { label: '💻 CS / AI', value: 'Computer Science' },
  { label: '🇨🇳 Chinese Language', value: 'Chinese Language (Mandarin)' },
  { label: '📈 Business / Trade', value: 'International Economics and Trade' },
  { label: '⚙️ Engineering', value: 'Mechanical Engineering' },
  { label: '🌐 Intl Relations', value: 'International Relations' },
]

// ---- Field option lists --------------------------------------------------------

export const SUBSCORE_INPUT_FIELDS: { key: keyof SubScores; label: string }[] = [
  { key: 'rating_academics', label: 'Academics / teaching' },
  { key: 'rating_campus', label: 'Campus & facilities' },
  { key: 'rating_accommodation', label: 'Accommodation / dorms' },
  { key: 'rating_cost', label: 'Cost of living in the city' },
  { key: 'rating_intl_office', label: 'International office support' },
  { key: 'rating_social', label: 'Social life / community' },
  { key: 'rating_extracurricular', label: 'Extracurricular activities' },
  { key: 'rating_career', label: 'Career & job support' },
]

export const POPULAR_TAGS = [
  'Strong academics',
  'Great food',
  'Expensive city',
  'Easy visa',
  'Good dorms',
  'Crowded',
  'Strong CS',
  'International-friendly',
  'Beautiful campus',
  'Good nightlife',
  'Safe',
  'Cheap city',
]

export const MORE_TAGS = [
  'Strong engineering',
  'Good language program',
  'Research opportunities',
  'Modern campus',
  'Old campus',
  'Quiet',
  'Bad dorms',
  'Bad food',
  'Active clubs',
  'Isolating',
  'Hard bureaucracy',
  'Good career support',
  'Unsafe',
  'Diverse',
  'Hard grading',
  'Easy grading',
  'Weak teaching',
]

export const DEGREE_LEVELS = [
  'Bachelor',
  'Master',
  'PhD',
  'Certificate',
  'Exchange',
  'Language Course',
  'Other',
]

export const INSTRUCTION_LANGS = ['English', 'Chinese (Mandarin)', 'Bilingual', 'Other']

export const RECOMMEND_OPTIONS = [
  { value: 'yes', label: 'Yes, definitely', emoji: '👍' },
  { value: 'no', label: 'No', emoji: '👎' },
  { value: 'maybe', label: 'It depends', emoji: '🤔' },
]

// ---- Years ---------------------------------------------------------------------

// Start-year input as chips: recent years are one tap; "Earlier" reveals the
// full select for anything older.
export const YEAR_CHIP_COUNT = 7

export const recentYearChips = (now = new Date().getFullYear()): number[] => {
  const years: number[] = []
  for (let y = now; y > now - YEAR_CHIP_COUNT; y--) years.push(y)
  return years
}

export const allYearOptions = (now = new Date().getFullYear()): number[] => {
  const years: number[] = []
  for (let y = now + 1; y >= 1990; y--) years.push(y)
  return years
}

// ---- Live preview ---------------------------------------------------------------

// The card needs `rating` on top of the display-fields shape ReviewCardData
// describes (the real card reads it off the full reviews row).
export type PreviewReview = ReviewCardData & { rating: number }

// Maps live form values to the card shape — shared by the preview card, the
// success screen's strength meter, and the wizard's detail track, so all
// three score the same review the same way.
export const previewReviewFromFields = (
  values: ReviewFieldValues,
  media: MediaItem[]
): PreviewReview => ({
  rating: values.rating,
  recommend: values.recommend || null,
  program: values.program || null,
  degree_level: values.degreeLevel || null,
  enrollment_status: values.enrollmentStatus || null,
  start_year: values.startYear || null,
  end_year: values.endYear || null,
  language_of_instruction: values.languageOfInstruction || null,
  tuition_range: values.tuitionRange || null,
  living_cost_range: values.livingCostRange || null,
  funding_type: values.fundingType || null,
  funding_coverage:
    values.fundingType && values.fundingType !== 'self' ? values.fundingCoverage || null : null,
  pros: values.pros || null,
  cons: values.cons || null,
  tags: values.selectedTags,
  media: media as unknown as PreviewReview['media'],
  rating_academics: values.subscores.rating_academics ?? null,
  rating_campus: values.subscores.rating_campus ?? null,
  rating_accommodation: values.subscores.rating_accommodation ?? null,
  rating_cost: values.subscores.rating_cost ?? null,
  rating_intl_office: values.subscores.rating_intl_office ?? null,
  rating_social: values.subscores.rating_social ?? null,
  rating_extracurricular: values.subscores.rating_extracurricular ?? null,
  rating_career: values.subscores.rating_career ?? null,
})
