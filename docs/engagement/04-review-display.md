# Phase 4: Make detail visible

**Depends on:** Phase 2. **Feeds:** Phase 7 (points and levels build on this).
**Overview:** [00-overview.md](00-overview.md) §6 "Making Boost worth doing".

## Goal

A reviewer can see that adding detail matters: their review looks better and
ranks higher. Readers find the most useful reviews first.

## Owner decisions (answer before coding)

**D4.1 What counts as a "detailed" review?**
- Option: at least 4 of the 8 sub-scores, plus cost info (tuition or living cost), plus pros or cons.
- Alternatively, a points score with a threshold.
- **Recommendation:** start with the simple rule above. It's easy to explain on the page.
- Decision: ______

**D4.2 Name and look of the mark**
"Detailed review", or something that fits the seal/stamp brand. It must not be confused with the existing Verified seal.
- Decision: ______

**D4.3 Default sort on university pages**
- (a) Keep newest first.
- (b) Most helpful: detail plus upvotes, with recency.
- **Recommendation:** (b), once there are at least 5 reviews on the page. Below that, keep (a).
- Decision: ______

**D4.4 Who sees the strength meter?**
- **Recommendation:** only the author (on the success screen and in My Reviews). A public score invites gaming.
- Decision: ______

## Tasks (agent)

1. Completeness helper in `frontend/src/lib/` with Vitest tests. If it's needed for sorting, also a SQL view or generated column: write a migration, update the snapshot, and handle grants.
2. Mark on `ReviewCard.jsx` and in `ReviewExtras.tsx`.
3. Sort option in `ReviewSortSelect.tsx` and the review data hooks.
4. Strength meter on the success screen and in `MyReviews.tsx`.
5. SEO check: no new review markup, and `universitySchema` rules unchanged.

## Done when

- The mark renders in prerendered pages as well as client-side.
- Sorting is covered by a test.
- `validate_build.mjs` passes.
