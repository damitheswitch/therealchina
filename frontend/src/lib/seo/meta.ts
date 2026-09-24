// Head-string builder for prerendered pages. Produces the exact tags that go
// into <head>; applyHead() keeps the browser <head> in sync after hydration.
import { SITE, siteUrl } from './site'
import { robotsFor, getPolicy } from './policy'
import { escapeAttr } from './escape'

export interface PageHeadInput {
  path: string // canonical path, no origin
  title?: string // raw page title; "" / undefined → SITE.name
  description?: string
  image?: string // path or absolute URL
  type?: 'website' | 'article' | 'profile'
  index?: boolean // default: getPolicy(path).index
  follow?: boolean // default: getPolicy(path).follow
  jsonLd?: string[] // pre-serialized JSON-LD blocks (already escaped)
  published?: string // ISO date — article pages
  updated?: string
}

export interface PageHead {
  title: string
  description: string
  canonical: string
  robots: string
  html: string // everything after <title> — safe to inject into <head>
}

const clampTitle = (t: string) => (t.length > 60 ? `${t.slice(0, 57).trimEnd()}…` : t)
const clampDesc = (d: string) => (d.length > 160 ? `${d.slice(0, 157).trimEnd()}…` : d)

export const buildPageHead = (input: PageHeadInput): PageHead => {
  const rawTitle = input.title?.trim()
  const title = clampTitle(rawTitle ? `${rawTitle} | ${SITE.name}` : SITE.name)
  const description = clampDesc(
    (input.description ?? SITE.defaultDescription).replace(/\s+/g, ' ').trim()
  )
  const canonical = siteUrl(input.path)
  const policy = getPolicy(input.path)
  const robots = robotsFor({
    index: input.index ?? policy.index,
    follow: input.follow ?? policy.follow,
  })
  const ogImage = input.image
    ? input.image.startsWith('http')
      ? input.image
      : siteUrl(input.image)
    : siteUrl('/og/default.png')
  const type = input.type ?? 'website'

  const tags = [
    `<meta name="description" content="${escapeAttr(description)}">`,
    `<meta name="robots" content="${robots}">`,
    `<link rel="canonical" href="${escapeAttr(canonical)}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:site_name" content="${escapeAttr(SITE.name)}">`,
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    `<meta property="og:description" content="${escapeAttr(description)}">`,
    `<meta property="og:url" content="${escapeAttr(canonical)}">`,
    `<meta property="og:image" content="${escapeAttr(ogImage)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(description)}">`,
    `<meta name="twitter:image" content="${escapeAttr(ogImage)}">`,
    SITE.twitter ? `<meta name="twitter:site" content="${escapeAttr(SITE.twitter)}">` : '',
    input.published
      ? `<meta property="article:published_time" content="${escapeAttr(input.published)}">`
      : '',
    input.updated
      ? `<meta property="article:modified_time" content="${escapeAttr(input.updated)}">`
      : '',
    ...(input.jsonLd ?? []).map((j) => `<script type="application/ld+json">${j}</script>`),
  ].filter(Boolean)

  return { title, description, canonical, robots, html: tags.join('\n    ') }
}
