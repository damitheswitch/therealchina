import { useEffect, useRef } from 'react'
import { SITE } from '../../lib/seo/site'
import { describeMissing, type RewardMissing } from '../../lib/reviewReward'

// Shown to signed-in reviewers when they press Publish while the gift offer is
// on. They type no email: the steps go to their sign-up address. Same
// accessibility pattern as ConfirmDialog (role=dialog, aria-modal, initial
// focus, Tab trap, Escape closes). Never opens on page load.
export const RewardEmailNotice = ({
  email,
  full,
  missing,
  onChoose,
  onClose,
}: {
  email: string
  full: boolean
  missing: RewardMissing[]
  onChoose: (wantsGift: boolean) => void
  onClose: () => void
}) => {
  const primaryRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    primaryRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
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

  return (
    <div className="auth-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="auth-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reward-notice-title"
        aria-describedby="reward-notice-body"
        onKeyDown={handleKeyDown}
      >
        <div className="auth-modal-header">
          <h2 id="reward-notice-title">Your free VPN gift</h2>
          <p id="reward-notice-body" className="auth-modal-subtitle">
            {full
              ? `We will send the steps to your sign-up email: ${email}. You do not need to type anything.`
              : `Your review is not full yet. Add ${describeMissing(missing)} and we will send the steps to ${email} as soon as it is full.`}
          </p>
          <p className="auth-modal-subtitle">Need help? Write to {SITE.contactEmail}.</p>
        </div>

        <div className="auth-modal-actions" style={{ display: 'flex', gap: '.5rem' }}>
          <button type="button" className="btn btn-ghost" onClick={() => onChoose(false)}>
            Publish without the gift
          </button>
          <button
            ref={primaryRef}
            type="button"
            className="btn btn-primary"
            onClick={() => onChoose(true)}
          >
            Publish and send my gift
          </button>
        </div>
      </div>
    </div>
  )
}
