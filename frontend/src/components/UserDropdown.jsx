import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { SealAvatar } from './SealAvatar'
import { Icons } from './Icons'
import { useAuth } from '../contexts/AuthContext'
import { useAuthModal } from '../contexts/AuthModalContext'

// UserDropdown component - Dropdown menu in header with user avatar
export const UserDropdown = () => {
  const { user, signOut, loading } = useAuth()
  const { openAuthModal } = useAuthModal()
  const [isOpen, setIsOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const dropdownRef = useRef(null)

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSignOut = async () => {
    try {
      await signOut()
      setIsOpen(false)
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const handleInstall = async () => {
    if (!installPrompt) return

    setIsOpen(false)
    installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  if (loading) return null

  const displayName = user?.user_metadata?.display_name || user?.email

  return (
    <div className="user-dropdown" ref={dropdownRef}>
      <button
        className="user-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={user ? 'User menu' : 'Menu'}
        aria-expanded={isOpen}
      >
        {user ? (
          <SealAvatar displayName={displayName} size={36} />
        ) : (
          <Icons.User size={36} />
        )}
      </button>

      {isOpen && (
        <div className="user-dropdown-menu">
          {user ? (
            <div className="user-dropdown-header">
              <SealAvatar displayName={displayName} size={48} />
              <div className="user-dropdown-info">
                <div className="user-dropdown-name">{displayName}</div>
                <div className="user-dropdown-email">{user.email}</div>
              </div>
            </div>
          ) : (
            <div className="user-dropdown-header">
              <Icons.User size={48} />
              <div className="user-dropdown-info">
                <div className="user-dropdown-name">Welcome</div>
                <div className="user-dropdown-email">Sign in or log in to continue</div>
                <div className="user-dropdown-guest-actions" style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setIsOpen(false)
                      openAuthModal('login')
                    }}
                  >
                    Sign in
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      setIsOpen(false)
                      openAuthModal('register')
                    }}
                  >
                    Register
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="user-dropdown-divider" />

          <div className="user-dropdown-actions">
            <Link
              to="/flights?post=1"
              className="user-dropdown-item user-dropdown-cta"
              onClick={() => setIsOpen(false)}
            >
              <Icons.Plane />
              <span>Post Your Flight</span>
            </Link>

            <Link
              to="/profile"
              className="user-dropdown-item"
              onClick={() => setIsOpen(false)}
            >
              <Icons.User />
              <span>My Profile</span>
            </Link>

            <Link
              to="/review"
              className="user-dropdown-item"
              onClick={() => setIsOpen(false)}
            >
              <Icons.Pen />
              <span>Leave a Review</span>
            </Link>

            <Link
              to="/users"
              className="user-dropdown-item"
              onClick={() => setIsOpen(false)}
            >
              <Icons.Users />
              <span>User Directory</span>
            </Link>

            {installPrompt && (
              <button className="user-dropdown-item" onClick={handleInstall}>
                <Icons.Download />
                <span>Install app</span>
              </button>
            )}

            {user && (
              <>
                <div className="user-dropdown-divider" />
                <button
                  className="user-dropdown-item user-dropdown-logout"
                  onClick={handleSignOut}
                >
                  <Icons.ArrowLeft />
                  <span>Sign out</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
