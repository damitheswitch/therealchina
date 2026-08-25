import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

// AuthModal component - Login/Register modal
export const AuthModal = ({ isOpen, onClose }) => {
  const { signIn, signUp } = useAuth()
  const { showToast } = useToast()
  const [mode, setMode] = useState('login') // 'login' or 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

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
      showToast(error.message || 'Authentication failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 'var(--r-md)',
          padding: 'var(--sp-4)',
          maxWidth: '400px',
          width: '90%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: 'var(--sp-2)' }}>
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </h2>

        <div style={{ display: 'flex', gap: 'var(--sp-1)', marginBottom: 'var(--sp-3)' }}>
          <button
            onClick={() => setMode('login')}
            className={`btn ${mode === 'login' ? 'btn-primary' : 'btn-outline'}`}
          >
            Login
          </button>
          <button
            onClick={() => setMode('register')}
            className={`btn ${mode === 'register' ? 'btn-primary' : 'btn-outline'}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="form-input"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              className="form-input"
              required
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-1)' }}>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
