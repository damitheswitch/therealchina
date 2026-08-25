import { Link } from 'react-router-dom'
import { Logo } from './Logo'

// Footer component
export const Footer = () => (
  <footer className="site-footer">
    <div className="container footer-inner">
      <div className="footer-brand">
        <Logo size={28} />
        <span className="logo-text">The Real China</span>
      </div>
      <div className="footer-links">
        <Link to="/">Browse Universities</Link>
        <Link to="/review">Leave a Review</Link>
        <Link to="/">About</Link>
      </div>
      <p className="footer-copy">
        The Real China — Authentic student reviews. Built by the community, for the community.
      </p>
    </div>
  </footer>
)
