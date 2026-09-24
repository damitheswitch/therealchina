// Program normalization — free-text review programs collapse into a fixed set
// of hub pages. ONLY hubs listed here can get a /program/<slug> page; unknown
// programs simply don't produce a hub (they still show on university pages).

export interface HubDef {
  slug: string
  label: string
  blurb: string
  aliases: string[]
}

export const PROGRAM_HUBS: HubDef[] = [
  {
    slug: 'business',
    label: 'Business & Management',
    blurb:
      'MBA, finance, marketing and management programs international students actually review in China.',
    aliases: [
      'business',
      'mba',
      'management',
      'finance',
      'marketing',
      'international business',
      'economics',
      'accounting',
      'entrepreneurship',
      'business administration',
    ],
  },
  {
    slug: 'computer-science',
    label: 'Computer Science & IT',
    blurb: 'CS, software engineering, AI and data programs reviewed by international students.',
    aliases: [
      'computer science',
      'cs',
      'computer science & technology',
      'software engineering',
      'information technology',
      'artificial intelligence',
      'ai',
      'data science',
      'big data',
      'machine learning',
      'cyber security',
      'information security',
    ],
  },
  {
    slug: 'engineering',
    label: 'Engineering',
    blurb: 'Mechanical, civil, electrical and other engineering programs in China.',
    aliases: [
      'engineering',
      'mechanical engineering',
      'civil engineering',
      'electrical engineering',
      'chemical engineering',
      'environmental engineering',
      'materials science',
      'aerospace',
      'automation',
      'biomedical engineering',
    ],
  },
  {
    slug: 'medicine',
    label: 'Medicine & Health',
    blurb: 'MBBS, clinical medicine, pharmacy and public health programs for foreigners.',
    aliases: [
      'mbbs',
      'medicine',
      'clinical medicine',
      'pharmacy',
      'nursing',
      'public health',
      'dentistry',
      'traditional chinese medicine',
      'tcm',
    ],
  },
  {
    slug: 'chinese-language',
    label: 'Chinese Language',
    blurb: 'Mandarin language courses and HSK-prep programs across China.',
    aliases: [
      'chinese language',
      'mandarin',
      'chinese language program',
      'hsk',
      'language course',
      'chinese studies',
    ],
  },
  {
    slug: 'social-sciences',
    label: 'Social Sciences',
    blurb: 'International relations, sociology, political science and journalism.',
    aliases: [
      'international relations',
      'sociology',
      'political science',
      'journalism',
      'psychology',
      'anthropology',
      'public administration',
      'social work',
    ],
  },
  {
    slug: 'natural-sciences',
    label: 'Natural Sciences',
    blurb: 'Math, physics, chemistry and biology programs in Chinese universities.',
    aliases: [
      'mathematics',
      'physics',
      'chemistry',
      'biology',
      'marine biology',
      'environmental science',
      'statistics',
    ],
  },
  {
    slug: 'arts-design',
    label: 'Arts & Design',
    blurb: 'Fine arts, design, architecture and media programs.',
    aliases: ['art', 'fine arts', 'design', 'architecture', 'music', 'film', 'media', 'animation'],
  },
  {
    slug: 'education',
    label: 'Education',
    blurb: 'Teaching, education leadership and pedagogy programs.',
    aliases: ['education', 'teaching', 'pedagogy', 'tesol', 'education management'],
  },
  {
    slug: 'law',
    label: 'Law',
    blurb: 'LLB, LLM and Chinese-law programs for international students.',
    aliases: ['law', 'llb', 'llm', 'international law', 'chinese law'],
  },
]

const norm = (s: string): string => s.toLowerCase().trim().replace(/\s+/g, ' ')

/**
 * Map a free-text program string to its hub slug, or null when the program
 * doesn't belong to any hub. EXACT normalized match only — fuzzy contains
 * matching mis-files programs like "Business Law" under `law`.
 */
export const normalizeProgram = (p: string | null | undefined): string | null => {
  if (!p) return null
  const n = norm(p)
  if (!n) return null
  for (const h of PROGRAM_HUBS) {
    if (h.aliases.includes(n) || h.slug === n) return h.slug
  }
  return null
}

export const hubBySlug = (slug: string): HubDef | null =>
  PROGRAM_HUBS.find((h) => h.slug === slug) ?? null
