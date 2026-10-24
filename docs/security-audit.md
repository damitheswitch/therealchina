# Security Audit — 2026-09-29

Audit of the production deployment (`www.therealchina.net` + Supabase project
`hfinkagueeojyyrpauav`). Method: live probing of the prod REST/RPC surface with
the publishable key (exactly what an anonymous attacker can do), schema review
against `supabase/schema_snapshot.sql`, Edge Function code review, live HTTP
header checks, and `npm audit`.

## The grant pitfall (root cause of the two biggest findings)

Supabase default privileges grant privileges **directly to `anon` and
`authenticated`** on every new table, view, and function in `public`. Two
consequences:

- `REVOKE ... FROM PUBLIC` does NOT remove them. Revoke per role:
  `REVOKE ... FROM PUBLIC, anon, authenticated`.
- `DROP` + `CREATE` (used on views in several migrations) re-applies the
  default grants. `CREATE OR REPLACE` preserves existing grants. Any migration
  that recreates an object must re-run its revokes.

## Fixed

| # | Finding | Fix | Verified |
|---|---------|-----|----------|
| 1 | `member_profiles` readable by anon: bio, location, university, program, social handles exposed to anyone holding the publishable key. | Migration `039_member_profiles_revoke_anon.sql`: `REVOKE SELECT ON public.member_profiles FROM PUBLIC, anon;` | Staging: `has_table_privilege('anon') = false`, authenticated still true. Prod: live anon request now 401; `profile_public` still readable (intended). Local: auto-applies on next `supabase start` / `db reset`. Pushed to prod directly as an approved security hotfix, ahead of the normal merge flow. |
| 2 | Service-role-only functions callable by `anon`/`authenticated`. Verified live: `use_upload_session` executed as anon. `REVOKE ... FROM PUBLIC` alone does not remove Supabase's per-role default EXECUTE grants. | Migration `040_function_grants_lockdown.sql`: per-role `REVOKE ALL ... FROM PUBLIC, anon, authenticated` on `record_upload_attempt`, `use_upload_session`, `cleanup_upload_rate_limits`, `refresh_university_stats`, `enqueue_comment_notification` (service-role only); `FROM PUBLIC, anon` on `profile_has_social_handle`, `toggle_upvote` (authenticated kept). | Staging: `has_function_privilege` all expected values. Prod: live anon POSTs now 401 on `use_upload_session`, `refresh_university_stats`, `toggle_upvote`; `is_email_allowed` still 200 (intended). Pushed to prod directly as an approved security hotfix. |
| 4 | No security headers on the site: no CSP, `X-Frame-Options`/`frame-ancestors` (frameable → clickjacking), `nosniff`, `Referrer-Policy`, `Permissions-Policy`. `generate_static.ts` emitted a comment-only `_headers` on prod deploys. | Prod `_headers` now emits a CSP scoped to what the site loads (self + Supabase API/realtime/storage + Turnstile + CF beacon; `script-src 'unsafe-inline'` only because `__PRERENDERED_DATA__` is inline and static hosting has no nonces), plus `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`. `smoke_live.mjs` asserts the headers on prod post-deploy. | Fixture prod build emits the headers; lint/tests/build gate green. Live on next prod deploy — run `node scripts/smoke_live.mjs https://www.therealchina.net` after merge. |

## Open findings

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 5 | Low | `upvotes.user_id` publicly readable (`SELECT TO public USING (true)`): voter identity + which reviews they upvoted is anonymous-readable. Only `review_id` is needed client-side. | Aggregate RPC/count view for public counts, or accept as public-by-design (it's a small leak — decide deliberately). |

Resolved during follow-up: prod Edge Function env confirmed — `TURNSTILE_SECRET_KEY` is the real secret (owner verified in dashboard, 2026-09-29). `TURNSTILE_HOSTNAMES`/`CORS_ORIGIN` behave correctly: foreign origins get no `Access-Control-Allow-Origin` on OPTIONS or POST.

Fixed in code, pending deploy: `checkRateLimit` in `supabase/functions/_shared/guard.ts` and `media-upload` now fails closed (`return false` on RPC error) instead of open — abuse gates no longer open exactly when the limiter is broken. Takes effect on the next `supabase functions deploy` per env (functions do not auto-update on merge).

## Verified clean

- `reviewer_context`, `comment_email_log`, `blocked_email_domains`: 401 for anon (proper `REVOKE ... FROM anon, authenticated`).
- `profiles`: RLS hides all rows from anon; `upload_sessions`/`upload_rate_limits`: RLS with no policies, empty.
- Edge Functions verify user JWTs via `auth.getUser` (never decoded claims); review-manage re-checks ownership inside writes; claim matcher sanitizes PostgREST filter strings; Turnstile fails closed on missing secret; uploads validated by magic bytes; CORS origin-restricted (no foreign-origin reflection); OpenAPI spec 401 for anon.
- Auth settings (`/auth/v1/settings`): email confirmation on, anonymous sign-ins off, phone off, Google + email providers only, signup open (intended).
- `npm audit`: 0 vulnerabilities. No secrets tracked in git; only the publishable key ships in the bundle.
- Frontend: no `dangerouslySetInnerHTML`; `_blank` links carry `noopener noreferrer`; social URLs can't produce `javascript:`; `__PRERENDERED_DATA__` uses explicit column lists (no emails/tokens); service worker has no nav fallback and doesn't precache HTML; dead slugs return real 404s.

## Not checked

- Supabase security advisors (authoritative lint): the Supabase MCP server was unreachable during the audit. Re-run `get_advisors` when available.
- HaveIBeenPwned password check, token/OTP expiries: dashboard-only settings.

## Phase 3: anonymous Boost write path (2026-10)

New anonymous write surface: `review-boost` Edge Function + `apply_anonymous_boost` RPC (migration 044). Design decisions and what they rest on:

- **Capability, not account.** New anonymous reviews mint a per-review token in the browser (`crypto.getRandomValues`, 256 bits, base64url). There is no `Math.random` fallback — without a CSPRNG the review submits but cannot be Boosted. The legacy shared `claim_token` is not accepted for Boost.
- **Digest at rest.** `reviewer_context.boost_secret_hash` stores SHA-256(token); the raw token never touches the DB or logs. A leaked `reviewer_context` row (service-role only table) does not yield a usable capability. `review-claim` hashes presented tokens before matching, so the same capability doubles as the device-claim matcher and is cleared on any resolution.
- **Authorization inside the write.** The RPC locks the review then the context row `FOR UPDATE`, then evaluates: hash match, `user_id`/`owner_id`/`claim_dismissed` all unset, `deleted_at IS NULL`, `created_at + 24h > now()`, `boost_save_count < 30`, `boost_fail_count < 20`. Verified locally with held locks: a committed claim mid-race flips the result to `claimed`; a committed Boost lets the claim proceed — no torn state.
- **Counter limits inside the transaction.** 30 successful saves per review per window; wrong-token attempts are throttled by exponential backoff on `boost_next_attempt_at` (`min(2^fails, 600s)`, cap 10 minutes) rather than a permanent lock — review IDs are public, so a fail-count lockout would let anyone end a reviewer's Boost window. The digest is compared before the throttle, so a valid capability saves during active backoff: bad-token traffic cannot block or delay the real reviewer at all — only invalid tokens wait. Attempts inside the backoff don't extend it; success resets. No header or IP is consulted; RPC failure fails closed.
- **Allowlist twice.** `validateBoostPatch` rejects any key outside the 20 Boost columns; the RPC re-checks patch keys before writing (`bad_fields`). Partial patches merge into stored values — stale client state cannot clobber fields the card doesn't own. `rating`, `text`, university, owner, `recommend`, `tags`, `media`, `deleted_at` are unreachable.
- **Grants.** `apply_anonymous_boost` revoked from `PUBLIC, anon, authenticated`; `service_role` only — the Edge Function is the single entry point. New `reviewer_context` columns inherit the table's existing lockdown.
- **Not opened.** Media upload still requires an `upload_sessions` token minted by a user JWT — anonymous Boost cannot attach media. `review-manage` remains JWT-only. `claim_token`/`email` claim flow unchanged for legacy rows.
- **Residual trade-off.** A bad-token flood on a known review ID can never block the real reviewer — the digest is checked before the throttle, so a valid capability saves during backoff, and only invalid tokens are made to wait (≤10 min each, never cumulative). The flood's only cost is cheap early-reject RPC calls. If targeted abuse shows up, revisit with a per-caller signal that doesn't depend on client-supplied headers.
- **Verified on staging:** anonymous publish (digest stored) → 5-card Boost saves (no media card), wrong-token 403 then 429 backoff, boost-token device match in `review-claim`, anonymous claim clears the hash (post-claim token → 404). Still unverified on staging: signed-in Boost and `?draft=` resume (Phase 2 doc tracks those).

## Follow-up audit fixes (2026-10-24)

| Finding | Fix | Verified |
|---|---|---|
| `reviews` still had an authenticated INSERT policy. Any onboarded user could POST to PostgREST and skip `review-submit`: no rate limit, no media URL allowlist, client-chosen `created_at`. The frontend never used it. | Migration `049_close_direct_write_paths.sql`: policy dropped, `REVOKE INSERT, UPDATE, DELETE ON reviews FROM PUBLIC, anon, authenticated`. | Local `db reset` + `supabase/verify/049_write_paths.sql`: direct insert as `authenticated` → permission denied. |
| `comments` UPDATE policy let authors rewrite `review_id`/`parent_id`/`created_at`; nesting was only checked on INSERT, so updates could build reply-to-reply chains or move comments across reviews. No comment edit feature exists. | Same migration: policy dropped, UPDATE revoked per role, `enforce_comment_nesting` now also runs on `UPDATE OF parent_id, review_id` and requires a reply to share its parent's review. | Same script: update denied, nested and cross-review replies rejected, normal replies and own-comment deletes still work. |
| `review-submit` and `media-upload` skipped the anonymous rate limit when the client IP resolved to `unknown` (fail-open). | `_shared/rateKey.ts`: unknown-IP callers share one bucket per surface and the event is logged. | `rateKey_test.ts`. Still to check on staging: what `getClientIP` returns behind the Supabase edge (if it's a shared edge IP, every anonymous caller shares one bucket). |
| Slug fallbacks: a non-Latin "not listed" university name slugified to `university` and every later one reused that row; non-Latin or repeated Q&A titles ran out of `-2…-4` suffixes and returned 500. | `_shared/slug.ts`: weak slugs (empty, tiny, or only generic words) never match existing rows by slug; universities match on `name`/`name_zh` instead, through `find_or_create_university_by_name` (migration 049): case/whitespace-insensitive, and lookup + insert run under a per-name advisory lock so concurrent submissions share one row. New rows get a random suffix on weak slugs and on collisions. | `slug_test.ts`; `supabase/verify/049_write_paths.sql` (case-variant reuse, not client-callable); concurrent-call check against Postgres 15. |

Edge Function changes take effect only after `supabase functions deploy` per environment.

## Audit follow-ups, part 2 (migration 050, 2026-10-24)

| Finding | Fix |
|---|---|
| Upvote counts came from downloading the `upvotes` table, which truncated silently past PostgREST's 1000-row cap. | `reviews.upvote_count`, kept in sync by a trigger on `upvotes` and backfilled. The frontend and prerender pipeline read counts from review rows. **Open finding #5 (voter identity readable by anon) is now the contract step:** once this frontend is live everywhere, a later migration replaces the public `upvotes` SELECT policy with own-rows only. |
| Comments and flight listings had no write rate limit. | `BEFORE INSERT` triggers: 20 comments per user per hour, 10 listings per user per 24h. They only apply to API callers (`auth.uid()` set). |
| No way to report reviews or comments; Q&A reports were never surfaced. | `content_reports` table (service role only) + `content-report` Edge Function (signed-in, 30/h) + Report buttons. New reports from both paths email `REPORT_ALERT_EMAIL`. |
| Comment emails had no opt-out. | `profiles.notify_on_comments` + profile toggle; `comment-notify` skips opted-out owners and links to the setting. |
| Uploads never attached to a review stayed public forever. | `list_orphan_media()` + `media-cleanup` Edge Function, run daily by pg_cron through Vault-stored URL + secret. Objects referenced by any review or draft are kept; only objects older than 2 days are removed. |
| Q&A answers under deleted questions stayed readable; `toggle_upvote` accepted soft-deleted reviews; the stats trigger recomputed on every review update; upload tables kept default client grants; notify secrets were compared with `!==`. | All fixed in 050 / the functions (`safeEqual` for shared secrets). |

Verified locally with `supabase/verify/050_audit_followups.sql` (14 probes); CI now rebuilds the DB from migrations and runs every `supabase/verify/*.sql` file.

**Owner setup needed per environment:**
- `REPORT_ALERT_EMAIL` (function secret) to receive report alerts.
- `MEDIA_CLEANUP_SECRET` (function secret), plus Vault secrets `media_cleanup_url` (`https://<ref>.supabase.co/functions/v1/media-cleanup`) and `media_cleanup_secret` (same value). Until both Vault secrets exist the cron job does nothing.
- `SUPABASE_ACCESS_TOKEN` GitHub secret to turn on `deploy-functions.yml`.

## Review follow-ups (migration 054)

- Posting quotas now use private `posting_events` history, so deleting a
  comment or flight does not restore the quota. Recent existing posts are
  backfilled during the upgrade. Expired events are pruned on the user's next
  post; deleting an account removes its history.
- Function deployments check the target migration history and stop if any
  migration in the checkout is missing. Apply migrations first, then rerun
  the failed deployment workflow. Only `staging` and `master` may deploy.
- My Flights uses ID-cursor pagination rather than relying on a single
  uncapped request. Upcoming and Past Flights retain separate row budgets.
- Regression coverage: `supabase/verify/054_persistent_posting_quotas.sql`,
  `frontend/src/hooks/useFlightListings.test.tsx`, and
  `scripts/check_deployment_migrations.test.mjs`.
