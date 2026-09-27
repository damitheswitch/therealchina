// Trust/legal page content — one source for all static policy pages.
// Keep copy factual and dated. When a policy changes, update here AND bump
// `updated` — the date renders on the page and in sitemap lastmod.
export interface TrustSection {
  h: string
  id: string // anchor target — retired standalone slugs 301 to these
  body: string[] // paragraphs
}
export interface TrustDoc {
  slug: string
  title: string
  description: string
  updated: string
  sections: TrustSection[]
}

export const TRUST_PAGES: TrustDoc[] = [
  {
    slug: 'about',
    title: 'About The Real China',
    description: 'What The Real China is, who runs it, and how to reach us.',
    updated: '2026-09-26',
    sections: [
      {
        h: 'What this is',
        id: 'what-this-is',
        body: [
          'The Real China (TRC) is a review site built for international students picking a university in China. Every review comes from someone who studied, or is studying, at the school they write about.',
          'University brochures give you rankings and campus photos. Our reviews tell you about dorm heating, canteen prices, whether the international office answers emails, and what CSC funding actually covers.',
        ],
      },
      {
        h: 'Why it exists',
        id: 'why-it-exists',
        body: [
          'Choosing a Chinese university from abroad is a leap of faith. Agencies earn commissions for steering students to partner schools, and ranking tables say nothing about daily life. TRC exists so students can hear from other students. No sponsorships, no partner placements, no reviews for sale.',
        ],
      },
      {
        h: 'Who runs it',
        id: 'who-runs-it',
        body: [
          "TRC is an independent, community-run project. We're not affiliated with any university, agency, or the Chinese government, and universities can't pay to influence ratings or remove negative reviews.",
        ],
      },
      {
        h: 'Contact',
        id: 'contact',
        body: [
          'Email nihao@therealchina.net. We read everything, though replies can take a few days.',
          "If your university's details are wrong (name, city, ranking, website), send us the source and we'll fix it. We don't remove reviews at a university's request — the editorial policy explains why.",
        ],
      },
      {
        h: 'Report content',
        id: 'report',
        body: [
          'Report fake reviews, spam, harassment, hate speech, private information, impersonation, or anything posted by someone who never attended the university.',
          'Email nihao@therealchina.net with the page URL and what is wrong. Screenshots or links help. A human reads every report, and safety issues go first. Content that breaks policy comes down, and the reporter is never identified to the author. Universities emailing us about negative reviews get pointed to our editorial policy.',
        ],
      },
    ],
  },
  {
    slug: 'editorial-policy',
    title: 'Editorial Policy',
    description: 'How The Real China verifies, moderates and sources everything on the site.',
    updated: '2026-09-26',
    sections: [
      {
        h: 'Reviews are user content',
        id: 'user-content',
        body: [
          'Reviews reflect the personal experience of whoever wrote them. We do not verify every claim and we do not endorse opinions. What we do check is covered below.',
        ],
      },
      {
        h: 'How we verify reviews',
        id: 'how-we-verify',
        body: [
          'A review counts as verified when its author was signed in when they posted. That proves they registered. It does not prove they studied at the university. Anonymous reviews are equally welcome, and enrollment status (current student, alumni, exchange, applicant) is self-reported and shown as written.',
          'Submissions pass through rate limits, bot detection (Cloudflare Turnstile), and disposable-email blocking. Reported reviews are read by a human and removed if they break the guidelines below.',
          "We don't check student IDs, admission letters, or enrollment documents, and we don't verify that a reviewer attended the school they describe. Treat every review as one person's claimed experience. Weigh the specifics, not the stars.",
        ],
      },
      {
        h: 'Review guidelines',
        id: 'review-guidelines',
        body: [
          "Write about your own experience: teaching quality, dorms, canteens, city life, admin support, costs. Specific beats general — 'the international office took three weeks to issue my JW202' helps people more than 'admin is slow'.",
          "Be honest and fair. Include what worked and what didn't. No review needs to be balanced, but honest nuance is more useful than a rant or an ad.",
          "Don't post content about people who aren't you, personal data, or hate speech. Don't review a university you never attended. One review per person per university.",
        ],
      },
      {
        h: 'What gets removed',
        id: 'removals',
        body: [
          'Fake, duplicated or spam content. Hate speech, harassment, doxxing, private information about identifiable people. Reviews by someone who demonstrably never attended the university.',
          "What never gets removed: negative reviews a university dislikes, balanced criticism, low ratings on their own. Universities cannot pay for removal or placement. That product doesn't exist here.",
        ],
      },
      {
        h: 'Moderation',
        id: 'moderation',
        body: [
          'Reports are reviewed by a human. Authors are told when their content is removed and can appeal by replying to the notice. Repeated fake submissions are rate-limited or blocked.',
        ],
      },
      {
        h: 'Where the data comes from',
        id: 'data-sources',
        body: [
          'University names, cities, rankings and logos are compiled from public ranking publications (including ShanghaiRanking) and university websites. Data is refreshed periodically, and each university page shows the ranking year.',
          "Ratings, review counts, cost ranges and recommend percentages are computed from user reviews only. Never imported, purchased, or seeded. A university with no reviews shows 'no reviews yet', not an estimate.",
          'Found an error? Email nihao@therealchina.net with the page URL and a source.',
        ],
      },
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    description: 'What data The Real China collects and why.',
    updated: '2026-09-26',
    sections: [
      {
        h: 'What we collect',
        id: 'collect',
        body: [
          'Account data (email, display name), the content you submit (reviews, photos, profile fields), and the technical logs needed to keep the site running. Reviews marked anonymous are not linked to your account publicly.',
        ],
      },
      {
        h: 'What we never do',
        id: 'never',
        body: [
          "We don't sell personal data, share your email, or publish your identity on reviews marked anonymous.",
        ],
      },
      {
        h: 'Your controls',
        id: 'controls',
        body: [
          'You can edit or delete your reviews and profile at any time. To delete your account and everything attached to it, email nihao@therealchina.net. Deletion is permanent and we cannot undo it.',
        ],
      },
      {
        h: 'Processors',
        id: 'processors',
        body: [
          'A handful of services keep TRC running: Supabase (database and auth), Netlify (hosting), Cloudflare Turnstile (abuse protection), and Resend (transactional email). Each only gets what it needs to do its job.',
        ],
      },
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of Service',
    description: 'The rules for using The Real China.',
    updated: '2026-09-26',
    sections: [
      {
        h: 'The deal',
        id: 'the-deal',
        body: [
          "Use TRC to read honest reviews and share your own experience. Don't scrape the site, submit fake content, harass users, or misrepresent who you are.",
        ],
      },
      {
        h: 'Your content',
        id: 'your-content',
        body: [
          'You keep ownership of your reviews. You grant TRC a license to display them on the site and in summaries or exports. You can delete them anytime.',
        ],
      },
      {
        h: 'Our content',
        id: 'our-content',
        body: [
          "TRC is provided as is. We're not liable for decisions you make based on reviews. University data may contain errors, so verify important details directly with the school.",
        ],
      },
      {
        h: 'Enforcement',
        id: 'enforcement',
        body: [
          'We may remove content or suspend accounts that violate these terms or the review guidelines. Serious abuse is blocked at the network level.',
        ],
      },
      {
        h: 'Disclaimer',
        id: 'disclaimer',
        body: [
          "Ratings and reviews reflect individual experiences at a point in time. They're not guarantees of your experience, endorsements, or professional advice.",
          'Program availability, tuition, entry requirements and policies change. Always confirm with the university before applying.',
          "Links to university sites and other resources are provided for convenience. We don't control their content.",
        ],
      },
    ],
  },
]

// Retired standalone slugs → their merged section. generate_static.ts turns
// these into _redirects 301s; App.jsx mirrors them client-side.
export const TRUST_REDIRECTS: Record<string, string> = {
  contact: '/about#contact',
  report: '/about#report',
  'how-we-verify': '/editorial-policy#how-we-verify',
  'review-guidelines': '/editorial-policy#review-guidelines',
  'data-sources': '/editorial-policy#data-sources',
  disclaimer: '/terms#disclaimer',
}

export const trustDocBySlug = (slug: string | undefined): TrustDoc | undefined =>
  TRUST_PAGES.find((d) => d.slug === slug)
