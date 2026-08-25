import { useState, useEffect } from 'react'

// RegistrationNudge component - dismissible banner shown once per session
export const RegistrationNudge = () => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Check if nudge has been shown this session
    const nudgeShown = sessionStorage.getItem('trc_nudge_shown')
    if (!nudgeShown) {
      // Show after a short delay
      setTimeout(() => setVisible(true), 2000)
    }
  }, [])

  const handleDismiss = () => {
    setVisible(false)
    sessionStorage.setItem('trc_nudge_shown', 'true')
  }

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'var(--sp-3)',
        right: 'var(--sp-3)',
        background: 'var(--seal-red)',
        color: '#fff',
        padding: 'var(--sp-3)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--shadow-card)',
        maxWidth: '400px',
        zIndex: 100,
      }}
    >
      <button
        onClick={handleDismiss}
        style={{
          position: 'absolute',
          top: 'var(--sp-1)',
          right: 'var(--sp-1)',
          background: 'none',
          border: 'none',
          color: '#fff',
          fontSize: '1.5rem',
          cursor: 'pointer',
          padding: '0.25rem 0.5rem',
        }}
      >
        ×
      </button>
      <h4 style={{ marginBottom: 'var(--sp-1)' }}>Create a free account</h4>
      <p style={{ marginBottom: 'var(--sp-2)', fontSize: '0.9rem' }}>
        Sign up to upvote reviews, leave comments, and connect with other students
      </p>
      <button className="btn btn-outline" style={{ color: '#fff', borderColor: '#fff' }}>
        Sign Up
      </button>
    </div>
  )
}
