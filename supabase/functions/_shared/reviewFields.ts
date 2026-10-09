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

function validateSubscoreColumns(
  value: unknown,
  out: Record<string, number | null>,
  { partial = false }: { partial?: boolean } = {}
): void {
  if (value === null || value === undefined) {
    if (!partial) {
      for (const key of VALID_SUBSCORES) out[key] = null
    }
    return
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('subscores must be an object')
  }
  const obj = value as Record<string, unknown>
  for (const key of VALID_SUBSCORES) {
    const val = obj[key]
    if (val === undefined) {
      if (!partial) out[key] = null
      continue
    }
    if (val === null) {
      out[key] = null
      continue
    }
    if (typeof val !== 'number' || !Number.isInteger(val) || val < 1 || val > 5) {
      throw new Error(`${key} must be a whole number between 1 and 5`)
    }
    out[key] = val
  }
}

function validateYearField(value: unknown, label: string): number | null {
  if (value === null || value === undefined) return null
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1990 ||
    value > new Date().getFullYear() + 1
  ) {
    throw new Error(`Invalid ${label} year`)
  }
  return value
}

function validateFundingCoverage(
  rawCoverage: unknown,
  fundingType: string | null
): string | null {
  let coverage = asTrimmedString(rawCoverage, 20)
  if (coverage && !VALID_COVERAGE.includes(coverage as (typeof VALID_COVERAGE)[number])) {
    throw new Error('Invalid funding coverage')
  }
  // Coverage only valid when funding is not self-funded
  if (coverage && fundingType === 'self') {
    coverage = null
  }
  return coverage
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
  const subscores: Record<string, number | null> = {}
  validateSubscoreColumns(body.subscores, subscores)

  const enrollmentStatus = asTrimmedString(body.enrollmentStatus, 20)
  if (
    enrollmentStatus &&
    !VALID_ENROLLMENT.includes(enrollmentStatus as (typeof VALID_ENROLLMENT)[number])
  ) {
    throw new Error('Invalid enrollment status')
  }

  const startYear = validateYearField(body.startYear, 'start')
  const endYear = validateYearField(body.endYear, 'end')

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
  const fundingCoverage = validateFundingCoverage(body.fundingCoverage, fundingType)

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

// ---- Anonymous Boost -------------------------------------------------------------
// The optional fields a post-publish Boost may set, keyed by request name to the
// reviews column it writes. Everything else — rating, text, university, owner,
// recommend, tags, media, deleted_at — is absent on purpose: this map is the
// allowlist the RPC also enforces.
export const BOOST_FIELD_COLUMNS = {
  program: 'program',
  degreeLevel: 'degree_level',
  enrollmentStatus: 'enrollment_status',
  startYear: 'start_year',
  endYear: 'end_year',
  languageOfInstruction: 'language_of_instruction',
  tuitionRange: 'tuition_range',
  livingCostRange: 'living_cost_range',
  fundingType: 'funding_type',
  fundingCoverage: 'funding_coverage',
  pros: 'pros',
  cons: 'cons',
} as const

export const BOOST_PATCH_MAX_FIELDS = Object.keys(BOOST_FIELD_COLUMNS).length + 1 // + subscores

// Validates a partial Boost update into a reviews-column patch. Only the keys
// the caller sends land in the patch — absent columns keep their stored values.
// Any key outside the allowlist rejects the whole request rather than being
// silently dropped. Throws Error with a user-safe message.
export function validateBoostPatch(body: Record<string, unknown>): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('fields must be an object')
  }
  const keys = Object.keys(body)
  if (keys.length === 0) throw new Error('No fields to save')
  if (keys.length > BOOST_PATCH_MAX_FIELDS) throw new Error('Too many fields')

  const patch: Record<string, unknown> = {}
  for (const key of keys) {
    if (key === 'subscores') {
      validateSubscoreColumns(body.subscores, patch as Record<string, number | null>, {
        partial: true,
      })
      continue
    }
    const column = BOOST_FIELD_COLUMNS[key as keyof typeof BOOST_FIELD_COLUMNS]
    if (!column) throw new Error('That field cannot be changed here')

    const value = body[key]
    switch (key) {
      case 'program':
        patch[column] = asTrimmedString(value, LIMITS.program.max)
        break
      case 'degreeLevel':
        patch[column] = asTrimmedString(value, LIMITS.degreeLevel.max)
        break
      case 'enrollmentStatus': {
        const v = asTrimmedString(value, 20)
        if (v && !VALID_ENROLLMENT.includes(v as (typeof VALID_ENROLLMENT)[number])) {
          throw new Error('Invalid enrollment status')
        }
        patch[column] = v
        break
      }
      case 'startYear':
        patch[column] = validateYearField(value, 'start')
        break
      case 'endYear':
        patch[column] = validateYearField(value, 'end')
        break
      case 'languageOfInstruction':
        patch[column] = asTrimmedString(value, 60)
        break
      case 'pros':
        patch[column] = asTrimmedString(value, LIMITS.pros.max)
        break
      case 'cons':
        patch[column] = asTrimmedString(value, LIMITS.cons.max)
        break
      case 'tuitionRange':
      case 'livingCostRange':
        patch[column] = asTrimmedString(value, 40)
        break
      case 'fundingType': {
        const v = asTrimmedString(value, 20)
        if (v && !VALID_FUNDING.includes(v as (typeof VALID_FUNDING)[number])) {
          throw new Error('Invalid funding type')
        }
        patch[column] = v
        break
      }
      case 'fundingCoverage': {
        const v = asTrimmedString(value, 20)
        if (v && !VALID_COVERAGE.includes(v as (typeof VALID_COVERAGE)[number])) {
          throw new Error('Invalid funding coverage')
        }
        patch[column] = v
        break
      }
    }
  }

  if (Object.keys(patch).length === 0) throw new Error('No fields to save')

  // Year ordering and self-funded coverage depend on the stored values too —
  // the RPC evaluates both rules against the post-patch row, so a partial
  // patch can never create a state a full update would reject.
  return patch
}
