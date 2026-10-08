# Phase 6: Q&A launch and cold start

**Depends on:** Phase 2 shipped (so the review side stops losing people first).
**Current state:** prototype on `origin/feat/community-mock` (mock data in
`frontend/src/lib/communityMock.ts`, routes registered as noindex in
`lib/seo/policy.ts`, no real tables).
**Overview:** [00-overview.md](00-overview.md) §7 F.

## Goal

Launch `/community` with real content on day one, and position it as the place
WeChat groups link to, not a replacement for them.

## Owner decisions (answer before coding)

**D6.1 Seed content**
- You collect the 30 to 50 most repeated questions from your WeChat groups.
- You post them under your own account and answer them, or credit the person who answered in the group, with their permission.
- No fake accounts, and no copying people's messages without permission.
- Decision: who collects them, and by when: ______

**D6.2 Anonymous asking and answering**
The mock supports anonymous authors.
- (a) Anonymous allowed, behind Turnstile and rate limits.
- (b) Account required.
- **Recommendation:** ask anonymously; answer with an account. Answers are where trust and reputation matter.
- Decision: ______

**D6.3 Indexing**
- Q&A pages could bring a lot of search traffic, but thin or empty threads hurt the site.
- **Recommendation:** noindex until a thread has an accepted or upvoted answer, then index it. That means a new rule in `policy.ts`/`indexable.ts` and an SEO review (`AGENTS.md`).
- Decision: ______

**D6.4 How links look when pasted into WeChat**
- What does a pasted link show: title, preview image, answer count?
- Do we need a "copy for WeChat" button?
- Decision: ______

**D6.5 Moderation**
Who removes spam and bad answers, and how? Today the only tool is the Supabase dashboard.
- **Recommendation:** soft delete plus a report button. A real admin tool can wait until reports come in regularly.
- Decision: ______

**D6.6 "Invite to answer"** (the Zhihu pattern)
Route a question to people who reviewed that university or city. Now or later?
- Decision: ______

## Tasks (agent, after decisions)

This phase is big enough to split again. Suggested sub-plans:
1. **Schema.** Tables for questions, answers and votes. RLS, grants, migration, snapshot update.
2. **Write paths.** Edge Functions with Turnstile and rate limits, following the pattern of `review-submit`.
3. **Swap the mock for real data** in `CommunityPage.tsx`, `CommunityQuestionPage.tsx`, `AskQuestionPage.tsx`.
4. **SEO and link previews** per D6.3 and D6.4.
5. **Seed import.** Founder content goes in through the normal UI or a reviewed script, never in migrations.

## Done when

- `/community` launches with at least 30 real answered questions.
- Pasting a link into WeChat shows a good preview.
