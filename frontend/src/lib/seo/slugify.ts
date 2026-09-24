// URL-safe slug for hubs built from free-text values (city names, program
// names). Mirrors the displayName regex and supabase/functions/review-submit
// slugify() — keep all three in sync.
export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const uniPath = (slug: string): string => `/university/${slug}`
export const cityPath = (city: string): string => `/city/${slugify(city)}`
export const programPath = (slug: string): string => `/program/${slug}`
export const degreePath = (slug: string): string => `/degree/${slug}`
