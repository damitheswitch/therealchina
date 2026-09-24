// validate_build.mjs — SEO guardrail that FAILS THE BUILD on regressions.
//   node scripts/validate_build.mjs        (after vite build + prerender)
//   TRC_INDEXABLE=1 to validate production-mode output.
//
// Covers the "never" rules that can be checked mechanically: canonicals,
// titles/descriptions, robots, sitemap, JSON-LD truthfulness, internal links,
// no hotlinked media, payload privacy, SPA shell + 404 isolation.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'node-html-parser'

const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(FRONTEND, 'dist')
const SRC = resolve(FRONTEND, 'src')
const PROD = 'https://www.therealchina.net'
const isProd =
  process.env.TRC_INDEXABLE === '1' ||
  (process.env.CONTEXT === 'production' && (process.env.URL ?? '').includes('therealchina.net'))

const errors = []
const warns = []
const fail = (m) => errors.push(m)
const warn = (m) => warns.push(m)

const read = (p) => readFileSync(p, 'utf8')
const distFile = (route) =>
  route === '/' ? resolve(DIST, 'index.html') : resolve(DIST, route.slice(1), 'index.html')

// ── Load the route registry ─────────────────────────────────────────────────
const routesMod = read(resolve(SRC, 'routes.generated.ts'))
const routePaths = [...routesMod.matchAll(/path:\s*"([^"]+)"/g)].map((m) => m[1])
if (routePaths.length < 2) fail('routes.generated.ts has <2 routes — generator broken?')

// Policy import for rule 17 — read patterns from source (no TS transpile here)
const policySrc = read(resolve(SRC, 'lib/seo/policy.ts'))
const indexPatterns = [...policySrc.matchAll(/\/\^(.+?)\$\//g)].map((m) => new RegExp(`^${m[1]}$`))

const APP_SHELL_PATHS = new Set([
  '/review',
  '/profile',
  '/users',
  '/flights',
  '/onboarding',
  '/settings',
  '/reset-password',
])
const MEDIA_EXTS = /\.(png|jpe?g|gif|webp|avif|svg|mp4|webm|mov|woff2?|ttf|otf)(\?|#|$)/i
const HOTLINK_HOSTS =
  /shanghairanking\.cn|images\.pexels\.com|picsum\.photos|cdn\.pixabay\.com|googleapis\.com|gstatic\.com/i

// Every generated page must have: file, one title, canonical=self, desc,
// robots, one h1, valid JSON-LD, parseable payload.
const titles = new Map()
const descs = new Map()
const linksToCheck = []
let pageCount = 0

for (const path of routePaths) {
  const file = distFile(path)
  if (!existsSync(file)) {
    fail(`${path}: generated file missing (${file})`)
    continue
  }
  pageCount++
  const html = read(file)
  const doc = parse(html)

  const titleEls = doc.querySelectorAll('title')
  if (titleEls.length !== 1) fail(`${path}: ${titleEls.length} <title> tags`)
  const title = titleEls[0]?.text.trim() ?? ''
  if (!title) fail(`${path}: empty <title>`)
  if (titles.has(title)) fail(`${path}: duplicate title "${title}" also on ${titles.get(title)}`)
  titles.set(title, path)

  const desc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? ''
  if (!desc) fail(`${path}: missing meta description`)
  if (descs.has(desc)) warn(`${path}: duplicate description also on ${descs.get(desc)}`)
  descs.set(desc, path)

  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')
  if (!canonical) fail(`${path}: missing canonical`)
  // Canonical URLs carry the trailing slash — Netlify pretty-URL normalization
  // 301s /x → /x/, so a slash-less canonical would point at a redirect.
  else if (canonical !== `${PROD}${path === '/' ? '/' : `${path}/`}`)
    fail(`${path}: canonical ${canonical} != ${PROD}${path}/`)

  const robots = doc.querySelector('meta[name="robots"]')?.getAttribute('content') ?? ''
  if (!robots) fail(`${path}: missing robots meta`)
  if (isProd && /noindex/i.test(robots)) fail(`${path}: noindex on a production page`)

  const h1s = doc.querySelectorAll('h1')
  if (h1s.length !== 1) warn(`${path}: ${h1s.length} <h1> (expected exactly 1)`)

  if (!/html[^>]*lang="en"/.test(html)) fail(`${path}: missing lang="en"`)

  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? ''
  if (!/^https:\/\//.test(ogImage)) fail(`${path}: og:image not absolute (${ogImage})`)

  // JSON-LD: parse + aggregateRating must be backed by visible text.
  // React SSR splits text with <!-- --> markers — normalize before checking.
  const visibleText = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ')
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const obj = JSON.parse(s.textContent)
      const rating = obj?.aggregateRating?.ratingCount
      if (rating && !visibleText.includes(`${rating} review`)) {
        fail(`${path}: JSON-LD aggregateRating count ${rating} not visible on page`)
      }
    } catch (e) {
      fail(`${path}: JSON-LD parse error — ${e.message}`)
    }
  }

  // Hydration payload: parseable + no secrets
  const payloadMatch = html.match(/__PRERENDERED_DATA__ = (.*);<\/script>/s)
  if (!payloadMatch) {
    fail(`${path}: missing __PRERENDERED_DATA__ payload`)
  } else {
    try {
      JSON.parse(payloadMatch[1])
      if (/password|service_role|secret|api[_-]?key/i.test(payloadMatch[1])) {
        fail(`${path}: payload contains secret-like token`)
      }
      if (/@[a-z0-9.-]+\.[a-z]{2,}/i.test(payloadMatch[1])) {
        warn(`${path}: payload contains an email-like string — check privacy`)
      }
    } catch (e) {
      fail(`${path}: payload JSON parse error — ${e.message}`)
    }
  }

  // Media/hotlink check: external src/href on resource elements
  for (const el of doc.querySelectorAll('img,script,iframe,video,source,link[href]')) {
    const u = el.getAttribute('src') ?? el.getAttribute('href') ?? ''
    if (/^https?:\/\//i.test(u) && !u.startsWith(PROD) && HOTLINK_HOSTS.test(u)) {
      fail(`${path}: hotlinked resource ${u.slice(0, 90)}`)
    }
  }

  // Internal links — collect for the integrity pass
  for (const a of doc.querySelectorAll('a[href^="/"]')) {
    const href = a.getAttribute('href').split(/[?#]/)[0]
    if (href) linksToCheck.push({ path, href })
  }
}

// ── Internal link integrity ─────────────────────────────────────────────────
const redirectSrc = existsSync(resolve(DIST, '_redirects')) ? read(resolve(DIST, '_redirects')) : ''
const redirectTargets = new Map()
for (const m of redirectSrc.matchAll(/^(\/\S+)\s+(\/\S+)\s+301/gm)) redirectTargets.set(m[1], m[2])
// 200-rewrite targets (thin university slugs → app.html) are valid link targets
const spaRewrites = new Set()
for (const m of redirectSrc.matchAll(/^(\/\S+)\s+\/app\.html\s+200/gm)) spaRewrites.add(m[1])
const routeSet = new Set(routePaths)
const distHas = (p) =>
  existsSync(resolve(DIST, p.slice(1))) || existsSync(resolve(DIST, p.slice(1), 'index.html'))

for (const { path, href } of linksToCheck) {
  if (
    routeSet.has(href) ||
    redirectTargets.has(href) ||
    spaRewrites.has(href) ||
    APP_SHELL_PATHS.has(href) ||
    distHas(href)
  )
    continue
  if (/\.(xml|txt|webmanifest|json)$/i.test(href) && distHas(href)) continue
  fail(`${path}: internal link to ${href} resolves to nothing`)
}

// ── sitemap.xml ─────────────────────────────────────────────────────────────
if (!existsSync(resolve(DIST, 'sitemap.xml'))) {
  fail('sitemap.xml missing')
} else {
  const sm = read(resolve(DIST, 'sitemap.xml'))
  // Sitemap locs end in / (canonical form); route paths don't.
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1].replace(PROD, '').replace(/\/$/, '') || '/'
  )
  const missing = routePaths.filter((r) => !locs.includes(r))
  const extra = locs.filter((l) => !routeSet.has(l))
  if (missing.length) fail(`sitemap missing routes: ${missing.join(', ')}`)
  if (extra.length) fail(`sitemap lists non-prerendered routes: ${extra.join(', ')}`)
}

// ── robots.txt ──────────────────────────────────────────────────────────────
if (!existsSync(resolve(DIST, 'robots.txt'))) fail('robots.txt missing')
else {
  const robots = read(DIST + '/robots.txt')
  if (isProd && !/Sitemap:\s*https:\/\/www\.therealchina\.net\/sitemap\.xml/.test(robots)) {
    fail('prod robots.txt missing sitemap line')
  }
  if (!isProd && !/Disallow:\s*\//.test(robots)) fail('non-prod robots.txt must Disallow: /')
}

// ── _redirects ──────────────────────────────────────────────────────────────
if (!redirectSrc) {
  fail('_redirects missing')
} else {
  if (!/\/\*\s+\/app\.html\s+200/.test(redirectSrc))
    fail('_redirects: SPA fallback must target /app.html')
  if (!/\/university\/\*\s+\/404\.html\s+404/.test(redirectSrc))
    fail('_redirects: missing /university/* → 404 rule')
  // alias targets that aren't prerendered are expected while reviews are thin —
  // report the count, not every line
  const thinAliasTargets = [...redirectTargets].filter(
    ([from, to]) => from.startsWith('/university/') && !routeSet.has(to)
  )
  if (thinAliasTargets.length) {
    warn(
      `${thinAliasTargets.length} alias redirects target non-prerendered slugs (thin pages → SPA shell)`
    )
  }
}

// ── app.html + 404.html shells ──────────────────────────────────────────────
for (const f of ['app.html', '404.html']) {
  const p = resolve(DIST, f)
  if (!existsSync(p)) {
    fail(`${f} missing`)
    continue
  }
  const h = read(p)
  if (!/noindex/i.test(h)) fail(`${f}: must carry noindex`)
}
if (
  existsSync(resolve(DIST, 'app.html')) &&
  !/<div id="app"><\/div>/.test(read(resolve(DIST, 'app.html')))
) {
  fail('app.html must have an empty #app mount')
}

// ── service worker ──────────────────────────────────────────────────────────
const swPath = resolve(DIST, 'sw.js')
if (existsSync(swPath)) {
  const sw = read(swPath)
  const precache = sw.match(/precacheAndRoute\(\[([^\]]*)\]/s)?.[1] ?? ''
  if (/\.html/.test(precache)) fail('sw.js precaches .html — prerendered pages would go stale')
  if (/navigateFallback/.test(sw) || /createHandlerBoundToURL/.test(sw)) {
    warn('sw.js may contain a navigation fallback — check unknown URLs still 404')
  }
}

// ── rule 17: prerendered routes must be indexable by policy ────────────────
const indexablePolicy = (p) => indexPatterns.some((re) => re.test(p))
for (const r of routePaths) {
  if (!indexablePolicy(r))
    fail(`route ${r} is prerendered but policy marks it noindex — registry/policy mismatch`)
}

// ── source-level rules ──────────────────────────────────────────────────────
// No raw external <a> for user URLs outside UserLink; no Google Fonts import.
const scanDir = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) scanDir(p, out)
    else if (/\.(jsx|tsx|ts)$/.test(e) && !e.endsWith('.test.ts') && !e.endsWith('.test.tsx'))
      out.push(p)
  }
  return out
}
for (const f of scanDir(SRC)) {
  const src = read(f)
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(src)) {
    fail(`${f.replace(FRONTEND, '')}: references Google Fonts (self-hosted only)`)
  }
}
const globalCss = read(resolve(SRC, 'styles/global.css'))
if (/@import\s+url\(/.test(globalCss)) fail('global.css still contains a remote @import')

// IndexNow key file must exist when a key is configured
const siteSrc = read(resolve(SRC, 'lib/seo/site.ts'))
const inKey = siteSrc.match(/indexnowKey:\s*'([^']+)'/)?.[1] ?? ''
if (inKey && !existsSync(resolve(FRONTEND, 'public', `${inKey}.txt`))) {
  fail(`IndexNow key file public/${inKey}.txt missing (or key out of sync with site.ts)`)
}

// ── summary ─────────────────────────────────────────────────────────────────
for (const w of warns) console.warn(`  WARN ${w}`)
if (errors.length) {
  console.error(`\nSEO VALIDATION FAILED — ${errors.length} error(s):`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}
console.log(
  `SEO VALIDATION PASSED — ${pageCount} prerendered pages, ${redirectTargets.size} alias redirects, ${warns.length} warnings`
)
