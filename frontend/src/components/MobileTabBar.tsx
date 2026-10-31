import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useAuthModal } from '../contexts/AuthModalContext'
import { activeTab, isTabBarHidden, reviewHref, type TabKey } from '../lib/tabBar'

const Svg = ({ children }: { children: ReactNode }) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

const HomeIcon = () => (
  <Svg>
    <path d="M3 11l9-8 9 8" />
    <path d="M5 10v10h14V10" />
  </Svg>
)
const PlaneIcon = () => (
  <Svg>
    <path d="M22 2L11 13" />
    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
  </Svg>
)
const ChatIcon = () => (
  <Svg>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
  </Svg>
)
const MeIcon = () => (
  <Svg>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
  </Svg>
)

// Phone-only bottom navigation. CSS shows it below 768px. It touches no
// browser APIs while rendering, so it is safe for renderToString (prerender).
export const MobileTabBar = () => {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const { openAuthModal } = useAuthModal()

  if (isTabBarHidden(pathname)) return null
  const active = activeTab(pathname)
  const item = (key: TabKey) => `tab-bar-item${active === key ? ' is-active' : ''}`
  const current = (key: TabKey) => (active === key ? ('page' as const) : undefined)

  return (
    <>
      <nav className="tab-bar" aria-label="Quick navigation">
        <Link to="/" className={item('home')} aria-current={current('home')}>
          <HomeIcon />
          <span>Home</span>
        </Link>
        <Link to="/flights" className={item('flights')} aria-current={current('flights')}>
          <PlaneIcon />
          <span>Flights</span>
        </Link>
        <Link to={reviewHref(pathname)} className="tab-bar-item tab-bar-review">
          <span className="tab-bar-review-btn" aria-hidden="true">
            +
          </span>
          <span>Review</span>
        </Link>
        <Link to="/community" className={item('community')} aria-current={current('community')}>
          <ChatIcon />
          <span>Community</span>
        </Link>
        {user ? (
          <Link to="/profile" className={item('me')} aria-current={current('me')}>
            <MeIcon />
            <span>Me</span>
          </Link>
        ) : (
          <button type="button" className="tab-bar-item" onClick={() => openAuthModal('login')}>
            <MeIcon />
            <span>Me</span>
          </button>
        )}
      </nav>
      <div className="tab-bar-spacer" aria-hidden="true" />
    </>
  )
}
