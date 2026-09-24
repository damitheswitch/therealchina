// prerender.tsx — renders every route in src/routes.generated.ts to
// dist/<route>/index.html using the app's own components (entry-server).
// Also emits dist/app.html (noindex SPA shell) and dist/404.html.
//
//   vite-node scripts/prerender.tsx   (after vite build + generate_static.ts)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, warmup } from '../src/entry-server'
import { PRERENDER_ROUTES } from '../src/routes.generated'
import { stringify } from '../src/lib/seo/jsonld'
import { escapeAttr } from '../src/lib/seo/escape'
import { SITE } from '../src/lib/seo/site'
import { buildEnv } from './lib/env'

const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(FRONTEND, 'dist')
const DATA_DIR = resolve(FRONTEND, '.prerender-data')
const TPL_CACHE = resolve(DATA_DIR, 'template.html')

// dist/index.html is overwritten by the prerendered homepage on the first
// run — cache the pristine vite output so reruns stay deterministic.
let TEMPLATE = readFileSync(resolve(DIST, 'index.html'), 'utf8')
if (TEMPLATE.includes('<div id="app"></div>')) {
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(TPL_CACHE, TEMPLATE)
} else if (existsSync(TPL_CACHE)) {
  TEMPLATE = readFileSync(TPL_CACHE, 'utf8')
} else {
  throw new Error(
    'dist/index.html already prerendered and no cached template — run vite build first'
  )
}

if (!TEMPLATE.includes('<div id="app"></div>')) {
  throw new Error('template has no <div id="app"></div> mount point')
}

// Strip the template's default SEO tags — each page injects its own managed set.
const baseTemplate = TEMPLATE.replace(/\s*<meta\s+name="description"[^>]*>/, '').replace(
  /<title>[^<]*<\/title>/,
  '<title></title>'
)

// Cloudflare Web Analytics — production deploys only, only when the owner has
// set CF_BEACON_TOKEN in Netlify env. Never ships on previews/local.
const env = buildEnv(FRONTEND)
const isProdDeploy =
  env.TRC_INDEXABLE === '1' ||
  (env.CONTEXT === 'production' && (env.URL ?? '').includes('therealchina.net'))
const BEACON =
  isProdDeploy && env.CF_BEACON_TOKEN
    ? `\n    <!-- Cloudflare Web Analytics -->\n    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${escapeAttr(env.CF_BEACON_TOKEN)}"}'></script>`
    : ''

const inject = (
  path: string,
  html: string,
  head: { title: string; html: string },
  data: Record<string, unknown>
): string => {
  const payload = `<script>window.__PRERENDERED_DATA__ = ${stringify(data)};</script>`
  return baseTemplate
    .replace('<title></title>', `<title>${escapeAttr(head.title)}</title>`)
    .replace('</head>', `    ${head.html}${BEACON}\n  </head>`)
    .replace('<div id="app"></div>', `<div id="app">${html}</div>\n    ${payload}`)
}

const outFile = (path: string): string => {
  if (path === '/') return resolve(DIST, 'index.html')
  const clean = path.replace(/^\//, '').replace(/\/$/, '')
  return resolve(DIST, clean, 'index.html')
}

// React.lazy resolves its payload only when first rendered, so renderToString
// needs two passes: pass 1 triggers each lazy init (renders the Suspense
// fallback), the awaited tick lets the already-warmed module promises settle,
// and pass 2 renders the resolved components synchronously.
await warmup()
for (const route of PRERENDER_ROUTES) render(route.path, route.data)
render('/404', {})
await new Promise((r) => setTimeout(r, 0))

let written = 0
for (const route of PRERENDER_ROUTES) {
  const { html, head } = render(route.path, route.data)
  if (!html.trim()) throw new Error(`empty render for ${route.path}`)
  const file = outFile(route.path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, inject(route.path, html, head, route.data))
  written++
}

// SPA shell for app/private routes — served via the /* → /app.html fallback.
// noindex: the shell is never a content page.
writeFileSync(
  resolve(DIST, 'app.html'),
  baseTemplate
    .replace('<title></title>', `<title>${escapeAttr(SITE.name)}</title>`)
    .replace('</head>', `    <meta name="robots" content="noindex, follow">${BEACON}\n  </head>`)
)

// Real 404 page for the generated splat rules (served with status 404).
const nf = render('/404', {})
writeFileSync(
  resolve(DIST, '404.html'),
  inject('/404', nf.html, { ...nf.head, title: `Page not found | ${SITE.name}` }, {})
)

console.log(`prerendered ${written} routes + app.html + 404.html`)
