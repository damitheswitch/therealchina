// Shared review-field validation for review-submit (insert) and
// review-manage (update). Both functions must validate identically — an edit
// can never sneak in values a fresh submission would reject. Throws Error with
// a user-safe message on the first invalid field.

export const MAX_MEDIA_ITEMS = 5

export const LIMITS = {
  text: { min: 10, max: 5000 },
  program: { max: 120 },
  degreeLevel: { max: 60 },
  uniName: { max: 160 },
  uniCity: { max: 120 },
  pros: { max: 1000 },
  cons: { max: 1000 },
  tags: { max: 20 },
  tagLen: { max: 40 },
}

export const VALID_ENROLLMENT = ['current', 'alumni', 'exchange', 'applicant'] as const
export const VALID_FUNDING = ['self', 'csc', 'school', 'province'] as const
export const VALID_COVERAGE = ['partial', 'full'] as const
export const VALID_RECOMMEND = ['yes', 'no', 'maybe'] as const
export const VALID_CURRENT_STATUS = [
  'studying',
  'working',
  'internship',
  'job_hunting',
  'break',
  'other',
] as const
export const VALID_SUBSCORES = [
  'rating_academics', 'rating_campus', 'rating_accommodation', 'rating_cost',
  'rating_intl_office', 'rating_social', 'rating_extracurricular', 'rating_career',
] as const

export type MediaItem = { url: string; type: 'image' | 'video'; name?: string; mime?: string }

export function asTrimmedString(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Error('invalid field type')
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (trimmed.length > maxLength) throw new Error('field too long')
  return trimmed || null
}

export function validateMedia(value: unknown, mediaUrlPrefix: string): MediaItem[] {
  if (value === null || value === undefined) return []
  if (!Array.isArray(value)) throw new Error('media must be an array')
  if (value.length > MAX_MEDIA_ITEMS) throw new Error(`at most ${MAX_MEDIA_ITEMS} media items`)

  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('invalid media item')
    const { url, type, name, mime } = item as Record<string, unknown>
    if (typeof url !== 'string' || !url.startsWith(mediaUrlPrefix)) {
      throw new Error('media url is not a TRC upload')
    }
    if (type !== 'image' && type !== 'video') throw new Error('invalid media type')
    return {
      url,
      type,
      name: typeof name === 'string' ? name.slice(0, 200) : undefined,
      mime: typeof mime === 'string' ? mime.slice(0, 100) : undefined,
    }
  })
}

// All writable review fields after validation, in DB column shape. Insert and
// update write this object verbatim — id/user_id/university_id/created_at are
// never part of it.
export interface ValidatedReviewFields {
  rating: number
  text: string
  program: string | null
  degree_level: string | null
  media: MediaItem[]
  rating_academics: number | null
  rating_campus: number | null
  rating_accommodation: number | null
  rating_cost: number | null
  rating_intl_office: number | null
  rating_social: number | null
  rating_extracurricular: number | null
  rating_career: number | null
  enrollment_status: string | null
  start_year: number | null
  end_year: number | null
  language_of_instruction: string | null
  tuition_range: string | null
  living_cost_range: string | null
  funding_type: string | null
  funding_coverage: string | null
  recommend: string | null
  pros: string | null
  cons: string | null
  tags: string[]
}

export function validateReviewFields(
  body: Record<string, unknown>,
  mediaUrlPrefix: string
): ValidatedReviewFields {
  if (
    typeof body.rating !== 'number' ||
    body.rating < 1 ||
    body.rating > 5 ||
    !Number.isInteger(body.rating)
  ) {
    throw new Error('Rating must be a whole number between 1 and 5')
  }
  const rating = body.rating

  const text = asTrimmedString(body.text, LIMITS.text.max)
  if (!text || text.length < LIMITS.text.min) {
    throw new Error(`Review text must be at least ${LIMITS.text.min} characters`)
  }

  const program = asTrimmedString(body.program, LIMITS.program.max)
  const degreeLevel = asTrimmedString(body.degreeLevel, LIMITS.degreeLevel.max)
  const media = validateMedia(body.media, mediaUrlPrefix)

  // Sub-scores (optional, 1-5)
  const subscores: Record<string, number> = {}
  if (body.subscores !== null && body.subscores !== undefined) {
    if (typeof body.subscores !== 'object' || Array.isArray(body.subscores)) {
      throw new Error('subscores must be an object')
    }
    for (const key of VALID_SUBSCORES) {
      const val = (body.subscores as Record<string, unknown>)[key]
      if (val === null || val === undefined) continue
      if (typeof val !== 'number' || !Number.isInteger(val) || val < 1 || val > 5) {
        throw new Error(`${key} must be a whole number between 1 and 5`)
      }
      subscores[key] = val
    }
  }

  const enrollmentStatus = asTrimmedString(body.enrollmentStatus, 20)
  if (
    enrollmentStatus &&
    !VALID_ENROLLMENT.includes(enrollmentStatus as (typeof VALID_ENROLLMENT)[number])
  ) {
    throw new Error('Invalid enrollment status')
  }

  let startYear: number | null = null
  if (body.startYear !== null && body.startYear !== undefined) {
    if (
      typeof body.startYear !== 'number' ||
      !Number.isInteger(body.startYear) ||
      body.startYear < 1990 ||
      body.startYear > new Date().getFullYear() + 1
    ) {
      throw new Error('Invalid start year')
    }
    startYear = body.startYear
  }

  let endYear: number | null = null
  if (body.endYear !== null && body.endYear !== undefined) {
    if (
      typeof body.endYear !== 'number' ||
      !Number.isInteger(body.endYear) ||
      body.endYear < 1990 ||
      body.endYear > new Date().getFullYear() + 1
    ) {
      throw new Error('Invalid end year')
    }
    endYear = body.endYear
  }

  if (startYear !== null && endYear !== null && endYear < startYear) {
    throw new Error('End year cannot be before start year')
  }

  const languageOfInstruction = asTrimmedString(body.languageOfInstruction, 60)
  const tuitionRange = asTrimmedString(body.tuitionRange, 40)
  const livingCostRange = asTrimmedString(body.livingCostRange, 40)

  const fundingType = asTrimmedString(body.fundingType, 20)
  if (fundingType && !VALID_FUNDING.includes(fundingType as (typeof VALID_FUNDING)[number])) {
    throw new Error('Invalid funding type')
  }
  let fundingCoverage = asTrimmedString(body.fundingCoverage, 20)
  if (
    fundingCoverage &&
    !VALID_COVERAGE.includes(fundingCoverage as (typeof VALID_COVERAGE)[number])
  ) {
    throw new Error('Invalid funding coverage')
  }
  // Coverage only valid when funding is not self-funded
  if (fundingCoverage && fundingType === 'self') {
    fundingCoverage = null
  }

  const recommend = asTrimmedString(body.recommend, 10)
  if (recommend && !VALID_RECOMMEND.includes(recommend as (typeof VALID_RECOMMEND)[number])) {
    throw new Error('Invalid recommend value')
  }

  const pros = asTrimmedString(body.pros, LIMITS.pros.max)
  const cons = asTrimmedString(body.cons, LIMITS.cons.max)

  // Tags: array of short strings
  const tags: string[] = []
  if (body.tags !== null && body.tags !== undefined) {
    if (!Array.isArray(body.tags)) throw new Error('tags must be an array')
    if (body.tags.length > LIMITS.tags.max) throw new Error(`at most ${LIMITS.tags.max} tags`)
    for (const t of body.tags) {
      const trimmed = asTrimmedString(t, LIMITS.tagLen.max)
      if (trimmed) tags.push(trimmed)
    }
  }

  return {
    rating,
    text,
    program,
    degree_level: degreeLevel,
    media,
    rating_academics: subscores.rating_academics ?? null,
    rating_campus: subscores.rating_campus ?? null,
    rating_accommodation: subscores.rating_accommodation ?? null,
    rating_cost: subscores.rating_cost ?? null,
    rating_intl_office: subscores.rating_intl_office ?? null,
    rating_social: subscores.rating_social ?? null,
    rating_extracurricular: subscores.rating_extracurricular ?? null,
    rating_career: subscores.rating_career ?? null,
    enrollment_status: enrollmentStatus,
    start_year: startYear,
    end_year: endYear,
    language_of_instruction: languageOfInstruction,
    tuition_range: tuitionRange,
    living_cost_range: livingCostRange,
    funding_type: fundingType,
    funding_coverage: fundingCoverage,
    recommend,
    pros,
    cons,
    tags,
  }
}
