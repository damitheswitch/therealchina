# Agent Rules — TRC Project

These rules are mandatory. Prefer following them even when a faster path exists.

## Database / Supabase

**Canonical schema**: `supabase/schema_snapshot.sql` is the single source of truth for the current database state.

When doing anything database-related (migrations, schema changes, RLS, views, functions, grants):

1. Always start from `supabase/schema_snapshot.sql`.
2. After any change (add/alter/drop table, column, index, function, trigger, view, RLS policy, or grant), update `supabase/schema_snapshot.sql` so it matches the final schema. Never leave it stale.
3. Do **not** read the entire `supabase/migrations/` folder by default. The numbered files are historical only.
4. If you need the history of a specific change, open only the relevant migration file (e.g. `017_definer_view_qualified_names.sql`).
5. New migrations go in `supabase/migrations/` with the next number. Update `schema_snapshot.sql` in the same change.
6. Never delete, rename, or squash migration files unless the user explicitly asks.

### Environments (mandatory)

Three tiers: local → staging → prod. Never skip tiers.

| Context                                             | Supabase target                                                             |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| `npm run dev` on this machine (any branch/worktree) | Local Docker stack via `supabase start`; `frontend/.env.local` points at it |
| `staging` branch site + Netlify deploy previews     | `trc-staging` cloud project                                                 |
| `master` → production site                          | `TRC prod` cloud project                                                    |

- **Never** run migrations, hand-edits, or test writes against the production project. Prod only receives `supabase db push` after merge to `staging`/`master`.
- Feature work: `supabase migration new <name>`, apply and test locally with `supabase db reset`. A scrapped feature is deleted with its branch — its migrations never reach prod.
- Push a feature's migrations to `trc-staging` (`supabase db push --project-ref pthlbalvkunugifbzgzk`) when its Netlify preview needs the schema. Staging schema may be a superset of prod — expected, it's disposable.
- Edge Function changes deploy to `trc-staging` for previews (`supabase functions deploy --project-ref pthlbalvkunugifbzgzk`), to prod only on merge.
- Reverting a live change: forward-fix migration (new numbered file that reverses it) + update `schema_snapshot.sql`. Migrations are up-only — no `down`.
- Risky schema changes use expand/contract: add → backfill → switch reads → drop old in a later migration. Every intermediate state stays compatible.
- Local stack commands: `supabase start` / `stop` / `status` (prints local URL + keys), `supabase db reset` rebuilds from migrations + `seed.sql`.
- Local Turnstile uses Cloudflare test keys (sitekey + secret `1x0000000000000000000000000000000AA`), set in `frontend/.env.local` and `supabase/.env.local`.
- Fake/demo data is allowed on local, feat branches, and staging — **never prod**. It lives in `seed.sql` (auto on `db reset`) and `supabase/seed_demo.sql` (manual reseed via `supabase db query --linked --file`). Never put demo inserts in migrations — they reach prod via `db push`.

## Remote ops playbook (verified paths)

Use these first, in order — they are the methods that actually work from this machine. Don't re-derive.

### Supabase remote

No DB password needed anywhere — the Management API token covers all of it.

- Read/query any env: MCP `execute_sql` / `list_migrations` with `project_id` — no `supabase link` needed. Staging `pthlbalvkunugifbzgzk`; prod `hfinkagueeojyyrpauav` (prod = reads only).
- Push migrations to staging: `supabase db push --project-ref pthlbalvkunugifbzgzk`. It pushes **all** pending local migration files — run it from a clean worktree (`git worktree add`) if the working tree holds unrelated WIP migrations.
- Apply a data SQL file (e.g. `seed_merge.sql`) to staging: `supabase link --project-ref <ref>` once per worktree, then `supabase db query --linked --file <path>`. Plain `--project-ref` on `db query` errors — it only applies to the linked project.
- `seed_merge.sql` is UPDATE-only — safe to replay on any env that has the uni dataset.

### Local stack

- `docker info` before `supabase status`/`start` — Docker Desktop isn't always running.
- `db reset` order: migrations → `seed.sql`. Seed inserts that join onto tables populated only by `seed.sql` silently insert 0 rows when placed in a migration — put them in `seed.sql`, or re-apply the file manually after reset.

### GitHub / web

- `github.com` and `ssh.github.com` are intermittently unreachable here (connection reset / 443 timeout) while `api.github.com` and `codeload.github.com` keep working. When git fetch/push fails:
  1. Retry once or twice — it is flaky, not always down.
  2. Use `gh api` / `gh pr` (hits `api.github.com`) — branch deletion, ref updates, even committing files via blobs → tree → commit → `PATCH refs/heads/<branch>` all work without git transport.
  3. Or use `github-mcp-server` tools.
- Never route git through third-party github proxies — credentials leak.
- `webfetch` blocked or redirect loop → domain-scoped `web_search`, then fetch the result URL.
- Docs-only commits: put `[skip netlify]` in the commit message to avoid burning build minutes.

## Code Standards

### Language

- TypeScript-first. All **new** frontend source files must be `.ts` / `.tsx`.
- Do not convert existing `.jsx` files unless the task is a deliberate migration **and** you are already substantially rewriting the file.
- Edge Functions are already TypeScript — keep them that way.

### Verification (required before finishing any task)

These must pass. Treat them as a hard gate:

1. `cd frontend && npm run lint` — zero errors. Fix any new warnings you introduce.
2. `cd frontend && npm run format`
3. `cd frontend && npm run build` — must succeed.
4. Edge Function changes:  
   `npx deno check --config supabase/functions/<fn>/deno.json supabase/functions/<fn>/index.ts`

Do not claim a task is complete until the relevant checks above pass.

### React / Frontend

- Every async `useEffect` **must** have a cleanup path (AbortController / abort signal or mounted guard). No exceptions.
- Never write to refs during render. Assign `ref.current` only inside effects or event handlers.
- No mutable module-level counters or shared state across component instances. Use `useRef` per instance.
- Never fetch per-row inside a loop. Batch with `.in('column', ids)` (or equivalent) in the parent.
- Never use `key={index}` on lists that can reorder, filter, or grow. Use stable IDs.
- Extract data-fetching into custom hooks (`useX`) instead of repeating `useState` + `useEffect` boilerplate.
- Accessibility is required:
  - Form inputs need an associated `<label htmlFor=...>` or `aria-label`.
  - Dialogs need `role="dialog"`, `aria-modal="true"`, initial focus, and focus trapping.
  - Never auto-open modals on page load.
- No `console.log` in committed code. `console.error` is allowed only on genuine error paths.
- Prefer explicit column lists over `select('*')` from Supabase.

### Security (non-negotiable)

- Never trust JWT claims decoded only on the client or via base64. Always verify server-side (`supabase.auth.getUser(token)` or proper signature check) before granting privilege. Fail closed.
- Abuse-sensitive writes must go through gated paths (Edge Function + Turnstile / rate limits). Never allow direct anonymous table inserts for those operations.
- Never commit secrets (`.env` files, service-role keys, etc.). Anon/public keys are fine; service-role keys are not.
- Never trust client-controlled headers (`X-Forwarded-For`, `Origin`, `User-Agent`, etc.) for security decisions.
- If a rate limiter or external check (e.g. Turnstile) is unavailable, default to **reject**. Only fail-open if the user explicitly approves it and the decision is documented.

### Tests

- New logic in `frontend/src/lib/` and changes to Edge Function logic should include tests once a harness exists (Vitest / Deno test).
- If no harness exists yet, create the minimal one needed rather than skipping tests.

### Git Hygiene

- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, etc. No placeholder messages.
- Do not leave staged-but-uncommitted files when finishing a task.
- Work on feature branches → PR into `staging` → then `master`.

## SEO Guardrails

The site is prerendered + indexed. These rules keep that intact. `docs/seo-ops.md`
has the runbook; this section is the law.

### Single sources of truth (never duplicate these decisions)

| Decision | File |
|---|---|
| Which routes may be indexed | `frontend/src/lib/seo/policy.ts` |
| Site name, URL, contact, IndexNow key | `frontend/src/lib/seo/site.ts` |
| Titles/descriptions/canonical assembly | `frontend/src/lib/seo/meta.ts` (+ `<Seo>` component) |
| JSON-LD builders | `frontend/src/lib/seo/jsonld.ts` |
| Indexability thresholds (reviews/cities) | `frontend/src/lib/seo/indexable.ts` |
| Program/degree hub taxonomy | `frontend/src/lib/seo/programs.ts`, `degrees.ts` |
| Prerendered route registry (generated) | `frontend/src/routes.generated.ts` |
| Redirects, robots.txt, sitemap (generated) | `scripts/generate_static.ts` → `dist/` |

### Never rules (enforced by validator/tests — do not bypass)

1. **Never** hardcode a `<title>`, meta description, canonical, or JSON-LD
   block in a page/component — declare via `<Seo>` only.
2. **Never** change a university's canonical slug without preserving the old
   one in `slug_aliases` (the DB trigger does this — never disable it or
   delete alias rows).
3. **Never** serve fabricated data on production. Demo reviews/media live in
   `seed.sql`/`seed_demo.sql` only — never in migrations.
4. **Never** emit aggregateRating/review markup for numbers not visible on
   the page. `universitySchema` enforces count≥2 — don't loosen it.
5. **Never** hotlink external media (logos, photos, fonts) in prerendered
   pages — mirror to `public/` first.
6. **Never** let the service worker precache `.html` or add a navigation
   fallback — prerendered pages must stay fresh, unknown URLs must 404.
7. **Never** add an indexable route without registering it in `policy.ts`
   AND letting `generate_static` emit it. Unknown routes default to
   noindex — that is intentional.
8. **Never** commit `select('*')` payloads, auth tokens, emails, or profile
   data into `__PRERENDERED_DATA__` — it's public HTML.
9. **Never** "fix" a 404 by rewriting to `/index.html` — real 404s are
   required for dead slugs (`_redirects` splat rules).
10. **Never** auto-open the auth modal or run browser-only APIs during render
    — they break `renderToString` and hydration.

### Build pipeline (required steps — don't reorder)

`npm run build` = `vite build` → `export:data` → `generate:static` →
`prerender`. Then run `node scripts/validate_build.mjs` — it fails the build
on SEO regressions. `TRC_EXPORT_FIXTURE=1` builds from the committed fixture
(no DB). After any deploy, run `node scripts/smoke_live.mjs <url>` (+`--preview`).

### Indexability model

- University/city/hub pages earn indexing with real review substance
  (`src/lib/seo/indexable.ts`). Thin-but-valid pages are served via
  `app.html` with `noindex` — they are NOT bugs and NOT 404s.
- Alias slugs always 301 to the canonical slug. Old links never die.
- Staging, deploy previews, and local builds are always `noindex` +
  `Disallow: /` — production is the only indexable deploy.

### When changing SEO-sensitive files

Files under `src/lib/seo/`, `scripts/`, `routes.generated.ts`, `netlify.toml`,
`vite.config.js` (workbox), `supabase/migrations/*slug*`: fill in the "SEO
impact" section of the PR template and expect a required review.

## When in doubt

- Prefer the safer / more explicit option.
- Prefer updating `schema_snapshot.sql` and running the verification commands over “I’ll do it later”.
- If a rule conflicts with the user’s explicit instruction, follow the user’s instruction and note the deviation.
