import { useEffect } from 'react'
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

  // Show the sign-in modal on the first load of the site (once per browser session)
  useEffect(() => {
    if (loading || user) return
    if (
      location.pathname === '/users' ||
      location.pathname === '/flights' ||
      location.pathname.startsWith('/profile')
    )
      return
    if (sessionStorage.getItem('trc:auth-nudge-shown')) return
    sessionStorage.setItem('trc:auth-nudge-shown', '1')
    openAuthModal('login')
  }, [loading, user, location.pathname, openAuthModal])

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
        </div>
      </div>
    </header>
  )
}
