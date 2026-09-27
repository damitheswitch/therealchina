// Regression guardrails as tests — the checks that catch SEO damage before
// a human notices.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(SRC, '../..')

const walk = (dir: string, out: string[] = []): string[] => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = resolve(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

describe('no document.title outside the Seo system', () => {
  it('pages and components never set document.title directly', () => {
    const offenders = walk(resolve(SRC, 'pages'))
      .concat(walk(resolve(SRC, 'components')))
      .filter((f) => /\.(jsx?|tsx?)$/.test(f))
      .filter((f) => /document\.title\s*=/.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })
})

describe('no fabricated data in migrations', () => {
  it('migrations never insert rows into reviews/comments', () => {
    // reviews/comments carry user content and have no legitimate schema-level
    // inserts — trigger functions only ever write profiles/upvotes/stats.
    // Any match = demo data smuggled into a migration → reaches prod.
    const dir = resolve(ROOT, 'supabase/migrations')
    const bad: string[] = []
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql'))) {
      const sql = readFileSync(resolve(dir, f), 'utf8')
      if (/insert\s+into\s+(public\.)?(reviews|comments)\b/i.test(sql)) {
        bad.push(f)
      }
    }
    expect(bad).toEqual([])
  })
})

describe('single canonical host', () => {
  it('PROD_ORIGIN is the www host (apex 301s to it)', () => {
    const site = readFileSync(resolve(SRC, 'lib/seo/site.ts'), 'utf8')
    expect(site).toContain("PROD_ORIGIN = 'https://www.therealchina.net'")
  })
})
