import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { AuthModal } from './AuthModal'

// RegistrationNudge component - dismissible banner shown once per session
export const RegistrationNudge = () => {
  const { user, loading } = useAuth()
  const [visible, setVisible] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  useEffect(() => {
    // Wait for the session to load and never nudge signed-in users
    if (loading || user) return
    // Check if nudge has been shown this session
    const nudgeShown = sessionStorage.getItem('trc_nudge_shown')
    if (!nudgeShown) {
      // Show after a short delay
      const timer = setTimeout(() => setVisible(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [loading, user])

  // Hide the nudge if the user signs in while it's on screen
  useEffect(() => {
    if (user) {
      setVisible(false)
      setAuthModalOpen(false)
    }
  }, [user])

  const handleDismiss = () => {
    setVisible(false)
    sessionStorage.setItem('trc_nudge_shown', 'true')
  }

  const handleSignUp = () => {
    // Dismiss the nudge and open the auth modal on the Register tab
    setVisible(false)
    sessionStorage.setItem('trc_nudge_shown', 'true')
    setAuthModalOpen(true)
  }

  return (
    <>
      {visible && (
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
            aria-label="Dismiss sign up reminder"
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
          <button
            onClick={handleSignUp}
            className="btn btn-outline"
            style={{ color: '#fff', borderColor: '#fff' }}
          >
            Sign Up
          </button>
        </div>
      )}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} initialMode="register" />
    </>
  )
}
