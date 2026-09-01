import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../lib/supabaseClient'
import { validateDisplayName } from '../lib/validateDisplayName'
import { Icons } from './Icons'
import { Logo } from './Logo'

// AuthModal component - Login/Register modal with createPortal mounting
export const AuthModal = ({ isOpen, onClose, initialMode = 'login', config = {} }) => {
  const { title, subtitle, closable = true } = config
  const { signIn, signUp, signInWithGoogle, user } = useAuth()
  const { showToast } = useToast()
  const [mode, setMode] = useState(initialMode) // 'login' or 'register'
  const [verificationSent, setVerificationSent] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [displayNameError, setDisplayNameError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Reset mode and form to the requested initial state whenever the modal re-opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode)
      setVerificationSent(false)
      setEmail('')
      setPassword('')
      setDisplayName('')
      setDisplayNameError('')
      setErrorMsg('')
      setShowPassword(false)
    }
  }, [isOpen, initialMode])

  const canClose = closable

  // Close on Escape key when the modal is closable, but force the user to use the X while the verification notice is showing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && canClose && !verificationSent) onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, verificationSent, canClose])

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
    setDisplayNameError('')

    try {
      if (mode === 'login') {
        await signIn(email, password)
        showToast('Signed in successfully!', 'success')
        if (canClose) onClose()
        return
      }

      const { valid, error, normalized } = validateDisplayName(displayName)
      if (!valid) {
        setDisplayNameError(error)
        return
      }

      try {
        const escaped = normalized.replace(/([%_\\])/g, '\\$1')
        const { count, error: preflightError } = await supabase
          .from('profile_public')
          .select('id', { count: 'exact', head: true })
          .ilike('display_name', escaped)

        if (preflightError) throw preflightError
        if (count > 0) {
          setDisplayNameError('That display name is already taken.')
          return
        }
      } catch (preflightError) {
        console.warn('Display name pre-flight check failed:', preflightError)
      }

      await signUp(email, password, normalized)
      setVerificationSent(true)
    } catch (error) {
      console.error('Auth error:', error)
      const message = error?.message || ''
      if (error?.code === '23505' || message.toLowerCase().includes('duplicate key')) {
        setDisplayNameError('That display name is already taken.')
      } else if (message.toLowerCase().includes('display name')) {
        setDisplayNameError(message)
      } else {
        setErrorMsg(message || 'Authentication failed. Please check your credentials.')
        showToast(message || 'Authentication failed', 'error')
      }
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
    <div
      className="auth-modal-overlay"
      onClick={canClose && !verificationSent ? onClose : undefined}
    >
      <div
        className={`auth-modal-content ${verificationSent ? 'verification' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {canClose && (
          <button
            type="button"
            className="auth-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        )}

        {verificationSent ? (
          <div className="auth-modal-verification">
            <div className="verification-brand">
              <Logo size={96} />
              <h2 className="verification-title">Check your inbox</h2>
              <p className="verification-subtitle">The Real China</p>
            </div>
            <p className="verification-message">
              We&apos;ve sent a verification link to <strong>{email}</strong>. Please check your
              email and click the link to activate your account.
            </p>
            <p className="verification-help">
              Didn&apos;t receive it? Check your spam or junk folder, or make sure the address above
              is correct.
            </p>
            {canClose && (
              <p className="verification-close-hint">
                Click the <span aria-hidden="true">✕</span> in the top-right corner when you&apos;re
                ready.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="auth-modal-header">
              <h2>{title || (mode === 'login' ? 'Welcome Back' : 'Create Account')}</h2>
              <p className="auth-modal-subtitle">
                {subtitle ||
                  (mode === 'login'
                    ? 'Sign in to access your reviews and profile'
                    : 'Join the community to post authentic reviews')}
              </p>
            </div>

            <div className="auth-modal-tabs">
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setErrorMsg('')
                  setDisplayNameError('')
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
                  setDisplayNameError('')
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
                    onChange={(e) => {
                      setDisplayName(e.target.value)
                      setDisplayNameError(validateDisplayName(e.target.value).error || '')
                    }}
                    placeholder="e.g. Alex (Shanghai Uni)"
                    className="form-input"
                    required
                  />
                  {displayNameError && (
                    <p className="form-hint" style={{ color: 'var(--error)' }}>
                      {displayNameError}
                    </p>
                  )}
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
          </>
        )}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
