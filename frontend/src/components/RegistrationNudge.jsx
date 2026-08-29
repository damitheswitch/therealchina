import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useAuthModal } from '../contexts/AuthModalContext'

// RegistrationNudge component - dismissible banner shown once per session
export const RegistrationNudge = () => {
  const { user, loading } = useAuth()
  const { openAuthModal, closeAuthModal } = useAuthModal()
  const [visible, setVisible] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

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
      closeAuthModal()
    }
  }, [user, closeAuthModal])

  const handleDismiss = () => {
    setVisible(false)
    sessionStorage.setItem('trc_nudge_shown', 'true')
  }

  const handleSignUp = () => {
    setVisible(false)
    sessionStorage.setItem('trc_nudge_shown', 'true')
    openAuthModal('register')
  }

  const handleInstall = async () => {
    if (!installPrompt) return
    setVisible(false)
    sessionStorage.setItem('trc_nudge_shown', 'true')
    installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
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
            aria-label="Dismiss reminder"
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
          <h4 style={{ marginBottom: 'var(--sp-1)' }}>
            {installPrompt ? 'Add The Real China to your home screen' : 'Create a free account'}
          </h4>
          <p style={{ marginBottom: 'var(--sp-2)', fontSize: '0.9rem' }}>
            {installPrompt
              ? 'Get a faster, app-like experience and keep access to reviews on the go.'
              : 'Sign up to upvote reviews, leave comments, and connect with other students'}
          </p>
          <button
            onClick={installPrompt ? handleInstall : handleSignUp}
            className="btn btn-outline"
            style={{ color: '#fff', borderColor: '#fff' }}
          >
            {installPrompt ? 'Install App' : 'Sign Up'}
          </button>
        </div>
      )}
    </>
  )
}
