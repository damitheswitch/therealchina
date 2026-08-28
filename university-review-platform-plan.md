# The Real China (TRC) — Project Plan

## The ++idea++

Community-driven, honest reviews of Chinese universities for prospective
international students. Existing options (iAgora, EDUopinions) exist but
have thin coverage per school and aren't where the target audience
actually talks (WeChat groups, Xiaohongshu/RED, Reddit). The gap is
aggregation + searchability, not "first review site."

## MVP scope (what's in, what's out)

**In:** no login required to view or submit reviews. Landing page +
per-university profile pages + a no-login review form.

**Seeding plan:** build the MVP fully first, then send it
privately to friends to submit their own real reviews through the
actual form. This doubles as a functional test of the submission flow
itself, rather than hand-entering data that bypasses whatever bugs
the form has.

**Deliberately out for now (phase 2+):**

- Accounts/auth — reconsider around the 100-review mark
- Comments/thread-style follow-up Q&A under reviews
- Partnerships with universities, agencies, accommodation providers,
VPN providers, brand deals of any kind — ruled out for now
- University UI localization (Russian, Darija, Spanish, etc.) —
reviews can be submitted in any language for free already; don't
build translated UI until real traffic data shows demand
- Any moderation/spam gate (see below) — fine while only trusted
friends are submitting, needs to come back before opening to
strangers



## Target audience / market notes

- Real sender-country data backs the targeting instinct: Pakistan,
Bangladesh, Russia, and Central Asia are genuine top-sender regions
to China. Morocco and Spanish-speaking countries are not — those
stay personal-network plays, not market bets.
- Monetizable-audience thinking (currently: newcomers/high schoolers
rather than current students) is open to change as more is learned
about the market.
- Incentive ideas: an optional promo field in the review form letting
reviewers link a WeChat/Instagram/RED/any social profile, shown as
a small banner on their review. Plus a referral program: a hidden
`?ref=` link captures who referred a submission (invisible to the
reviewer, adds no friction), paid out manually (~1rmb/review) for
now rather than automated.



## Tech stack (and why)

- **Data store: Airtable (free tier), two tables.**
  - `Universities` — seeded from a public GitHub dataset (582 Chinese
  universities: Chinese name, English name, city, website, logo
  URL). Keeping all fields including logos for now; will drop logos
  later only if they're confirmed broken on the live site, not
  preemptively.
  - `Reviews` — University (linked), Program (optional), Degree Level
  (optional), Overall_Rating (single number 1-5, meaning shown in
  UI: 1 Poor → 3 So-so → 5 Amazing), Review_Text (required),
  Media_URL (optional), Promo_Link (optional — social profile
  banner), Referral_Code (hidden, auto-captured from the URL,
  invisible to the reviewer).
  - No Status/moderation field and no honeypot right now — there's no
  automated way to act on either yet, and only trusted friends are
  submitting during this phase. Revisit both before opening past
  the friend circle.
  - Airtable is a validation tool, not the permanent backend — plan
  to migrate to a real database once traffic/volume outgrows it.
- **Frontend: static HTML/CSS/vanilla JS.** 
 simplest path wins: no build step, no bundler, drag-and-drop
or git-connected deploy just works. Generated via Bolt.new (free
tier, exports/downloads real code, no lock-in), then edited by hand
in Cursor/Claude Code.
- **Hosting: Netlify**, free tier. Simplest option for a static site;
not worth further comparison shopping at this stage.
- **Data fetching: build-time, not runtime.** A small script pulls
data from Airtable at build time and generates static pages.
Visitors hit static files, not the Airtable API directly — avoids
rate limits.
- **Review submission → a Netlify Function**, not directly to
Airtable from the browser. The function holds the Airtable API key
server-side (never exposed to the client) and writes the record.
No n8n involved (that was a job tool, not used here).
- **Rebuild trigger:** new approved content triggers a Netlify build
hook to regenerate the static site.



## Branding

- Name: **The Real China (TRC)**
- Direction: red and gold, with dragon motifs — audience is young,
needs to feel trustworthy and community-driven, not tacky or
cliché "Chinese restaurant" red/gold.
- Design approach: ground the palette in real Chinese material
culture (seal-ink red, brass/antique gold, rice-paper background,
ink-black text) rather than a generic gradient. Use a red
seal-stamp (印章) as the signature visual element — seals are
literally used to authenticate documents in Chinese tradition,
which ties directly into "verified, authentic reviews." A single
restrained dragon line-motif accompanies the logo; not repeated
as background decoration.



## Status: done vs. not done

**Done:**

- Airtable base created — both tables built (`Universities` via CSV
import, `Reviews` via Airtable's AI table-creation prompt)
- University seed data sourced and imported (names, city, website,
logos — all kept)

**Not done yet:**

- Frontend shell (landing page, university profile template, review
form) — next step, detailed prompt below
- Netlify Function for review submission
- Build-time script to generate static pages from Airtable data
- Seeding via friends (after the MVP is functional)



## Immediate next step: front-end prompt for [Bolt.new](http://Bolt.new)

```
Build a static website called "The Real China" (TRC), plain
HTML/CSS/vanilla JS only — no React, no Vue, no build framework,
no backend or database (I will wire real data myself later). Use
placeholder/dummy content for now.

BRAND DIRECTION:
Audience is young international students; the site must feel
trustworthy, community-driven, and authentic — never tacky or
like a generic "Chinese restaurant" red-and-gold cliché. Ground
the palette in real Chinese material culture rather than a
gradient: a deep seal-ink red (around #A6192E), a muted antique
gold/brass accent (around #C9A227), a warm rice-paper background
(around #FAF6EF), and near-black ink text (around #1A1613) rather
than pure black. The signature visual motif is a red seal-stamp
(印章) mark — used as a "verified review" badge and worked into the
logo — since seals are traditionally used to authenticate
documents, which ties directly to the site's purpose (authentic,
real reviews). Include one subtle, restrained dragon line-motif in
the logo area only — do not repeat it as a background pattern.
Typography: a display face with some brush-like character for
headlines, paired with a clean, modern, highly legible sans for
body text and UI. Mobile-first, generous whitespace, no clutter.

PAGES:

1. Landing page: compact hero (one-line mission statement + two
buttons: "Browse Universities" and "Leave a Review"), then straight
into a searchable/filterable grid of university cards (name, city,
average star rating or "No reviews yet"). Most of the page should
be the browsable grid, not the hero.

2. University profile page (one reusable template): name and city
header, a large aggregate star rating at top (with the red
seal-stamp badge if the university has verified reviews), then a
feed of review cards below — each showing the star rating, review
text, optional image, and a small promo banner if the reviewer
linked a social profile (WeChat/Instagram/RED/other). Repeat the
"Leave a Review" button on this page too.

3. Review submission page, no login. Show only two fields by
default: a single star-rating input (1-5, with labels appearing on
hover/tap: 1 Poor, 3 So-so, 5 Amazing) and a review text box. Below
that, a collapsed "Add more detail (optional)" section that expands
to reveal: university dropdown (with a "my university isn't
listed" option that reveals two inline fields — name, city —
instead of navigating away), program, degree level, media URL, and
a social profile/promo link field. Submit posts JSON to a
placeholder "/api/submit-review" (I'll replace this later).

Keep the code simple and readable — a developer extends it by hand
afterward.
```



## After this

Pull the Bolt.new output into Cursor/Claude Code, write the
build-time Airtable script, wire the form to a Netlify Function,
seed by sending it to friends, then plan the soft launch.