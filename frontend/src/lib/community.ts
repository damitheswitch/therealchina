// Community Q&A — shared types + taxonomy.
// PROTOTYPE: data comes from communityMock.ts until the real tables land.

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
}

export interface CommunityQuestion {
  slug: string
  title: string
  body: string[]
  category: string
  city?: string
  university?: { name: string; slug: string }
  author: CommunityAuthor | null
  upvotes: number
  ago: string
  postedHoursAgo: number
  acceptedAnswerId: string | null
  mine?: boolean
  relatedGuide?: { title: string; slug: string }
  answers: CommunityAnswer[]
}
