# Frontend state machines

Every place in `frontend/src` where a lifecycle is spread over several
`useState` flags (and sometimes refs) that only make sense in certain
combinations. Audited 2026-11-13 on `staging`.

**Pattern for new or refactored flows:** a pure reducer in `src/lib/` with a
discriminated-union state (`status` field), named events, ignored invalid
transitions, and Vitest coverage. The component keeps side effects (fetch,
analytics, timers) and only `dispatch`es. Reference implementation:
`src/lib/reviewWizardMachine.ts`. Data hooks use the shared
`src/lib/asyncState.ts` instead of their own `loading`/`error` flags: seed with
`initialAsyncState(prerenderPayload)`, fetch with `run(task, { signal })`,
return `asyncFlags(state)` fields.

## Explicit (done)

| Flow                                                                                        | Where                                                                                                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New-review wizard: draft load, 6 screens, validation banner, publish, stamp, success, Boost | `components/ReviewWizard.tsx` → `lib/reviewWizardMachine.ts`                                                 | Replaced `phase`, `step`, `error`, `loading`, `showStamp`, `pendingSuccess` (a function in state), `published`, `boostIndex`, `boostDeck`, `draftLoading` and `submittedRef`. Fixed: Publish re-enabled under the click-through stamp overlay, so a second click posted a duplicate review (reproduced locally). Fixed: guests landing straight on Boost got the Photo card, which anonymous Boost cannot save.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Stamp animation                                                                             | `components/SealStampOverlay.jsx`                                                                            | `impact → hold → fade` on timers. Callers must pass a stable `onComplete` or the timers restart on every parent render.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Media upload items                                                                          | `components/MediaUploader.jsx`                                                                               | Per-item `status: 'uploading' \| 'done' \| 'error'`. Already explicit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Data-fetching hooks: loading, ready, notFound, error (+ idle for lazy hooks)                | `hooks/useCityData.ts`, `useHubData.ts`, `useCommunity.ts` (3 hooks), `useComments.ts` → `lib/asyncState.ts` | One `AsyncState<T>` union per hook via `useAsyncState`; `initialAsyncState(seed)` starts prerender-seeded pages in `ready` (no fetch, no loading flash); `asyncFlags` derives the old `{ loading, error, resolved }` return fields so pages did not change. Replaced `loading`, `error`, `resolved`, `notFound`, `loaded` and the `mounted` refs. Fixed: a slow response for a previous slug or request could overwrite a newer one (`run` keeps only the newest); signing out on a seeded hub page kept the old upvote marks. Still on hand-rolled flags, migrate one per commit: `useUniversity`, `useUniversityReviews`, `useUniversities`, `useCities`, `useProfile`, `useMemberProfileData`, `useMemberDirectory`, `useMyReviews`, `useRecentReviews`, `useHomeSections`, `useFlightListings` and the smaller count hooks. |

## Implicit (candidates, highest value first)

1. **AuthModal** (`components/AuthModal.jsx`): `mode` (login, register, forgot)
   crossed with `verificationSent`, `resetSent`, `loading`, `googleLoading`,
   `errorMsg`. The "check your email" screens are flags that must be reset by
   hand on every mode switch.
2. **ResetPasswordPage** (`pages/ResetPasswordPage.tsx`): `linkState` + `mode`
   (request, sent, reset) + `busy` + `errorMsg`, also driven by
   `AuthContext.passwordRecovery`.
3. **AuthContext** (`contexts/AuthContext.jsx`): `loading`, `user`, `session`,
   `passwordRecovery`. Small, but every consumer re-derives "signed out vs
   still checking".
4. **FlightListingsPage** (`pages/FlightListingsPage.jsx`): `showForm`,
   `editingListing`, `showSetupModal` are really one "which panel is open"
   value (none, create, edit listing X, socials setup).
5. **Submit-once forms**: `saving`/`posting` + error in `FlightListingForm`,
   `ProfileEditForm` (+ `passwordSectionOpen`), `OnboardingForm`,
   `AskQuestionPage`, `CommunityQuestionPage` answer box, `CommentSection`
   (`replyTo` + `posting`), `SocialHandlesSetupModal` (`loading` + `seeded`),
   `ReviewEditForm` (`loading` + `showConfirm`), `ReviewClaimPrompt`
   (`items` + `busyId` + `error`), `MyReviews` (`deleteBusy`, `revealBusy`),
   `FlightListingCard` (`deleting`, `toggling`). Each is idle, submitting,
   error. Low risk individually; a shared `useSubmit` hook would cover them.
6. **BoostCards** (`components/review/BoostCards.tsx`): `index` + `saving` +
   restore-on-leave refs.
