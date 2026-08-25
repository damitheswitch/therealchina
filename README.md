# The Real China (TRC) — Full-Stack Platform

Authentic, community-driven university reviews for international students in China.

**Tech Stack:** React + Vite frontend, Supabase backend (Postgres + Auth + Storage)

---

## Project Structure

```
project/
├── frontend/               # React + Vite frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── contexts/      # AuthContext, ToastContext
│   │   ├── lib/           # Supabase client
│   │   ├── pages/         # Page components
│   │   └── styles/        # Global CSS
│   ├── package.json
│   ├── vite.config.js
│   └── .env               # Supabase credentials (create from .env.example)
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql
└── README.md
```

---

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Wait for the database to initialize (~2 minutes)

### 2. Run SQL Migrations

1. In your Supabase project dashboard, go to **SQL Editor**
2. Copy and paste the contents of `supabase/migrations/001_initial_schema.sql`
3. Click **Run** to execute the migration
4. Copy and paste the contents of `supabase/seed.sql`
5. Click **Run** to load seed data (12 universities + 10 reviews)

### 3. Get Supabase Credentials

1. In your Supabase dashboard, go to **Settings > API**
2. Copy your **Project URL** and **anon/public key**

### 4. Configure Frontend

```bash
cd frontend
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 5. Install Dependencies & Run

```bash
npm install
npm run dev
```

The app will open at **http://localhost:5173**

---

## Features (Phase 1)

✅ **Public review browsing** — anyone can browse universities and read reviews  
✅ **Anonymous review submission** — no account required to submit a review  
✅ **Authenticated comments** — sign in to leave comments on reviews  
✅ **Upvote system** — authenticated users can upvote reviews (atomic RPC toggle)  
✅ **One-level comment nesting** — replies allowed, replies-to-replies blocked by DB trigger  
✅ **University search & filter** — search by name/city, filter by city, sort by rating/reviews  
✅ **User accounts** — email/password registration & login via Supabase Auth  
✅ **Materialized stats view** — fast landing page loads (no live AVG() queries)  
✅ **Row Level Security** — all permissions enforced at the database level

---

## Database Schema

**Tables:**
- `universities` — name, name_zh, city, slug, logo_url, is_verified
- `reviews` — university_id, user_id (nullable), rating, text, program, degree_level
- `comments` — review_id, user_id, parent_id (nullable), text
- `upvotes` — review_id, user_id (unique constraint)
- `profiles` — auto-created on signup via trigger

**RLS Policies:**
- Public read: universities, reviews, comments, upvotes (for counts)
- Public insert: universities (for "not listed"), reviews (anonymous OK)
- Authenticated insert/update/delete: comments (own), upvotes (own via RPC)
- Authenticated update: profiles (own)

**Special Features:**
- `toggle_upvote(review_id)` RPC — atomic upvote toggle (no race conditions)
- `university_stats` materialized view — pre-computed avg_rating, review_count
- `enforce_comment_nesting` trigger — blocks replies to replies
- `handle_new_user` trigger — auto-creates profile row on signup

---

## Verification Checklist

After setup, verify these work:

1. **Landing page loads** with 12 universities from Supabase
2. **Search/filter/sort** updates the grid correctly
3. **University page** shows correct university + reviews + stats
4. **Anonymous review submission** works (no login required)
5. **Registration** creates account and auto-creates profile
6. **Login** persists across page refresh
7. **Comment on a review** (requires login)
8. **Upvote a review** (requires login, toggles on/off)
9. **Reply to a comment** works; **reply to a reply** blocked by DB trigger
10. **Registration nudge** appears once per session, dismissible

---

## Future Phases

**Phase 2:** Image/video uploads via Supabase Storage + Google OAuth  
**Phase 3:** User profiles, referral system with payouts, Community Discovery page  
**Phase 4:** Admin panel (moderation, payouts, CSV import) via Edge Functions

---

## Tech Details

- **Frontend:** React 18 + Vite + React Router
- **Backend:** Supabase (Postgres 15 + Row Level Security)
- **Auth:** Supabase Auth (JWT-based, session managed by SDK)
- **CSS:** Existing TRC design system (CSS variables, no framework)
- **Fonts:** Noto Serif SC (headings), Inter (body)

---

## Troubleshooting

**"Missing Supabase environment variables" error:**
- Create `frontend/.env` from `.env.example` and add your credentials

**Landing page shows no universities:**
- Run the seed.sql file in Supabase SQL Editor
- Refresh the materialized view: `REFRESH MATERIALIZED VIEW university_stats;`

**Can't comment/upvote:**
- Check that you're logged in (sign up/login via the header)
- Verify RLS policies are enabled in Supabase

**Comments not showing:**
- The profiles table needs to exist (auto-created via migration)
- Check browser console for errors

---

## Development

```bash
# Frontend dev server
cd frontend
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## License

MIT
