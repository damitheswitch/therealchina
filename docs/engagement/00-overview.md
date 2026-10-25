# Engagement Plan: Review Flow First, Incentives Next

**Status:** Living master plan. Started 2026-10-05.
**Latest owner decisions:** recorded 2026-10-13. Flow first remains the
foundation; the pre-change baseline wait is waived. Next work is contact
emails, a small contributor-recognition proposal, and community growth on TRC.
**Audience:** the project owner and any coding agent picking up a piece of this.

## Current coordination status (2026-10-13)

| Phase                    | Current state and evidence                                                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Measurement            | Released per owner confirmation; prior instrumentation/deploy evidence is recorded in Phase 1. No pre-change baseline was captured or will be invented. Continue measuring.                           |
| 2 Fast review flow       | Released per owner confirmation. Earlier local/preview checks remain in the phase doc; this coordinating agent has not independently checked the production deployment.                               |
| 3 Anonymous Boost        | Released per owner confirmation. Existing 24-hour limited edit window remains; no authorization change is approved for email convenience.                                                             |
| 4 Review display         | Released per owner confirmation. Gold glow, not an extra badge; detailed means at least 3 of 7 areas.                                                                                                 |
| 5 Contact emails         | Planned. Owner wants reminders before anonymous expiry and a thank-you at the existing detailed threshold, under one visible non-commercial contact policy.                                           |
| 6 Q&A                    | Released per owner confirmation; owner reports no user posts yet. Community growth/format work is planned, not implemented.                                                                           |
| 7 Recognition/incentives | Planning direction: Google-style recognition plus playful progress, rewarding contribution and helpfulness. Exact mechanics remain open. Dragon is an idea only; points/referrals/cash are undecided. |

Owner confirmation is recorded as its own evidence source, not relabeled as
independent staging or production verification. Agents must distinguish
planned, implemented, verified on staging, and released. A report or merge
alone does not prove a deployed feature works.

## How to use this doc

- This is the **root plan**. It is deliberately too big to build as one PR.
- Each workstream in §7 is a **phase** with its own file in this folder
  (`01-measurement.md`, `02-review-flow.md`, ...). Use the session briefs and
  integration order below, not a blind restart of released phases. Each file
  separates **owner decisions**, proposed defaults, and unresolved choices;
  an agent should not guess approvals.
- When a decision changes, update this file in the same PR. Don't let it rot.
- Agents: read `AGENTS.md` first. Its rules (environments, grants, copy rules,
  verification gate, SEO guardrails) override anything written here.

---

## 1. The problem

- Students prefer **WeChat groups** over the site. The owner explicitly wants
  users to move their participation onto TRC, not merely use it as WeChat's
  searchable archive. WeChat may still be an acquisition channel.
- The **community Q&A** is reported live on production by the owner, with no
  user posts yet. Its mock implementation was replaced by real tables/write
  paths (see Phase 6). Empty content is a community activation issue, not a
  reason to invent posts or claim the deployment failed.
- **Friends asked to leave reviews didn't.** 3 to 4 people asked, near zero
  results.
- **The review form is too long.** Observed directly: a friend on a Discord call
  got bored partway through the wizard.

## 2. Decision: fix the review flow before incentives

1. Incentives push people **into** the funnel; the flow decides how many come
   **out**. Paying for 20 starts that yield 4 reviews wastes the incentive.
2. There is direct evidence the flow loses people (the Discord call).
3. The strongest incentive patterns (see §4, "give to get") only work when
   contributing is cheap. A 6-minute form can't be a toll gate.
4. It is entirely in our control and needs no audience to ship.

Incentives are not dropped. They are workstream F, built on top of the fixed flow.

## 3. Historical diagnosis of the legacy wizard

This is the original 2026-10-05 diagnosis, not the released two-screen flow.
File lengths, step numbers, and findings below describe that old layout.

File: `frontend/src/components/ReviewWizard.tsx` (1643 lines, 5 steps,
`TOTAL_STEPS = 5` at line 48). Background on why it was built this way:
`REVIEW_WIZARD_CHANGES.md`.

| Step        | Inputs                                                                                                                                | Required                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1 Basics    | university, program, overall stars, recommend                                                                                         | all 4                   |
| 2 Ratings   | 8 sub-score star rows                                                                                                                 | none                    |
| 3 Details   | enrollment status, start year, end year, instruction language, degree level, tuition, living cost, funding, coverage, tags (28 chips) | start year              |
| 4 Story     | pros, cons, review text, media                                                                                                        | review text >= 10 chars |
| 5 About you | anon email, home country, current status, languages, email consent, Turnstile                                                         | none                    |

Findings:

- **31 inputs across 5 screens; only 6 are required.** The UI doesn't make that
  visible, so the user feels the weight of all 31.
- **Three blank textareas on one screen** (pros, cons, review). Writing is the
  costly part; three empty boxes read as three essays.
- **The only required field in step 3 (start year) is a dropdown**, and the
  step's "Skip" button still runs validation (lines ~1335-1339), so "Skip" fails
  when start year is empty. Confusing.
- **Step 5 is mostly friction for signed-in users**: values are prefilled from
  the profile (effect at ~line 536) but they still have to click through.
- **Anonymous reviewers hit a non-closable register modal** right after
  submitting (`closable: false`, ~line 818). It punishes the exact behavior we
  want.
- **Dropdowns everywhere** (`<select>` for years, language, degree, tuition,
  living cost, country, status, languages). Slow on phones, which is where this
  audience is (WeChat in-app browser).
- **Analytics were missing at diagnosis.** Phase 1 now records production
  activation after the CSP fix. The owner reconfirmed release and waived the
  baseline wait; use continuing Umami events plus read-only outcomes (§5).

## 4. What the leaders do (research summary)

| Who                 | Pattern                                                                                                                                                                        | What we take from it                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Local Guides | 1 pt for a star rating alone, 10 for a review, +10 bonus over 200 chars, points for photos/answers; levels and a badge next to your name                                       | A rating alone is a valid contribution. **Reward depth, don't require it.**                                                                                     |
| Glassdoor           | "Give to get": one contribution unlocks 12 months of full access. They report reviews collected this way spread more evenly across the 1-5 scale (less extreme-only reviewing) | Soft gate on the most valuable data, only once contributing is cheap                                                                                            |
| Niche               | Monthly $1,000 scholarship draw; every verified review is an entry                                                                                                             | One monthly draw beats paying per review                                                                                                                        |
| Reddit              | Founders posted ~most early content themselves (via many accounts) to set tone                                                                                                 | Cold start is solved by founders doing the work. **We do it under our own name, never fake accounts** (trust site; `AGENTS.md` forbids fabricated data on prod) |
| Stack Overflow      | Launched with traffic from two big existing blogs                                                                                                                              | Bring an existing audience. Ours lives in WeChat groups                                                                                                         |
| Zhihu               | Askers invite specific people to answer                                                                                                                                        | "Invite someone to answer" routing for Q&A                                                                                                                      |
| Form research       | Completion drops noticeably at 4-6 fields and falls off a cliff around 7-10. Questions users see a reason for cost less                                                        | Keep the pre-publish part tiny; explain why each extra question matters                                                                                         |

Sources:
[Glassdoor give-to-get (Clark)](https://clark.com/make-money/glassdoor/),
[Glassdoor rating balance (HR Review)](https://hrreview.co.uk/?p=106446),
[Local Guides points](https://support.google.com/maps/answer/6225851?hl=en),
[Niche sweepstakes](https://www.collegexpress.com/scholarships/school-survey-sweepstakes/2037039/),
[Reddit fake accounts (Vice)](https://www.vice.com/en/article/how-reddit-got-huge-tons-of-fake-accounts-2/),
[Stack Overflow launch (HackerNoon)](https://hackernoon.com/the-$18b-lesson-hidden-in-stack-overflows-launch-day),
[Form statistics (Crazy Egg)](https://www.crazyegg.com/blog/form-statistics/),
[Form length (Orbit Forms)](https://orbitforms.ai/blog/long-forms-reducing-completion-rate).

## 5. Measurement: what we can see today

### Where the data lives

`public.review_drafts` on the **TRC prod** Supabase project
(`hfinkagueeojyyrpauav`). Schema: `supabase/schema_snapshot.sql` (search
`CREATE TABLE IF NOT EXISTS public.review_drafts`).

How it gets written (all in `ReviewWizard.tsx`):

- Autosave, debounced 1.5 s, **signed-in users only**. Writes `progress =`
  the step the user is on (~line 486). Changing step changes the payload, so
  every step change triggers a save.
- Only saves once `isDraftWorthSaving` is true (`frontend/src/lib/reviewDrafts.ts`):
  any of rating, text, program, university, a sub-score, or step > 1.
- **On successful submit the draft row is deleted** (~lines 790-799). So rows
  left in the table are reviews that were started and not (yet) finished.
- One row per user per university (unique index on `(user_id, university_id)`).
- Feature reached prod with PR #37 (merged to `master` 2026-09-28), so there is
  roughly a week of data at the time of writing. Expect small numbers.

### What it can't see

- **Anonymous users.** Their drafts live in `localStorage` only.
- **People who bounce before touching anything.** No row is written until
  `isDraftWorthSaving`.
- **Funnel history.** It's a snapshot: if a user goes back from step 4 to 2,
  `progress` becomes 2. Resuming later overwrites it.

### How to look at it (no admin panel needed)

Supabase dashboard → project **TRC prod** → **SQL Editor** → new query → paste →
Run. Save each one as a snippet so it's one click next time. **Run only
`SELECT`s on prod**: the SQL editor runs with full privileges.

Keep the two sources separate:

- `public.reviews` is the authoritative count of published outcomes.
- `public.review_drafts` is a snapshot of currently idle signed-in work. It is
  not a denominator for finished reviews because successful submissions delete
  the draft and anonymous drafts never reach the table.

For a dated before/after window, use the full bounded queries in
[01-measurement.md](01-measurement.md#baseline-queries). The important
definitions are:

```sql
-- Authoritative published outcomes for a bounded window.
select
  date_trunc('day', created_at)::date as day,
  count(*) as published_reviews,
  count(*) filter (where user_id is null) as anonymous_reviews,
  count(*) filter (where user_id is not null) as signed_in_reviews
from public.reviews
where deleted_at is null
  and created_at >= '<window_start_utc>'
  and created_at <  '<window_end_utc>'
group by 1
order by 1;
```

```sql
-- Idle signed-in draft snapshot. This is not a conversion denominator.
select
  progress as stopped_at_step,
  count(*) as idle_drafts,
  min(updated_at) as oldest_update,
  max(updated_at) as newest_update
from public.review_drafts
where updated_at < now() - interval '1 hour'
group by progress
order by progress;
```

The same measurement file has an optional-field fill-rate query for the same
review cohort. The owner waived the pre-change baseline on 2026-10-11 and
reaffirmed that decision on 2026-10-13. Measure continuously and record dated
windows/raw counts when reviewing outcomes; no observation-week release wait.
No missing pre-change baseline or before/after uplift may be invented.

### Tools that won't answer this

- **Google Search Console**: shows Google search traffic (queries, impressions,
  clicks, indexing). Nothing about what happens inside the site. Still useful
  for SEO.
- **Netlify**: its paid Analytics add-on counts server requests per URL. The
  whole wizard is one URL (`/review`) and client-side navigation after hydration
  never hits the server, so steps are invisible.
- **Supabase Reports**: infra metrics (API calls, DB load), not product
  behavior.

### Admin panel?

Not yet. The Supabase dashboard plus saved SQL snippets is the admin panel at
this size. Revisit when one of these is true: someone non-technical needs
access, you check the numbers daily, or you need moderation actions (hide
review, ban user) with an audit trail.

## 6. Target review flow

Principle: **publish a small real experience, then collect optional detail
through Boost.** The Phase 2 publish minimum is university (including the
not-listed proposal path), stars, and review text of at least 10 characters.
Program, recommendation, and start year are not required. See Phase 2 for
implemented fields, validation, and draft compatibility; do not restore the
old six-field minimum.

The following original screen/card sketch is historical where it differs from
Phases 2 to 4. Those phase files describe the implemented direction. Anonymous
email is currently optional on the story screen; anonymous reply notification
is not established merely by collecting it. Phase 5 owns the new disclosure
and routing changes.

### Screen 1: the essentials (all taps)

- University: prefilled from `?uni=` (already supported).
- Program: prefilled from profile (already supported).
- Overall stars, Recommend: unchanged.
- **Start year as chips** (`current year - 6` ... `current year`, plus
  "Earlier" which reveals the select). Replaces the step-3 dropdown.

### Screen 2: one thing you'd tell a friend

- **One** textarea (maps to `reviews.text`, still >= 10 chars).
- **Starter chips** that insert a sentence opening: "The best part is ",
  "The worst part is ", "I wish I knew ". Kills the blank page.
- Tag chips below ("Tap anything that fits"), optional.
- Hint that the phone keyboard's mic works (this audience already sends voice
  messages on WeChat). Don't build in-browser speech: Chrome's speech API
  depends on Google services blocked in mainland China.
- Turnstile for anonymous users, then **Publish**.

### Success screen (replaces the non-closable modal)

- Show their review exactly as it renders on the university page.
- "Make it more useful in 60 seconds?" → Boost.
- Sign-up offer with a concrete reason ("Get notified when someone replies to
  your review"; `comment-notify` already sends those). **Closable.**

### Boost: one card at a time, each saved immediately

| Today's field                                                   | New home                                                                                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 8 sub-scores                                                    | Card stack: one aspect per card, tap a score → next card, "Don't know" button. ~15 s for all 8                                  |
| Tuition, living cost, funding, coverage                         | One "money" card, chips only                                                                                                    |
| Enrollment status, end year, instruction language, degree level | One "details" card, chips only                                                                                                  |
| Pros / cons                                                     | "One more: what was the worst part?" (whichever wasn't covered)                                                                 |
| Media                                                           | "Got a photo of your dorm?"                                                                                                     |
| Home country                                                    | One tap; top-country chips (Pakistan, Bangladesh, Russia, Central Asia...) + autocomplete                                       |
| Anon email                                                      | On the success screen, framed as "get told when someone replies"                                                                |
| Languages, current status, email consent                        | Move to sign-up onboarding (`OnboardingForm.jsx` already collects them). Signed-in users with a complete profile never see them |

### Making Boost worth doing

- Live preview card fills in as each card is answered, plus a **review
  strength** meter.
- Detailed reviews use the existing **gold glow, no extra badge**. Phase 4
  defines the score and helpfulness sort; the owner also chose its existing
  3-of-7 threshold for Phase 5's completion thank-you.
- Next (workstream E): reminder below that threshold and a thank-you when it
  is reached. One non-commercial contact policy is the owner direction;
  timing/permission/routing contracts need refinement before sending.

### The data trade-off, stated honestly

Some people will publish and skip Boost, so the **average optional-field fill
rate per review may drop**. The bet is that total useful data goes up because
far more reviews get finished (today's observed outcome is a bored friend and
zero data). Judge continuing outcomes with dated published counts and
optional-field fill rates. With no captured pre-change baseline, do not claim
a measured before/after improvement.

## 7. Workstreams (each becomes its own sub-plan)

| Phase  | Workstream                                                  | Depends on                                                           | Plan                                         |
| ------ | ----------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------- |
| 1 (A)  | Continuing Umami events + read-only outcome queries         | No baseline waiting gate                                             | [01-measurement.md](01-measurement.md)       |
| 2 (B)  | Small publish minimum, success screen, signed-in Boost      | Measurement instrumentation                                          | [02-review-flow.md](02-review-flow.md)       |
| 3 (C)  | Anonymous Boost with per-review capability                  | Phase 2                                                              | [03-anon-boost.md](03-anon-boost.md)         |
| 4 (D)  | Gold glow, author strength meter, helpfulness sort          | Phase 2                                                              | [04-review-display.md](04-review-display.md) |
| 5 (E)  | Contact policy, pre-expiry reminder, detailed-review thanks | Phases 2, 3, 4 + resolved delivery contract                          | [05-reengagement.md](05-reengagement.md)     |
| 6 (F1) | Live Q&A + community growth/format proposal                 | Existing review/community paths; email invitations depend on Phase 5 | [06-qa-cold-start.md](06-qa-cold-start.md)   |
| 7 (F2) | Contributor recognition proposal; other incentives parked   | Phases 2, 4; shared interfaces with Phases 5, 6                      | [07-incentives.md](07-incentives.md)         |

The section letters (A to F) below are kept for reference; the phase files are
the source of truth once they exist.

### A. Measurement

- Selected: Umami Cloud plus read-only Supabase outcomes. Keep dated windows,
  raw sample sizes, and fill-rate results in `01-measurement.md` when reviewed.
- Its exact event contract/payload boundary is authoritative; the earlier
  generic step-event sketch is not a second event schema.
- Check mainland/WeChat reachability before treating observed events as
  representative. Local/preview tracking stays off by default; only one
  production Umami website currently exists.
- No new analytics vendor, events table, user identification, or baseline
  waiting period is approved by the latest planning sessions.

### B. Review flow (historical implementation checklist)

Phase 2 records the completed split, versioned drafts, and one-page edit
layout. The checklist below explains original risks, not permission to
rewrite the released flow independently in each new branch.

Files: `ReviewWizard.tsx`, `StarInput.jsx`, `lib/reviewDrafts.ts`,
`lib/reviewSubmit.ts`, `lib/reviewEdit.ts`, `global.css`.

Watch out for:

- **Draft compatibility.** `ReviewDraftPayload.step` and
  `review_drafts.progress` (CHECK 0..5) encode the old 5-step layout, and
  `applyDraftPayload` clamps to `TOTAL_STEPS`. Existing drafts saved at steps
  3-5 must still resume sensibly. Add a payload version or map old steps.
- **Edit mode** (`editReview` prop) reuses the wizard. Decide whether edit
  becomes "all cards on one page" or keeps steps.
- **Logged-in Boost** can use the existing `review-manage` update path
  (`lib/reviewManage.ts → updateReview`), which checks ownership via JWT.
- Everything still validated server-side by `review-submit`. Don't loosen any
  check; only the UI order changes.
- Copy rules from `AGENTS.md` apply: no em/en dashes in user-visible text,
  humanized wording.
- Consider splitting `ReviewWizard.tsx` (1643 lines) into
  `ReviewEssentials`, `ReviewStory`, `ReviewSuccess`, `BoostCards` as `.tsx`.

### C. Anonymous Boost (security-sensitive, original sketch)

The sketch below is superseded by Phase 3's implemented per-review hashed
capability, strict allowlist, atomic checks, and 24-hour window. In particular,
its old tags/media suggestion is not the current allowlist. Phase 5 must
preserve the implemented authorization model when adding email links.

Problem: `review-manage` requires a signed-in JWT, so anonymous reviewers can't
edit after publishing. The browser already holds a claim token
(`lib/reviewClaim.ts`, stored server-side on `reviewer_context`).

Proposed: new Edge Function (or a mode on `review-manage`) that accepts
`{ reviewId, claimToken, fields }` and:

- updates **only an allowlist of optional fields** (sub-scores, cost, funding,
  details, pros, cons, tags, media). Never `rating`, `text`, `university_id`,
  `user_id`;
- only while the review is still unclaimed and within ~24 h of creation;
- reuses `review-submit`'s validation (enums, ranges, lengths);
- is rate-limited and **fails closed** if the limiter is unavailable;
- follows the grants rule in `AGENTS.md` for any new SQL object
  (`REVOKE ... FROM PUBLIC, anon, authenticated`), with a migration +
  `schema_snapshot.sql` update and tests (Deno).

Tested locally → `trc-staging` → prod, per `AGENTS.md` environments.

### D. Display

- Gold glow only, no extra badge. The implemented Phase 4 helper in `lib/`
  defines detail areas and the 3-of-7 rule; do not add a competing formula.
- Helpfulness sort weighting completeness and upvotes.
- SEO: review markup rules in `AGENTS.md` still apply (no aggregateRating for
  numbers not on the page; `universitySchema` count >= 2 stays).

### E. Re-engagement

- Owner wants a reminder before anonymous Boost expiry and a thank-you when
  the existing detailed threshold is reached. Exact hours/frequency and safe
  recipient eligibility remain proposals in session 5A, not deployed rules.
- One visible non-commercial contact policy, no thank-you-specific checkbox.
  Do not silently repurpose legacy newsletter preferences or unverified
  anonymous addresses. This is not a legal conclusion about sending rights.
- Session 5A resolves policy, suppression, schedule, and same/different-browser
  edit-link behavior; session 5B implements and verifies the approved loop.

### F. Community growth and recognition

- **Owner goal: move participation from WeChat onto TRC.** Shareable links can
  bring people in, but repeat questions, answers, and review interactions
  should happen on TRC. Chat and image/experience posts are options to assess,
  not already approved features. Phase 6 sessions 6A/6B own that decision.
- **Recognize contributions and helpfulness.** Google-style recognition plus
  playful progress is the selected direction; exact badges/levels remain
  open in Phase 7 sessions 7A/7B. The dragon is a parked completion-meter idea,
  not an implementation task.
- **Participate as the founder.** Collect genuine recurring questions with
  appropriate permission, post under your own account, and answer them. The
  earlier 30-50 question suggestion is an aspirational owner task, not a
  release gate or completed dataset; the owner reports Q&A already live.
- The following legacy incentive ideas remain unapproved options, not tasks
  to code by implication:
- **Soft give-to-get.** Review text stays public; cost and dorm breakdowns
  unlock after any contribution (a quick review or one answer). **SEO risk:**
  crawlers and users must see the same content or it is cloaking. Needs an SEO
  sub-plan and `policy.ts` review before building.
- **Points and levels** (Local Guides style): rating, review, longer review,
  photo, answer, accepted answer. Show level on the review card. Ties into the
  existing social chip (`SocialChip.tsx`): higher levels get more visibility
  for the reviewer's link.
- **Monthly draw** instead of per-review payment (the old `~1 RMB/review` idea
  in `university-review-platform-plan.md`). Check the legal side (prize draws
  in China and wherever you operate) first.
- **Invite to answer** (Zhihu): route a question to reviewers of that
  university or city.

## 8. Test plan for the review flow

These are validation goals, not claims that all tests were completed. Consult
the phase evidence records; owner-reported release does not establish every
human timing/device test below.

- Five friends on a call, timed, the same way the problem was found.
  **Target: published in under 90 seconds.**
- On a phone, inside WeChat's in-app browser, on a mainland network without
  VPN. Check Turnstile loads (`challenges.cloudflare.com`) and the Supabase
  calls complete. Unverified so far.
- Resume an old draft saved at step 3, 4 and 5 (compatibility, see B).
- Anonymous path end to end: publish → Boost → claim after sign-up.

## 9. Open questions for the owner

Moved: every open question now lives in the "Owner decisions" section of the
phase it blocks (files 01-07). Record the answer there, with the date, before
handing the phase to a coding agent.

## 10. Separate session handoffs and integration order

1. **5A: contact policy/delivery contract** in `05-reengagement.md`, then
   **5B: email implementation** after the unresolved contract is approved.
2. **7A: small contributor recognition proposal** in `07-incentives.md`, then
   **7B: implement the selected minimum** after names/earning rules/benefits
   are approved. No dragon, cash, points ledger, or gating by implication.
3. **6A: community growth/format decision** in `06-qa-cold-start.md`, then
   **6B: the selected community pilot** after scope approval. No blanket chat,
   DM, media-upload, or social-feed implementation permission.

Planning sessions 5A, 7A, and 6A may run concurrently. Each should read this
master doc and its related phase interfaces, and end with decisions/open
questions rather than a "shipped" claim. No specialized agents were launched
by this coordinating session.

Implementation uses separate feature branches/worktrees from current staging,
not stale historical Phase 2/3/4 branches. Recommended integration: contact
policy/email contract first, then approved recognition, then the community
pilot. An on-site-only community pilot need not wait for email delivery, but
must integrate the agreed recognition interface if it uses it.

- Phase 5 owns disclosure, email preferences/suppression, sender, and link
  landing changes. Phase 7 owns contributor eligibility/display. Phase 6
  owns question discovery and any selected new posting/chat surfaces.
- Shared review success/form/profile/notification components need one owner
  at a time. Other branches should wait for the shared change, then merge
  current staging into their feature branch and rerun the full integrated
  gate. Do not independently rewrite the small publish flow or meter.
- Inspect staging migration history before numbering/pushing migrations;
  push from a clean worktree to avoid unrelated pending migration files.
- Local tests, staging migrations/functions/deploy verification, then master
  release. Record deploy identity and evidence for the combined build. No
  production test data or test emails to real users; preserve SEO/privacy
  protections and the analytics payload boundary.
- Continue measurement without a baseline waiting gate. New notification or
  incentive mechanisms are not proven effective until real data exists.

## 11. Changelog

- 2026-10-13: Recorded owner-reported releases for Phases 1-4 and 6, reaffirmed
  the missing-baseline waiver, and synchronized stale release gates. Recorded
  the TRC community migration goal, unified non-commercial contact direction,
  pre-expiry anonymous reminder, existing detailed threshold for thanks, and
  contribution/helpfulness recognition direction. Added separate session
  briefs to Phases 5-7; exact mechanisms remain proposals where undecided.

- 2026-10-05: Created. Decision: flow before incentives. Workstreams A-F defined.
- 2026-10-05: Renamed to `00-overview.md`. Split into phase files 01-07, each
  with owner decisions. §9 open questions moved into the relevant phases.
