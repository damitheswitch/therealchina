import { useEffect, useRef } from 'react'

// Generic confirm modal for destructive / hard-to-undo actions. Shares the
// auth-modal styling and accessibility pattern: role="dialog", aria-modal,
// initial focus, Tab focus trap, Escape to cancel, backdrop click cancels.
// Focus lands on the safe (cancel) action by default — confirming a
// destructive action should never be the passive choice.
export const ConfirmDialog = ({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  busy = false,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  // Keep Tab cycling inside the dialog; Escape cancels.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (!busy) onCancel()
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
    <div
      className="auth-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && !busy && onCancel()}
    >
      <div
        ref={dialogRef}
        className="auth-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
        onKeyDown={handleKeyDown}
      >
        <div className="auth-modal-header">
          <h2 id="confirm-dialog-title">{title}</h2>
          <p id="confirm-dialog-body" className="auth-modal-subtitle">
            {body}
          </p>
        </div>

        <div className="auth-modal-actions" style={{ display: 'flex', gap: '.5rem' }}>
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
