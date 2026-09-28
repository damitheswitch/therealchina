import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { listReviewDrafts, deleteReviewDraft, type ReviewDraft } from '../lib/reviewDrafts'

export const useReviewDrafts = () => {
  const { user } = useAuth()
  const [drafts, setDrafts] = useState<ReviewDraft[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  const refetch = useCallback(() => setReloadTick((t) => t + 1), [])

  useEffect(() => {
    if (!user?.id) {
      setDrafts([])
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const rows = await listReviewDrafts(user.id)
        if (!controller.signal.aborted) {
          setDrafts(rows)
        }
      } catch (err) {
        if (controller.signal.aborted) return
        console.error('Error loading review drafts:', err)
        setError(err as Error)
        setDrafts([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    run()
    return () => controller.abort()
  }, [user?.id, reloadTick])

  const removeDraft = useCallback(
    async (draftId: string) => {
      if (!user?.id) return
      await deleteReviewDraft(draftId, user.id)
      refetch()
    },
    [user, refetch]
  )

  return { drafts, loading, error, refetch, removeDraft }
}
