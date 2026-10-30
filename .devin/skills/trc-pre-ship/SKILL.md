---
name: trc-pre-ship
description: TRC pre-ship verification gate. Use before committing, opening a PR, merging to staging or master, or deploying. Runs the repo's required checks (lint, format, build, validate_build, deno check), the SEO-sensitive file check, the schema_snapshot check, and the release checklist from docs/seo-ops.md.
---

# TRC pre-ship gate

Do not claim a task is done until the relevant gates pass. `AGENTS.md` Verification section is the authority; this is the executable order.

## 1. Required gates

Run from repo root unless noted:

1. `cd frontend && npm run lint` — zero errors; fix any new warnings you introduced.
2. `cd frontend && npm run format`
3. `cd frontend && npm run build` — must succeed (runs vite build → export:data → generate:static → prerender).
4. `node scripts/validate_build.mjs` — the build gate; run after every build.
5. Edge Function changes: `npx deno check --config supabase/functions/<fn>/deno.json supabase/functions/<fn>/index.ts`

## 2. Conditional checks

- **DB touched** (`supabase/migrations/`, `schema_snapshot.sql`, RLS, grants): `schema_snapshot.sql` must be updated in the same change. See `trc-db-change`.
- **SEO-sensitive files touched** (`frontend/src/lib/seo/`, `scripts/`, `routes.generated.ts`, `netlify.toml`, `vite.config.js` workbox, `supabase/migrations/*slug*`): fill the "SEO impact" section of the PR template; expect a required review. Indexability model: staging, previews, and local are always `noindex`; production is the only indexable deploy.
- **Code standards spot-check** on your diff: async `useEffect` cleanups, no refs written in render, no `key={index}` on reorderable lists, batched fetches (`.in()`), explicit column lists (no `select('*')`), no `console.log`, form inputs labelled, no em/en dashes in user-visible copy.

## 3. Git hygiene

- Conventional commits (`feat:` `fix:` `docs:` `refactor:` `chore:`). No placeholder messages. No staged-but-uncommitted files when done.
- Flow: feature branch → PR into `staging` → then `master`. Never push directly to prod paths.
- Netlify skip tokens, only when the user asked: `[skip netlify]` or `[skip ci]` in the **PR title** for deploy previews (before pushing); in the **effective head commit message** for branch deploys. Squash-merge keeps a token in the PR title; a plain merge commit message does not inherit it. Confirm Netlify reports the deploy skipped.

## 4. After merge (release checklist, docs/seo-ops.md)

1. Merge to `staging` → Netlify preview builds.
2. `node scripts/smoke_live.mjs <preview-url> --preview` — must pass.
3. Merge to `master` → production deploy.
4. `node scripts/smoke_live.mjs https://www.therealchina.net` — must pass.
5. `node scripts/indexnow.mjs` — submit the sitemap.
6. Check Search Console coverage over the following days.

GitHub connectivity on this machine is intermittent. If `git push`/`gh` fail, follow the AGENTS.md remote ops playbook: retry once, then `gh api`/GitHub MCP, then `curl --retry` against `api.github.com`, then hand the push to the user via GitHub Desktop. Never rewrite remote history or silently base commits on stale branches.
