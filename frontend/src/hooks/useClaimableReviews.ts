import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { listClaimableReviews, type ClaimableReview } from '../lib/reviewClaim'

// Reviews the signed-in user posted before signing in (matched by this
// browser's claim token or the verified account email) and hasn't claimed yet.
export const useClaimableReviews = () => {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [items, setItems] = useState<ClaimableReview[]>([])
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    if (!userId) {
      setItems([])
      return
    }
    let active = true
    listClaimableReviews()
      .then((found) => {
        if (active) setItems(found)
      })
      .catch((err) => {
        // Best-effort section: hide it rather than break the profile.
        if (active) setItems([])
        console.error('Error fetching claimable reviews:', err)
      })
    return () => {
      active = false
    }
  }, [userId, reloadTick])

  const remove = useCallback(
    (reviewId: string) => setItems((prev) => prev.filter((r) => r.reviewId !== reviewId)),
    []
  )
  const refetch = useCallback(() => setReloadTick((t) => t + 1), [])

  return { items, remove, refetch }
}
