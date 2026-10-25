# Phase 5: Review reminders and thank-you emails

**Status:** planned. Owner direction recorded 2026-10-13; no Phase 5 implementation or delivery verification claimed.
**Depends on:** existing Phases 2, 3, and 4, reported released by the owner. No pre-change baseline gate.
**Overview:** [00-overview.md](00-overview.md) sections 5 and 7 E.

## Goal

Bring reviewers back to add useful detail, and thank them once their review
qualifies as detailed. Keep the publish minimum small. Use honest, on-brand
emails without invented audience numbers or commercial promotions.

## Owner decisions recorded 2026-10-13

### D5.1 One visible, non-commercial contact policy

The owner wants one understandable policy covering TRC contact emails, rather
than an extra checkbox specifically for a thank-you email. Explain visibly
what messages people can receive and that email is not used for commercial
promotions. Do not interpret "contact" as unlimited permission for any email.

The intended scope includes review reminders, completion thanks, and existing
review/Q&A interaction notifications. Whether future invitations to answer
questions belong in this scope must be resolved before enabling those sends.
Newsletter/scholarship promotions are not automatically included.

This is a product decision, not a legal conclusion that disclosure alone is
sufficient in every jurisdiction. The implementation agent must assess the
applicable permission requirements and surface any need for owner review.
Do not silently broaden existing newsletter permissions or override explicit
notification opt-outs. Keep anonymous email optional and preserve suppression
and unsubscribe controls.

### D5.2 Reminder timing

Send an anonymous reviewer a reminder before the existing 24-hour anonymous
Boost window expires. This supersedes the earlier three-day suggestion and
the tentative two-day discussion for anonymous reviewers.

**Proposed starting schedule, not a psychological benchmark or an approved
exact hour:** anonymous at about 18 hours after publication, leaving time to
act; signed-in at about 48 hours. The agent should propose the exact schedule,
job cadence, and expiry safety margin for owner confirmation in session 5A.
Use UTC timestamps. Never send a stale anonymous quick-edit promise after
expiry just because a worker was delayed.

**Proposed frequency:** at most one reminder per review, only while below the
detailed threshold. No repeated chasing; suppress it if the review becomes
detailed before sending.

### D5.3 "Full" uses the existing detailed threshold

Owner decision: use the Phase 4 detailed rule, at least 3 of 7 detail areas.
Do not invent another completion formula or require every optional field.
`frontend/src/lib/reviewDetail.ts` is the current source of that rule; its
ratings area requires at least 4 of 8 sub-scores. Public wording should say
"detailed review", not imply every field is complete.

### D5.4 Thank-you email and brand direction

Send a thank-you email when a review qualifies as detailed. Emphasize helping
students and peers understand real experiences in China. End with the owner's
requested sentiment: "We'd like to welcome you once again to The Real China."

**Proposed behavior:** one thank-you per review when a successful publication
or saved update first qualifies, including a review already detailed at
publication. Edits, retries, and crossing the threshold again must not resend
it. No historical bulk backfill without an explicit owner decision.

**Draft copy for owner review, not final approved copy:**

> Thank you for sharing your experience. Your review helps students and peers
> understand what studying in China is really like, including the parts a
> brochure might leave out.
>
> By telling your own story, you're helping others make a more informed choice.
>
> We'd like to welcome you once again to The Real China.

## Current code observations (2026-10-13, local tree only)

- `OnboardingForm.jsx` labels `profiles.email_consent` as a newsletter:
  scholarships, new features, and early access. It is not already the new
  unified contact policy.
- `AnonEmailField` in `components/review/fields.tsx` explains account matching.
  It does not currently disclose reminder or thank-you sends. `ReviewStory`
  renders that input without a separate email-permission control.
- `comment-notify` skips reviews with `reviews.user_id IS NULL`; merely
  providing an anonymous email does not currently enable reply notifications.
- `qa-notify` has existing per-question notification choices. Preserve these
  choices when introducing a shared contact policy or suppression mechanism.
- No dedicated Phase 5 sender was found in the local functions directory.
  Check the current branch and deployed configuration before assuming absence
  on a remote environment. No production inspection was performed here.

## Session 5A: Contact policy and safe delivery contract

**Mode:** investigate and refine this plan first. Resolve the contract before
building a sending job. Read `AGENTS.md`, this file, Phase 3, Phase 4, and the
canonical `supabase/schema_snapshot.sql` before database work.

### Deliverables

1. Audit email collection, identity verification, existing preferences,
   privacy copy, `comment-notify`, and `qa-notify`. Explain how a unified
   non-commercial policy can be disclosed at the right collection points
   without adding another required pre-publish step.
2. Propose concise disclosure copy and a permission/preference model. Cover
   new signed-in users, new anonymous reviewers, existing users, legacy
   anonymous addresses, opt-outs, and newsletter separation. Do not default
   old records into broader permission. Ask the owner to resolve any migration
   of existing permissions or jurisdiction-specific requirements.
3. Decide how a recipient is eligible and sufficiently verified. An arbitrary
   anonymous email can belong to someone else; do not turn review submission
   into an unsolicited-email relay. Assess existing verification/claim paths,
   sender limits, and any verification step needed without weakening publish
   or abuse protections.
4. Inspect the current Boost/review resume routes. The anonymous editing key
   is stored in the original browser, not recoverable from its server hash.
   An email may open a different browser/device. Propose routing that:
   - resumes editing only when a valid capability is actually present;
   - handles signed-in and claimed reviews using the authorized edit path;
   - offers sign-in/account claiming when the key is absent or expired;
   - does not place raw claim/Boost keys in email URLs, logs, analytics, or
     HTML, and does not extend the edit window merely to simplify reminders.
     If adding a new email-based edit capability is necessary, present it as a
     separate security design for approval, not an incidental deep-link change.
5. Confirm the schedule, frequency, expiry margin, eligibility start date,
   backfill policy, and thank-you deduplication behavior. Recommend no bulk
   sends to historical records by default. Do not claim an optimal hour based
   on psychology without evidence.
6. Report the approved contract and remaining blockers in this doc and the
   overview. A policy proposal is not an implemented email system.

## Session 5B: Implement the approved email loop

**Mode:** implement after session 5A's permission, recipient, timing, and link
contract is resolved. Do not build contributor badges, chat, or a social feed
in this session.

### Implementation scope

1. Implement the agreed disclosure/preferences, eligibility rules, and link
   landing behavior with minimal changes to shared review components.
2. Add a scheduled selector and gated Edge Function sender, plus private
   queue/send-log objects as needed. Use numbered migrations, update the
   schema snapshot, and revoke default client grants as required by
   `AGENTS.md`. Check staging migration versions before numbering.
3. Re-evaluate review state, recipient eligibility, opt-out, and anonymous
   expiry immediately before sending. Deleted reviews, below-threshold
   thank-you candidates, newly detailed reminder candidates, and suppressed
   recipients must not receive the inappropriate message.
4. Compute detailed eligibility server-side with parity tests against the
   existing Phase 4 rule. Never trust a client's claimed completeness score.
5. Cover publish, signed-in Boost/edit, and anonymous Boost without changing
   their ownership rules. Use an atomic unique send identity for each
   `(review, message type)` and a concurrency-safe retry design. Use provider
   idempotency where supported; do not promise exactly-once external delivery
   merely because a database log is unique. Treat ambiguous provider outcomes
   explicitly. Honor cross-message caps and avoid a reminder racing a thank-you.
6. Provide a scoped, functional unsubscribe/preference route. Possessing an
   unsubscribe link must not grant review editing or disclose private context.
7. Draft branded HTML and plain-text versions. Include one relevant action,
   no fabricated impact metrics, no sales copy, and no user-visible em/en
   dashes. Humanize and obtain approval for final copy.
8. Keep emails, account IDs, review IDs, tokens, and link query strings out of
   Umami. Operational delivery logs remain private. Decide aggregate reporting
   without inventing a new public anonymous analytics write path.

### Verification and release

- Tests cover below/at/above threshold, all detail areas, legacy records,
  verified/unverified recipients, opt-outs, deletions, claims, expiration,
  stale jobs, duplicate work, concurrency, provider failure, and retry paths.
- Test both same-browser and different-browser anonymous email-link journeys,
  plus a signed-in reviewer. Verify actual saved updates, not just rendering.
- Local first, then staging with controlled test recipients. Protect staging
  from accidentally sending to copied real addresses; no production fixtures
  or test writes. Missing verification/configuration fails closed.
- Pass relevant `AGENTS.md` checks: frontend lint/format/build, unit tests,
  Edge Function Deno checks/tests, schema/grants checks, and applicable SEO
  build validation and deploy smoke checks.
- On staging, establish one appropriate reminder and one appropriate
  thank-you, no sends to ineligible/suppressed recipients, working opt-out,
  safe expired/missing-key handling, and no duplicate sends under retries.
- Record commit/deploy identity, environment, tests, and observed delivery.
  Merge through staging to master; label planned, implemented, verified on
  staging, and released separately. Production success is not inferred from
  an agent summary or a merge alone.

## Done when

Session 5A's contract is approved, session 5B passes its gates, staging delivery
and suppression are observed, and the release is documented with evidence.
Until then, this phase remains planned. Ongoing Phase 1 measurement continues;
there is no missing-baseline waiting period.
