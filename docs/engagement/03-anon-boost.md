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
- **Decided:** counters on `reviewer_context`, enforced inside the same
  transaction so they can't be raced:
  - `boost_save_count` — 30 successful saves per review per window.
  - Wrong-token attempts are throttled by **exponential backoff** on
    `boost_next_attempt_at` (migrations 045+046): each failure sets the
    wait to `min(2^fails, 600s)`, and attempts inside the backoff are
    rejected without extending it. The capability is compared **before**
    the throttle (046), so a valid token saves even while wrong-token
    backoff is active — bad-token traffic can never block or delay the
    real reviewer's saves at all. Only invalid tokens wait; a successful
    save resets the counter. (045 alone still gated the correct token
    during backoff; 046 fixed the ordering.)
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
     anonymous, dismissed) / expired / over_limit (30 saves) / backoff
     locked-then-recovers / grants / claim↔boost race both directions.
5. ✅ `deno check` on all three functions.
6. ✅ Frontend: anonymous submissions mint `boostToken`; the Boost offer is
   gated on `boostAvailable` (true only when the context row with the digest
   actually persisted, so a failed context insert never promises a save that
   can only 403); Boost cards call `review-boost` with the per-card patch;
   `review-claim` accepts boost tokens for device matching and clears the
   hash on resolution.
7. ✅ Staging (`trc-staging`): migrations 044+045+046 and `review-boost`/
   `review-submit`/`review-claim` deployed; verified live end to end:
   anonymous publish (digest on `reviewer_context`) → Boost offer (5 cards,
   no media) → card saves persisted (`degree_level`, `rating_*`,
   `boost_save_count` incremented) → tampered token 403 + 429 backoff →
   real token saved again → signed in as a staging test account
   (`trc-e2e-stage2@proton.me`) → claim prompt matched via the boost token →
   anonymous claim set `owner_id`/`claimed_at` and cleared the hash →
   post-claim Boost with the real token returns 404 (capability dead).
   046 verified live on a staging fixture: wrong token → 403 `bad_token`,
   immediate wrong retry → 429 `locked`, correct token during active
   backoff → 200 save, then claimed → 409 `claimed`.
   ⏳ Signed-in Boost and `?draft=` resume on staging still unverified
   (Phase 2 carry-over — no signed-in session existed on the staging build
   before this account was created; retest pending).
8. ✅ `docs/security-audit.md` updated.

## Done when

- All five rejection cases are covered by tests. (done, per task 4)
- The anonymous path works end to end on staging: publish, Boost, then
  claim after signing up. (done — see task 7)
- The `docs/security-audit.md` notes are updated. (done)

**Incident note (2026-10-09):** during staging verification,
`SUPABASE_PROJECT_ID=hfinkagueeojyyrpauav` was set in the shell env (it is
the local-stack project label in `config.toml`), which redirected
`supabase db query --linked` from the linked staging project to **prod**.
Migration 044's objects (3 `reviewer_context` columns, the
service-role-only `apply_anonymous_boost` function) and its
`schema_migrations` row were applied to prod directly. Temporary writes on
prod: one fixture review row inserted and deleted inside a single
transaction (net zero rows; a sequence value was consumed), plus the
schema objects and migration-history row above. With owner approval the
objects and the migration row were reverted the same day. Final state
verified read-only by the implementing agent via the Management API
(`POST /v1/projects/<ref>/database/query`, project ref explicit in the
URL — not `--linked`): prod has 0 boost
functions/columns/constraints/indexes, no `044`/`045` migration row, 6
reviews, 4 `reviewer_context` rows; staging has all 044-046 objects
present. (Agent-verified, not independently re-verified by the reviewer.)
`AGENTS.md` documents the env-var pitfall; prod remains gated on the
Phase 1 baseline and Phase 2's release.
