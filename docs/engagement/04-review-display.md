# Phase 4: Make detail visible

**Depends on:** Phase 2. **Feeds:** Phase 7 (points and levels build on this).
**Overview:** [00-overview.md](00-overview.md) §6 "Making Boost worth doing".
**Status:** implementing on `feat/phase4-review-display` (worktree
`.tmp/phase4-review-display`), branched from staging after PRs #56/#57 —
Phase 3's PR #58 is still open, so anything touching `ReviewSuccess.tsx`,
`BoostCards.tsx`, `ReviewWizard.tsx`, or `reviewFlow.ts` is deferred until
it merges into staging.

## Goal

A reviewer can see that adding detail matters: their review looks better and
ranks higher. Readers find the most useful reviews first.

## Owner decisions (answered 2026-10-09)

**D4.1 What counts as a "detailed" review?**
- **Decided:** the areas rule at threshold 3 — a review is detailed when it
  fills **at least 3 of 7 detail areas**. Each area maps to a Boost card or
  the story-screen tag chips, so the rule explains itself as "this review
  answers at least 3 of these":
  1. `program` — program or degree level
  2. `ratings` — at least 4 of the 8 category sub-scores
  3. `money` — tuition, living cost, or funding type
  4. `timing` — enrollment status, start/end year, or instruction language
  5. `pros_cons` — pros or cons
  6. `media` — at least one photo/video (optional area, never required)
  7. `tags` — at least one tag
- A publish-minimum review (rating + text) scores 0. Implemented in
  `frontend/src/lib/reviewDetail.ts` (`detailScore`, `isDetailedReview`,
  `missingDetailAreas`, `DETAILED_THRESHOLD`).

**D4.2 Name and look of the mark**
- **Decided:** glow only, no badge. Detailed reviews get a gold border +
  halo on the whole `.review-card` plus the existing gold expand-pill halo
  (`.review-expand-btn.rich`), all driven by `isDetailedReview` — replacing
  the old `teaserItems.length >= 3` heuristic. A screen-reader-only
  "Detailed review" label keeps the mark accessible. Nothing added near the
  Verified seal; the seal stays the only "identity" signal.

**D4.3 Default sort on university pages**
- **Decided:** (b). 'Most helpful' now ranks `upvotes + filled detail
  areas` (each area counts like one vote), recency tiebreak — and it is the
  default once a university page has ≥5 reviews (`HELPFUL_DEFAULT_MIN_REVIEWS`
  in `lib/reviewSort.ts`). Below 5 the default stays `newest`. The picker
  keeps the same four options; the hook reports `resolvedSort` so the UI
  shows the real order.
- Applies to university pages only. `/reviews` and the program/degree hubs
  keep 'newest' as default; their 'Most helpful' option gets the new
  ranking automatically (shared comparator).
- Prerender: `universityPageData` now ships `upvoteCounts` (counts only,
  voter identity never exported — same rule as the reviews/hub payloads)
  and pre-orders the corpus by the resolved default, so static HTML and
  first hydrated paint agree — no reshuffle on load, and the seeded
  'helpful' rank needs zero extra requests.

**D4.4 Who sees the strength meter?**
- **Decided:** author only. `ReviewStrengthMeter` (in `ReviewExtras.tsx`)
  renders on each card in My reviews today; the post-publish success screen
  picks it up once PR #58 is merged (that file is Phase 3 territory until
  then). Anonymous authors see it on the success screen when it lands —
  they never reach My reviews. Nothing meter-like renders on public cards.

## Tasks (agent)

1. Completeness helper in `frontend/src/lib/` with Vitest tests. If it's needed for sorting, also a SQL view or generated column: write a migration, update the snapshot, and handle grants.
   **Done differently on purpose:** the score is computed client-side from
   `reviewDetail.ts` — 'helpful' was already client-ranked (PostgREST can't
   ORDER BY a vote count), so no SQL object, migration, or grants change
   was needed. The 'helpful' head select widened to `REVIEW_DETAIL_COLUMNS`
   (all score fields except `text`).
2. Mark on `ReviewCard.jsx` and in `ReviewExtras.tsx`. **Done** — gold
   accent + halo on `ReviewCard`, author meter added to `ReviewExtras`.
3. Sort option in `ReviewSortSelect.tsx` and the review data hooks.
   **Done** — 'auto' default in `useUniversityReviews`; option set
   unchanged; `useRecentReviews`/`useHubData` get the new ranking free via
   the shared comparator.
4. Strength meter on the success screen and in `MyReviews.tsx`.
   **Half done** — `MyReviews` done; success screen deferred until PR #58
   merges, then this section is revisited.
5. SEO check: no new review markup, and `universitySchema` rules unchanged.
   **Done** — no JSON-LD touched; the mark is CSS classes on existing card
   markup and renders in prerendered HTML like everything else.

## Done when

- The mark renders in prerendered pages as well as client-side.
- Sorting is covered by a test.
- `validate_build.mjs` passes.

## Release gate (owner)

Phase 2 is on staging but not production — this branch builds on it and
must not reach production before the Phase 1 baseline is captured and the
Phase 2 flow is released. PR into `staging` for a deploy preview; do not
merge `staging` into `master` carrying this.

## Follow-up after PR #58

- Integrate staging into this branch (or rebase) once `feat/phase3-anon-boost`
  merges, then add `ReviewStrengthMeter` to `ReviewSuccess.tsx` — including
  for anonymous authors — and verify the combined result on the deploy
  preview.
