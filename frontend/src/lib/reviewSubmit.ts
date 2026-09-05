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

export interface ReviewPayload {
  cfToken?: string
  universitySlug?: string
  universityName?: string
  newUniversity?: { name: string; city: string }
  rating: number
  text: string
  program?: string
  degreeLevel?: string
  media?: MediaItem[]
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
    const msg = await parseFunctionError(error)
    throw new Error(msg)
  }
  return data as ReviewSubmitResult
}
