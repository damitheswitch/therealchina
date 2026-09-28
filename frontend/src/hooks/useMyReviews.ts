import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { listAnonymousOwnedIds, mergeMyReviews } from '../lib/reviewClaim'
import type { EditableReview } from '../lib/reviewEdit'

// Same column list as useMemberProfileData (kept as one literal so supabase-js
// infers the row shape), plus the university join for display labels.
const MY_REVIEW_COLUMNS =
  'id, university_id, user_id, rating, text, program, degree_level, media, created_at, updated_at, deleted_at, enrollment_status, start_year, end_year, language_of_instruction, tuition_range, living_cost_range, funding_type, funding_coverage, recommend, pros, cons, tags, rating_academics, rating_campus, rating_accommodation, rating_cost, rating_intl_office, rating_social, rating_extracurricular, rating_career, universities(name, city, slug)'

// The signed-in user's own reviews, newest first — plus reviews they claimed
// anonymously: those keep user_id NULL publicly (the private
// reviewer_context.owner_id link lists their ids), so they're fetched by id
// through the ordinary public read and merged in. Soft-deleted rows are
// hidden by RLS; the explicit filter documents the intent anyway.
export const useMyReviews = () => {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [reviews, setReviews] = useState<EditableReview[]>([])
  const [loading, setLoading] = useState<boolean>(!!userId)
  const [error, setError] = useState<Error | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  const refetch = useCallback(() => setReloadTick((t) => t + 1), [])

  useEffect(() => {
    if (!userId) {
      setReviews([])
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: fetchError } = await supabase
          .from('reviews')
          .select(MY_REVIEW_COLUMNS)
          .eq('user_id', userId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .abortSignal(controller.signal)

        if (fetchError) throw fetchError
        const own = (data as unknown as EditableReview[] | null) || []

        // Anonymously-claimed reviews: their ids come from the private link
        // via review-claim; the rows themselves are read through the normal
        // public select. A failure here must not hide the owned list.
        let claimed: EditableReview[] = []
        try {
          const anonIds = await listAnonymousOwnedIds()
          if (anonIds.length > 0 && !controller.signal.aborted) {
            const { data: claimedRows, error: claimedError } = await supabase
              .from('reviews')
              .select(MY_REVIEW_COLUMNS)
              .in('id', anonIds)
              .is('deleted_at', null)
              .abortSignal(controller.signal)
            if (claimedError) throw claimedError
            claimed = (claimedRows as unknown as EditableReview[] | null) || []
          }
        } catch (err) {
          const e = err as { name?: string; message?: string }
          if (e?.name === 'AbortError' || e?.message?.startsWith('AbortError')) return
          console.error('Error fetching anonymously-claimed reviews:', err)
        }

        setReviews(mergeMyReviews(own, claimed))
      } catch (err) {
        const e = err as { name?: string; message?: string }
        if (e?.name === 'AbortError' || e?.message?.startsWith('AbortError')) return
        console.error('Error fetching my reviews:', err)
        setError(err as Error)
        setReviews([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    run()
    return () => controller.abort()
  }, [userId, reloadTick])

  return { reviews, loading, error, refetch }
}
