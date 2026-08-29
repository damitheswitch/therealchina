import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { Logo } from './Logo'
import { Icons } from './Icons'
import { useAuth } from '../contexts/AuthContext'
import { useAuthModal } from '../contexts/AuthModalContext'
import { UserDropdown } from './UserDropdown'

// Header component
export const Header = () => {
  const location = useLocation()
  const { user, loading } = useAuth()
  const { openAuthModal } = useAuthModal()
  const [menuOpen, setMenuOpen] = useState(false)

  // Show the sign-in modal on the first load of the site (once per browser session)
  useEffect(() => {
    if (loading || user) return
    if (location.pathname === '/users') return
    if (sessionStorage.getItem('trc:auth-nudge-shown')) return
    sessionStorage.setItem('trc:auth-nudge-shown', '1')
    openAuthModal('login')
  }, [loading, user, location.pathname, openAuthModal])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!menuOpen) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const isActive = (path) => location.pathname === path

  const navLinks = [
    { to: '/', label: 'Universities', icon: <Icons.Book /> },
    { to: '/flights', label: 'Flights', icon: <Icons.Plane /> },
    { to: '/users', label: 'Users', icon: <Icons.Users /> },
  ]

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="logo-link">
          <Logo size={36} />
          <span className="logo-text">
            The Real <span className="accent">China</span>
          </span>
        </Link>
        <nav className="nav-links" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="nav-text-link"
              style={{ color: isActive(link.to) ? 'var(--seal-red)' : '' }}
            >
              {link.icon} {link.label}
            </Link>
          ))}
          <Link
            to="/review"
            className="btn btn-primary"
            style={{ background: isActive('/review') ? 'var(--seal-red-dark)' : '' }}
          >
            <Icons.Pen /> Leave a Review
          </Link>
        </nav>
        <div className="header-actions">
          <UserDropdown />
          <button
            type="button"
            className="nav-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
          >
            {menuOpen ? <Icons.X /> : <Icons.Menu />}
          </button>
        </div>
      </div>

      {/* Portaled to body: the header's backdrop-filter would otherwise make it
          the containing block for a fixed-position child */}
      {menuOpen && createPortal(
        <div className="mobile-nav-backdrop" onClick={() => setMenuOpen(false)} />,
        document.body,
      )}

      <nav
        id="mobile-nav"
        className={`mobile-nav${menuOpen ? ' is-open' : ''}`}
        aria-label="Mobile navigation"
        aria-hidden={!menuOpen}
      >
        {navLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`mobile-nav-item${isActive(link.to) ? ' is-active' : ''}`}
            onClick={() => setMenuOpen(false)}
            tabIndex={menuOpen ? undefined : -1}
          >
            {link.icon} {link.label}
          </Link>
        ))}
        <Link
          to="/review"
          className={`mobile-nav-item${isActive('/review') ? ' is-active' : ''}`}
          onClick={() => setMenuOpen(false)}
          tabIndex={menuOpen ? undefined : -1}
        >
          <Icons.Pen /> Leave a Review
        </Link>
        {!user && (
          <button
            type="button"
            className="btn btn-primary mobile-nav-cta"
            onClick={() => {
              setMenuOpen(false)
              openAuthModal('login')
            }}
            tabIndex={menuOpen ? undefined : -1}
          >
            Sign in
          </button>
        )}
      </nav>
    </header>
  )
}
