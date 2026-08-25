import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Logo } from './Logo'
import { Icons } from './Icons'
import { useAuth } from '../contexts/AuthContext'
import { AuthModal } from './AuthModal'

// Header component
export const Header = () => {
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [authModalOpen, setAuthModalOpen] = useState(false)

  const isActive = (path) => location.pathname === path

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="logo-link">
          <Logo size={36} />
          <span className="logo-text">
            The Real <span className="accent">China</span>
          </span>
        </Link>
        <nav className="nav-links">
          <Link
            to="/"
            className="nav-text-link"
            style={{ color: isActive('/') ? 'var(--seal-red)' : '' }}
          >
            Universities
          </Link>
          {user ? (
            <div className="nav-cta">
              <Link
                to="/review"
                className="btn btn-primary"
                style={{ background: isActive('/review') ? 'var(--seal-red-dark)' : '' }}
              >
                <Icons.Pen /> Leave a Review
              </Link>
              <button onClick={signOut} className="btn btn-outline">
                Sign out
              </button>
            </div>
          ) : (
            <>
              <Link
                to="/review"
                className="btn btn-primary"
                style={{ background: isActive('/review') ? 'var(--seal-red-dark)' : '' }}
              >
                <Icons.Pen /> Leave a Review
              </Link>
              <button onClick={() => setAuthModalOpen(true)} className="btn btn-outline">
                Sign in
              </button>
            </>
          )}
        </nav>
      </div>
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </header>
  )
}
