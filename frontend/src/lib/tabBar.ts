import { matchPath } from 'react-router-dom'

// Routes that bring their own sticky actions, so the bar stays out of the way.
const HIDDEN_ROUTES = ['/review', '/onboarding', '/community/ask', '/reset-password']

export type TabKey = 'home' | 'flights' | 'community' | 'me'

const trimSlash = (pathname: string): string =>
  pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname

export const isTabBarHidden = (pathname: string): boolean =>
  HIDDEN_ROUTES.includes(trimSlash(pathname))

// Where the raised center button goes: on a university page it pre-selects
// that university in the wizard (the wizard reads ?uni).
export const reviewHref = (pathname: string): string => {
  const match = matchPath('/university/:slug', trimSlash(pathname))
  const slug = match?.params.slug
  return slug ? `/review?uni=${encodeURIComponent(slug)}` : '/review'
}

export const activeTab = (pathname: string): TabKey | null => {
  const p = trimSlash(pathname)
  if (p === '/') return 'home'
  if (p === '/flights' || p.startsWith('/flights/')) return 'flights'
  if (p === '/community' || p.startsWith('/community/')) return 'community'
  if (p === '/profile' || p.startsWith('/profile/')) return 'me'
  return null
}
