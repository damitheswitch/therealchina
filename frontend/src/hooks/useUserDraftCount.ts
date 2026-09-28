import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { countReviewDrafts } from '../lib/reviewDrafts'

export const useUserDraftCount = () => {
  const { user } = useAuth()
  const [count, setCount] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)

  const refetch = useCallback(() => setReloadTick((t) => t + 1), [])

  useEffect(() => {
    if (!user?.id) {
      setCount(0)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const run = async () => {
      setLoading(true)
      try {
        const c = await countReviewDrafts(user.id)
        if (!controller.signal.aborted) setCount(c)
      } catch (err) {
        if (controller.signal.aborted) return
        console.error('Error counting review drafts:', err)
        setCount(0)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    run()
    return () => controller.abort()
  }, [user?.id, reloadTick])

  return { count, loading, refetch }
}
