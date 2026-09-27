// routes.test.ts — the route-registry guardrail.
// Every route declared in App.jsx must be covered by the SEO policy: either an
// indexable pattern (content page) or an explicit noindex pattern (app/utility).
// A route missing from both fails here — new routes can't silently ship
// without an indexing decision.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPolicy, NOINDEX_FOLLOW_PATTERNS } from './lib/seo/policy'

const SRC = dirname(fileURLToPath(import.meta.url))
const appSrc = readFileSync(resolve(SRC, 'App.jsx'), 'utf8')

const declaredRoutes = [...appSrc.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1])

// Expand a route pattern to a representative concrete path for policy checks.
const concrete = (pattern: string): string =>
  pattern.replace(/:([a-zA-Z]+)/g, (_m, name) => `sample-${name}`)

describe('route registry ↔ SEO policy', () => {
  it('App.jsx declares routes', () => {
    expect(declaredRoutes.length).toBeGreaterThan(3)
  })

  it.each(declaredRoutes)('route %s is covered by policy', (pattern) => {
    if (pattern === '*') return // catch-all is fine
    const path = concrete(pattern)
    const p = getPolicy(path)
    const explicitNoindex = NOINDEX_FOLLOW_PATTERNS.some((re) => re.test(path))
    expect(
      p.index || explicitNoindex,
      `${pattern} resolves to neither an indexable nor an explicitly noindex route — add it to src/lib/seo/policy.ts`
    ).toBe(true)
  })

  it('dynamic params never make an indexable route noindex', () => {
    // /university/:slug must stay indexable — the most important route
    expect(getPolicy(concrete('/university/:slug')).index).toBe(true)
  })
})
