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
    setValues((v) => {
      // A direct write is deliberate: drop inference ownership so smart
      // defaults can never roll the value back.
      let inferred = v.inferred
      if (inferred.has(key)) {
        const next = new Set(inferred)
        next.delete(key)
        inferred = next
      }
      return { ...v, [key]: value, inferred }
    })
  }, [])

  const applyValues = useCallback(
    (
      partial: Partial<ReviewFieldValues> | ((v: ReviewFieldValues) => Partial<ReviewFieldValues>)
    ) => {
      setValues((v) => {
        const patch = typeof partial === 'function' ? partial(v) : partial
        // Helper patches carry their own provenance set; a plain partial is
        // deliberate input, so any flags on the keys it writes are dropped.
        let inferred = v.inferred
        if ('inferred' in patch) {
          inferred = patch.inferred ?? v.inferred
        } else if (Object.keys(patch).some((k) => v.inferred.has(k))) {
          const next = new Set(v.inferred)
          for (const k of Object.keys(patch)) next.delete(k)
          inferred = next
        }
        return { ...v, ...patch, inferred }
      })
    },
    []
  )

  return useMemo(() => ({ values, set, applyValues }), [values, set, applyValues])
}
