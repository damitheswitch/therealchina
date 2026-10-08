# Phase 2: The fast review flow

**Depends on:** Phase 1 baseline recorded. **Blocks:** Phases 3 to 7.
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
- Decision: ______

**D2.2 Tags: before or after publishing?**
- **Recommendation:** before. They're a few taps, and they partly replace pros and cons.
- Decision: ______

**D2.3 The register popup after an anonymous review**
Today it can't be closed (`closable: false`).
- (a) Make it closable, with a concrete reason to sign up ("get notified when someone replies").
- (b) Keep it forced.
- **Recommendation:** (a).
- Decision: ______

**D2.4 "About you" fields** (languages, current status, email consent)
- (a) Move them to sign-up onboarding (`OnboardingForm.jsx` already asks for them).
- (b) Keep them as a final Boost card.
- **Recommendation:** (a) for signed-in users. Anonymous users get only the home-country card in Boost.
- Decision: ______

**D2.5 Old drafts saved under the 5-step layout**
- (a) Map old steps: 1 → screen 1; 2 and 3 → screen 1 with Boost data kept; 4 and 5 → screen 2.
- (b) Discard drafts older than the release.
- **Recommendation:** (a). Losing someone's half-written review is the opposite of this whole plan.
- Decision: ______

**D2.6 What editing a published review looks like**
- (a) One long page with all sections.
- (b) Keep the step-by-step layout.
- **Recommendation:** (a). Editing isn't a first-time flow, so speed matters less than seeing everything.
- Decision: ______

**D2.7 Copy for the starter chips and Boost cards**
The agent drafts the wording. You approve it, because it's user-facing and the `AGENTS.md` copy rules apply.
- Decision: ______

## Scope

- Screen 1: university, program, stars, recommend, start year as chips.
- Screen 2: one text box with starter chips, tags, Turnstile for anonymous users, Publish.
- Success screen: the published review card, the Boost offer, the sign-up offer per D2.3.
- Boost cards, signed-in only: sub-score card stack, money, details, pros or cons, photo, home country.
  - Each card saves immediately through `review-manage` (`lib/reviewManage.ts → updateReview`).
- Draft compatibility per D2.5.
- Edit layout per D2.6.

## Out of scope

- Anonymous Boost (Phase 3).
- Completeness badge and sorting (Phase 4).
- Emails (Phase 5).

## Tasks (agent)

1. Split `ReviewWizard.tsx` (1643 lines) into `.tsx` pieces: `ReviewEssentials`, `ReviewStory`, `ReviewSuccess`, `BoostCards`, plus a shared state hook.
2. Version the draft payload (`ReviewDraftPayload`) and map old steps.
   - `review_drafts.progress` is limited to 0 to 5 in the database. Keep new values inside that range, or add a migration and update `schema_snapshot.sql`.
3. Replace `<select>` with chip rows wherever the list is short: years, language, degree, tuition, living cost, funding.
4. Change no server-side validation. `review-submit` checks stay exactly as they are.
5. Add Vitest tests for the draft mapping and any new `lib/` helpers.

## Files

`ReviewWizard.tsx` (split), `lib/reviewDrafts.ts`, `lib/reviewSubmit.ts`,
`lib/reviewEdit.ts`, `lib/reviewManage.ts`, `StarInput.jsx`, `global.css`,
`OnboardingForm.jsx` (if D2.4 is (a)), `AuthModal` call sites (D2.3).

## Done when

- Five people, timed on a call, publish in under 90 seconds.
- A phone inside WeChat on a mainland network completes the anonymous path, including Turnstile.
- Old drafts saved at steps 1 to 5 all resume.
- The `AGENTS.md` verification gate passes (lint, format, build).
- Phase 1 events fire for the new screens.
