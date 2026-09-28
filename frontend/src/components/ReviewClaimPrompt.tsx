import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import {
  listClaimableReviews,
  resolveClaim,
  type ClaimableReview,
  type ClaimDecision,
} from '../lib/reviewClaim'
import { StarRating } from './StarRating'

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
        showToast('Added to your reviews. It stays anonymous publicly.', 'success')
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
          {items.map((item) => {
            const date = item.createdAt
              ? new Date(item.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'UTC',
                })
              : null
            const busy = busyId === item.reviewId
            return (
              <div key={item.reviewId} className="claim-review">
                <div className="claim-review-head">
                  <StarRating rating={item.rating} />
                  {date && <span className="muted">{date}</span>}
                </div>
                {item.universityName &&
                  (item.universitySlug ? (
                    <Link to={`/university/${item.universitySlug}/`} className="claim-review-uni">
                      {item.universityName}
                    </Link>
                  ) : (
                    <div className="claim-review-uni">{item.universityName}</div>
                  ))}
                <p className="claim-review-text">{item.text}</p>
                {item.matchedBy === 'email' && (
                  <p className="form-hint" style={{ marginTop: 0 }}>
                    Matched by the email you left on the review.
                  </p>
                )}
                <div className="claim-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyId !== null}
                    title="Your display name and the Verified seal show on it"
                    onClick={() => decide(item, 'named')}
                  >
                    {busy ? 'Claiming...' : 'Put my name on it'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={busyId !== null}
                    title="Saved to your account, publicly it stays Anonymous"
                    onClick={() => decide(item, 'anonymous')}
                  >
                    Keep it anonymous
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busyId !== null}
                    onClick={() => decide(item, 'not_mine')}
                  >
                    Not mine
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {error && <div className="auth-modal-error">{error}</div>}

        <p className="claim-caption muted">
          Your name earns the Verified seal. Anonymous claims still land in your account, they just
          stay nameless publicly.
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
