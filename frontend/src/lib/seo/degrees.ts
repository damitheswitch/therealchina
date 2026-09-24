// Degree normalization — review.degree_level values collapse into hub pages.
import type { HubDef } from './programs'

export const DEGREE_HUBS: HubDef[] = [
  {
    slug: 'bachelor',
    label: "Bachelor's Programs",
    blurb: 'Undergraduate programs reviewed by international students in China.',
    aliases: ['bachelor', 'bachelors', "bachelor's", 'undergraduate', 'ba', 'bsc', 'beng'],
  },
  {
    slug: 'master',
    label: "Master's Programs",
    blurb: 'Postgraduate taught and research masters reviewed by students.',
    aliases: ['master', 'masters', "master's", 'postgraduate', 'ma', 'msc', 'meng'],
  },
  {
    slug: 'phd',
    label: 'PhD & Doctoral',
    blurb: 'Doctoral programs and research degrees in Chinese universities.',
    aliases: ['phd', 'doctorate', 'doctoral', 'dphil'],
  },
  {
    slug: 'mba',
    label: 'MBA Programs',
    blurb: 'MBA and executive programs for international students.',
    aliases: ['mba', 'emba', 'executive mba', 'international mba', 'imba'],
  },
  {
    slug: 'language',
    label: 'Language Courses',
    blurb: 'Chinese-language programs and short courses for foreigners.',
    aliases: ['language course', 'language', 'chinese language course'],
  },
  {
    slug: 'exchange',
    label: 'Exchange Programs',
    blurb: 'Semester and year-abroad exchange experiences in China.',
    aliases: ['exchange', 'study abroad', 'exchange program'],
  },
  {
    slug: 'certificate',
    label: 'Certificate & Non-degree',
    blurb: 'Certificate and non-degree programs reviewed by students.',
    aliases: ['certificate', 'non-degree', 'diploma', 'short course'],
  },
]

const norm = (s: string): string => s.toLowerCase().trim().replace(/\s+/g, ' ')

/** Map a review degree_level to a hub slug, or null for 'Other'/unknown. */
export const normalizeDegree = (d: string | null | undefined): string | null => {
  if (!d) return null
  const n = norm(d)
  if (!n) return null
  for (const h of DEGREE_HUBS) {
    if (h.aliases.includes(n) || h.slug === n) return h.slug
  }
  return null
}

export const degreeHubBySlug = (slug: string): HubDef | null =>
  DEGREE_HUBS.find((h) => h.slug === slug) ?? null
