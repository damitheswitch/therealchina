import type { Tables } from '../types/database.types'

// The review columns needed to render the rich wizard data (migration 022).
// Callers may pass a full reviews row or any superset of this Pick.
export type ReviewDisplayData = Pick<
  Tables<'reviews'>,
  | 'program'
  | 'degree_level'
  | 'enrollment_status'
  | 'start_year'
  | 'end_year'
  | 'language_of_instruction'
  | 'tuition_range'
  | 'living_cost_range'
  | 'funding_type'
  | 'funding_coverage'
  | 'recommend'
  | 'pros'
  | 'cons'
  | 'tags'
  | 'rating_academics'
  | 'rating_campus'
  | 'rating_accommodation'
  | 'rating_cost'
  | 'rating_intl_office'
  | 'rating_social'
  | 'rating_extracurricular'
  | 'rating_career'
>

export type SubScoreKey =
  | 'rating_academics'
  | 'rating_campus'
  | 'rating_accommodation'
  | 'rating_cost'
  | 'rating_intl_office'
  | 'rating_social'
  | 'rating_extracurricular'
  | 'rating_career'

export interface SubScore {
  key: SubScoreKey
  label: string
  value: number
}

// Display labels for the eight optional sub-scores (shorter than the wizard
// labels so they fit a compact two-column grid). Exported so aggregate views
// (reviewSummary) iterate the same fields in the same order.
export const SUBSCORE_FIELDS: { key: SubScoreKey; label: string }[] = [
  { key: 'rating_academics', label: 'Academics' },
  { key: 'rating_campus', label: 'Campus' },
  { key: 'rating_accommodation', label: 'Accommodation' },
  { key: 'rating_cost', label: 'Cost of living' },
  { key: 'rating_intl_office', label: 'Intl office' },
  { key: 'rating_social', label: 'Social life' },
  { key: 'rating_extracurricular', label: 'Extracurricular' },
  { key: 'rating_career', label: 'Career support' },
]

export const ENROLLMENT_LABELS: Record<string, string> = {
  current: 'Current student',
  alumni: 'Alumni',
  exchange: 'Exchange',
  applicant: 'Applicant',
}

// Lowercase, count-aware variants for mid-sentence use (e.g. the reviewer-mix
// footer line reads "3 current students · 1 alum", not "3 Current students").
const ENROLLMENT_SINGULAR: Record<string, string> = {
  current: 'current student',
  alumni: 'alum',
  exchange: 'exchange student',
  applicant: 'applicant',
}

const ENROLLMENT_PLURAL: Record<string, string> = {
  current: 'current students',
  alumni: 'alumni',
  exchange: 'exchange students',
  applicant: 'applicants',
}

export const FUNDING_LABELS: Record<string, string> = {
  self: 'Self-funded',
  csc: 'CSC / Government',
  school: 'School',
  province: 'Provincial',
}

const RECOMMEND_META: Record<string, { label: string; emoji: string }> = {
  yes: { label: 'Recommends', emoji: '👍' },
  maybe: { label: 'Neutral', emoji: '🤔' },
  no: { label: "Doesn't recommend", emoji: '👎' },
}

// Sub-scores that were actually filled in (all are nullable on older reviews).
export const getSubScores = (review: ReviewDisplayData): SubScore[] =>
  SUBSCORE_FIELDS.map(({ key, label }) => ({ key, label, value: review[key] })).filter(
    (s): s is SubScore => typeof s.value === 'number'
  )

const formatYearRange = (start: number | null, end: number | null): string => {
  if (start && end) return `${start}–${end}`
  if (start) return `${start}–present`
  if (end) return `until ${end}`
  return ''
}

// e.g. "Studied Computer Science · Master's · Alumni · 2019–2023".
// Built only from non-null parts; empty string when nothing is set.
export const buildContextLine = (review: ReviewDisplayData): string => {
  const parts: string[] = []
  if (review.program) parts.push(`Studied ${review.program}`)
  if (review.degree_level) parts.push(review.degree_level)
  if (review.enrollment_status)
    parts.push(ENROLLMENT_LABELS[review.enrollment_status] ?? review.enrollment_status)
  const years = formatYearRange(review.start_year, review.end_year)
  if (years) parts.push(years)
  return parts.join(' · ')
}

// Cost / funding / language facts, e.g. "Tuition: ¥20k–¥40k/yr".
export const buildFactItems = (review: ReviewDisplayData): string[] => {
  const facts: string[] = []
  if (review.language_of_instruction) facts.push(`Instruction: ${review.language_of_instruction}`)
  if (review.tuition_range) facts.push(`Tuition: ${review.tuition_range}/yr`)
  if (review.living_cost_range) facts.push(`Living cost: ${review.living_cost_range}/mo`)
  if (review.funding_type) {
    const label = FUNDING_LABELS[review.funding_type] ?? review.funding_type
    const coverage =
      review.funding_coverage === 'full'
        ? 'full coverage'
        : review.funding_coverage === 'partial'
          ? 'partial coverage'
          : ''
    facts.push(`Funding: ${label}${coverage ? ` (${coverage})` : ''}`)
  }
  return facts
}

export const getRecommendMeta = (value: string | null | undefined) =>
  value ? (RECOMMEND_META[value] ?? null) : null

// "1 current student" / "3 alumni". Unknown statuses fall back to the raw
// string so new wizard options still render something sensible.
export const formatEnrollmentLabel = (status: string, count: number): string => {
  const word =
    count === 1 ? (ENROLLMENT_SINGULAR[status] ?? status) : (ENROLLMENT_PLURAL[status] ?? status)
  return `${count} ${word}`
}

// Summary footer line, e.g. "3 current students · 1 alumni". Costs are
// rendered as a separate stepped scale — this formats enrollment only.
export const formatReviewerMix = (enrollment: { status: string; count: number }[]): string =>
  enrollment.map(({ status, count }) => formatEnrollmentLabel(status, count)).join(' · ')
