# Review Wizard — Branch Documentation

**Branch:** `feat/review-wizard` (from `staging`)
**Purpose:** Replace the single-page review form with a 5-step wizard that collects
structured sub-scores, enrollment context, cost/funding data, tags, pros/cons, and
reviewer demographics — for both anonymous and authenticated users.

---

## Commits on this branch

| Commit | What |
|--------|------|
| `ff5305c` | Initial wizard implementation: component, migration 022, edge function, CSS |
| `ff26bf1` | Fix duplicate-review risk on profile-update failure; `end_year >= start_year` validation (all 3 layers, migration 023) |
| `c0d52a9` | Regenerate `database.types.ts` after migrations 022–023 |
| `edbab8f` | Fix 9 `tsc` type errors (vite build never ran typecheck) |
| `c17eadf` | Fix shared-radio-group star bug; rework step 5 (migration 024) |
| `003843f` | Move program field to step 1; languages dropdown with full list |

---

## Schema changes (migrations 022–024 — already pushed to remote)

### `reviews` — new columns (migration 022)
- 8 sub-scores, all `INT NULL CHECK (1..5)`: `rating_academics`, `rating_campus`,
  `rating_accommodation`, `rating_cost`, `rating_intl_office`, `rating_social`,
  `rating_extracurricular`, `rating_career`
- Context: `enrollment_status` (`current|alumni|exchange|applicant`),
  `start_year` INT, `end_year` INT, `language_of_instruction` TEXT,
  `tuition_range` TEXT, `living_cost_range` TEXT,
  `funding_type` (`self|csc|school|province`),
  `funding_coverage` (`partial|full`), `recommend` (`yes|no|maybe`),
  `pros` TEXT, `cons` TEXT, `tags TEXT[] DEFAULT '{}'` (+ GIN index `idx_reviews_tags`)

### `reviews` — new constraint (migration 023)
- `chk_reviews_end_after_start`: `end_year IS NULL OR start_year IS NULL OR end_year >= start_year`

### `profiles` — new/changed columns (022 + 024)
- `home_country` TEXT, `monthly_budget` TEXT (defined but **not collected** — see Known gaps),
  `email_consent` BOOLEAN DEFAULT FALSE
- `journey_stage` **renamed to** `current_status` (024), CHECK:
  `studying|working|internship|job_hunting|break|other`
- `languages_spoken` TEXT → **TEXT[] DEFAULT '{}'** (024)

### `universities` — new columns (022)
- `country` TEXT, `uni_type` (`public|private`), `languages_of_instruction` TEXT[] DEFAULT '{}',
  `website` TEXT — **no UI writes these yet**, all NULL until curation

`supabase/schema_snapshot.sql` is up to date through migration 027 (per AGENTS.md).

### `reviewer_context` — new table (migration 027)
Private store for anonymous reviewers' "about you" answers (`email`,
`email_consent`, `home_country`, `current_status`, `languages_spoken`), keyed by
`review_id` with CASCADE delete. RLS enabled, no policies, `REVOKE ALL` from
anon + authenticated — only the review-submit edge function (service role)
touches it. Insert is best-effort: a context failure never fails the review.

---

## Deployment state (remote project `hfinkagueeojyyrpauav`)

- [x] Migrations 022, 023, 024 applied via `supabase db push`
- [x] Edge function `review-submit` deployed (`supabase functions deploy`)
- [x] `database.types.ts` regenerated from the live schema
- [ ] **Edge function redeploy needed if it changes again** — functions do not auto-update

### Edge function changes (`supabase/functions/review-submit/index.ts`)
- Validates all new fields server-side: enum allowlists, integer range checks,
  string length limits (`pros`/`cons` ≤ 1000, tags ≤ 20 items × 40 chars),
  `endYear >= startYear`, and `funding_coverage` nulled when `funding_type === 'self'`
- Insert writes all new `reviews` columns. Profile fields are **not** handled here
  (client-side `profiles` update — see Known gaps).

---

## Frontend changes

### New
- `ReviewWizard.tsx` (~1350 lines): 5 steps, per-step validation, submit logic.
  Reuses `UniversityAutocomplete`, `ProgramAutocomplete`, `MediaUploader`,
  `StarInput`, `SealStampOverlay`, Turnstile for anonymous users.
- `review-wizard-blueprint.html` — design mockup at repo root (candidate for deletion/move to `docs/`).

### Modified
- `ReviewPage.jsx` — now an 11-line wrapper passing `searchParams` (`?uni=<slug>` prefill).
- `reviewSubmit.ts` — `ReviewPayload` extended with all new fields; `SubScores` interface.
- `StarInput.jsx` — **bug fix**: all instances shared `name="rating"`, so clicking stars
  in one group natively unchecked the others (visual reset while value stayed saved).
  Each instance now gets a unique group name via `useId`.
- `useUniversity.ts` — signature widened to `slug: string | undefined`.
- `ToastContext.jsx` / `AuthModalContext.jsx` — JSDoc-typed `createContext` defaults so
  `showToast(msg, type)` / `openAuthModal(mode, config)` typecheck.
- `SealStampOverlay.jsx` — JSDoc props fixed for typechecking.
- `global.css` — +257 lines of wizard styles (progress bar, chips, segmented controls,
  recommend buttons, step animations).
- `database.types.ts` — regenerated.

### Wizard flow

| Step | Fields | Required |
|------|--------|----------|
| 1 Basics | University (or "not listed" → name+city), **Program**, overall rating, recommend | all four |
| 2 Ratings | 8 sub-scores | none (skippable) |
| 3 Details | enrollment status, **start year**, end year ("Still studying" = null), instruction language, degree level, tuition range, living cost, funding type/coverage, tags | start year only |
| 4 Story | pros, cons, review text, media | review text ≥ 10 chars |
| 5 About you | home country, "What are you up to right now?" (`current_status`), languages (multi), email consent; Turnstile if anonymous | none |

### Validation layers
1. Client `validateStep` on Continue (steps 1, 3, 4) + submit
2. Edge function re-validates everything independently
3. DB CHECK constraints as backstop

### Anonymous flow
Turnstile-gated submit → seal stamp → non-closable register modal
(`trc_anon_review_submitted` / `trc_anon_review_redirect` in sessionStorage).

---

## Testing guide

Dev server: `cd frontend && npm run dev` → `http://localhost:5173/review`
(prefill: `/review?uni=<slug>`)

⚠️ Local dev hits the **live** Supabase project — test submissions create real rows.

1. **Step 1**: university autocomplete; "isn't listed" flow; program required;
   stars must stay filled after mouse-leave; recommend required. Continue with
   missing fields → error banner.
2. **Step 2**: partial sub-scores OK; stars independent of step-1 rating.
3. **Step 3**: start year required; end year < start year → error
   (client, edge fn, and `chk_reviews_end_after_start` all enforce).
   Coverage field only appears when funding ≠ self.
4. **Step 4**: <10 chars review → error; media upload.
5. **Step 5**: languages dropdown → chips; current status; email consent.
   Anonymous: Turnstile must load before submit enables.
6. **Verify in Supabase dashboard**: `reviews` row has sub-scores/tags/pros/cons/
   years; logged-in `profiles` row has `current_status`, `languages_spoken` (array),
   `home_country`, `email_consent`.

## Merge checklist (→ staging)

- [ ] All wizard paths tested locally (anon + logged-in + not-listed university)
- [ ] `cd frontend && npm run lint` (0 errors) — note: `npm run typecheck` is **not**
      covered by build; run it explicitly
- [ ] `npm run format`, `npm run build`, `npm test`
- [ ] `npx deno check --config supabase/functions/review-submit/deno.json supabase/functions/review-submit/index.ts`
- [ ] If edge function changed since last deploy: `npx supabase functions deploy review-submit`
- [ ] Confirm remote migration list matches local (`npx supabase migration list`)
- [ ] Clean up test review rows from the live DB

## Known gaps / follow-ups

1. ~~Review display not updated~~ — **fixed** (PR #10: `ReviewExtras` renders
   sub-scores, tags, pros/cons, funding, years on cards).
2. ~~Anonymous step-5 data is discarded~~ — **fixed**: anonymous answers now go to
   the private `reviewer_context` table via the edge function (migration 027);
   no client can read it. Logged-in users get an opt-in "save to profile?"
   prompt that only writes provided, changed fields (never nulls, never
   downgrades `email_consent`).
3. **`monthly_budget` column unused** — kept in schema, not collected (was redundant
   with step-3 living cost).
4. ~~Onboarding/profile-edit don't collect the new profile fields~~ — **fixed**
   (PR #11).
5. **University new columns (`country`, `uni_type`, etc.) have no UI** — need curation.
6. **No wizard tests** — `lib/` helpers are covered; the wizard component itself
   has no tests yet.
7. ~~`review-wizard-blueprint.html`~~ — deleted.
8. **Hardcoded constants** — COUNTRIES/LANGUAGES/statuses/ranges now live in
   `src/lib/constants.ts`; tags and wizard option lists still inline.
9. **`tsc --noEmit` isn't in the build** — 9 type errors shipped unnoticed because
   `vite build` skips typechecking. Consider `npm run typecheck` in CI.
10. **Time-dependent CHECKs** — `start_year`/`end_year` use `EXTRACT(YEAR FROM NOW())`
    (non-immutable; fine on insert, stale rows unaffected unless updated).
