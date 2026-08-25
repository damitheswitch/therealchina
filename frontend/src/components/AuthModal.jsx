import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

// AuthModal component - Login/Register modal with createPortal mounting
export const AuthModal = ({ isOpen, onClose }) => {
  const { signIn, signUp } = useAuth()
  const { showToast } = useToast()
  const [mode, setMode] = useState('login') // 'login' or 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)

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

  if (!isOpen) return null

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
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="form-input"
              required
              minLength={6}
            />
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

