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

## Analytics tags

Both beacons are injected at prerender time on **production deploys only**
(the same `isProdDeploy` gate as robots/CSP) — previews, staging and local
builds ship no analytics code:

- **Google tag** (`SITE.gaMeasurementId`, GA4 `G-SETVDZ07H4`): immediately
  after `<head>` on every prerendered route and `404.html`. `app.html` is
  deliberately GA-free — app URLs can hold `?draft=` and `?code=` params
  that must not reach a third-party tracker's `page_location`.
- **Cloudflare beacon**: before `</head>` on all output including `app.html`,
  only when `CF_BEACON_TOKEN` is set.

Operational notes:

- SPA page views rely on **GA4 Enhanced Measurement** staying enabled in the
  web data stream (it is by default). There is no client-side hook.
- A build made with `TRC_INDEXABLE=1` emits the prod tag — never serve such
  output on a public URL or it will hit the production GA property.
- `validate_build.mjs` asserts the contract on every build (tag count per
  page type); `smoke_live.mjs` asserts it on the live site (present on `/`,
  absent on `/review`, absent entirely with `--preview`). After a prod
  deploy, also confirm hits in GA4 → Reports → Realtime.

## Per-release checklist

1. Merge to `staging` → Netlify preview builds.
2. `node scripts/smoke_live.mjs <preview-url> --preview` — must pass.
3. Merge to `master` → production deploy.
4. `node scripts/smoke_live.mjs https://www.therealchina.net` — must pass.
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
- [ ] Google Search Console: verify `www.therealchina.net`, submit `sitemap.xml`
      (apex `therealchina.net` 301s to www — verify the www property)
- [ ] Bing Webmaster Tools: verify site (IndexNow key file is already deployed)
- [ ] Netlify → Build hooks → create one → add as GitHub repo secret
      `NETLIFY_BUILD_HOOK` (enables the daily rebuild in
      `.github/workflows/daily-rebuild.yml` — without it, new reviews only
      appear in prerendered pages on the next code deploy)
- [ ] Netlify env var `CF_BEACON_TOKEN` (Cloudflare Web Analytics token) —
      optional; when set, prod pages get the beacon automatically
- [ ] Confirm Netlify env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
      `VITE_TURNSTILE_SITE_KEY` on the production site
- [ ] Confirm staging site is a separate Netlify site/branch-deploy (it is
      noindex automatically either way; `therealchina.netlify.app` force-301s
      to the canonical www host)

## Weekly / monthly

- Search Console coverage: watch "Indexed" count grow as real reviews land.
- `smoke_live.mjs` can be run anytime against prod — it only reads.
- If a redirect chain appears (alias → alias), fix `slug_aliases` data, never
  stack two 301s.
