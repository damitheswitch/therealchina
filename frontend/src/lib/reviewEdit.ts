import type { Tables } from '../types/database.types'
import type { MediaItem } from './reviewSubmit'

// The row shape the "My reviews" list fetches — full review plus the joined
// university label needed to render/edit it.
export type EditableReview = Tables<'reviews'> & {
  universities?: { name: string; city: string | null; slug: string } | null
}

// Initial form state for the wizard in edit mode. Mirrors the wizard's own
// state names so prefill stays a one-to-one map.
export interface WizardEditState {
  rating: number
  recommend: string
  program: string
  degreeLevel: string
  subscores: Record<string, number>
  enrollmentStatus: string
  startYear: number | ''
  endYear: number | ''
  languageOfInstruction: string
  tuitionRange: string
  livingCostRange: string
  fundingType: string
  fundingCoverage: string
  tags: string[]
  pros: string
  cons: string
  reviewText: string
  media: MediaItem[]
  universityLabel: string
}

// SUBSCORE_KEYS is the wizard's SubScores key set, widened to the row's index
// signature for the mapper's dynamic access.
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

// Maps a stored review row into the wizard's initial state. Nulls become the
// wizard's empty values ('' / [] / 0) so untouched optional fields stay
// "unset" rather than gaining fabricated values.
export const reviewToWizardState = (review: EditableReview): WizardEditState => {
  const subscores: Record<string, number> = {}
  for (const key of SUBSCORE_KEYS) {
    const v = review[key]
    if (typeof v === 'number') subscores[key] = v
  }

  const uni = review.universities
  const universityLabel = uni ? [uni.name, uni.city].filter(Boolean).join(' — ') : ''

  return {
    rating: review.rating,
    recommend: review.recommend ?? '',
    program: review.program ?? '',
    degreeLevel: review.degree_level ?? '',
    subscores,
    enrollmentStatus: review.enrollment_status ?? '',
    startYear: review.start_year ?? '',
    endYear: review.end_year ?? '',
    languageOfInstruction: review.language_of_instruction ?? '',
    tuitionRange: review.tuition_range ?? '',
    livingCostRange: review.living_cost_range ?? '',
    fundingType: review.funding_type ?? '',
    fundingCoverage: review.funding_coverage ?? '',
    tags: review.tags ?? [],
    pros: review.pros ?? '',
    cons: review.cons ?? '',
    reviewText: review.text,
    media: Array.isArray(review.media) ? (review.media as unknown as MediaItem[]) : [],
    universityLabel,
  }
}
