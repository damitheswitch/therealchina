import { supabase } from './supabaseClient'
import { parseFunctionError } from './mediaUpload'

/**
 * Submits a review through the review-submit Edge Function.
 * All submissions (anonymous and authenticated) go through the function:
 * anonymous callers must include a Cloudflare Turnstile token, universities
 * referenced as "not listed" are created server-side with safe slugs, and the
 * write happens with the service role key after rate limiting and validation.
 *
 * @param {{
 *   cfToken?: string,
 *   universitySlug?: string,
 *   universityName?: string,
 *   newUniversity?: { name: string, city: string },
 *   rating: number,
 *   text: string,
 *   program?: string,
 *   degreeLevel?: string,
 *   media?: Array<{ url: string, type: 'image' | 'video', name?: string, mime?: string }>,
 * }} payload Exactly one of universitySlug / universityName / newUniversity.
 * @returns {Promise<{ reviewId: string, universitySlug: string, universityCreated: boolean }>}
 */
export const submitReview = async (payload) => {
  const { data, error } = await supabase.functions.invoke('review-submit', { body: payload })
  if (error) {
    const msg = await parseFunctionError(error)
    throw new Error(msg)
  }
  return data
}
