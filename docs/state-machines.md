# Frontend state machines

Every place in `frontend/src` where a lifecycle is spread over several
`useState` flags (and sometimes refs) that only make sense in certain
combinations. Audited 2026-11-13 on `staging`.

**Pattern for new or refactored flows:** a pure reducer in `src/lib/` with a
discriminated-union state (`status` field), named events, ignored invalid
transitions, and Vitest coverage. The component keeps side effects (fetch,
analytics, timers) and only `dispatch`es. Reference implementation:
`src/lib/reviewWizardMachine.ts`.

## Explicit (done)

| Flow                                                                                        | Where                                                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New-review wizard: draft load, 6 screens, validation banner, publish, stamp, success, Boost | `components/ReviewWizard.tsx` → `lib/reviewWizardMachine.ts` | Replaced `phase`, `step`, `error`, `loading`, `showStamp`, `pendingSuccess` (a function in state), `published`, `boostIndex`, `boostDeck`, `draftLoading` and `submittedRef`. Fixed: Publish re-enabled under the click-through stamp overlay, so a second click posted a duplicate review (reproduced locally). Fixed: guests landing straight on Boost got the Photo card, which anonymous Boost cannot save. |
| Stamp animation                                                                             | `components/SealStampOverlay.jsx`                            | `impact → hold → fade` on timers. Callers must pass a stable `onComplete` or the timers restart on every parent render.                                                                                                                                                                                                                                                                                         |
| Media upload items                                                                          | `components/MediaUploader.jsx`                               | Per-item `status: 'uploading' \| 'done' \| 'error'`. Already explicit.                                                                                                                                                                                                                                                                                                                                          |

## Implicit (candidates, highest value first)

1. **Data-fetching hooks** (`hooks/use*.ts`, about 20): `data + loading + error`,
   plus `resolved`, `notFound` or `loaded` in some (`useCityData`, `useHubData`,
   `useCommunity`, `useComments`). Nothing stops `loading && error` or
   `resolved && loading`; each hook re-implements the transitions and the
   prerender seeding. Candidate: one `AsyncState<T>` union
   (`loading | ready | notFound | error`) behind a shared helper that also
   takes the `__PRERENDERED_DATA__` seed. Migrate one hook at a time; keep the
   returned `{ loading, error }` shape so pages do not change.
2. **AuthModal** (`components/AuthModal.jsx`): `mode` (login, register, forgot)
   crossed with `verificationSent`, `resetSent`, `loading`, `googleLoading`,
   `errorMsg`. The "check your email" screens are flags that must be reset by
   hand on every mode switch.
3. **ResetPasswordPage** (`pages/ResetPasswordPage.tsx`): `linkState` + `mode`
   (request, sent, reset) + `busy` + `errorMsg`, also driven by
   `AuthContext.passwordRecovery`.
4. **AuthContext** (`contexts/AuthContext.jsx`): `loading`, `user`, `session`,
   `passwordRecovery`. Small, but every consumer re-derives "signed out vs
   still checking".
5. **FlightListingsPage** (`pages/FlightListingsPage.jsx`): `showForm`,
   `editingListing`, `showSetupModal` are really one "which panel is open"
   value (none, create, edit listing X, socials setup).
6. **Submit-once forms**: `saving`/`posting` + error in `FlightListingForm`,
   `ProfileEditForm` (+ `passwordSectionOpen`), `OnboardingForm`,
   `AskQuestionPage`, `CommunityQuestionPage` answer box, `CommentSection`
   (`replyTo` + `posting`), `SocialHandlesSetupModal` (`loading` + `seeded`),
   `ReviewEditForm` (`loading` + `showConfirm`), `ReviewClaimPrompt`
   (`items` + `busyId` + `error`), `MyReviews` (`deleteBusy`, `revealBusy`),
   `FlightListingCard` (`deleting`, `toggling`). Each is idle, submitting,
   error. Low risk individually; a shared `useSubmit` hook would cover them.
7. **BoostCards** (`components/review/BoostCards.tsx`): `index` + `saving` +
   restore-on-leave refs.
