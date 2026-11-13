import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import {
  listClaimableReviews,
  resolveClaim,
  type ClaimableReview,
  type ClaimDecision,
} from '../lib/reviewClaim'
import { ClaimReviewCard } from './ClaimReviewCard'

// ReviewClaimPrompt — after a sign-in, offers reviews the account holder left
// anonymously (matched by this browser's claim token or by the verified
// account email). Each review gets its own choice: name on it, anonymous
// claim, or "not mine". Skipped reviews stay claimable — the prompt returns
// next session.
//
// Mounted once at app level; renders nothing unless there is something to
// decide. Never runs during prerender (auth starts loading, no user).
const CHECKED_KEY = 'trc_claim_checked'

export const ReviewClaimPrompt = () => {
  const { user, loading } = useAuth()
  const { showToast } = useToast()
  const [items, setItems] = useState<ClaimableReview[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Look for claimable reviews once per session per account. The check runs
  // even without a browser token: the stored reviewer email is a second
  // matcher, which is what makes reviews written on another device findable.
  useEffect(() => {
    if (loading || !user) return
    try {
      if (sessionStorage.getItem(CHECKED_KEY) === user.id) return
      sessionStorage.setItem(CHECKED_KEY, user.id)
    } catch {
      // Storage blocked — check anyway; worst case the prompt re-appears.
    }
    const controller = new AbortController()
    const run = async () => {
      try {
        const found = await listClaimableReviews()
        if (!controller.signal.aborted && found.length > 0) setItems(found)
      } catch {
        // Best-effort prompt: a failure here must never break the app.
      }
    }
    run()
    return () => controller.abort()
  }, [user, loading])

  useEffect(() => {
    if (items && items.length > 0) dialogRef.current?.focus()
  }, [items])

  const close = () => setItems(null)

  // Tab cycles inside the dialog; Escape = "decide later".
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (!busyId) close()
      return
    }
    if (e.key !== 'Tab' || !dialogRef.current) return
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const decide = async (item: ClaimableReview, decision: ClaimDecision) => {
    setBusyId(item.reviewId)
    setError(null)
    try {
      await resolveClaim(item.reviewId, decision)
      if (decision === 'named') {
        showToast('Done. It now shows your name and the Verified seal.', 'success')
      } else if (decision === 'anonymous') {
        showToast(
          'Added to your reviews. It stays anonymous publicly, and you can put your name on it later.',
          'success'
        )
      }
      setItems((prev) => {
        const next = (prev ?? []).filter((r) => r.reviewId !== item.reviewId)
        return next.length > 0 ? next : null
      })
    } catch (err) {
      console.error('Claim resolve failed:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  if (!items || items.length === 0 || !user) return null

  const title =
    items.length === 1 ? 'Is this review yours?' : `Are these ${items.length} reviews yours?`

  const modal = (
    <div
      className="auth-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busyId) close()
      }}
    >
      <div
        ref={dialogRef}
        className="auth-modal-content claim-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-prompt-title"
        aria-describedby="claim-prompt-sub"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="auth-modal-header">
          <h2 id="claim-prompt-title">{title}</h2>
          <p id="claim-prompt-sub" className="auth-modal-subtitle">
            You posted before signing in, so it&apos;s already live. Claim it to manage it from your
            profile: under your name, or anonymously.
          </p>
        </div>

        <div className="claim-list">
          {items.map((item) => (
            <ClaimReviewCard
              key={item.reviewId}
              item={item}
              busy={busyId === item.reviewId}
              disabled={busyId !== null}
              onDecide={(decision) => decide(item, decision)}
            />
          ))}
        </div>

        {error && <div className="auth-modal-error">{error}</div>}

        <p className="claim-caption muted">
          Your name earns the Verified seal. Anonymous claims still land in your account, they just
          stay nameless publicly. You can put your name on one anytime from My reviews.
        </p>

        <div className="auth-modal-actions">
          <button type="button" className="btn btn-ghost" disabled={!!busyId} onClick={close}>
            Decide later
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
