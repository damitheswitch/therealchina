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

  // Every emitted tag carries data-seo-managed — applyHead() removes marked
  // nodes before inserting new ones, so hydration/client nav replaces tags
  // instead of duplicating them.
  const M = ' data-seo-managed'
  const tags = [
    `<meta name="description" content="${escapeAttr(description)}"${M}>`,
    `<meta name="robots" content="${robots}"${M}>`,
    `<link rel="canonical" href="${escapeAttr(canonical)}"${M}>`,
    `<meta property="og:type" content="${type}"${M}>`,
    `<meta property="og:site_name" content="${escapeAttr(SITE.name)}"${M}>`,
    `<meta property="og:title" content="${escapeAttr(title)}"${M}>`,
    `<meta property="og:description" content="${escapeAttr(description)}"${M}>`,
    `<meta property="og:url" content="${escapeAttr(canonical)}"${M}>`,
    `<meta property="og:image" content="${escapeAttr(ogImage)}"${M}>`,
    `<meta property="og:image:width" content="1200"${M}>`,
    `<meta property="og:image:height" content="630"${M}>`,
    `<meta name="twitter:card" content="summary_large_image"${M}>`,
    `<meta name="twitter:title" content="${escapeAttr(title)}"${M}>`,
    `<meta name="twitter:description" content="${escapeAttr(description)}"${M}>`,
    `<meta name="twitter:image" content="${escapeAttr(ogImage)}"${M}>`,
    SITE.twitter ? `<meta name="twitter:site" content="${escapeAttr(SITE.twitter)}"${M}>` : '',
    input.published
      ? `<meta property="article:published_time" content="${escapeAttr(input.published)}"${M}>`
      : '',
    input.updated
      ? `<meta property="article:modified_time" content="${escapeAttr(input.updated)}"${M}>`
      : '',
    ...(input.jsonLd ?? []).map((j) => `<script type="application/ld+json"${M}>${j}</script>`),
  ].filter(Boolean)

  return { title, description, canonical, robots, html: tags.join('\n    ') }
}
