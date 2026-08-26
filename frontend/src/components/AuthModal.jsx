import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Icons } from './Icons'

// AuthModal component - Login/Register modal with createPortal mounting
export const AuthModal = ({ isOpen, onClose, initialMode = 'login' }) => {
  const { signIn, signUp, signInWithGoogle, user } = useAuth()
  const { showToast } = useToast()
  const [mode, setMode] = useState(initialMode) // 'login' or 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Never leave the password revealed the next time the modal opens
  useEffect(() => {
    if (!isOpen) setShowPassword(false)
  }, [isOpen])

  // Never render for a signed-in user, no matter who opened the modal
  if (!isOpen || user) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      if (mode === 'login') {
        await signIn(email, password)
        showToast('Signed in successfully!', 'success')
      } else {
        await signUp(email, password, displayName)
        showToast('Account created! Please check your email to verify.', 'success')
      }
      onClose()
    } catch (error) {
      console.error('Auth error:', error)
      setErrorMsg(error.message || 'Authentication failed. Please check your credentials.')
      showToast(error.message || 'Authentication failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setErrorMsg('')
    try {
      await signInWithGoogle()
      // Browser will redirect to Google OAuth page
    } catch (error) {
      console.error('Google Sign-In error:', error)
      setErrorMsg(error.message || 'Google sign-in failed. Please try again.')
      showToast(error.message || 'Google sign-in failed', 'error')
      setGoogleLoading(false)
    }
  }

  const modalContent = (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="auth-modal-close"
          onClick={onClose}
          aria-label="Close modal"
        >
          ✕
        </button>

        <div className="auth-modal-header">
          <h2>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="auth-modal-subtitle">
            {mode === 'login'
              ? 'Sign in to access your reviews and profile'
              : 'Join the community to post authentic reviews'}
          </p>
        </div>

        <div className="auth-modal-tabs">
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setErrorMsg('')
            }}
            className={`auth-modal-tab ${mode === 'login' ? 'active' : ''}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register')
              setErrorMsg('')
            }}
            className={`auth-modal-tab ${mode === 'register' ? 'active' : ''}`}
          >
            Register
          </button>
        </div>

        {errorMsg && <div className="auth-modal-error">{errorMsg}</div>}

        <div className="social-auth-section">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="btn btn-google w-full"
          >
            <Icons.Google size={20} />
            <span>{googleLoading ? 'Redirecting to Google...' : 'Continue with Google'}</span>
          </button>
        </div>

        <div className="auth-divider">
          <span>or continue with email</span>
        </div>

        <form onSubmit={handleSubmit} className="auth-modal-form">
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Display Name / Pseudonym</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex (Shanghai Uni)"
                className="form-input"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="form-input"
                required
                minLength={6}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
              </button>
            </div>
          </div>

          <div className="auth-modal-actions">
            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

