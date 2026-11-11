import { supabase } from './supabaseClient'
import { parseFunctionError } from './mediaUpload'
import { getBoostToken } from './reviewClaim'
import type { SubScores } from './reviewSubmit'
import type { RewardResult } from './reviewReward'

// Anonymous post-publish Boost (Phase 3). The caller sends the per-review
// capability minted at submit time; the review-boost Edge Function validates
// the fields and applies the update atomically via apply_anonymous_boost.
// Only the fields listed here are ever sendable — anything else is rejected.
export interface BoostFields {
  // Own words only (065): lets a guest finish the gift after publishing.
  text?: string
  program?: string | null
  degreeLevel?: string | null
  subscores?: SubScores
  enrollmentStatus?: string | null
  startYear?: number | null
  endYear?: number | null
  languageOfInstruction?: string | null
  tuitionRange?: string | null
  livingCostRange?: string | null
  fundingType?: string | null
  fundingCoverage?: string | null
  pros?: string | null
  cons?: string | null
}

export const boostReview = async (
  reviewId: string,
  fields: BoostFields
): Promise<RewardResult | undefined> => {
  const boostToken = getBoostToken(reviewId)
  if (!boostToken) {
    throw new Error("This review can't be edited from this device.")
  }
  const { data, error } = await supabase.functions.invoke('review-boost', {
    body: { reviewId, boostToken, fields },
  })
  if (error) {
    throw new Error(await parseFunctionError(error))
  }
  return (data as { reward?: RewardResult } | null)?.reward
}
