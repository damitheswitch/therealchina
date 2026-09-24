// Structured-data builders — the ONLY place JSON-LD is assembled. Every value
// that reaches a <script type="application/ld+json"> block goes through
// stringify() → escapeJsonLd(), so user content can never break the document.
//
// Truthfulness rules (enforced by callers + tests):
//   - aggregateRating only when count >= 2 REAL reviews (seed demos excluded)
//   - no schema types that don't match visible page content
import { SITE, siteUrl } from './site'
import { escapeJsonLd } from './escape'

export const stringify = (o: unknown): string => escapeJsonLd(o)

export const orgSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE.name,
  url: siteUrl('/'),
  logo: siteUrl('/pwa-512x512.png'),
  email: SITE.contactEmail,
  ...(SITE.sameAs.length ? { sameAs: SITE.sameAs } : {}),
})

export const websiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE.name,
  url: siteUrl('/'),
  description: SITE.tagline,
  publisher: { '@type': 'Organization', name: SITE.name },
})

interface UniInput {
  name: string
  slug: string
  city?: string | null
  logo?: string | null
  website?: string | null
  rating?: { value: number; count: number } | null
  // Visible reviews embedded as Review markup — only pass reviews whose text
  // actually renders on the page.
  reviews?: { author: string; rating: number; text: string; date: string }[]
}

export const universitySchema = (u: UniInput) => ({
  '@context': 'https://schema.org',
  '@type': 'CollegeOrUniversity',
  name: u.name,
  url: siteUrl(`/university/${u.slug}`),
  ...(u.city
    ? { address: { '@type': 'PostalAddress', addressLocality: u.city, addressCountry: 'CN' } }
    : {}),
  ...(u.logo ? { logo: siteUrl(u.logo) } : {}),
  ...(u.website ? { sameAs: [u.website] } : {}),
  ...(u.rating && u.rating.count >= 2
    ? {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: u.rating.value,
          bestRating: 5,
          worstRating: 1,
          ratingCount: u.rating.count,
        },
      }
    : {}),
  ...(u.reviews?.length ? { review: u.reviews.map(reviewSchema) } : {}),
})

export const courseSchema = (input: {
  name: string
  slug: string
  providerName: string
  providerSlug: string
}) => ({
  '@context': 'https://schema.org',
  '@type': 'Course',
  name: input.name,
  url: siteUrl(`/program/${input.slug}`),
  provider: {
    '@type': 'EducationalOrganization',
    name: input.providerName,
    url: siteUrl(`/university/${input.providerSlug}`),
  },
})

export const breadcrumbSchema = (items: { name: string; url: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: it.name,
    item: siteUrl(it.url),
  })),
})

interface ArticleInput {
  title: string
  description: string
  url: string
  image?: string | null
  published?: string
  updated?: string
  authorName?: string
  authorUrl?: string
}

export const articleSchema = (a: ArticleInput) => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: a.title,
  description: a.description,
  url: siteUrl(a.url),
  inLanguage: 'en',
  ...(a.image ? { image: [siteUrl(a.image)] } : {}),
  ...(a.published ? { datePublished: a.published } : {}),
  ...(a.updated ? { dateModified: a.updated } : {}),
  author: a.authorName
    ? [
        {
          '@type': 'Person',
          name: a.authorName,
          ...(a.authorUrl ? { url: siteUrl(a.authorUrl) } : {}),
        },
      ]
    : [{ '@type': 'Organization', name: SITE.name, url: siteUrl('/') }],
  publisher: {
    '@type': 'Organization',
    name: SITE.name,
    logo: { '@type': 'ImageObject', url: siteUrl('/pwa-512x512.png') },
  },
})

export const faqSchema = (items: { q: string; a: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map((it) => ({
    '@type': 'Question',
    name: it.q,
    acceptedAnswer: { '@type': 'Answer', text: it.a },
  })),
})

export const itemListSchema = (items: { name: string; url: string }[], listName: string) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: listName,
  numberOfItems: items.length,
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: it.name,
    url: siteUrl(it.url),
  })),
})

export const personSchema = (p: { name: string; url: string; jobTitle?: string }) => ({
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: p.name,
  url: siteUrl(p.url),
  ...(p.jobTitle ? { jobTitle: p.jobTitle } : {}),
  worksFor: { '@type': 'Organization', name: SITE.name, url: siteUrl('/') },
})

/** Individual review schema — only emitted inside university schema where the
 *  review text is visible on the page. Not used for demo/seed reviews. */
export const reviewSchema = (r: {
  author: string
  rating: number
  text: string
  date: string
}) => ({
  '@type': 'Review',
  author: { '@type': 'Person', name: r.author },
  reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
  reviewBody: r.text,
  datePublished: r.date,
})
