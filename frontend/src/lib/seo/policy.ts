// Indexing policy — the ONLY place that decides whether a route can appear
// in Google. The robots meta tag, the sitemap builder and the prerender list
// all read from this table, so they can never disagree.
//
// Consequences of flipping a row:
//   index:true → route is eligible for prerendered HTML + sitemap entry.
//   index:false → route gets meta noindex and is excluded from the sitemap.
//   follow:false is for pages that exist but should not pass link equity
//   (almost always keep true).

export interface Policy {
  index: boolean
  follow: boolean
}

export const INDEXABLE_PATTERNS: RegExp[] = [
  /^\/$/, // /
  /^\/universities$/, // /universities
  /^\/university\/[^/]+$/, // /university/:slug
  /^\/reviews$/, // /reviews
  /^\/city\/[^/]+$/, // /city/:slug
  /^\/program\/[^/]+$/, // /program/:slug
  /^\/degree\/[^/]+$/, // /degree/:slug
  /^\/guide\/[^/]+$/, // /guide/:slug
  /^\/authors\/[^/]+$/, // /authors/:slug
  /^\/(about|editorial-policy|privacy|terms)$/, // trust/legal (merged — retired slugs 301 via TRUST_REDIRECTS)
]

export const NOINDEX_FOLLOW_PATTERNS: RegExp[] = [
  /^\/(onboarding|review|flights|users|settings)$/, // app pages & wizard
  /^\/profile/, // /profile, /profile/:id
  /^\/reset-password/, // auth flow
]

export const NOFOLLOW_PATTERNS: RegExp[] = [
  /^\/search/, // utility
]

export const robotsFor = (p: Policy): string =>
  `${p.index ? 'index' : 'noindex'}, ${p.follow ? 'follow' : 'nofollow'}`

/** Convert a react-router path into a pattern string ('/university/x' →
 *  '/university/:slug', '/a/b' → '/a/:p'). Used for diagnostics/tests. */
export const routeToPattern = (path: string): string => {
  const seg = path.split('/').filter(Boolean)
  if (seg.length === 0) return '/'
  if (seg.length === 1) return `/${seg[0]}`
  return `/${seg[0]}/:${seg[1]}`
}

/** Policy for a concrete path. Default for unlisted paths: noindex,follow —
 *  a new route stays OUT of Google until a human explicitly registers it
 *  here (and in routes.generated.ts). */
export const getPolicy = (path: string): Policy => {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  const indexable = INDEXABLE_PATTERNS.some((r) => r.test(clean))
  const nofollow = NOFOLLOW_PATTERNS.some((r) => r.test(clean))
  if (indexable) return { index: true, follow: !nofollow }
  return { index: false, follow: !nofollow }
}
