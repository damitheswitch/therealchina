---
name: trc-db-change
description: TRC database change checklist. Use before writing or changing anything under supabase/ (migrations, schema_snapshot.sql, RLS policies, functions, triggers, views, indexes, grants, seed.sql) or modifying Edge Functions in supabase/functions/. Enforces the schema_snapshot contract, staging-safe migration numbering, and the grant-revoke rule.
---

# TRC database change checklist

`AGENTS.md` is the law; this skill is the run-order. If they conflict, `AGENTS.md` wins.

## 1. Before writing SQL

- Start from `supabase/schema_snapshot.sql` — the single source of truth. Do not read the whole `supabase/migrations/` folder; open only the specific historical migration you need.
- Check remote numbering before picking a version: `supabase migration list --project-ref pthlbalvkunugifbzgzk`. Feature branches push their own versions to trc-staging, so if remote is ahead, number your file after the highest **remote** version, not the highest local file.
- New migration: `supabase migration new <name>` in `supabase/migrations/`.

## 2. Writing the migration

- Grants: new tables/views/functions in `public` are auto-granted to `anon`/`authenticated` at CREATE time. Always add `REVOKE ... FROM PUBLIC, anon, authenticated` for anything not meant for clients, and re-run the revoke in any migration that DROPs/recreates the object (`CREATE OR REPLACE` keeps grants, `CREATE` does not). See `docs/security-audit.md`.
- Migrations are up-only. Reverting a live change = a new forward-fix migration.
- Risky changes use expand/contract: add, backfill, switch reads, drop old in a later migration. Every intermediate state must stay compatible.
- Never put demo/seed inserts in a migration — they reach prod via `db push`. Seed data lives in `supabase/seed.sql` (auto on `db reset`) and `supabase/seed_demo.sql` (manual). Seed inserts that join onto `seed.sql` tables must go in `seed.sql`, not a migration — they silently insert 0 rows otherwise.

## 3. Test locally, never skip tiers

- `docker info` first — Docker Desktop is not always running. Then `supabase start` / `status` / `db reset`.
- Apply and test locally with `supabase db reset`. Only push to `trc-staging` (`supabase db push --project-ref pthlbalvkunugifbzgzk`) when the feature's Netlify preview needs the schema, and push from a clean worktree if the tree holds unrelated WIP migrations — it pushes all pending files.
- Prod (`hfinkagueeojyyrpauav`) is reads-only. It only receives `supabase db push` after merge to `staging`/`master`.
- **`SUPABASE_PROJECT_ID` hazard:** it is set to the prod ref in the main worktree env and overrides `--linked`. For `supabase db query --linked`, unset it first and sanity-check which project answered (`SELECT current_database(), inet_server_addr()`).

## 4. Same-change obligations (not follow-ups)

- Update `supabase/schema_snapshot.sql` so it matches the final schema — never leave it stale.
- Edge Function changes: `npx deno check --config supabase/functions/<fn>/deno.json supabase/functions/<fn>/index.ts`.
- If types were regenerated: `npx supabase gen types typescript --db-url "postgresql://postgres:postgres@localhost:54322/postgres?sslmode=disable" > frontend/src/types/database.types.ts`, then `git diff` and keep only intended changes.
- If a slug-related migration (`supabase/migrations/*slug*`), the file is SEO-sensitive — see `trc-pre-ship`.
