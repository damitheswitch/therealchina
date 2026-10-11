# Phase 6: Q&A launch and cold start

**Depends on:** Phase 2 shipped (so the review side stops losing people first).
**Current state:** real implementation on `feat/community-qa` — `qa_*` tables +
public views (migration 048), `community-submit` / `qa-notify` Edge Functions,
live pages, mock deleted. `/community` stays noindex.
**Overview:** [00-overview.md](00-overview.md) §7 F.

## Goal

Launch `/community` with real content on day one, and position it as the place
WeChat groups link to, not a replacement for them.

## Decision memo — implemented defaults (2026-10-11)

The owner asked for a concise memo on every unresolved moderation,
anonymous-posting, notification, or indexing choice before enabling it. These
are the shipped defaults — each is reversible, and the exposure-expanding
ones are OFF until the owner says otherwise.

**D6.1 Seed content** — *unchanged, owner task.* No founder content is
invented or seeded by code; the feed honestly shows "No questions here yet."
The 30-50 question collection (who / by when) is still open and is a
community goal, not a code gate — the release does not wait on it.

**D6.2 Anonymous posting** — *implemented: account required for all writes.*
The write path (`community-submit`) rejects unauthenticated callers (401) and
requires an onboarded profile; per-user rate limits apply (10 questions/h,
20 answers/h, 30 reports/h, fail-closed). What the UI calls "Post
anonymously" is display-only masking: `is_anonymous` hides the name publicly
(base tables are not client-readable at all — reads go through masking views)
while `author_id` keeps the caller traceable for moderation. Fully anonymous
*write* (no account) stays disabled — it would need Turnstile + stricter
limits and is a future owner decision.

**D6.3 Indexing** — *implemented: all `/community` routes stay noindex.* The
proposal for later (needs owner approval before enabling): a thread becomes
indexable only once it has an accepted answer or a ≥3-upvoted answer —
implemented through `policy.ts`/`indexable.ts` + `routes.generated.ts` with a
full SEO review, never by editing pages directly.

**D6.4 WeChat link previews** — *deferred.* Community pages are not
prerendered while noindex, so a pasted link shows the generic site card.
Custom previews/OG data per question belong to the D6.3 indexing work.

**D6.5 Moderation** — *implemented: report + soft delete.* Report buttons on
questions and answers write to `qa_reports` (service-role only — nothing is
client-readable; the owner reviews rows in the dashboard). Removal is a soft
delete (`deleted_at`, service role only) which hides the row from both public
views instantly. No admin UI yet — revisit when report volume justifies it.

**D6.6 Invite to answer** — *deferred, not implemented.*

**Notifications (new)** — *implemented with explicit opt-out.* The question
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

- `/community` exists with real, persisted questions/answers — **met** (local
  E2E verified; staging verification pending).
- `/community` grows to ~30 real answered questions — owner task, tracked
  separately from release.
- Pasting a link into WeChat shows a good preview — deferred with D6.4.
