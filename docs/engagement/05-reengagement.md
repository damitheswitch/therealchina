# Phase 5: Bring reviewers back

**Depends on:** Phases 2 and 3.
**Overview:** [00-overview.md](00-overview.md) §7 E.

## Goal

Recover the optional data people skipped, and bring them back to the site,
with one well-timed email.

## Owner decisions (answer before coding)

**D5.1 Which consent covers this email?**
- `profiles.email_consent` is currently framed as a newsletter ("early access & updates").
- Comment notifications (`comment-notify`) are a separate, transactional case.
- Options: (a) treat it as transactional, like a comment notification; (b) require newsletter consent; (c) add a separate "tips about my reviews" setting.
- **Recommendation:** (c) if it's cheap. Otherwise (b). Don't email anyone who didn't opt in.
- Decision: ______

**D5.2 Timing and how often**
- **Recommendation:** one email, about 3 days after publishing, only if Boost fields are missing. Never more than one per review.
- Decision: ______

**D5.3 Anonymous reviewers who left an email**
- They gave the email for claiming and replies.
- **Recommendation:** email them only if they also opted in under D5.1.
- Decision: ______

**D5.4 Content**
Plain text with one link that opens Boost on the missing cards. Optionally, a reason ("3 students read reviews of {university} this week") once there's real view data. Never invent numbers.
- Decision: ______

## Tasks (agent)

1. Scheduled job (a Supabase cron calling an Edge Function) that finds reviews about 3 days old with missing fields, the right consent, and no email sent yet.
2. A send-log table like `comment_email_log` to guarantee one email per review. Write a migration, update the snapshot, and handle grants.
3. Deep link. Signed-in users land on edit/Boost. Anonymous users can only use it inside the Phase 3 window; outside it, send them to sign up and claim.
4. Unsubscribe link, plus tests for who gets selected.

## Done when

- Staging sends exactly one email to an opted-in test account and none to an opted-out one.
- The unsubscribe link works.
