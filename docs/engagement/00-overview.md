# Engagement Plan: Review Flow First, Incentives Next

**Status:** Living master plan. Started 2026-10-05.
**Owner decision so far:** fix the review flow before building incentives (see §2).
**Audience:** the project owner and any coding agent picking up a piece of this.

## How to use this doc

- This is the **root plan**. It is deliberately too big to build as one PR.
- Each workstream in §7 is a **phase** with its own file in this folder
  (`01-measurement.md`, `02-review-flow.md`, ...). Do them in order, one per
  coding session. Each phase file lists the **owner decisions** that must be
  made before coding starts; an agent should not guess those.
- When a decision changes, update this file in the same PR. Don't let it rot.
- Agents: read `AGENTS.md` first. Its rules (environments, grants, copy rules,
  verification gate, SEO guardrails) override anything written here.

---

## 1. The problem

- Students prefer **WeChat groups** over the site. The site has to feel more
  useful than the group chat, not compete with it on speed.
- The **community Q&A** (Reddit / Stack Overflow style) is a staging prototype
  backed by `frontend/src/lib/communityMock.ts`, with no real tables. It has
  the classic empty-room problem: nobody asks because nobody answers, and the
  reverse.
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

## 3. Diagnosis of the current wizard

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
- **No released product analytics** before Phase 1. Phase 1 instrumentation is
  merged to `staging`, but until Umami site IDs are configured, staging is
  verified, production is released, and a baseline is observed, the only
  durable signal is the drafts table (§5).

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
review cohort. Capture the production browser baseline only after Phase 1
events are released, then observe at least one complete pre-Phase-2 week.

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

Principle: **publish after the required fields, then collect the rest as an
optional "Boost".** Same 6 required fields as today. Nothing optional is
removed; it moves to after publishing, where each answer visibly improves a
review that is already live.

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
- Reviews above a completeness threshold get a **"Detailed review"** mark and
  rank higher under a helpfulness sort (`ReviewSortSelect.tsx`).
- Later (workstream E): follow-up email for missing fields.

### The data trade-off, stated honestly

Some people will publish and skip Boost, so the **average optional-field fill
rate per review may drop**. The bet is that total useful data goes up because
far more reviews get finished (today's observed outcome is a bored friend and
zero data). Judge it with the §5 baseline queries: finished reviews × fill rate,
before vs after.

## 7. Workstreams (each becomes its own sub-plan)

| Phase  | Workstream                                                        | Depends on                | Plan                                         |
| ------ | ----------------------------------------------------------------- | ------------------------- | -------------------------------------------- |
| 1 (A)  | Measurement baseline + step events                                | none                      | [01-measurement.md](01-measurement.md)       |
| 2 (B)  | Two-screen flow, success screen, Boost for signed-in users        | Phase 1 baseline captured | [02-review-flow.md](02-review-flow.md)       |
| 3 (C)  | Anonymous Boost (claim-token edge function)                       | Phase 2                   | [03-anon-boost.md](03-anon-boost.md)         |
| 4 (D)  | Display: "Detailed review" mark, strength meter, helpfulness sort | Phase 2                   | [04-review-display.md](04-review-display.md) |
| 5 (E)  | Re-engagement email for missing fields                            | Phases 2, 3               | [05-reengagement.md](05-reengagement.md)     |
| 6 (F1) | Q&A launch and cold start                                         | Phase 2 shipped           | [06-qa-cold-start.md](06-qa-cold-start.md)   |
| 7 (F2) | Incentives (points, give-to-get, draw)                            | Phases 2, 4               | [07-incentives.md](07-incentives.md)         |

The section letters (A to F) below are kept for reference; the phase files are
the source of truth once they exist.

### A. Measurement

- Run the §5 queries on prod, paste results into `A-measurement.md` with the date.
- Add step-level events that also cover anonymous users. Options:
  - Cookieless hosted analytics (Plausible / Umami style). Cheapest. **Open
    question:** reachability from mainland China without VPN; test before
    relying on it. Must not break prerender (no browser APIs during render,
    `AGENTS.md` SEO rule 10).
  - Own events table. Any anonymous write is abuse-sensitive per `AGENTS.md`,
    so it must go through a gated Edge Function, not a direct table insert.
    More work; only if hosted analytics is unreachable.
- Events needed: `review_step_viewed {step}`, `review_published`,
  `boost_card_completed {card}`, `boost_exited {after_card}`.

### B. Review flow (frontend-heavy)

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

### C. Anonymous Boost (security-sensitive)

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

- "Detailed review" mark + completeness score. Compute in SQL (view or
  generated column) or in `lib/`; add Vitest tests either way.
- Helpfulness sort weighting completeness and upvotes.
- SEO: review markup rules in `AGENTS.md` still apply (no aggregateRating for
  numbers not on the page; `universitySchema` count >= 2 stays).

### E. Re-engagement

- Email: "Your review of X is live. Add your dorm rating, it takes 10 seconds."
  Deep link to the missing Boost cards.
- Reuse the `comment-notify` patterns (send log table, consent checks). Only
  email people who consented.

### F. Incentives and Q&A cold start (ideas, not committed)

- **Be WeChat's memory, not its rival.** Groups win on speed and presence; they
  lose on search and memory (same question weekly, answers buried, invite-only
  joining). Make every answer a clean, shareable link people paste back into
  the group. Every paste is free distribution.
- **Seed the Q&A as the founder.** Collect the 30-50 most repeated questions
  from your groups, post them under your own account, answer them. Launch
  `/community` with real content, not empty.
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

## 8. Test plan for the new flow

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

## 10. Changelog

- 2026-10-05: Created. Decision: flow before incentives. Workstreams A-F defined.
- 2026-10-05: Renamed to `00-overview.md`. Split into phase files 01-07, each
  with owner decisions. §9 open questions moved into the relevant phases.
