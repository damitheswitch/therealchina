# SEO Ops Runbook

Day-to-day and per-release procedures that keep the SEO work intact.
Guardrail details live in `AGENTS.md` → SEO section.

## How the pipeline works

`npm run build` (frontend) now runs:

1. `vite build` — client bundle → `dist/`
2. `export:data` — pulls public tables → `.prerender-data/*.json`
   (set `TRC_EXPORT_FIXTURE=1` to use the committed CI fixture instead)
3. `generate:static` — writes `src/routes.generated.ts`, `dist/_redirects`,
   `dist/robots.txt`, `dist/_headers`, `dist/sitemap.xml`, `dist/feeds/reviews.xml`
4. `prerender` — renders every registered route → `dist/<route>/index.html`,
   plus `dist/app.html` (SPA shell, noindex) and `dist/404.html`

`node scripts/validate_build.mjs` is the build gate — run it after every build.
`node scripts/smoke_live.mjs <url> [--preview]` is the post-deploy gate.

## Deploy contexts

| Context | robots.txt | X-Robots-Tag | Indexed? |
|---|---|---|---|
| Netlify `production` on therealchina.net | allow + sitemap | — | yes |
| branch-deploy / deploy-preview / local | `Disallow: /` | `noindex, nofollow` | no |

Detection: `CONTEXT=production` AND `URL` contains `therealchina.net`, or
`TRC_INDEXABLE=1`. Everything else is noindex — safe by default.

## Per-release checklist

1. Merge to `staging` → Netlify preview builds.
2. `node scripts/smoke_live.mjs <preview-url> --preview` — must pass.
3. Merge to `master` → production deploy.
4. `node scripts/smoke_live.mjs https://therealchina.net` — must pass.
5. `node scripts/indexnow.mjs` — submit the sitemap (Bing/Yandex/AI search).
6. Check Search Console coverage in the following days.

## When data changes

- **New substantive reviews** → next deploy automatically prerenders newly
  indexable university/city/hub pages and adds them to the sitemap.
- **Slug renames** → the DB trigger records the old slug in `slug_aliases`;
  `generate_static` emits the 301 automatically. Never delete `slug_aliases`.
- **University merges** → old slug becomes an alias → 301. Same flow.

## Owner manual steps (one-time)

- [ ] Delete the 23 leftover media objects: Supabase dashboard → Storage →
      `review-media` (inventory: `backups/prod-wipe-2026-09-24/storage_objects.json`)
- [ ] Google Search Console: verify `therealchina.net`, submit `sitemap.xml`
- [ ] Bing Webmaster Tools: verify site (IndexNow key file is already deployed)
- [ ] Confirm Netlify env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
      `VITE_TURNSTILE_SITE_KEY` on the production site
- [ ] Confirm staging site is a separate Netlify site/branch-deploy (it is
      noindex automatically either way)

## Weekly / monthly

- Search Console coverage: watch "Indexed" count grow as real reviews land.
- `smoke_live.mjs` can be run anytime against prod — it only reads.
- If a redirect chain appears (alias → alias), fix `slug_aliases` data, never
  stack two 301s.
