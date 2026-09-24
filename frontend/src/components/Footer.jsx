import { Link } from 'react-router-dom'
import { Logo } from './Logo'

// Footer component — trust links live here so every page exposes them
// to crawlers (E-E-A-T) and users.
export const Footer = () => (
  <footer className="site-footer">
    <div className="container footer-inner">
      <div className="footer-brand">
        <Logo size={28} />
        <span className="logo-text">The Real China</span>
      </div>
      <div className="footer-links">
        <Link to="/universities">Universities</Link>
        <Link to="/reviews">Reviews</Link>
        <Link to="/review">Leave a Review</Link>
        <Link to="/about">About</Link>
        <Link to="/how-we-verify">How we verify</Link>
        <Link to="/review-guidelines">Review guidelines</Link>
        <Link to="/editorial-policy">Editorial policy</Link>
        <Link to="/data-sources">Data sources</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/contact">Contact</Link>
      </div>
      <p className="footer-copy">
        The Real China — Authentic student reviews. Built by the community, for the community.
      </p>
    </div>
  </footer>
)
