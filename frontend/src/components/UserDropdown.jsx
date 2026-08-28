import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { SealAvatar } from './SealAvatar'
import { Icons } from './Icons'
import { useAuth } from '../contexts/AuthContext'

// UserDropdown component - Dropdown menu in header with user avatar
export const UserDropdown = () => {
  const { user, signOut, loading } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

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

  if (loading || !user) return null

  const displayName = user.user_metadata?.display_name || user.email

  return (
    <div className="user-dropdown" ref={dropdownRef}>
      <button
        className="user-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User menu"
        aria-expanded={isOpen}
      >
        <SealAvatar displayName={displayName} size={36} />
      </button>

      {isOpen && (
        <div className="user-dropdown-menu">
          <div className="user-dropdown-header">
            <SealAvatar displayName={displayName} size={48} />
            <div className="user-dropdown-info">
              <div className="user-dropdown-name">{displayName}</div>
              <div className="user-dropdown-email">{user.email}</div>
            </div>
          </div>

          <div className="user-dropdown-divider" />

          <div className="user-dropdown-actions">
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

            <div className="user-dropdown-divider" />

            <button
              className="user-dropdown-item user-dropdown-logout"
              onClick={handleSignOut}
            >
              <Icons.ArrowLeft />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}