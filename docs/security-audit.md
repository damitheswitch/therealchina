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
