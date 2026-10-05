# Phase 1: Measurement

**Depends on:** nothing. **Blocks:** Phase 2 (the baseline must exist before the flow changes).
**Overview:** [00-overview.md](00-overview.md) §5.

## Goal

Know where people drop out of the review flow, for signed-in **and** anonymous
users, and record a "before" baseline that Phase 2 can be judged against.

## Owner decisions (answer before coding)

**D1.1 Analytics tool for step events**
- (a) Hosted cookieless analytics (Plausible, Umami Cloud). Cheapest, a script tag plus custom events.
- (b) Self-hosted Umami (e.g. on a small VPS). Same as (a) but you control reachability from China.
- (c) Own `analytics_events` table behind a gated Edge Function. Most work; needed only if (a) and (b) are unreachable.
- **Recommendation:** (a), but first test that its script loads in WeChat's browser on a mainland network without VPN. If it doesn't, (b).
- Decision: ______

**D1.2 Privacy wording**
Cookieless tools usually need no consent banner, but the privacy/trust page should mention them.
- **Recommendation:** add one plain sentence to the trust page. Decision: ______

**D1.3 Which events** (approve or edit the list)
`review_step_viewed {step}`, `review_published {signed_in}`, `boost_card_completed {card}`, `boost_exited {after_card}`.
The Boost events only fire after Phase 2. Add them now so the names are stable.
- Decision: ______

## Tasks

1. **Owner, no code:** run the three baseline queries from overview §5 in the Supabase SQL Editor on TRC prod. Paste the results, with the date, into the "Baseline" section below.
2. **Agent:** add the analytics script per D1.1.
   - Load it only in the browser, never during prerender (`AGENTS.md` SEO rule 10).
   - Keep it off staging and deploy previews, or send their events to a separate site ID.
3. **Agent:** fire the events from D1.3 in `ReviewWizard.tsx`, wrapped in a small `lib/analytics.ts` helper (with a Vitest test) so the wizard doesn't call the vendor directly.
4. **Agent:** update the trust page copy per D1.2.

## Files

`frontend/src/lib/analytics.ts` (new), `frontend/src/components/ReviewWizard.tsx`,
`frontend/index.html` or app shell, trust page component.

## Done when

- Baseline numbers are recorded below.
- Events show up in the dashboard from a real phone, including one test from inside WeChat.
- Prerendered HTML contains no analytics side effects (`validate_build.mjs` passes).

## Baseline (fill in)

| Date | Drafts stopped at step 1/2/3/4/5 | Finished (signed-in) | Abandoned | Fill rates |
|---|---|---|---|---|
| | | | | |
