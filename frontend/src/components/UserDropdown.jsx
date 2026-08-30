import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { SealAvatar } from './SealAvatar'
import { Icons } from './Icons'
import { useAuth } from '../contexts/AuthContext'
import { useAuthModal } from '../contexts/AuthModalContext'

// UserDropdown component - Dropdown menu in header with user avatar
export const UserDropdown = () => {
  const { user, signOut, loading } = useAuth()
  const { openAuthModal } = useAuthModal()
  const location = useLocation()
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

  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname, location.search])

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

  const isActive = (path) => location.pathname === path

  const displayName = user?.user_metadata?.display_name || user?.email

  const menuLinks = [
    { to: '/review', label: 'Leave a Review', icon: <Icons.Pen /> },
    { to: '/', label: 'Universities', icon: <Icons.Book /> },
    { to: '/flights?post=1', label: 'Get paid to fly', icon: <Icons.Plane />, active: '/flights' },
    { to: '/users', label: 'Our Community', icon: <Icons.Users /> },
  ]

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
                <div className="user-dropdown-email">Sign up or sign in to continue</div>
                <div className="user-dropdown-guest-actions" style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setIsOpen(false)
                      openAuthModal('register')
                    }}
                  >
                    Sign up
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      setIsOpen(false)
                      openAuthModal('login')
                    }}
                  >
                    Sign in
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="user-dropdown-divider" />

          <div className="user-dropdown-actions">
            {menuLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`user-dropdown-item${isActive(link.active || link.to) ? ' is-active' : ''}`}
                onClick={() => setIsOpen(false)}
              >
                {link.icon} <span>{link.label}</span>
              </Link>
            ))}

            {user && (
              <Link
                to="/profile"
                className={`user-dropdown-item${isActive('/profile') ? ' is-active' : ''}`}
                onClick={() => setIsOpen(false)}
              >
                <Icons.User />
                <span>My Profile</span>
              </Link>
            )}

            {user && (
              <button
                className="user-dropdown-item user-dropdown-logout"
                onClick={handleSignOut}
              >
                <Icons.ArrowLeft />
                <span>Sign out</span>
              </button>
            )}

            {installPrompt && (
              <button className="user-dropdown-item" onClick={handleInstall}>
                <Icons.Download />
                <span>Install app</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
