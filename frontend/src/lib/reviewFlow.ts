import type { MediaItem, SubScores } from './reviewSubmit'
import type { ReviewEditPayload } from './reviewManage'
import { DRAFT_PAYLOAD_VERSION, type ReviewDraftPayload } from './reviewDrafts'
import type { BoostCard } from './analytics'

// ---- Fast review flow (Phase 2) --------------------------------------------------
// Two publish screens: essentials (university + rating) then story (text + tags).
// Everything else is optional and moves to the post-publish Boost card stack.
// The server minimum is already university + rating + text (see
// _shared/reviewFields.ts), so publishing never needs more than that.

export const FAST_FLOW_SCREENS = 2

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
  homeCountry: string
  currentStatus: string
  languagesSpoken: string[]
  emailConsent: boolean
  anonEmail: string
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
  homeCountry: '',
  currentStatus: '',
  languagesSpoken: [],
  emailConsent: false,
  anonEmail: '',
}

// Strips the draft-only keys (v, step, media) so the rest can be applied to
// form state directly. Media is handled separately by the uploader.
export const fieldValuesFromDraft = (p: ReviewDraftPayload): Partial<ReviewFieldValues> => {
  const { v: _v, step: _step, media: _media, ...fields } = p
  return fields
}

export const draftPayloadFromState = (
  values: ReviewFieldValues,
  media: MediaItem[],
  step: number
): ReviewDraftPayload => ({ ...values, media, step, v: DRAFT_PAYLOAD_VERSION })

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

export const BOOST_CARD_ORDER: BoostCard[] = [
  'program',
  'ratings',
  'money',
  'details',
  'pros_cons',
  'media',
]

export const BOOST_CARD_META: Record<BoostCard, { title: string; sub: string }> = {
  program: {
    title: 'What did you study?',
    sub: 'Students searching for your program will find this review.',
  },
  ratings: {
    title: 'Rate the details',
    sub: 'Tap a score for each one. Takes about 15 seconds.',
  },
  money: {
    title: 'The money question',
    sub: 'What does it actually cost to study here?',
  },
  details: {
    title: 'When were you there?',
    sub: 'So students know how current your experience is.',
  },
  pros_cons: {
    title: 'Best and worst',
    sub: 'One line each is plenty.',
  },
  media: {
    title: 'Got a photo?',
    sub: 'Dorm, campus, canteen. Real photos beat every rating.',
  },
}

// Starter chips for the writing screen: one tap inserts a sentence opening so
// the textarea never starts blank.
export const STORY_STARTERS = ['The best part is ', 'The worst part is ', 'I wish I knew ']

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
