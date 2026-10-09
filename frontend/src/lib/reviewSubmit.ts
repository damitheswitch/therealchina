import { supabase } from './supabaseClient'
import { parseFunctionError } from './mediaUpload'

export interface MediaItem {
  url: string
  type: 'image' | 'video'
  name?: string
  mime?: string
}

export interface SubScores {
  rating_academics?: number
  rating_campus?: number
  rating_accommodation?: number
  rating_cost?: number
  rating_intl_office?: number
  rating_social?: number
  rating_extracurricular?: number
  rating_career?: number
}

// "About you" answers from anonymous reviewers. Stored in the private
// reviewer_context table by the edge function — never readable by clients.
export interface ReviewerContext {
  email?: string
  emailConsent?: boolean
  homeCountry?: string
  currentStatus?: string
  languagesSpoken?: string[]
}

export interface ReviewPayload {
  cfToken?: string
  // Anonymous-only: browser-held token that later links this review to an
  // account (stored privately, matched by review-claim after sign-in).
  claimToken?: string
  // Anonymous-only: per-review capability for post-publish Boost — the server
  // stores only its SHA-256 digest.
  boostToken?: string
  universitySlug?: string
  universityName?: string
  newUniversity?: { name: string; city: string; province?: string }
  rating: number
  text: string
  program?: string
  degreeLevel?: string
  media?: MediaItem[]
  reviewerContext?: ReviewerContext
  // Wizard fields
  subscores?: SubScores
  enrollmentStatus?: string
  startYear?: number
  endYear?: number
  languageOfInstruction?: string
  tuitionRange?: string
  livingCostRange?: string
  fundingType?: string
  fundingCoverage?: string
  recommend?: string
  pros?: string
  cons?: string
  tags?: string[]
}

export interface ReviewSubmitResult {
  reviewId: string
  universitySlug: string
  universityCreated: boolean
  // Anonymous-only: the server persisted the Boost capability's digest. When
  // false, the client must not store the token or offer Boost — saves would
  // always 403.
  boostAvailable?: boolean
}

export class ReviewSubmitError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ReviewSubmitError'
    this.status = status
  }
}

/**
 * Submits a review through the review-submit Edge Function.
 * All submissions (anonymous and authenticated) go through the function:
 * anonymous callers must include a Cloudflare Turnstile token, universities
 * referenced as "not listed" are created server-side with safe slugs, and the
 * write happens with the service role key after rate limiting and validation.
 */
export const submitReview = async (payload: ReviewPayload): Promise<ReviewSubmitResult> => {
  const { data, error } = await supabase.functions.invoke('review-submit', { body: payload })
  if (error) {
    const status = (error as { context?: { status?: unknown } }).context?.status
    const msg = await parseFunctionError(error)
    throw new ReviewSubmitError(msg, typeof status === 'number' ? status : undefined)
  }
  return data as ReviewSubmitResult
}
