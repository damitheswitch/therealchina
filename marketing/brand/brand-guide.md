# TRC brand guide

Status: first draft for owner review, 2026-10-27.
Existing website identity is recorded below. Marketing positioning, examples,
and production defaults are proposals unless labeled otherwise.

## Identity and positioning

Existing source: `frontend/src/lib/seo/site.ts`.

- Name: The Real China. Short form: TRC.
- Current tagline: "Honest reviews of Chinese universities, by international students".
- Current focus: international students researching Chinese universities, with
  experiences covering costs, campus life, and support.
- Identity and links must be checked against `site.ts` when preparing a campaign.
  This document does not replace that source.

Owner direction: TRC is a student-built space for honest university reviews.
Current students and alumni create its value by sharing what university life is
really like. Prospective students use those experiences to make better-informed
choices and, where contact details are voluntarily shared, connect with students.

Do not broaden the promise to every aspect of travel, work, immigration, or life
in China without an owner decision and content that supports it.

## Two audience roles, contributors first

Geography is not the audience filter. A graduate who left China can contribute
valuable experience; someone already in China may be choosing their next school.
Classify people by firsthand experience and need, not their present country.
Current students and alumni are the permanent priority. Prospective students
and other interested readers benefit from the reviews they create.

|                              | Contribution                                                                         | Research                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Brief audience ID            | `contributors`                                                                       | `prospective_students`                                                                    |
| Primary person               | Current students and alumni with firsthand experience, anywhere                      | Prospective students and other interested readers, anywhere                               |
| Job                          | Share firsthand university experience                                                | Understand options and reduce uncertainty before applying                                 |
| Motivation                   | Help another student; receive a useful thank-you when the planned incentive launches | Hear firsthand experiences, including strong criticism; connect where contacts are shared |
| Likely friction, to validate | Time, privacy worries, unclear benefit                                               | Trust, relevance, sparse reviews, outdated information                                    |
| Useful content               | Specific prompts about dorms, teaching, costs, administration                        | How to research schools, read reviews, and check practical details                        |
| Primary CTA                  | Tell the next student what your university is really like                            | Hear from students at the university                                                      |
| Main outcome                 | Genuine, useful, detailed reviews; sign-ups and filled profiles support this         | Informed research and voluntary student connections                                       |

The planned VPN thank-you may be prominent in a review campaign without turning
it into a paid-plan sales campaign. The mission and the material reward limits
must both remain clear. Keep standalone service sales campaigns separate.
Positive, mixed, and negative reviews qualify equally. Criticism or profanity
alone is not a reason to reject a genuine review; apply the same detail standard
and existing rules against fake content, threats, harassment, and private data.
Never encourage students to invent detail merely to fill fields.

### Privacy messaging

Owner priority: explain that students do not have to choose between having an
account and keeping an eligible review nameless publicly. The repository has a
guest-review claim flow that can keep a review anonymous when attached to an
account (`ReviewClaimPrompt.tsx`, `MyReviews.tsx`, `ReviewCard.jsx`).
Verify the intended journey before advertising it; do not imply every signed-in
submission offers the same anonymous-posting control.

Describe public identity masking accurately. Never promise "no one can track you
down", complete anonymity, or guaranteed protection against consequences.
The story, dates, course, photos, or events can identify someone even without
a name. Public WeChat handles are optional; do not tie them to reward eligibility.
The guest email field in `components/review/fields.tsx` is currently optional.
Future reward fulfillment needs an explicit explanation and delivery process;
do not imply that submitting an anonymous review requires an email today.

## Commercial content

Commercial offers are a separate campaign objective, not a third undifferentiated
audience. Choose who needs the product and when, then apply
[commercial-policy.md](commercial-policy.md).

VPN buyer needs, translation needs, language, location, and readiness to buy are
unknown until specified. Do not assume every student wants these services.
Admissions referrals are exploratory and on hold.

## Voice

Owner-confirmed direction, with execution defaults:

- Students to students. Their space, not a company talking down to them.
- Direct, useful, candid. Explain whom a contribution helps and why it matters.
- Leave room for frustration and praise. Do not manufacture controversy or
  suggest negative reviews are more eligible than positive ones.
- Give a concrete detail rather than a broad promise.
- Separate someone's experience from a general fact.
- Admit gaps, low review counts, and uncertainty.
- Respect both China and the audience. Avoid exoticizing, savior language,
  fear-based stereotypes, or presenting one campus as representative of a country.
- The founder is a fellow community member, not a guru or hero. Personal
  appearance is case by case, when useful, not a founder-led brand default.
  Avoid boasting, status language, or implying the founder's experience matters
  more than other students'. This is a voice principle, not a claim that
  moderation or operational responsibilities do not exist.
  Do not invent a founder biography, experience, or quote.
- English by default, as confirmed by the owner, until a campaign specifies another language.
  Localized copy needs a fluent reviewer, not just an AI translation.

Existing project copy rules also apply:

- No em or en dashes in public copy.
- No hype such as "seamless", "unlock", or "elevate".
- Avoid repetitive slogan structures and artificial punchline fragments.
- Short, specific sentences. No fake urgency, invented scarcity, or guilt.

### Copy examples, not approved campaigns

| Purpose          | Avoid                                                     | Proposed draft                                                                                  |
| ---------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Review request   | "Leave us five stars and help TRC win!"                   | "Tell the next student what your university is really like."                                    |
| Specific prompt  | "Tell us everything about your amazing journey."          | "What should a new student know about your dorm?"                                               |
| Research         | "Discover the perfect university and secure your future." | "Hear from students at the university, including what they wish they had known before joining." |
| Limited evidence | "Everyone loves this campus."                             | "Read the experiences shared for this university."                                              |
| Commercial       | "The best VPN, guaranteed to work everywhere."            | Do not write a recommendation until the product, evidence, terms, and disclosure are approved.  |

These examples are newly written copy, not student quotes. They must never appear
as testimonials.

The owner values direct student connections and firsthand accounts over polished
promotion. Do not turn this into an unsupported claim that Reddit, Instagram, or
YouTube contain no useful firsthand information.

## Visual identity

Existing source: `frontend/src/styles/global.css`. Recheck it when producing
assets; these values are a convenient snapshot, not new design tokens.

| Role             | Existing value |
| ---------------- | -------------- |
| Primary seal red | `#A6192E`      |
| Gold accent      | `#C9A227`      |
| Rice background  | `#FAF6EF`      |
| Ink text         | `#1A1613`      |
| Secondary ink    | `#4A413B`      |
| Display type     | Noto Serif SC  |
| Body type        | Inter          |

Proposed marketing treatment: warm backgrounds, clear ink text, restrained red,
small gold accents, generous space, and one clear visual idea per frame.
Do not use gold as small body text on a light background without contrast checks.
Existing fonts do not establish coverage for every language; check glyph support
and licensing for the intended export.

Logo source: `frontend/src/components/Logo.jsx`. The static
`frontend/public/favicon.svg` is a simplified mark, not an identical master.
No dedicated approved marketing logo pack was established during this draft.
Request or export a suitable owner-approved master before a final branded export.
Do not redraw the logo with an image generator.

Reference candidates: the website identity and `frontend/public/og/default.png`.
These are existing assets, not yet an owner-approved moodboard. The owner should
supply three examples to emulate and three to avoid.

Owner-approved format flexibility: real student-life material, actual TRC
screenshots/recordings, bold type/graphics, and illustrative AI imagery/animation
are all available ingredients, subject to rights and truthful presentation.
Recommend the format that serves the message and workload; do not require the
owner to pick a medium before showing concrete creative directions. There is no
requirement to rotate formats, use AI in every post, or feature the founder.

## Images, video, and animation

Proposed defaults:

- Prefer authentic, licensed campus/student footage for factual campus content.
- Generated scenes are illustrative. Never label them as a real campus,
  actual dorm, student testimonial, or documentary evidence.
- Avoid fake university affiliations, official-looking seals, invented signs,
  identity documents, and realistic fake student reviews.
- Use generators for clean visual material. Add exact typography, CTA, logo,
  disclosures, and sourced screenshots in the editing/layout step.
- Preserve room for captions and platform controls. Confirm current placement
  dimensions and safe areas before export; no platform spec is assumed current.
- Keep movement purposeful and readable. Avoid flashing and unreadably fast cuts.
- Caption speech, check contrast, and make the message understandable without sound.
- Voice clones, real faces, music, and footage need appropriate permission/rights.

For continuity, choose an approved keyframe before animation. Record subject,
wardrobe, setting, palette, camera, motion, and reference IDs per shot.
One approved frame does not establish that the motion output is correct.

AI disclosure wording and placement depend on the content and distribution
requirements. Flag synthetic people, realistic generated scenes, and altered
evidence for explicit review. Never hide synthetic media to create false proof.

## Not decided yet

Campaign-specific countries beyond the initial network, humor/profanity in
TRC's own voice, approved visual references, budget,
reward mechanics, and fulfillment. English, WeChat/Instagram, contributor-first
priorities, and a sustainable every-other-day cadence are recorded owner direction.
Founder appearance is case by case and formats are flexible within the brand.
See [the interactive discussion record](../review-questions.md).
