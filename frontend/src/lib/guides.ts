// Guides — editorial content for /guide/:slug, versioned with the site.
// Same pattern as trustContent.ts: one source file, prerendered at build
// time, no DB needed. Bump `updated` whenever a guide's content changes —
// it renders on the page, feeds sitemap lastmod and articleSchema.
export interface GuideSection {
  h: string
  id: string // anchor — also used by the on-page table of contents
  body?: string[]
  list?: string[]
}

export interface GuideDoc {
  slug: string
  title: string
  description: string
  published: string
  updated: string
  sections: GuideSection[]
  related: { label: string; href: string }[]
}

export const GUIDES: GuideDoc[] = [
  {
    slug: 'check-if-chinese-university-legit',
    title: 'How to check if a Chinese university is legit',
    description:
      'The checks to run before you apply or pay anyone: the official list, the visa form, rankings, and the red flags agents hope you skip.',
    published: '2026-09-26',
    updated: '2026-09-26',
    sections: [
      {
        h: "Start with the government's list",
        id: 'official-list',
        body: [
          "China's Ministry of Education maintains the official list of institutions approved to enroll international students (the 涉外监管信息网, jsj.moe.gov.cn). If a school isn't on it, it cannot legally enroll you in a degree program. Full stop.",
          "The list is in Chinese, so search the school's Chinese name, not the English marketing name. If an agent tells you a school is 'approved' but can't show you the listing, that tells you something.",
        ],
      },
      {
        h: 'Ask about the JW form',
        id: 'jw-form',
        body: [
          "For a degree program, the university itself issues a visa application form (JW202 for self-funded students, JW201 for scholarship students). It's the document that turns your admission notice into a student visa application.",
          "If a program can't or won't produce one, you are not enrolled in anything that leads to a student visa. No form, no visa, no degree. We have a separate guide on what the JW forms are and how they work.",
        ],
      },
      {
        h: 'Sanity-check the footprint',
        id: 'footprint',
        body: [
          "Recognized universities show up in ranking publications (ShanghaiRanking is the standard domestic one), have a working official website, and appear in other students' accounts online. A 'university' with no footprint anywhere is a flag.",
          'One caveat: small vocational colleges can be legitimate and still rank nowhere. When the footprint is thin, the government list matters more, not less.',
        ],
      },
      {
        h: 'Check recognition at home',
        id: 'recognition',
        body: [
          "If you plan to work or study further back home, check whether your country recognizes Chinese degrees. Most do through bilateral agreements, and China's own credential service (CSCSE) verifies Chinese degrees for use inside China.",
          'For regulated fields like medicine or engineering licensure, confirm with your home licensing body before you pay anything. Recognition for work is a different question from recognition of the school.',
        ],
      },
      {
        h: 'Red flags',
        id: 'red-flags',
        list: [
          'Guaranteed admission regardless of your grades or language scores',
          'Fees payable to a personal account, or by WeChat transfer to an individual',
          'A "scholarship" that needs an upfront payment to unlock',
          'No JW form offered for what is supposedly a degree program',
          'A campus address that maps to an office building',
          'Pressure to pay "today only" before the offer expires',
        ],
      },
      {
        h: 'Then read what students say',
        id: 'reviews',
        body: [
          "Once a school clears the paperwork checks, the remaining question is whether you'll actually like it there. That's what reviews are for — browse the universities and see what students report about dorms, costs, admin support and daily life.",
        ],
      },
    ],
    related: [
      { label: 'Browse universities', href: '/universities' },
      { label: 'JW201, JW202 and the student visa, explained', href: '/guide/jw202-visa-forms' },
      { label: 'How we verify reviews', href: '/editorial-policy#how-we-verify' },
    ],
  },
  {
    slug: 'jw202-visa-forms',
    title: 'JW201, JW202 and the student visa, explained',
    description:
      'What the JW forms are, who issues them, and how they connect to the X1/X2 visa and your residence permit after arrival.',
    published: '2026-09-26',
    updated: '2026-09-26',
    sections: [
      {
        h: 'What the form is',
        id: 'what',
        body: [
          'The JW form (Visa Application Form for Foreigners Studying in China) is the document that connects a university admission to a visa application. JW201 goes to students on Chinese government scholarships; JW202 goes to self-funded students. Same family of form, different funding source.',
          "You'll see it called the visa form, the study visa form, or just the JW202. Whatever the name, it's the piece of paper the embassy wants to see alongside your admission notice.",
        ],
      },
      {
        h: 'Who issues it',
        id: 'who-issues',
        body: [
          'Your admitting university issues it — not the embassy, not an agent. It comes after you accept an offer, through the official enrollment system.',
          "That has a useful side effect: anyone selling a JW form who isn't the university is selling a fake one. If a school can't produce the form for a degree program, question whether it's a real degree program.",
        ],
      },
      {
        h: 'How it connects to the visa',
        id: 'visa',
        body: [
          'You take the admission notice and the JW form to a Chinese embassy or consulate — or through the online visa system where that applies — and apply for a student visa. X1 covers programs longer than 180 days, which means most degrees. X2 covers stays under 180 days: exchanges, language semesters, short courses.',
          'The visa in your passport gets you into the country. It is not the final permission to stay.',
        ],
      },
      {
        h: 'After you land',
        id: 'after-arrival',
        body: [
          'X1 holders convert the visa into a residence permit within 30 days of arrival, at the local exit-entry office, using the same admission notice and JW form. Universities usually walk new international students through this in the first week.',
          'Keep the originals safe. You will need them again for the residence permit, and replacing them is slow.',
        ],
      },
      {
        h: 'What it is not',
        id: 'not',
        list: [
          'Not a scholarship by itself — the JW201 just marks that you have one',
          'Not a residence permit — that comes after arrival',
          'Not transferable — change universities before arrival and you need a new form',
        ],
      },
      {
        h: 'Timing',
        id: 'timing',
        body: [
          'Universities issue the JW form after admission is confirmed, and the wait is measured in weeks, not days — longer around the September intake. Plan your visa appointment around the document, not the other way round.',
        ],
      },
    ],
    related: [
      {
        label: 'How to check if a Chinese university is legit',
        href: '/guide/check-if-chinese-university-legit',
      },
      { label: 'Browse universities', href: '/universities' },
      { label: 'How we verify reviews', href: '/editorial-policy#how-we-verify' },
    ],
  },
]

export const guideBySlug = (slug: string | undefined): GuideDoc | undefined =>
  GUIDES.find((g) => g.slug === slug)
