// swConfig.test.ts — service-worker guardrails for prerendered pages.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = dirname(fileURLToPath(import.meta.url))
const viteCfg = readFileSync(resolve(SRC, '../../../vite.config.js'), 'utf8')

describe('workbox config (vite.config.js)', () => {
  it('never precaches html (prerendered pages must stay fresh)', () => {
    const gp = viteCfg.match(/globPatterns:\s*\[([^\]]*)\]/s)?.[1] ?? ''
    expect(/html/.test(gp)).toBe(false)
  })
  it('excludes logos/media/fonts from precache', () => {
    const gi = viteCfg.match(/globIgnores:\s*\[([^\]]*)\]/s)?.[1] ?? ''
    expect(gi).toContain('logos/')
    expect(gi).toContain('media/')
    expect(gi).toContain('noto-serif-sc')
  })
  it('has no active navigate fallback that would mask 404s', () => {
    // navigateFallback must be absent or explicitly null — a URL fallback
    // would serve the SPA shell with 200 for genuinely-missing pages.
    const m = viteCfg.match(/navigateFallback:\s*([^,\n]+)/)
    expect(!m || /null/.test(m[1])).toBe(true)
  })
})
