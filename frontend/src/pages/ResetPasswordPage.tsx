import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useAuthModal } from '../contexts/AuthModalContext'
import { useToast } from '../contexts/ToastContext'
import { parseRecoveryHash, RESET_PATH } from '../lib/passwordReset'
import { Icons } from '../components/Icons'
import { Seo } from '../components/Seo'

type Mode = 'request' | 'sent' | 'reset'

// /reset-password — landing page for Supabase recovery emails (served via the
// app.html shell, noindex by policy). Recovery links carry the session in the
// URL fragment; supabase-js consumes it and emits PASSWORD_RECOVERY, which
// AuthContext surfaces as `passwordRecovery`. Visitors without a token get
// the request-a-link form, which doubles as the standalone forgot-password page.
export const ResetPasswordPage = () => {
  const { user, loading, passwordRecovery, resetPassword, updatePassword } = useAuth()
  const { openAuthModal } = useAuthModal()
  const { showToast } = useToast()
  const navigate = useNavigate()

  // Read the fragment once at mount — supabase-js strips auth params from the
  // URL while it processes them, so later reads would see a clean location.
  const [linkState] = useState(() =>
    typeof window === 'undefined'
      ? { recovery: false, error: null }
      : parseRecoveryHash(window.location.hash)
  )
  const [mode, setMode] = useState<Mode>(linkState.recovery ? 'reset' : 'request')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [busy, setBusy] = useState(false)

  // PASSWORD_RECOVERY is emitted on a timer after client init, so it can land
  // after this page mounts — promote to reset mode whenever it arrives.
  useEffect(() => {
    if (passwordRecovery) setMode('reset')
  }, [passwordRecovery])

  // Prefill the request form for a signed-in visitor who came here directly.
  useEffect(() => {
    if (user?.email) setEmail((prev) => prev || user.email || '')
  }, [user])

  const handleRequest = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErrorMsg('')
    try {
      await resetPassword(email)
      setMode('sent')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not send the reset email.')
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (password !== confirm) {
      setErrorMsg("Passwords don't match.")
      return
    }
    setBusy(true)
    try {
      await updatePassword(password)
      showToast('Password updated. You are signed in.', 'success')
      navigate('/', { replace: true })
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Could not update the password. Request a new link below.'
      )
      setBusy(false)
    }
  }

  return (
    <div className="container auth-page">
      <Seo path={RESET_PATH} title="Reset your password" index={false} />
      <div className="auth-page-card">
        {mode === 'sent' ? (
          <>
            <h1>Check your inbox</h1>
            <p className="auth-page-copy">
              If <strong>{email}</strong> matches an account, a reset link is on its way. Open it on
              this device to choose a new password.
            </p>
            <p className="form-hint">
              Nothing arrived? Check spam, or{' '}
              <button type="button" className="auth-link-button" onClick={() => setMode('request')}>
                try a different email
              </button>
              .
            </p>
          </>
        ) : mode === 'reset' ? (
          <>
            <h1>Choose a new password</h1>
            <p className="auth-page-copy">Set a new password for your account.</p>

            {linkState.error && <div className="auth-modal-error">{linkState.error}</div>}
            {errorMsg && <div className="auth-modal-error">{errorMsg}</div>}

            <form onSubmit={handleReset} className="auth-modal-form">
              <div className="form-group">
                <label className="form-label" htmlFor="reset-password">
                  New password
                </label>
                <div className="password-field">
                  <input
                    id="reset-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="form-input"
                    required
                    minLength={6}
                    autoComplete="new-password"
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

              <div className="form-group">
                <label className="form-label" htmlFor="reset-password-confirm">
                  Confirm new password
                </label>
                <input
                  id="reset-password-confirm"
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat the new password"
                  className="form-input"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>

              <div className="auth-modal-actions">
                <button type="submit" disabled={busy || loading} className="btn btn-primary w-full">
                  {busy ? 'Updating...' : 'Set new password'}
                </button>
              </div>
            </form>

            <p className="form-hint auth-page-foot">
              Link expired or broken?{' '}
              <button
                type="button"
                className="auth-link-button"
                onClick={() => {
                  setMode('request')
                  setErrorMsg('')
                }}
              >
                Request a new one
              </button>
            </p>
          </>
        ) : (
          <>
            <h1>Reset your password</h1>
            <p className="auth-page-copy">
              Enter the email on your account and we&apos;ll send you a link to set a new password.
            </p>

            {linkState.error && <div className="auth-modal-error">{linkState.error}</div>}
            {errorMsg && <div className="auth-modal-error">{errorMsg}</div>}

            <form onSubmit={handleRequest} className="auth-modal-form">
              <div className="form-group">
                <label className="form-label" htmlFor="reset-request-email">
                  Email Address
                </label>
                <input
                  id="reset-request-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="form-input"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="auth-modal-actions">
                <button type="submit" disabled={busy} className="btn btn-primary w-full">
                  {busy ? 'Sending...' : 'Send reset link'}
                </button>
              </div>
            </form>

            <p className="form-hint auth-page-foot">
              {!user && (
                <>
                  Remembered it?{' '}
                  <button
                    type="button"
                    className="auth-link-button"
                    onClick={() => openAuthModal('login')}
                  >
                    Sign in
                  </button>
                  <span aria-hidden="true"> · </span>
                </>
              )}
              <Link to="/" className="auth-page-home">
                <Icons.ArrowLeft /> Back to the site
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
