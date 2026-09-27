import { supabase } from './supabaseClient'
import { parseFunctionError } from './mediaUpload'
import type { ReviewPayload } from './reviewSubmit'

// Editable subset of the submission payload: everything except the fields an
// edit can never change (which university the review is for) and the
// anonymous-only fields (Turnstile token, reviewer context).
export type ReviewEditPayload = Pick<
  ReviewPayload,
  | 'rating'
  | 'text'
  | 'program'
  | 'degreeLevel'
  | 'media'
  | 'subscores'
  | 'enrollmentStatus'
  | 'startYear'
  | 'endYear'
  | 'languageOfInstruction'
  | 'tuitionRange'
  | 'livingCostRange'
  | 'fundingType'
  | 'fundingCoverage'
  | 'recommend'
  | 'pros'
  | 'cons'
  | 'tags'
>

export const updateReview = async (reviewId: string, fields: ReviewEditPayload): Promise<void> => {
  const { error } = await supabase.functions.invoke('review-manage', {
    body: { action: 'update', reviewId, ...fields },
  })
  if (error) {
    const msg = await parseFunctionError(error)
    throw new Error(msg)
  }
}

export const deleteReview = async (reviewId: string): Promise<void> => {
  const { error } = await supabase.functions.invoke('review-manage', {
    body: { action: 'delete', reviewId },
  })
  if (error) {
    const msg = await parseFunctionError(error)
    throw new Error(msg)
  }
}
