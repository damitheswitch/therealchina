# Phase 7: Incentives

**Depends on:** Phase 2 (contributing is cheap) and Phase 4 (detail is visible).
**Overview:** [00-overview.md](00-overview.md) §4 (research) and §7 F.

## Goal

Give people a reason to review, answer, and come back, beyond doing the owner
a favor.

## Owner direction recorded 2026-10-13

**Status:** direction approved for planning; no new recognition system is
claimed implemented, verified on staging, or released.

- Prefer Google Local Guides-style contributor recognition plus the playful
  progress/return motivation associated with Duolingo. Do not copy Stack
  Overflow's complex reputation/privilege system.
- Recognize contributing itself and helping others. Contributions can be
  valuable before receiving votes, especially in an early community.
- Encourage answering real questions and interacting with reviews, not just
  finishing the review form. The community goal is to move participation from
  WeChat groups onto TRC; see session 6A in Phase 6.
- Badge names, earning criteria, levels, point values, reward benefits,
  streaks, and leaderboards are not decided by this direction.
- Dragon completion-meter artwork remains a future idea only. No dragon
  implementation/design brief is requested now.

## Owner decisions still open (answer before coding the relevant feature)

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

## Future idea: animated dragon completion meter

**Recorded 2026-10-13 at the owner's request. Status: idea only, not approved for implementation.**

A playful review-completion meter: a dragon moves forward as the reviewer
fills in their review, with its mouth open, trying to eat something at the
end. The target it eats, visual treatment, and completion rule are undecided.

This is an idea for encouraging review completion, not a decided system for
ongoing community engagement. No implementation plan is requested yet.
Points, badges, referrals, cash redemption, and other incentive rules remain
undecided; recording this idea does not approve any of them.

## Tasks (agent, after decisions)

Split into sub-plans per decision that was a yes:

- **Points ledger.** A server-side table, written only by Edge Functions and triggers. Never trust points sent by the client.
- **Level display.**
- **SEO plan for gating**, if D7.3 is (a).
- **Draw tooling.** An eligible-entries query and a published rules page.
- **Referral capture.**

## Session 7A: Small contributor recognition proposal

**Mode:** research the current code and refine the product proposal first.
Read `AGENTS.md`, the overview, Phase 4's gold-glow/detail rule, Phase 5's
contact policy, and Phase 6's community goal. Do not implement the dragon,
points ledger, cash redemption, paid rewards, or content gates in this session.

### Proposed starting shape, not approved mechanics

- Immediate acknowledgment for a real successful contribution, without
  requiring votes or a large existing audience.
- One simple contributor identity shared across reviews and Q&A, with a small
  number of meaningful milestones rather than ten levels of bureaucracy.
- Personal progress and additional recognition for genuine peer helpfulness.
  Anonymous reviewers must not be forced to register to publish; distinguish
  local acknowledgment from persistent account recognition/claiming.
- Relevant opportunities to answer real questions or join review discussions.
  Phase 6 owns matching/discovery; coordinate the interface rather than
  building a separate feed here.

### Deliverables and decisions

1. Inspect existing profile, review, answer, vote, accepted-answer, claim, and
   public-display paths. Decide whether useful first-version recognition can
   be computed from existing outcomes without a new points economy.
2. Propose the smallest identity/milestone scheme: names, appearance, earning
   criteria, surfaces, and what a user gains. Give examples for a first
   contributor with no votes and an established helpful contributor.
   Do not claim expertise or verification merely from activity.
3. Distinguish acknowledgement of contribution from evidence of helpfulness.
   Reject duplicate/self-vote farming, filler, rewarding positive ratings,
   and counting deleted/moderated content. Define treatment of edits,
   anonymous claims, repeat reviews, vote reversals, and accepted-answer
   changes. The agent must ask the owner to approve exact earning rules.
4. Keep recognition separate from the Verified identity seal and Phase 4's
   gold glow for detailed content. Do not add a second completeness formula
   or turn badges into a reason to lower review quality/abuse checks.
5. Propose lightweight celebratory feedback and optional personal progress.
   Daily streaks, loss pressure, leaderboards, and animation are not approved
   automatically by the Duolingo reference. Assess reduced motion,
   accessibility, mobile performance, and prerender/hydration behavior.
6. Propose how to measure genuine return participation and useful answers,
   not just animation clicks. Check existing data first; any new event
   contract requires explicit review of Phase 1's privacy restrictions.
7. Deliver one recommended scheme and a short alternative, with open owner
   decisions, abuse protections, and an isolated PR boundary. Finalize names,
   criteria, benefits, and copy before an implementation session begins.

## Session 7B: Implement the approved recognition minimum

**Blocked on:** owner approval of session 7A's exact scheme. The general
recognition direction is not approval for arbitrary points or badges.

- Start on current staging in a separate feature branch/worktree. Avoid
  independently rewriting shared Phase 2 review components.
- Reuse existing gold/detail and verified signals rather than replacing them.
  Keep public profile exposure and anonymous author masking unchanged unless
  an explicit privacy decision approves a change.
- Compute authoritative rewards/eligibility server-side or derive display
  from authorized persisted outcomes; never trust client-reported points.
  For database changes, update the snapshot, use numbered migrations, inspect
  staging versions, and revoke Supabase default grants appropriately.
- Test eligibility, duplicate events, deletion, claims, self/duplicate votes,
  reversals, anonymity, and the approved milestone boundaries. Verify SSR,
  hydration, accessibility, and reduced-motion behavior where relevant.
- Run `AGENTS.md` gates, relevant unit/Deno tests, and SEO validation. Verify
  the combined staging deploy's identity and behavior before a production
  release; document each evidence stage separately.

## Parked incentive decisions

D7.1-D7.5 above remain open. Points, redemption/cash, referrals, monthly draws,
content gating, prize rules, and legal eligibility are not approved. No
budget, exchange rate, payout threshold, or legal conclusion is established.
The dragon's endpoint and visual treatment also remain undecided.

## Done when

Defined per approved sub-plan. Sessions 7A and 7B are proposed handoffs, not
completed work or proof of release.

## Free VPN gift for full reviews (built 2026-10-30, off by default)

**Status:** built on a feature branch, not released. Nothing shows to reviewers
until both switches are on.

**What it is.** A reviewer who writes a full review can get a free 2GB VPN
trial from a friend of the owner. The email carries the owner's WeChat ID and
asks for an optional small proof. Buyers get a TRC discount and 150GB of online
storage. The owner adds reviewers to the TRC WeChat group by hand.

**Full review (checked on the server, never reads the rating).**
1. 40 or more units of the reviewer's own words (words, plus one unit per 2
   Chinese characters). The sentence the "What stood out" taps write does not
   count. Filler and keyboard mashing are rejected.
2. At least 2 taps on "What stood out".
3. At least 4 of 5 detail areas: major, category ratings (4 of 8), costs or
   funding, dates, photo.
4. Review is live. Near-duplicate text (trigram similarity 0.85 or more against
   any live review in the last 180 days) is declined; 0.6 or more is flagged.

Code: `supabase/functions/_shared/reward.ts` (server), `frontend/src/lib/reviewReward.ts`
(client mirror). Both run the same fixtures in `reward.fixtures.json`.

**Switches.** Client build flag `VITE_REVIEW_REWARD=on`. Server secret
`REWARD_ENABLED=true` plus `REWARD_WECHAT_ID`, `REWARD_HASH_SECRET` and
`RESEND_API_KEY`. If any server value is missing the gift email is not sent and
the reviewer sees "Gifts are paused" (their email stays saved).

**Secrets.** `REWARD_ENABLED`, `REWARD_WECHAT_ID` (dami_theSwitch),
`REWARD_OWNER_NAME`, `REWARD_DISCOUNT_TEXT`, `REWARD_HASH_SECRET` (any long
random string), `REWARD_SUPPORT_EMAIL` (default nihao@therealchina.net).

**Who gets contacted.** Guests: the private email typed on screen 3, kept on
`reviewer_context.email`. Members: the email on their account. The table
`review_rewards` stores the gift state and a one-way hash of the email, never
the address. A daily job deletes the guest's stored email 90 days after the gift.

**When the email goes out.** `review-submit`, `review-boost` and `review-manage`
all call `maybeDispatchReward` after a save, so a review that becomes full later
(for example through the extra-detail cards) sends the email at that moment.

**Owner queue (Supabase SQL editor).**

```sql
SELECT rr.reward_code, rr.status, coalesce(rc.email, au.email) AS email,
       rr.sent_at, u.name AS university, r.deleted_at IS NOT NULL AS deleted,
       r.updated_at > rr.sent_at AS edited_after_send, rr.flags
FROM public.review_rewards rr
JOIN public.reviews r ON r.id = rr.review_id
JOIN public.universities u ON u.id = r.university_id
LEFT JOIN public.reviewer_context rc ON rc.review_id = rr.review_id
LEFT JOIN auth.users au ON au.id = rr.user_id
WHERE rr.status IN ('sent', 'contacted')
ORDER BY rr.sent_at;

UPDATE public.review_rewards SET status = 'contacted' WHERE reward_code = 'TRC-XXXXXX';
UPDATE public.review_rewards
SET status = 'fulfilled', handled_at = now(), owner_note = 'link sent'
WHERE reward_code = 'TRC-XXXXXX';
```

**Claims the owner must confirm before turning it on.**

| Claim | What has to be true | Fallback wording |
|---|---|---|
| "very fast" | Tested from several Chinese networks | "a fast VPN" or "a VPN" |
| "150GB of online storage" | Comes with every paid plan | "extra online storage" |
| "limited time" | A real end date or gift count, stated on the policy page | Drop "(limited time)" |
| "2GB, one time" | The friend agrees to the amount | "a free trial" |

**Switch it off.** Set `REWARD_ENABLED` to anything other than `true`, or turn
the client flag off. Existing rows stay as they are.
