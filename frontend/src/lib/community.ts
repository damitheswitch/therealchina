// Community Q&A — shared types + taxonomy. Data comes from the qa_questions /
// qa_answers tables via communityApi.ts; COMMUNITY_CATEGORIES is mirrored by
// a CHECK constraint in migration 048 — update both together.

export interface CommunityCategory {
  id: string
  label: string
  blurb: string
}

export const COMMUNITY_CATEGORIES: CommunityCategory[] = [
  {
    id: 'visas',
    label: 'Visas & permits',
    blurb: 'JW forms, residence permits, police registration',
  },
  {
    id: 'driving',
    label: 'Driving & transport',
    blurb: 'License conversion, metros, bikes, trains',
  },
  { id: 'money', label: 'Banking & money', blurb: 'Bank accounts, Alipay, stipends, transfers' },
  { id: 'housing', label: 'Housing', blurb: 'Dorms, apartments, agents, deposits' },
  {
    id: 'academics',
    label: 'Academics & applications',
    blurb: 'Admissions, scholarships, coursework',
  },
  {
    id: 'work',
    label: 'Work & internships',
    blurb: 'Part-time rules, internships, post-grad jobs',
  },
  { id: 'health', label: 'Health & insurance', blurb: 'Hospitals, insurance, clinics' },
  {
    id: 'tech',
    label: 'Phone & internet',
    blurb: 'SIM cards, campus wifi, Alipay, WeChat, apps',
  },
  { id: 'life', label: 'Daily life', blurb: 'Food, apps, shopping, everything else' },
  { id: 'other', label: 'Other', blurb: 'Does not fit the rest? Put it here' },
]

export const categoryLabel = (id: string): string =>
  COMMUNITY_CATEGORIES.find((c) => c.id === id)?.label ?? id

export interface CommunityAuthor {
  id: string
  displayName: string
}

export interface CommunityAnswer {
  id: string
  // null author = posted anonymously (display masked; real identity stays server-side)
  author: CommunityAuthor | null
  body: string[]
  upvotes: number
  ago: string
  postedHoursAgo: number
  accepted?: boolean
  mine?: boolean
  viewerUpvoted?: boolean
}

export interface CommunityQuestion {
  id: string
  slug: string
  title: string
  excerpt: string
  body: string[]
  category: string
  city?: string
  university?: { name: string; slug: string }
  author: CommunityAuthor | null
  upvotes: number
  ago: string
  postedHoursAgo: number
  answerCount: number
  acceptedAnswerId: string | null
  // True for the signed-in author — drives owner controls (accept, notify).
  mine?: boolean
  // Author-only: current email-on-answer preference (null for everyone else).
  notifyOnAnswer?: boolean
  viewerUpvoted?: boolean
}
