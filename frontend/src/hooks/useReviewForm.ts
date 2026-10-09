import { useCallback, useMemo, useState } from 'react'
import { emptyReviewFieldValues, type ReviewFieldValues } from '../lib/reviewFlow'

export type ReviewFormSet = <K extends keyof ReviewFieldValues>(
  key: K,
  value: ReviewFieldValues[K]
) => void

export interface ReviewForm {
  values: ReviewFieldValues
  set: ReviewFormSet
  // Merges a partial. Also accepts an updater `(current) => partial` for
  // fills that must read the latest state (prefills, draft rehydration).
  applyValues: (
    partial: Partial<ReviewFieldValues> | ((v: ReviewFieldValues) => Partial<ReviewFieldValues>)
  ) => void
}

// All writable review fields in one state object, shared by the 2-screen
// publish flow, the post-publish Boost cards, and the one-page edit form.
// Screens and cards read `form.values` and write through `form.set`, so a
// Boost save and an edit save always serialize the same shape.
export const useReviewForm = (initial?: Partial<ReviewFieldValues>): ReviewForm => {
  const [values, setValues] = useState<ReviewFieldValues>(() => ({
    ...emptyReviewFieldValues,
    ...initial,
  }))

  const set = useCallback<ReviewFormSet>((key, value) => {
    setValues((v) => ({ ...v, [key]: value }))
  }, [])

  const applyValues = useCallback(
    (
      partial: Partial<ReviewFieldValues> | ((v: ReviewFieldValues) => Partial<ReviewFieldValues>)
    ) => {
      setValues((v) => ({ ...v, ...(typeof partial === 'function' ? partial(v) : partial) }))
    },
    []
  )

  return useMemo(() => ({ values, set, applyValues }), [values, set, applyValues])
}
