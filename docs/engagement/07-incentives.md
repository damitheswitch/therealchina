# Phase 7: Incentives

**Depends on:** Phase 2 (contributing is cheap) and Phase 4 (detail is visible).
**Overview:** [00-overview.md](00-overview.md) §4 (research) and §7 F.

## Goal

Give people a reason to review, answer, and come back, beyond doing the owner
a favor.

## Owner decisions (answer before coding)

**D7.1 Points and levels** (Local Guides style)
- Points for: a rating, a review, a longer review, a photo, an answer, an accepted answer, Boost cards.
- A level shown on review cards and profiles.
- Decision: yes/no, and the point table: ______

**D7.2 What a level is worth**
Status alone is weak. Options:
- (a) Higher levels make the reviewer's social link (`SocialChip.tsx`) more prominent.
- (b) Early access to new features.
- (c) A "local expert" label for a city or university.
- **Recommendation:** (a) and (c). Both cost nothing and matter to this audience.
- Decision: ______

**D7.3 Give-to-get** (Glassdoor style)
- Review text stays public.
- Detailed breakdowns (cost, dorms, sub-scores) unlock after any one contribution.
- **SEO risk:** crawlers and users must see the same content, or it counts as cloaking. That needs an SEO sub-plan and changes to `policy.ts`.
- Options: (a) yes, with the SEO plan first; (b) no, rely on points; (c) later, once traffic proves people want the gated data.
- **Recommendation:** (c).
- Decision: ______

**D7.4 Monthly draw** (Niche style)
- One prize a month, with each review as an entry. Replaces the old 1 RMB-per-review idea.
- Needs: a budget, a legal check (prize draws in China and wherever you operate), and rules that count only real, non-deleted reviews.
- Decision: yes/no, budget, start month: ______

**D7.5 Referral links**
The old plan had a hidden `?ref=` code. Who gets credit, and what do they get (points, draw entries)?
- Decision: ______

## Tasks (agent, after decisions)

Split into sub-plans per decision that was a yes:
- **Points ledger.** A server-side table, written only by Edge Functions and triggers. Never trust points sent by the client.
- **Level display.**
- **SEO plan for gating**, if D7.3 is (a).
- **Draw tooling.** An eligible-entries query and a published rules page.
- **Referral capture.**

## Done when

Defined per sub-plan.
