# Marketing claims register

Status: draft. Repository observations checked 2026-10-27, not live-site QA.

Every factual campaign claim needs an evidence ID, source, checked date, and
scope. An existing source is not a guarantee that the deployed product matches
it. The owner reviews the claim and destination before publication.

| ID  | Claim boundary                                                                             | Source                                                                             | Use and limits                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C01 | TRC focuses on university reviews for international students researching China             | `frontend/src/lib/seo/site.ts`, `frontend/src/lib/trustContent.ts`                 | Supported positioning. Do not expand to guaranteed admissions or comprehensive national coverage.                                                      |
| C02 | The repository has university browsing and review submission routes                        | `frontend/src/App.jsx`: `/universities`, `/review`                                 | Route presence only. Verify the destination on the audience's device/network before using it.                                                          |
| C03 | Reviews are individual accounts, not independently proven enrollment                       | `frontend/src/lib/trustContent.ts`, editorial policy                               | Never say "every student verified", "ID checked", or "all reviews fact-checked". Signed-in identity is not enrollment verification.                    |
| C04 | Public policy says payment cannot influence ratings or remove negative reviews             | `frontend/src/lib/trustContent.ts`, About and editorial policy                     | Preserve this boundary. Do not infer that future affiliate arrangements are already approved.                                                          |
| C05 | Current About copy includes "No sponsorships, no partner placements, no reviews for sale." | `frontend/src/lib/trustContent.ts`, About                                          | Internal conflict marker. Do not reuse blanket noncommercial language in new campaigns without checking the business model and public policy together. |
| C06 | Anonymous reviews are welcomed; published anonymity has limits                             | `frontend/src/lib/trustContent.ts`, editorial and privacy policies                 | Do not promise complete anonymity, untraceability, or risk-free disclosure. Check actual flow before describing controls.                              |
| C07 | The repository supports keeping a guest review anonymous when claiming it into an account  | `frontend/src/components/ReviewClaimPrompt.tsx`, `MyReviews.tsx`, `ReviewCard.jsx` | Public masking is not untraceability. Verify the actual journey; do not imply all signed-in review submissions have an anonymous toggle.               |

## Claims with no approved evidence yet

| Topic                                     | Missing evidence                                                               | Interim rule                                                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review counts, traffic, reach, conversion | Dated production metrics and method                                            | No made-up numbers, charts, testimonials, or "thousands of students" claims                                                                                                       |
| Review completion time                    | Actual timed testing for the current flow                                      | Do not turn the historical under-90-second target into a promise                                                                                                                  |
| Rewards, badges, prizes                   | Exact mechanics, fulfillment, terms, and verified release                      | Owner selected a future 2GB reward for full/approximately 90%-complete reviews, photos optional. Not a live reward; see commercial policy and `docs/engagement/07-incentives.md`. |
| Mainland accessibility                    | Current device/network tests, including in-app browsers                        | Do not claim guaranteed accessibility without a VPN                                                                                                                               |
| VPN offer                                 | Provider responsibilities, testing, dated terms and any financial relationship | Owner reports a friend-run, single-location server; "fast" and "secure" are not independently verified. No unlimited-service implication.                                         |
| Translation service                       | Named vetted partner, scope, credentials, pricing, complaint process           | No "certified", "accepted everywhere", or trust endorsement without evidence                                                                                                      |
| Admissions                                | Partner due diligence, conflict decision, service terms                        | On hold. No admission, visa, scholarship, or placement guarantees                                                                                                                 |
| Comparative superlatives                  | Fair comparison and dated criteria                                             | No "best", "safest", "cheapest", or "number one" without defensible evidence                                                                                                      |
| Student contact and unique access         | Current public contact controls and consent; substantiation for comparisons    | Some reviewers may voluntarily share WeChat. No universal contact availability or claim that useful firsthand accounts cannot exist on other platforms.                           |
| Complaint protection                      | Defined complaint/refund process and provider agreement                        | Owner intends case-dependent resolution/refund help and removal after a verified unresolved complaint, not guaranteed reimbursement, legal representation, or scam-proof service. |

## Add campaign evidence

For each new claim, record:

- Evidence ID and exact claim wording.
- Source location, author/provider, publication date if available, and checked date.
- Relevant excerpt or measurement method, with enough context to preserve caveats.
- Scope: geography, product version, audience, time period, and limitations.
- Owner approval, reviewer, recheck trigger, and any expiry.

Store campaign-specific evidence in the brief's `claims` array. Add reusable
approved claims here only after review. Provider marketing is not independent
proof. If evidence is missing or contradictory, omit the claim or block the asset.

Screenshots, reviews, and student stories need a source and permission review for
their intended reuse. Remove personal data; do not rewrite a quote to change its
meaning or fabricate a "representative" student quote.
