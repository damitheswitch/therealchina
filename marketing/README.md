# TRC marketing kit

Status: first draft for owner review. Created 2026-10-27.

This kit makes campaign planning, copy, images, and video repeatable across
tools. It does not approve a campaign, partner, budget, or public policy change.

## Start here

1. Review [the brand guide](brand/brand-guide.md).
2. Review [commercial boundaries](brand/commercial-policy.md), especially the
   conflict with the current public About page.
3. Look at the two starter briefs:
   [review contributors](campaigns/review-contributors/brief.json) and
   [prospective students](campaigns/research-from-abroad/brief.json).
   The second folder's original name is historical, not a geography restriction.
4. Continue [the interactive discussion](review-questions.md). Ask a few focused
   questions, record each answer, then refine. Do not hand the owner another
   unanswered questionnaire or invent the remaining decisions.

## What is decided and what is not

| Label            | Meaning                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| Existing source  | Observed in the repository, not independently verified on the live site |
| Owner direction  | Requested in the conversation on 2026-10-27                             |
| Proposed default | A starting recommendation awaiting owner review                         |
| Unknown          | Must be filled in or checked before the relevant campaign proceeds      |

## Owner decisions recorded 2026-10-27

- TRC is reviews, built by current students and alumni wherever they live.
  Contributors are the permanent first priority, not a temporary growth phase.
- Prioritize useful, detailed reviews, then sign-ups and completed profiles.
  Prospective students follow the value created by contributors.
- Student-to-student voice: direct, candid, helpful, and welcoming of criticism.
  English by default; targeted-language campaigns need an explicit brief.
- Start with the owner's WeChat network/groups and Instagram. The owner reports
  being a master's student with contacts at Xidian, CJLU, NUIST, Chang'an, and
  other universities. Confirm full school names/links before naming them publicly.
- A post every other day is realistic; daily simple images are possible, not a
  quota. Produce only what supports growth. The owner approves final work.
- Founder presence is case by case, as a fellow student rather than a hero or
  status figure. Any visual medium is acceptable when useful and on-brand;
  agents should recommend concrete options rather than ask the owner to choose
  production details without examples.
- Future offer: 2GB of VPN data for a full or approximately 90%-complete review;
  photos are not mandatory. Exact criteria and fulfillment are not yet defined.
  Profile completion alone is not the reward trigger. Any profile-linked
  discount still needs confirmation.
- Make the reward prominent without burying the mission. The 2GB limit must be
  clear near the offer, even when it is not the headline. This is future-facing,
  not a live reward announcement.
- Anonymous reviews qualify. Email is needed to deliver the reward, not to
  create automatic marketing consent or permission to share contacts with a provider.
- Vetted services respond to student needs; university/agency placements and
  paid influence over reviews are rejected. Admissions help stays parked.
  VPN/translation revenue potential for newcomers versus current students is untested.
- A friend operates the proposed VPN using one rented server/location.
  Speed/security are owner reports, not verified marketing claims.
  A translation office is known but has not confirmed participation or terms.
- Future voluntary support such as Buy Me a Coffee is an idea, not a live feature.
  Do not claim no income or nonprofit status without checking actual circumstances.

See the brand and commercial documents for boundaries and unresolved details.
These decisions approve direction, not implementation, spending, or publication.

## Sources of truth

| Topic                                        | Source                                                               |
| -------------------------------------------- | -------------------------------------------------------------------- |
| Name, tagline, production origin, contact    | `frontend/src/lib/seo/site.ts`                                       |
| Current public trust and legal copy          | `frontend/src/lib/trustContent.ts`                                   |
| Website colors and type                      | `frontend/src/styles/global.css`                                     |
| Website logo                                 | `frontend/src/components/Logo.jsx`                                   |
| Contribution and incentive plans             | `docs/engagement/00-overview.md`, `docs/engagement/07-incentives.md` |
| Marketing voice, audiences, visual direction | [Brand guide](brand/brand-guide.md)                                  |
| Marketing claim evidence and limits          | [Claims register](brand/claims-register.md)                          |
| Proposed commercial decision rules           | [Commercial policy](brand/commercial-policy.md)                      |

Public policies are not overridden by this kit. If they conflict with a proposed
campaign, stop that campaign and resolve the conflict with the owner. Do not
silently edit the public policies or repeat an outdated promise.

## Run a campaign

1. Copy [campaign-brief.json](templates/campaign-brief.json) to
   `marketing/campaigns/<campaign-id>/brief.json`. Choose one primary audience,
   objective, CTA, and measurable outcome.
2. Use the campaign-planning skill to propose three angles. Approve one angle
   before spending money on generation.
3. Copy [production-record.json](templates/production-record.json) into the
   campaign. Use the asset-production skill to prepare copy and generation
   prompts with [the reusable prompt blocks](templates/creative-prompts.md).
   Save editable sources separately from exports.
4. Review the actual exports with the creative-QA skill and
   [review checklist](templates/review-checklist.md).
5. The owner approves the exact asset version, caption, destination, placement,
   and any spend. Publishing is a separate authorized action.
6. Record outcomes and one change to test next. Do not manufacture baselines.

Brief status: `draft` -> `ready_for_review` -> `approved` -> `published` ->
`archived`. Use `blocked` when a dependency prevents progress. These are manual
records, not an automated approval or publishing system.

The starter briefs are ideas, not publication-ready campaigns. Empty strings,
`null`, and empty arrays indicate unanswered fields. Keep them visibly incomplete.

## Working files

For each campaign, create only the folders needed:

```text
brief.json
production-record.json
copy/
prompts/
source-assets/
exports/
qa.md
results.md
```

Use filenames such as
`<campaign-id>_<asset-id>_<placement>_<language>_v01.<ext>`.
Variants get separate IDs. Approved exports are not overwritten.

Commit small text records and templates. Keep large video/project files in
owner-approved storage and record their location. Never commit private
testimonials, contact lists, contracts, credentials, or personal documents.
No external storage or upload destination has been selected by this kit.

## Using the kit in different AI tools

Project skills:

- `.devin/skills/trc-campaign-planning/SKILL.md`
- `.devin/skills/trc-asset-production/SKILL.md`
- `.devin/skills/trc-creative-qa/SKILL.md`

In Devin, invoke `/trc-campaign-planning`, `/trc-asset-production`, or
`/trc-creative-qa` when discovered by the session. A new session may be needed
after adding skills.

For Claude Code or another coding agent, explicitly ask it to read this file,
the relevant skill, and the campaign brief. Automatic discovery depends on that
tool's configuration; this kit does not change its configuration.

For Gemini or an image/video tool, attach the relevant brand references and
paste the prepared production prompt. Do not assume the tool can access local
paths. Record what was actually supplied, not just a path it could not read.

Reusable starting instruction:

> Read marketing/README.md and the brand documents it references. Follow
> .devin/skills/trc-campaign-planning/SKILL.md for the selected campaign brief.
> Treat unknowns as unknowns. Propose three angles and recommend one.
> Do not publish, spend, contact partners, or invent proof.

## Maintaining the kit

After owner review, record each decision below and update the affected source.
Do not mark the whole kit approved because one campaign was approved.
Replace proposed defaults with decisions only when the owner confirms them.

| Date       | Decision                                                                                                                                                            | Approved by | Files affected                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------- |
| 2026-10-27 | Initial draft created; no blanket approval                                                                                                                          | Pending     | This kit                                           |
| 2026-10-27 | Contributor-first, geography-independent audiences; English, peer voice, channels, cadence, future reward direction, and service boundaries clarified interactively | Owner       | Brand documents, starter briefs, discussion record |
