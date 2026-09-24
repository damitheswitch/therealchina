// smoke_live.mjs — post-deploy SEO smoke test against the LIVE site.
//   node scripts/smoke_live.mjs https://therealchina.net
//   node scripts/smoke_live.mjs https://deploy-preview-123--site.netlify.app --preview
// Fails (exit 1) on: non-200 content pages, wrong canonical, missing
// noindex on app routes, soft-404s, broken sitemap/robots, dev-server HTML.
import { parse } from 'node-html-parser'

const base = (process.argv[2] ?? 'https://therealchina.net').replace(/\/$/, '')
const isPreview = process.argv.includes('--preview')
const PROD = 'https://therealchina.net'

const failures = []
const notes = []
const fail = (m) => failures.push(m)
const note = (m) => notes.push(m)

const get = async (path, follow = false) => {
  const res = await fetch(`${base}${path}`, { redirect: follow ? 'follow' : 'manual' })
  return { status: res.status, headers: res.headers, body: await res.text() }
}

console.log(`smoke: ${base} (${isPreview ? 'preview/staging' : 'production'} mode)`)

// ── 1. homepage ─────────────────────────────────────────────────────────────
{
  const r = await get('/')
  const doc = parse(r.body)
  if (r.status !== 200) fail(`/ → ${r.status}`)
  const title = doc.querySelector('title')?.text ?? ''
  if (!title) fail('/: empty <title>')
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')
  if (canonical !== `${PROD}/`) fail(`/: canonical ${canonical} != ${PROD}/`)
  const robots = doc.querySelector('meta[name="robots"]')?.getAttribute('content') ?? ''
  // Preview noindex is enforced by X-Robots-Tag + robots.txt (checked below);
  // page meta stays policy-level so content never fights deploy context.
  if (!isPreview && /noindex/i.test(robots)) fail('/: production page is noindex!')
  if (!/<div id="app">\s*<[^>]|<div id="app">[^<]{10}/s.test(r.body)) {
    fail('/: #app looks empty — prerendered HTML not being served')
  }
  if (!/__PRERENDERED_DATA__/.test(r.body))
    note('/: no __PRERENDERED_DATA__ — first paint refetches')
}

// ── 2. dynamic-route behavior — need a real slug: pull one from sitemap ─────
let uniSlug = null
{
  const sm = await get('/sitemap.xml')
  if (sm.status !== 200) fail(`/sitemap.xml → ${sm.status}`)
  const locs = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  uniSlug = locs.find((l) => l.includes('/university/'))?.split('/university/')[1] ?? null
  if (!isPreview && locs.length === 0) fail('sitemap empty on production')
}

if (uniSlug) {
  // Trailing slash: identical content on Netlify, also resolvable by simple
  // static servers for local runs.
  const r = await get(`/university/${uniSlug}/`)
  const doc = parse(r.body)
  if (r.status !== 200) fail(`/university/${uniSlug} → ${r.status}`)
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')
  if (canonical !== `${PROD}/university/${uniSlug}`) fail(`uni canonical: ${canonical}`)
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      JSON.parse(s.textContent)
    } catch {
      fail('uni: unparseable JSON-LD')
    }
  }
} else {
  note('no university pages in sitemap (zero substantive reviews) — skipping uni checks')
}

// ── 3. redirect + 404 contracts ─────────────────────────────────────────────
{
  // An alias must 301 to the canonical (use a known historical alias if any)
  const alias = await get('/university/tsinghua')
  if (alias.status === 301) {
    const loc = alias.headers.get('location') ?? ''
    if (!loc.includes('/university/tsinghua-university')) {
      note(`alias /university/tsinghua → ${loc} (not the expected canonical — data may differ)`)
    }
  } else if (alias.status === 200) {
    note('/university/tsinghua served 200 — alias may not exist in this dataset')
  } else {
    note(`/university/tsinghua → ${alias.status}`)
  }

  // A bogus slug must be a REAL 404, not a soft 404
  const nf = await get('/university/definitely-not-a-real-university-zzz')
  if (nf.status !== 404) fail(`/university/bogus → ${nf.status} (soft 404!)`)
  const bogusCity = await get('/city/notacity-zzz')
  if (bogusCity.status !== 404) fail(`/city/bogus → ${bogusCity.status} (soft 404!)`)

  // App routes → 200 via SPA shell, must carry noindex
  const app = await get('/review')
  if (app.status !== 200) fail(`/review → ${app.status}`)
  if (!/noindex/i.test(app.body)) fail('/review: app shell missing noindex')
}

// ── 4. robots + headers contract ────────────────────────────────────────────
{
  const robots = await get('/robots.txt')
  if (robots.status !== 200) fail('/robots.txt missing')
  if (isPreview) {
    if (!/Disallow:\s*\//.test(robots.body)) fail('preview robots.txt must Disallow: /')
    const home = await get('/')
    const xrt = home.headers.get('x-robots-tag') ?? ''
    if (!/noindex/i.test(xrt)) fail('preview missing X-Robots-Tag: noindex header')
  } else {
    if (!/Sitemap:/.test(robots.body)) fail('prod robots.txt missing Sitemap line')
    if (/Disallow:\s*\/\s*$/m.test(robots.body)) fail('PROD robots.txt disallows everything!')
  }
}

// ── 5. no stale dev artifacts ───────────────────────────────────────────────
{
  const home = await get('/')
  if (/@vite\/client|vite\/dist\/client/.test(home.body)) fail('dev-server HTML detected on live')
  if (/src="\/src\/main\.jsx"/.test(home.body)) fail('unbuilt entry reference on live')
}

for (const n of notes) console.log(`  note: ${n}`)
if (failures.length) {
  console.error(`\nSMOKE FAILED — ${failures.length}:`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`SMOKE PASSED — ${base}`)
