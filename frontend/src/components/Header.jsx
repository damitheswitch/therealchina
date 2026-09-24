import { Link, useLocation } from 'react-router-dom'
import { Logo } from './Logo'
import { Icons } from './Icons'
import { UserDropdown } from './UserDropdown'

// Header component
export const Header = () => {
  const location = useLocation()

  const isActive = (path) => location.pathname === path

  const navLinks = [
    { to: '/universities', label: 'Universities', icon: <Icons.Book /> },
    { to: '/reviews', label: 'Reviews', icon: <Icons.Pen /> },
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
