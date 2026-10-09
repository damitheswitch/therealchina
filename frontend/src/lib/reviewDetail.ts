import { SUBSCORE_FIELDS, normalizeMediaItems, type ReviewCardData } from './reviewDisplay'

// The "Detailed" review rule (Phase 4, D4.1 — owner decision 2026-10-09).
// A review earns one point per filled detail area and needs
// DETAILED_THRESHOLD areas to carry the gold highlight. Every area maps to
// something the reviewer actually saw — a Boost card or the tag chips on the
// story screen — so the rule explains itself: "this review answers at least
// N of these questions". Photos are one area of seven, never required, and a
// publish-minimum review (rating + text only) scores zero.
//
// The same count drives three surfaces: the public card highlight, the
// author-only strength meter, and the 'helpful' sort ranking.

// Accepts sparse rows: the 'helpful' head select fetches only the columns
// the score reads (REVIEW_DETAIL_COLUMNS), so absent fields must count as
// unfilled, never as filled.
export type ReviewDetailInput = Partial<ReviewCardData>

export const DETAIL_AREAS = [
  { key: 'program', label: 'what you studied' },
  { key: 'ratings', label: 'category ratings' },
  { key: 'money', label: 'costs or funding' },
  { key: 'timing', label: 'when you were there' },
  { key: 'pros_cons', label: 'the best and worst' },
  { key: 'media', label: 'a photo' },
  { key: 'tags', label: 'tags' },
] as const

export type DetailAreaKey = (typeof DETAIL_AREAS)[number]['key']

export const DETAIL_AREA_COUNT = DETAIL_AREAS.length
export const DETAILED_THRESHOLD = 3

// The ratings card counts once at least this many of the eight aspects are
// scored — one stray tap shouldn't equal a finished card.
export const RATINGS_AREA_MIN = 4

const hasText = (v: string | null | undefined) => Boolean(v && v.trim())

const AREA_FILLED: Record<DetailAreaKey, (r: ReviewDetailInput) => boolean> = {
  program: (r) => hasText(r.program) || hasText(r.degree_level),
  ratings: (r) =>
    SUBSCORE_FIELDS.filter(({ key }) => typeof r[key] === 'number').length >= RATINGS_AREA_MIN,
  money: (r) => hasText(r.tuition_range) || hasText(r.living_cost_range) || hasText(r.funding_type),
  timing: (r) =>
    hasText(r.enrollment_status) ||
    typeof r.start_year === 'number' ||
    typeof r.end_year === 'number' ||
    hasText(r.language_of_instruction),
  pros_cons: (r) => hasText(r.pros) || hasText(r.cons),
  media: (r) => normalizeMediaItems(r.media).length > 0,
  tags: (r) => (r.tags ?? []).some(Boolean),
}

export const filledDetailAreas = (review: ReviewDetailInput): DetailAreaKey[] =>
  DETAIL_AREAS.filter(({ key }) => AREA_FILLED[key](review)).map(({ key }) => key)

export const detailScore = (review: ReviewDetailInput): number => filledDetailAreas(review).length

export const isDetailedReview = (review: ReviewDetailInput): boolean =>
  detailScore(review) >= DETAILED_THRESHOLD

// Unfilled areas in card order — the strength meter lists them as
// "Still missing: costs or funding, a photo".
export const missingDetailAreas = (review: ReviewDetailInput) =>
  DETAIL_AREAS.filter(({ key }) => !AREA_FILLED[key](review))
