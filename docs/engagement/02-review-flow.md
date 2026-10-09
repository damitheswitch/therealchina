# Phase 2: The fast review flow

**Depends on:** Phase 1 baseline recorded (production tracker working + dated
pre-change baseline captured — not done yet; see `01-measurement.md`).
**Blocks:** Phases 3 to 7.
**Status:** implemented on `feat/phase2-fast-review-flow` (unreleased — do not
merge to `staging` or `master` until the Phase 1 gate opens).
**Overview:** [00-overview.md](00-overview.md) §3 (diagnosis) and §6 (target flow).

## Goal

A signed-in or anonymous student can publish a review in **under 90 seconds**.
Everything optional moves to a "Boost" after publishing. Signed-in users can
Boost through the existing edit path. Anonymous Boost is Phase 3.

## Owner decisions (answer before coding)

**D2.1 What's required before publishing?**
Today 6 fields are required: university, program, stars, recommend, start year, review text (10+ characters).
- (a) Keep all 6.
- (b) Drop program and start year to optional.
- (c) Allow rating-only reviews, no text (the Local Guides approach).
- **Recommendation:** (a). Program and start year make a review findable and current. Rating-only reviews would also create thin pages and move averages with no context.
- **Implemented direction (owner redirect):** beyond (b). The publish minimum is
  now exactly what the server already requires — **university, rating, review
  text (10+ characters)**. `program`, `recommend`, `start_year` are optional in
  `reviewFields.ts` and nullable in `reviews`, so no server or schema change
  was needed. `recommend` stays as an optional one-tap input on screen 1;
  `program`, `degree_level`, `enrollment`, years, and instruction language
  moved to Boost cards. `start_year`/`program` fill-rate risk: reviews may
  publish without them, reducing program-hub coverage — flagged for the
  owner report, since this was the argument for (a).

**D2.2 Tags: before or after publishing?**
- **Recommendation:** before. They're a few taps, and they partly replace pros and cons.
- **Implemented:** before. Optional chips on screen 2, per the recommendation.

**D2.3 The register popup after an anonymous review**
Today it can't be closed (`closable: false`).
- (a) Make it closable, with a concrete reason to sign up ("get notified when someone replies").
- (b) Keep it forced.
- **Recommendation:** (a).
- **Implemented:** (a). The forced modal is gone. The success screen shows a
  dismissible inline offer ("get notified when someone replies, edit later,
  put your name on it") and the register modal it opens is `closable: true`.
  The claim-token and post-sign-in redirect keys are unchanged.

**D2.4 "About you" fields** (languages, current status, email consent)
- (a) Move them to sign-up onboarding (`OnboardingForm.jsx` already asks for them).
- (b) Keep them as a final Boost card.
- **Recommendation:** (a) for signed-in users. Anonymous users get only the home-country card in Boost.
- **Implemented:** removed from the flow entirely. Those fields never reached
  review columns — they were stored on the private `reviewer_context` row —
  and onboarding already collects them for signed-in users. **Kept:** the
  optional anonymous email field, on screen 2 for anonymous users only. It is
  the existing `reviewer_context.email` path and powers review-claim email
  matching plus any future Phase 5 contact. No Boost cards for anonymous
  users in this phase at all, so the "home-country card" from option (b) does
  not exist yet — revisit in Phase 3.

**D2.5 Old drafts saved under the 5-step layout**
- (a) Map old steps: 1 → screen 1; 2 and 3 → screen 1 with Boost data kept; 4 and 5 → screen 2.
- (b) Discard drafts older than the release.
- **Recommendation:** (a). Losing someone's half-written review is the opposite of this whole plan.
- **Implemented:** (a). `ReviewDraftPayload` gained `v` (absent = v1).
  `mapDraftStepToScreen` maps v1 steps 1-3 to screen 1 and 4-5 to screen 2;
  all payload fields carry over, so Boost-only answers (sub-scores, money,
  details, about-you) ride along in form state and re-save into the v2
  payload on the next autosave. `progress` writes stay in the 0-5 check, no
  migration needed. `draftProgressLabel` reports the mapped screen ("Step X
  of 2").

**D2.6 What editing a published review looks like**
- (a) One long page with all sections.
- (b) Keep the step-by-step layout.
- **Recommendation:** (a). Editing isn't a first-time flow, so speed matters less than seeing everything.
- **Implemented:** (a). `ReviewEditForm` renders every section on one page and
  saves through `review-manage` with the same confirm dialog.

**D2.7 Copy for the starter chips and Boost cards**
The agent drafts the wording. You approve it, because it's user-facing and the `AGENTS.md` copy rules apply.
- **Drafted, awaiting owner approval.** Starters: "The best part is ",
  "The worst part is ", "I wish I knew ". Boost cards and subtitles are in
  `BOOST_CARD_META` (`lib/reviewFlow.ts`). Screen titles: "The essentials.
  Under a minute." and "One thing you'd tell a friend".

## Scope (as implemented)

- Screen 1 (`ReviewEssentials`): university (autocomplete + not-listed
  proposal), stars, optional recommend.
- Screen 2 (`ReviewStory`): review text with starter chips, optional tags,
  optional anonymous email, Turnstile for anonymous users, Publish.
- Success screen (`ReviewSuccess`): the published review card rendered live
  from form state, the Boost offer (signed-in), the closable sign-up offer
  (anonymous).
- Boost cards (`BoostCards`, signed-in only): `program` (program + degree
  level), `ratings` (8-aspect sub-score stack, one save), `money`, `details`
  (enrollment, years, language), `pros_cons`, `media`. Card order and copy in
  `BOOST_CARD_ORDER`/`BOOST_CARD_META`.
  - Each card saves immediately through `review-manage` (`updateReview`)
    with the full merged field set, since the server rewrites all writable
    columns on each update. A skipped card restores its fields to the values
    they had when the card opened, so unsaved input can't leak into a later
    card's save.
  - Deviation from the original card list: `home_country` is a profile field,
    not a review field, so it has no Boost card (onboarding owns it).
- Draft compatibility per D2.5 (`v` payload + `mapDraftStepToScreen`).
- Edit layout per D2.6 (`ReviewEditForm`, one page).
- Shared state: `useReviewForm` hook holds all field values; screens, Boost
  cards, and the edit page compose the granular blocks in
  `components/review/fields.tsx`. `buildReviewFields` produces the identical
  payload for submit, edit, and Boost saves.
- Analytics: `flow: 'fast_2'` on every Phase 1 event; steps 1-2 map to stages
  `basics`/`story` (screen 2 also fires `review_story_viewed`). New events:
  `boost_card_completed {flow, auth, card}` and
  `boost_exited {flow, auth, after_card}` with the fixed card enum — see
  `01-measurement.md` D1.3.

## Out of scope

- Anonymous Boost (Phase 3).
- Completeness badge and sorting (Phase 4).
- Emails (Phase 5).

## Tasks (agent)

1. Split `ReviewWizard.tsx` into `.tsx` pieces: `ReviewEssentials`,
   `ReviewStory`, `ReviewSuccess`, `BoostCards`, `ReviewEditForm`, shared
   `fields.tsx`, plus the `useReviewForm` state hook. **Done.**
2. Version the draft payload (`ReviewDraftPayload`) and map old steps.
   **Done** — `v: 2`, `mapDraftStepToScreen`; `progress` stays in the 0-5
   check, no migration.
3. Replace `<select>` with chip rows wherever the list is short: years,
   language, degree, tuition, living cost, funding. **Done** — chip rows with
   an "Earlier" select escape for older years.
4. Change no server-side validation. **Done** — the publish minimum already
   matched `reviewFields.ts`; nothing server-side changed.
5. Add Vitest tests for the draft mapping and any new `lib/` helpers.
   **Done** — `reviewFlow.test.ts`, `mapDraftStepToScreen` cases in
   `reviewDrafts.test.ts`, boost-event schema cases in `analytics.test.ts`.

## Files

`ReviewWizard.tsx` (container), `components/review/{fields,ReviewEssentials,
ReviewStory,ReviewSuccess,BoostCards,ReviewEditForm}.tsx`,
`hooks/useReviewForm.ts`, `lib/reviewFlow.ts`, `lib/reviewDrafts.ts`,
`lib/analytics.ts`, `lib/reviewSubmit.ts`, `lib/reviewManage.ts`,
`StarInput.jsx`, `global.css`, `AuthModalContext` call (D2.3).

## Done when

- Five people, timed on a call, publish in under 90 seconds.
- A phone inside WeChat on a mainland network completes the anonymous path, including Turnstile.
- Old drafts saved at steps 1 to 5 all resume.
- The `AGENTS.md` verification gate passes (lint, format, build).
- Phase 1 events fire for the new screens.

## Release gate (owner)

This branch must not reach production until the Phase 1 gate opens: the
production Umami tracker verified delivering events **and** a dated
pre-change baseline captured. Merge `feat/phase2-fast-review-flow` into
`staging` only for a deploy preview; do not merge `staging` into `master`
with it. The legacy 5-step flow keeps serving production until then.
