import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { SITE } from '../../lib/seo/site'

export type RewardMissing = 'words' | 'taps' | 'ratings' | 'money' | 'program'

const FIX_LABELS: Record<RewardMissing, string> = {
  words: 'Write a few words of your own',
  taps: 'Tap 2 rows in What stood out',
  ratings: 'Give the quick ratings',
  money: 'Add the cost',
  program: 'Add your major',
}

// Shown to signed-in reviewers when they press Publish while the gift offer is
// on. They type no email: the steps go to their sign-up address. Same
// accessibility pattern as ConfirmDialog (role=dialog, aria-modal, initial
// focus, Tab trap, Escape closes). Never opens on page load.
export const RewardEmailNotice = ({
  email,
  full,
  missing,
  onFix,
  onChoose,
  onClose,
}: {
  email: string
  full: boolean
  missing: RewardMissing[]
  onFix: (item: RewardMissing) => void
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

  const finishItem = missing[0]

  return (
    <div
      className="gift-dialog-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        className="gift-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reward-notice-title"
        aria-describedby="reward-notice-body"
        onKeyDown={handleKeyDown}
      >
        <div className="gift-dialog-header">
          <span className="gift-dialog-icon" aria-hidden="true">
            {full ? '🎁' : '🧧'}
          </span>
          <h2 id="reward-notice-title" className="gift-dialog-title">
            {full ? 'Your free VPN gift is ready' : 'Almost there'}
          </h2>
        </div>

        <div className="gift-dialog-body">
          <p id="reward-notice-body" className="gift-dialog-lead">
            {full
              ? `We send the steps to ${email} and show you how to claim it after you post.`
              : 'Finish these and your free VPN is yours:'}
          </p>

          {!full && finishItem && (
            <ul className="gift-dialog-list">
              {missing.map((item) => (
                <li key={item}>
                  <button type="button" className="gift-dialog-row" onClick={() => onFix(item)}>
                    <span className="gift-dialog-row-label">{FIX_LABELS[item]}</span>
                    <span className="gift-dialog-row-chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="gift-dialog-actions">
          {full || !finishItem ? (
            <button
              ref={primaryRef}
              type="button"
              className="gift-dialog-btn gift-dialog-btn-primary"
              onClick={() => onChoose(true)}
            >
              Post and get my gift
            </button>
          ) : (
            <button
              ref={primaryRef}
              type="button"
              className="gift-dialog-btn gift-dialog-btn-primary"
              onClick={() => onFix(finishItem)}
            >
              Finish my gift
            </button>
          )}
          <button
            type="button"
            className="gift-dialog-btn gift-dialog-btn-secondary"
            onClick={() => onChoose(false)}
          >
            Post without the gift
          </button>
        </div>

        <div className="fine-print gift-dialog-fine">
          <p>
            One gift per person. Same gift for good or bad reviews.{' '}
            <Link className="fine-print-link" to="/editorial-policy#gifts">
              How gifts work
            </Link>
          </p>
          <p>
            Questions?{' '}
            <a className="fine-print-link" href={`mailto:${SITE.contactEmail}`}>
              {SITE.contactEmail}
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
