import { useEffect, useRef } from 'react'

export interface ProfileSaveItem {
  label: string
  value: string
}

// Shown after a logged-in user's first successful review when the wizard
// collected "about you" answers the profile doesn't have yet. Saving is
// opt-in — declining just means the profile keeps its current values.
export const ProfileSavePrompt = ({
  items,
  saving,
  onSave,
  onSkip,
}: {
  items: ProfileSaveItem[]
  saving: boolean
  onSave: () => void
  onSkip: () => void
}) => {
  const saveRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    saveRef.current?.focus()
  }, [])

  // Keep Tab cycling inside the dialog; Escape declines.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onSkip()
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
    <div className="auth-modal-overlay" onClick={(e) => e.target === e.currentTarget && onSkip()}>
      <div
        ref={dialogRef}
        className="auth-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-save-title"
        onKeyDown={handleKeyDown}
      >
        <div className="auth-modal-header">
          <h2 id="profile-save-title">Save this to your profile?</h2>
          <p className="auth-modal-subtitle">
            One tap and your profile remembers this — no need to fill it in twice.
          </p>
        </div>

        <div className="chip-row" style={{ marginBottom: 'var(--sp-3)' }}>
          {items.map((item) => (
            <span key={item.label} className="chip selected">
              {item.label}: {item.value}
            </span>
          ))}
        </div>

        <div className="auth-modal-actions" style={{ display: 'flex', gap: '.5rem' }}>
          <button
            ref={saveRef}
            type="button"
            className="btn btn-primary"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Yes, save it'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onSkip} disabled={saving}>
            No thanks
          </button>
        </div>
        <span className="form-hint" style={{ display: 'block', marginTop: 'var(--sp-2)' }}>
          You can always review or change these in your profile.
        </span>
      </div>
    </div>
  )
}
