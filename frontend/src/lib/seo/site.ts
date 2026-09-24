// The ONE place site identity lives. Every SEO string (meta, JSON-LD, sitemap,
// feeds) comes from here — never retype the site name or tagline in a page.
export const SITE = {
  name: 'The Real China',
  shortName: 'TRC',
  tagline: 'Honest reviews of Chinese universities, by international students',
  defaultDescription:
    'Real reviews from real international students — costs, campus life and the support nobody puts in a brochure, for universities across China.',
  contactEmail: 'nihao@therealchina.net',
  contactUrl: 'https://www.therealchina.net/contact',
  twitter: '', // no account yet — update when created
  sameAs: [] as string[],
  // IndexNow key — the matching key file lives at frontend/public/<key>.txt.
  indexnowKey: '0f4d0874e85f43c1933b9fd11f9b60ad',
} as const

// www is the canonical host — the apex 301s to it, so every canonical,
// sitemap URL and JSON-LD url must use www or they point at a redirect.
export const PROD_ORIGIN = 'https://www.therealchina.net'
export const TEST_ORIGIN = 'https://trc-seo.test'

/** Absolute canonical URL for a path. Always same-origin, always PROD — canonical
 *  never points at a deploy preview or staging host. */
export const siteUrl = (path: string, origin = PROD_ORIGIN): string =>
  `${origin}${path.startsWith('/') ? path : `/${path}`}`
