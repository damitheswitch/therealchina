# Phase 6: Q&A launch and cold start

**Depends on:** Phase 2 shipped (so the review side stops losing people first).
**Status as of 2026-10-13:** released to production per owner confirmation;
not independently deployment-verified by this coordinating agent. The owner
reports an empty feed because no users have posted yet. Empty real content is
not a deployment failure and does not justify fake posts.
**Implementation record:** `feat/community-qa`, `qa_*` tables/public views
(migration 048), `community-submit` / `qa-notify`, live pages, mock deleted.
`/community` remains noindex unless a separate indexing decision changes it.
**Overview:** [00-overview.md](00-overview.md) §7 F.

## Goal

**Owner redirect, 2026-10-13:** bring users out of WeChat groups and into TRC
for questions, answers, review discussions, and repeat participation. WeChat
can be an acquisition channel, but remaining only a searchable companion to
WeChat is not the owner's end goal.

Build a real community without fake users or fabricated content. An empty
feed is acceptable as the honest starting state; recognition and new posting
formats alone do not supply the first real conversations.

## Decision memo — implemented defaults (2026-10-11)

The owner asked for a concise memo on every unresolved moderation,
anonymous-posting, notification, or indexing choice before enabling it. These
are the shipped defaults — each is reversible, and the exposure-expanding
ones are OFF until the owner says otherwise.

**D6.1 Seed content** — _unchanged, owner task._ No founder content is
invented or seeded by code; the feed honestly shows "No questions here yet."
The 30-50 question collection (who / by when) is still open and is a
community goal, not a code gate — the release does not wait on it.

**D6.2 Anonymous posting** — _implemented: account required for all writes._
The write path (`community-submit`) rejects unauthenticated callers (401) and
requires an onboarded profile; per-user rate limits apply (10 questions/h,
20 answers/h, 30 reports/h, fail-closed). What the UI calls "Post
anonymously" is display-only masking: `is_anonymous` hides the name publicly
(base tables are not client-readable at all — reads go through masking views)
while `author_id` keeps the caller traceable for moderation. Fully anonymous
_write_ (no account) stays disabled — it would need Turnstile + stricter
limits and is a future owner decision.

**D6.3 Indexing** — _implemented: all `/community` routes stay noindex._ The
proposal for later (needs owner approval before enabling): a thread becomes
indexable only once it has an accepted answer or a ≥3-upvoted answer —
implemented through `policy.ts`/`indexable.ts` + `routes.generated.ts` with a
full SEO review, never by editing pages directly.

**D6.4 WeChat link previews** — _deferred._ Community pages are not
prerendered while noindex, so a pasted link shows the generic site card.
Custom previews/OG data per question belong to the D6.3 indexing work.

**D6.5 Moderation** — _implemented: report + soft delete._ Report buttons on
questions and answers write to `qa_reports` (service-role only — nothing is
client-readable; the owner reviews rows in the dashboard). Removal is a soft
delete (`deleted_at`, service role only) which hides the row from both public
views instantly. No admin UI yet — revisit when report volume justifies it.

**D6.6 Invite to answer** — _deferred, not implemented._

**Notifications (new)** — _implemented with explicit opt-out._ The question
author gets one email when someone answers (Resend, `qa-notify`,
`qa_email_log` for every outcome). Opt-in at ask time via the "Email me when
someone answers" checkbox (checked by default); opt-out any time via the
author-only toggle on the question page, and every email says how to stop.
Self-answers never email; 30-min throttle per question + 20/day cap. Answers
do not subscribe anyone but the author — no thread-follow in v1.

## Tasks

1. ~~Schema~~ — done: migration 048, snapshot updated.
2. ~~Write paths~~ — done: `community-submit` (auth + onboarded + rate
   limits) instead of direct inserts; no Turnstile because writes require an
   account (see D6.2).
3. ~~Swap the mock for real data~~ — done: `communityMock.ts` deleted, all
   three pages read/write through `communityApi.ts` + RPCs.
4. SEO and link previews — D6.3 stays noindex; D6.4 deferred.
5. Seed import — owner task, no code needed.

## Done when

- Infrastructure release: reported live by the owner on 2026-10-13. Earlier
  local E2E claims do not independently establish staging or production
  deployment identity; collect that evidence when checking the live system.
- `/community` grows to ~30 real answered questions: an earlier aspirational
  community goal, not an achieved result or a release gate.
- Pasting a link into WeChat shows a good preview: deferred with D6.4.

## Session 6A: Community growth and format decision

**Status:** planning brief, not approval to implement chat or replace Q&A.
**Mode:** investigate and improve the idea first. Read `AGENTS.md`, the
engagement overview, this file, Phase 5, and Phase 7. Preserve current posting,
masking, moderation, notification, and indexing protections.

### Owner direction and open choices

- Goal: repeat interaction on TRC, not merely links pasted back into WeChat.
- Chat, general posts, images, and a mixed questions/experiences feed were
  raised as possibilities. None has a selected implementation scope yet.
- Recognition should acknowledge both contributions and subsequent
  helpfulness. Phase 7 owns that system; do not create a competing one here.
- No fake accounts or automated fabricated questions/answers on production.

### Deliverables

1. Inspect the released community and review discussions. Separate missing
   features from empty content, poor discovery, or unclear calls to action.
   Report actual observations, not assumed demand or invented metrics.
2. Compare three bounded directions: improve existing Q&A/review discussions;
   add experience/update posts and contextual images; add real-time chat.
   Recommend the smallest pilot that serves the owner's migration goal.
   Evaluate interaction value, repeat-use reason, mobile/WeChat behavior,
   moderation work, notifications, privacy, and implementation cost without
   claiming an unsupported completion timeline.
3. Propose a genuine founder/user activation exercise: invite a small real
   cohort, post real questions under real accounts, and arrange actual
   knowledgeable responders. Group content requires appropriate permission
   or a non-identifying rewrite; do not impersonate members or import private
   chat histories. Named participants/content remain an owner task.
4. Design a relevant next action after publishing or answering. Prefer a real
   question connected to the user's experience when matching data exists;
   include an honest empty state. Do not fake relevance, unread counts,
   helpful votes, or activity. Any email invitation depends on Phase 5's
   resolved contact policy and caps; an on-site pilot can be independent.
5. For an image/experience pilot, specify post taxonomy, upload authorization,
   limits, safety/moderation, deletion, accessibility, and private-data risks.
   For chat, specify public vs private rooms/DMs, blocking/reporting, message
   retention, visibility, presence, abuse controls, and moderator ownership.
   These are unresolved choices, not permissions to implement them all.
6. Recommend pilot measures: genuine participants, unanswered questions,
   response times, repeat participation, substantive review discussions, and
   reports/moderation workload. Validate which can be measured with existing
   read-only outcomes before proposing any new analytics. No target or
   expected uplift is established yet. Respect Phase 1's payload boundary.
7. Return one recommended scope, owner decisions, and a small PR sequence.
   Record approval before implementation. Do not change indexing or remove
   Q&A/accepted-answer behavior merely to make it look like a social feed.

## Session 6B: Implement the chosen community pilot

**Blocked on:** owner selecting the scope from 6A. This is not a blanket
approval for chat, direct messages, or unrestricted media posts.

- Start from a clean feature branch/worktree based on current staging.
- Keep the pilot separate from Phase 5 mail infrastructure and Phase 7
  contributor identity. Integrate approved interfaces rather than duplicating
  sender/preferences, notification counters, or reputation data.
- Server-verify identity/ownership, keep gated/rate-limited writes fail-closed,
  preserve anonymous display masking and private moderation records. Any
  database work starts from the schema snapshot and updates it with numbered
  migrations and correct grants. Inspect current staging migration versions.
- Test empty and populated states, relevant/no-match suggestions, posting,
  replies, permissions, masking, deletion/reporting, notification opt-out,
  and the selected media/chat risks. No real-user email in local/staging tests.
- Meet `AGENTS.md` gates and relevant SEO validation. Verify the integrated
  staging deploy with its identity before release through master.
- Report planned, implemented, verified on staging, and released separately.
  Keep broader community features and their owner choices explicitly open.
