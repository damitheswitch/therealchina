# Phase 3: Anonymous Boost

**Depends on:** Phase 2. **Security-sensitive:** yes.
**Overview:** [00-overview.md](00-overview.md) §7 C.
**Status:** implemented on `feat/phase3-anon-boost` (migration 044 +
`review-boost` Edge Function, PR #58). Locally verified; staging migration,
functions, and the anonymous happy path verified live. Not released to
production — gated behind the Phase 1 baseline and the Phase 2 production
release.

## Goal

Let anonymous reviewers add the optional details after publishing, as
signed-in users can, without opening an editing hole.

## Background

`review-manage` only works for signed-in users (it checks the JWT). Anonymous
reviewers already have a claim token: a random secret kept in their browser
(`lib/reviewClaim.ts`) and stored privately on `reviewer_context`.

## Owner decisions (answered)

**D3.1 How anonymous users Boost**
- **Decided:** dedicated `review-boost` Edge Function plus an atomic
  authorization/update boundary. `apply_anonymous_boost` (migration 044)
  locks the review and its context row `FOR UPDATE`, checks token hash,
  claim state, window, and both counters, then writes — all in one
  transaction. `review-manage` stays JWT-only.
- Implementation: the client mints a **per-review** capability at submit
  time (`crypto.getRandomValues`, 256 bits — no `Math.random` fallback).
  `review-submit` stores only its SHA-256 digest in
  `reviewer_context.boost_secret_hash`. The raw token lives in
  `localStorage` under `trc_boost_tokens` keyed by review id.

**D3.2 How long the Boost window stays open**
- **Decided:** 24 hours from `reviews.created_at`, only while the review is
  live (`deleted_at IS NULL`) and unclaimed (`reviews.user_id IS NULL`,
  `owner_id IS NULL`, not `claim_dismissed`). Claiming clears
  `boost_secret_hash`, so token-based Boost ends immediately — including
  under a racing claim (the FOR UPDATE locks serialize the two).
- Legacy claim tokens still work for account claiming; older reviews
  without a boost hash simply require sign-in to edit.

**D3.3 Which fields anonymous Boost may change**
- **Decided:** only the fields the program, ratings, money, details, and
  pros/cons Boost cards represent: `program`, `degree_level`, the eight
  `rating_*` sub-scores, `enrollment_status`, `start_year`, `end_year`,
  `language_of_instruction`, `tuition_range`, `living_cost_range`,
  `funding_type`, `funding_coverage`, `pros`, `cons`.
- Explicitly excluded: `rating`, `text`, university, owner, `recommend`,
  `tags`, `media`, `deleted_at`. `tags`/`media` are deferred — the media
  upload path has separate session-based authorization and was not opened.
  The anonymous UI hides the media card (`ANON_BOOST_CARDS`).
- Patches are partial: the client sends only the current card's fields,
  `validateBoostPatch` (`_shared/reviewFields.ts`) validates them, and the
  RPC re-checks the key allowlist before writing. Cross-field rules
  (end ≥ start, self-funded clears coverage) are evaluated on merged
  values inside the transaction.

**D3.4 Rate limit**
- **Decided:** two counters on `reviewer_context`, both enforced inside the
  same transaction so they can't be raced:
  - `boost_save_count` — 30 successful saves per review per window.
  - `boost_fail_count` — 20 wrong-token attempts, then the anonymous path
    locks (`locked`). Claim-by-sign-up remains as the recovery path.
- No client-supplied header or IP participates in authorization or abuse
  decisions; every check runs on columns inside the locked rows. A failed
  or unreachable RPC rejects the request (fail closed).

## Tasks (agent) — status

1. ✅ `review-boost` Edge Function + `apply_anonymous_boost` RPC.
2. ✅ Atomic counters per D3.4.
3. ✅ Migration `044_anonymous_boost.sql`; `schema_snapshot.sql` updated;
   function revoked from `PUBLIC, anon, authenticated`, granted to
   `service_role` only.
4. ✅ Deno tests: `validateBoostPatch` allowlist/validation
   (`_shared/reviewFields_test.ts`), token format + hashing
   (`_shared/boostToken_test.ts`), claim matcher hash atoms
   (`review-claim/matcher_test.ts`). Vitest: token mint/storage,
   `buildBoostPatch`, `boostReview` payloads.
   - RPC behavior verified against the local Docker stack (psql battery):
     ok / bad_token / bad_fields / empty / not_found / claimed (named,
     anonymous, dismissed) / expired / over_limit (30 saves) / locked
     (20 fails) / grants / claim↔boost race both directions.
5. ✅ `deno check` on all three functions.
6. ✅ Frontend: anonymous submissions mint `boostToken`; Boost cards call
   `review-boost` with the per-card patch; `review-claim` accepts boost
   tokens for device matching and clears the hash on resolution.
7. ✅ Staging (`trc-staging`): migration 044 + `review-boost`/`review-submit`/
   `review-claim` deployed; anonymous publish → Boost offer → two card saves
   (program card, ratings card) verified live, `degree_level`/`rating_*`
   persisted, `boost_save_count` incremented; a tampered token was rejected
   (403, `boost_fail_count` incremented) and saving resumed with the real
   token. Staging RPC grant + counter smoke also run directly.
   ⏳ Claim-after-sign-up on staging pending — needs a staging test account.
   ⏳ Signed-in Boost and `?draft=` resume on staging still unverified
   (Phase 2 carry-over, same reason).
8. ✅ `docs/security-audit.md` updated.

## Done when

- All five rejection cases are covered by tests. (done, per task 4)
- The anonymous path works end to end on staging: publish, Boost, then
  claim after signing up. (publish + Boost done; claim pending test account)
- The `docs/security-audit.md` notes are updated. (done)

**Incident note (2026-10-09):** during staging verification,
`SUPABASE_PROJECT_ID=hfinkagueeojyyrpauav` was set in the shell env (it is
the local-stack project label in `config.toml`), which redirected
`supabase db query --linked` from the linked staging project to **prod**.
Migration 044's objects (3 `reviewer_context` columns, the
service-role-only `apply_anonymous_boost` function) and its
`schema_migrations` row were applied to prod directly. No prod data was
modified (the only row write was a fixture review inserted and deleted in
one transaction; `reviewer_context` showed zero rows with boost data).
With owner approval the objects and the migration row were reverted the
same day — prod is back to its pre-044 state and Phase 3 will reach it
normally through the release gate. `AGENTS.md` documents the env-var
pitfall.
