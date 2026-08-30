# The Real China (TRC)

> Authentic, community-driven university reviews for international students in China.

**Status:** Private, for-profit product · Public repo for portfolio / recruiter visibility  
**License:** Proprietary — All Rights Reserved. Not open source.

---

## What this is

The Real China (TRC) is a full-stack review and community platform built for international students researching universities in China. Existing alternatives have thin coverage and don't live where the target audience actually talks (WeChat groups, Xiaohongshu/RED, Reddit). TRC aggregates honest, structured feedback and makes it searchable — starting with universities, then expanding into student profiles, peer discovery, and student-life services.

This repository is public as a **portfolio reference and technical spec** for recruiters and hiring managers. The source code is proprietary; no license is granted to use, copy, modify, or distribute it.

---

## Product Highlights

- **Anonymous-first review flow** — visitors can submit reviews without an account, lowering friction during the seeding phase.
- **Authenticated engagement** — upvotes, comments, and user profiles require sign-in.
- **University profiles** — searchable grid with city filtering, sorting by rating/review count, and autocomplete.
- **Review cards with media** — star ratings, program/degree context, image/video uploads, and optional social promo banners.
- **Comment system** — one-level nesting (replies to replies blocked at the DB layer).
- **Member directory** — discoverable user profiles for networking.
- **Flight listings board** — student-contributed travel offers, tied to profiles.
- **Onboarding flow** — required profile setup after sign-up.
- **PWA-ready** — installable, offline-capable via Vite PWA, with themed splash and icon set.
- **Brand-anchored UI** — seal-ink red (#A6192E), antique gold (#C9A227), rice-paper background (#FAF6EF), Noto Serif SC + Inter.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite 5, React Router 6, vanilla CSS design system |
| Backend / DBaaS | Supabase — Postgres 15, Auth, Storage |
| Auth | Supabase Auth (JWT-based, session managed by SDK) |
| File storage | Supabase Storage for review media with RLS policies |
| Hosting | Netlify (SPA redirects, Node 20 build environment) |
| PWA | Vite PWA plugin, custom manifest, maskable icons |

### Why this stack

- **Supabase** replaces a separate backend/ORM with Postgres + real-time subscriptions + built-in auth, letting a solo builder ship fast while staying production-grade.
- **Vite + React** gives a modern DX with fast HMR and a small production bundle.
- **Netlify** provides zero-config static hosting with SPA fallback routing.
- **Custom CSS** keeps the bundle dependency-light and the design system fully controlled.

---

## Architecture & Key Technical Decisions

### Row Level Security (RLS)

All data access is enforced at the database level:

- Public read on `universities`, `reviews`, `comments`, and `upvotes`.
- Anonymous insert on `reviews` and `universities` (for "not listed" submissions).
- Authenticated users can only modify their own `comments`, `upvotes`, and `profiles`.
- Media uploads gated by Supabase Storage RLS.

### Database design

**Core tables:**

- `universities` — name, Chinese name, city, slug, logo, verification status.
- `reviews` — rating (1-5), text, program, degree level, media JSONB, optional `user_id`.
- `comments` — review_id, user_id, optional parent_id, text.
- `upvotes` — `(review_id, user_id)` with unique constraint.
- `profiles` — display name, avatar, bio, location, university, program, social handles, discoverability.
- `flight_listings` — origin/destination, dates, price, contact info, linked to profiles.
- `university_stats` — precomputed `avg_rating` and `review_count` for fast landing-page loads.

**Special PostgreSQL features:**

- `toggle_upvote(review_id)` RPC — atomic upvote toggle, no race conditions.
- `university_stats` maintained by triggers — no expensive live aggregates on the landing page.
- `enforce_comment_nesting` trigger — blocks replies to replies at the DB layer.
- `handle_new_user` trigger — auto-creates a profile row on signup.
- `member_profiles` view — non-sensitive profile exposure for the user directory.
- `pg_trgm` extension + indexes for fuzzy university/city/program autocomplete.

### Frontend structure

```
frontend/src/
├── components/    # UI pieces (ReviewCard, UniversityCard, AuthModal, Onboarding, etc.)
├── contexts/      # AuthContext, AuthModalContext, ToastContext
├── hooks/         # useDebounce
├── lib/           # Supabase client, media upload, social handle helpers
├── pages/         # LandingPage, UniversityPage, ReviewPage, ProfilePage, UserDirectoryPage, FlightListingsPage, OnboardingPage
├── styles/        # Global CSS + design tokens
└── App.jsx        # Route tree with onboarding guard and auth-modal wiring
```

### Notable UX patterns

- **Anonymous-to-auth handoff:** an anonymous reviewer who then signs up is redirected back to the university they just reviewed.
- **One-time registration nudge** — shown once per session, dismissible.
- **Onboarding guard** — blocks non-onboarded users from core pages until profile setup is complete.
- **Autocomplete everywhere** — city, country, program, and university inputs use fuzzy matching.

---

## Deployment

The frontend builds to `dist/` and deploys on Netlify:

```toml
[build]
  base = "frontend"
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Supabase project, storage, and migrations are managed separately outside this repo.

---

## Development

```bash
cd frontend
npm install
npm run dev      # localhost:5173
npm run build    # production build
npm run preview  # preview production build
```

> Credentials and environment variables are not included. This repo is a code reference, not a runnable turnkey template.

---

## Roadmap

**Shipped:** MVP review platform, auth, comments, upvotes, media uploads, user profiles, member directory, flight listings, PWA shell.

**Next:**
- Referral program with manual payout tracking.
- Admin moderation panel (approvals, spam gating, CSV import).
- Community Discovery / Q&A features.
- Partnership integrations (accommodation, VPN, agencies).

---

## License & Use

This is a **private, for-profit project**. The repository is public for **recruiter and interview demonstration** only.

- No open-source license is granted.
- The code, design, and product concept are proprietary and may not be copied, modified, distributed, or used commercially without explicit permission.
- All rights reserved.
