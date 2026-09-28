import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import type { Json } from '../types/database.types'
import { loadLocalDraft, isDraftWorthSaving, type ReviewDraft } from '../lib/reviewDrafts'

// Returns the user's server draft for a university, or a local draft for an
// anonymous user whose saved slug matches. Used for gentle "finish your review"
// reminders on university pages.
export const useReviewDraftForUniversity = (
  universityId: string | undefined,
  universitySlug: string | undefined
) => {
  const { user } = useAuth()
  const [draft, setDraft] = useState<ReviewDraft | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!universityId || !universitySlug) {
      setDraft(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const run = async () => {
      setLoading(true)
      try {
        if (user?.id) {
          const { data, error } = await supabase
            .from('review_drafts')
            .select('id, user_id, university_id, payload, progress, created_at, updated_at')
            .eq('user_id', user.id)
            .eq('university_id', universityId)
            .abortSignal(controller.signal)
            .maybeSingle()
          if (error) throw error
          if (!controller.signal.aborted) {
            setDraft((data as ReviewDraft | null) ?? null)
          }
        } else {
          const local = loadLocalDraft()
          if (isDraftWorthSaving(local) && local?.selectedUni === universitySlug) {
            setDraft({
              id: 'local',
              user_id: '',
              university_id: universityId,
              payload: local as unknown as Json,
              progress: local.step,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as ReviewDraft)
          } else {
            setDraft(null)
          }
          if (!controller.signal.aborted) setLoading(false)
        }
      } catch (err) {
        if (controller.signal.aborted) return
        console.error('Error fetching draft for university:', err)
        setDraft(null)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    run()
    return () => controller.abort()
  }, [user?.id, universityId, universitySlug])

  return { draft, loading }
}
