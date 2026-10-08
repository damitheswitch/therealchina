# Phase 3: Anonymous Boost

**Depends on:** Phase 2. **Security-sensitive:** yes.
**Overview:** [00-overview.md](00-overview.md) §7 C.

## Goal

Let anonymous reviewers add the optional details after publishing, as
signed-in users can, without opening an editing hole.

## Background

`review-manage` only works for signed-in users (it checks the JWT). Anonymous
reviewers already have a claim token: a random secret kept in their browser
(`lib/reviewClaim.ts`) and stored privately on `reviewer_context`.

## Owner decisions (answer before coding)

**D3.1 How anonymous users Boost**
- (a) New Edge Function that accepts the claim token and updates optional fields only.
- (b) No backend work. Anonymous users see the Boost cards before Publish, with a "Publish now" button on every card.
- **Recommendation:** (a). With (b), the review isn't live until they press Publish, so an abandoned Boost means an abandoned review, which is the problem we're fixing.
- Decision: ______

**D3.2 How long the Boost window stays open**
- **Recommendation:** 24 hours after publishing, and only while the review hasn't been claimed by an account. After that, they sign up and edit normally.
- Decision: ______

**D3.3 Which fields anonymous Boost may change**
- **Recommendation:** sub-scores, tuition, living cost, funding, coverage, enrollment status, end year, language, degree, pros, cons, tags, media.
- Never rating, text, university, or owner.
- Decision: ______

**D3.4 Rate limit**
- **Recommendation:** about 30 updates per review per day. Reject if the rate limiter is unavailable (`AGENTS.md`: fail closed).
- Decision: ______

## Tasks (agent)

1. Build the Edge Function (or a new mode on `review-manage`).
   - Check: claim token matches, review is unclaimed, within the D3.2 window, fields are in the D3.3 allowlist.
   - Reuse the `review-submit` validation helpers rather than copying them.
2. Rate limiting per D3.4.
3. Any new SQL object: write a migration, update `schema_snapshot.sql`, and `REVOKE ... FROM PUBLIC, anon, authenticated` (`AGENTS.md` grants rule).
4. Deno tests for:
   - wrong token,
   - expired window,
   - claimed review,
   - a field outside the allowlist,
   - limiter unavailable.
5. Run `deno check`, deploy to `trc-staging` first, then prod on merge.
6. Frontend: anonymous Boost cards call the new path.

## Done when

- All five rejection cases are covered by tests.
- The anonymous path works end to end on staging: publish, Boost, then claim after signing up.
- The `docs/security-audit.md` notes are updated.
