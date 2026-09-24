// Trust/legal page content — one source for all static policy pages.
// Keep copy factual and dated. When a policy changes, update here AND bump
// `updated` — the date renders on the page and in sitemap lastmod.
export interface TrustSection {
  h: string
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
    description: 'Why The Real China exists and who it is for.',
    updated: '2026-09-24',
    sections: [
      {
        h: 'What this is',
        body: [
          'The Real China (TRC) is a review platform built for international students choosing universities in China. Every review comes from someone who studied — or is studying — at the university they describe.',
          'University brochures tell you about rankings and campus photos. Our reviews tell you about dorm heating, canteen prices, whether the international office answers emails, and what CSC funding actually covers.',
        ],
      },
      {
        h: 'Why it exists',
        body: [
          'Choosing a Chinese university from abroad is a leap of faith. Agency sites earn commissions for steering students to partner schools. Ranking tables say nothing about daily life. TRC exists so students can hear from students — no sponsorships, no partner placements, no reviews-for-sale.',
        ],
      },
      {
        h: 'Who runs it',
        body: [
          'TRC is an independent, community-run project. It is not affiliated with any university, agency, or the Chinese government. Universities cannot pay to influence ratings or remove negative reviews.',
        ],
      },
    ],
  },
  {
    slug: 'contact',
    title: 'Contact',
    description: 'How to reach The Real China.',
    updated: '2026-09-24',
    sections: [
      {
        h: 'General',
        body: [
          'Email: nihao@therealchina.net — we read everything, though replies may take a few days.',
        ],
      },
      {
        h: 'Report a review or a safety issue',
        body: [
          'Use the /report page or email nihao@therealchina.net with the review URL. Safety issues are prioritized.',
        ],
      },
      {
        h: 'Universities and data corrections',
        body: [
          'If your university information is wrong (name, city, ranking, website), email us with a source and we will fix it. We do not remove reviews at university request — see our editorial policy.',
        ],
      },
    ],
  },
  {
    slug: 'editorial-policy',
    title: 'Editorial Policy',
    description: 'How The Real China handles reviews, moderation and removals.',
    updated: '2026-09-24',
    sections: [
      {
        h: 'Reviews are user content',
        body: [
          'Reviews reflect the personal experience of their authors. TRC does not verify every claim and does not endorse opinions. We do verify authenticity signals — see How We Verify.',
        ],
      },
      {
        h: 'What gets removed',
        body: [
          'We remove content that is fake, duplicated, spam, hateful, harassing, doxxing, or reveals private information about identifiable people. We also remove reviews where the author demonstrably never attended the university.',
        ],
      },
      {
        h: 'What never gets removed',
        body: [
          'Negative reviews a university dislikes. Balanced criticism. Low ratings on their own. Universities cannot pay for removal or placement — we do not offer that product to anyone.',
        ],
      },
      {
        h: 'Moderation process',
        body: [
          'Reports are reviewed by a human. Authors are notified when their content is removed and can appeal by replying to the notice. Repeated fake submissions are rate-limited or blocked.',
        ],
      },
    ],
  },
  {
    slug: 'how-we-verify',
    title: 'How We Verify Reviews',
    description: 'The signals used to keep reviews authentic.',
    updated: '2026-09-24',
    sections: [
      {
        h: 'Enrollment signals',
        body: [
          'Reviewers can attach proof of enrollment (admission letter, student card) which is reviewed by a human and marked with a verified badge. Proof documents are deleted after review.',
        ],
      },
      {
        h: 'Behavioral signals',
        body: [
          'Rate limits, submission patterns, and disposable-email blocking filter most fake content before it publishes. Reviews that pass still show "unverified" unless proof is attached — we never claim a review is verified when it is not.',
        ],
      },
      {
        h: 'What we do not do',
        body: [
          'We do not publish IP addresses or identity documents. We do not sell reviewer data. Anonymous reviews stay anonymous to readers.',
        ],
      },
    ],
  },
  {
    slug: 'review-guidelines',
    title: 'Review Guidelines',
    description: 'What makes a helpful review on The Real China.',
    updated: '2026-09-24',
    sections: [
      {
        h: 'Write about your own experience',
        body: [
          'Describe what you lived: teaching quality, dorms, canteens, city life, admin support, costs. Specific beats general — "the intl office took 3 weeks to issue my JW202" helps people more than "admin is slow".',
        ],
      },
      {
        h: 'Be honest and fair',
        body: [
          'Include what worked AND what did not. No review needs to be balanced, but honest nuance is more useful to readers than a rant or an ad.',
        ],
      },
      {
        h: 'Do not post',
        body: [
          'Content about people who are not you, personal data, hate speech, or reviews written by someone who never attended. One review per person per university.',
        ],
      },
    ],
  },
  {
    slug: 'data-sources',
    title: 'Data Sources',
    description: 'Where university data on The Real China comes from.',
    updated: '2026-09-24',
    sections: [
      {
        h: 'University directory',
        body: [
          'Names, cities, rankings and logos are compiled from public ranking publications (including ShanghaiRanking) and university websites. Data is refreshed periodically; see each university page for the ranking year.',
        ],
      },
      {
        h: 'Reviews and stats',
        body: [
          'Ratings, review counts, cost ranges and recommend percentages are computed from user reviews only — never imported, purchased, or seeded. A university with no reviews shows "no reviews yet", not an estimate.',
        ],
      },
      {
        h: 'Corrections',
        body: ['Found an error? Email nihao@therealchina.net with the page URL and a source.'],
      },
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    description: 'What data The Real China collects and why.',
    updated: '2026-09-24',
    sections: [
      {
        h: 'What we collect',
        body: [
          'Account data (email, display name), content you submit (reviews, photos, profile fields), and technical logs needed to run the service. Anonymous reviews are not linked to your account publicly.',
        ],
      },
      {
        h: 'What we never do',
        body: [
          'Sell personal data, share your email, publish your identity on reviews marked anonymous, or use your enrollment documents for anything other than verification (they are deleted afterward).',
        ],
      },
      {
        h: 'Your controls',
        body: [
          'You can edit or delete your reviews and profile at any time. To delete your account and all associated content, contact nihao@therealchina.net — deletion is permanent and irreversible.',
        ],
      },
      {
        h: 'Processors',
        body: [
          'Supabase (database + auth), Netlify (hosting), Cloudflare Turnstile (abuse protection), Resend (transactional email). Each only receives what it needs to function.',
        ],
      },
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of Service',
    description: 'The rules for using The Real China.',
    updated: '2026-09-24',
    sections: [
      {
        h: 'The deal',
        body: [
          'Use TRC to read honest reviews and share your own experience. Do not scrape the site, submit fake content, harass users, or misrepresent who you are.',
        ],
      },
      {
        h: 'Your content',
        body: [
          'You keep ownership of your reviews. You grant TRC a license to display them on the site and in summaries/exports. You can delete them anytime.',
        ],
      },
      {
        h: 'Our content',
        body: [
          'TRC provides information "as is" — we are not liable for decisions you make based on reviews. University data may contain errors; verify important details directly.',
        ],
      },
      {
        h: 'Enforcement',
        body: [
          'We may remove content or suspend accounts that violate these terms or the review guidelines. Serious abuse is blocked at the network level.',
        ],
      },
    ],
  },
  {
    slug: 'disclaimer',
    title: 'Disclaimer',
    description: 'The limits of what The Real China can promise.',
    updated: '2026-09-24',
    sections: [
      {
        h: 'Reviews are opinions',
        body: [
          'Ratings and reviews reflect individual experiences at a point in time. They are not guarantees of your experience, endorsements, or professional advice.',
        ],
      },
      {
        h: 'University information',
        body: [
          'Program availability, tuition, entry requirements and policies change — always confirm with the university before applying.',
        ],
      },
      {
        h: 'External links',
        body: [
          'Links to university sites and other resources are provided for convenience; we do not control their content.',
        ],
      },
    ],
  },
  {
    slug: 'report',
    title: 'Report Content',
    description: 'How to report a review, profile, or listing.',
    updated: '2026-09-24',
    sections: [
      {
        h: 'What to report',
        body: [
          'Fake reviews, spam, harassment, hate speech, private information, impersonation, or content posted by someone who never attended the university.',
        ],
      },
      {
        h: 'How to report',
        body: [
          'Email nihao@therealchina.net with the page URL and what is wrong. Include evidence if you have it (screenshots, links). Safety issues are handled first.',
        ],
      },
      {
        h: 'What happens next',
        body: [
          'A human reviews every report. If content violates policy it is removed; the reporter is not identified to the author. Universities reporting negative reviews are directed to our editorial policy.',
        ],
      },
    ],
  },
]

export const trustDocBySlug = (slug: string | undefined): TrustDoc | undefined =>
  TRUST_PAGES.find((d) => d.slug === slug)
