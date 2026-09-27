import { describe, it, expect } from 'vitest'
import { getPolicy, INDEXABLE_PATTERNS, robotsFor } from './policy'
import { buildPageHead } from './meta'
import { siteUrl, SITE, PROD_ORIGIN } from './site'
import { slugify } from './slugify'
import { escapeAttr, escapeJsonLd } from './escape'

describe('policy: indexability', () => {
  it('indexes content routes', () => {
    for (const p of [
      '/',
      '/universities',
      '/university/tsinghua-university',
      '/city/beijing',
      '/program/medicine',
      '/degree/masters',
      '/reviews',
      '/about',
      '/editorial-policy',
      '/guides',
      '/guide/visa-application',
    ]) {
      expect(getPolicy(p).index, p).toBe(true)
    }
  })
  it('noindexes app/utility routes', () => {
    for (const p of [
      '/review',
      '/profile',
      '/profile/abc',
      '/users',
      '/flights',
      '/onboarding',
      '/settings',
      '/reset-password',
    ]) {
      expect(getPolicy(p).index, p).toBe(false)
    }
  })
  it('defaults unknown routes to noindex (safe-by-default)', () => {
    for (const p of ['/nope', '/university/', '/university', '/city', '/random-path/x', '/admin']) {
      expect(getPolicy(p).index, p).toBe(false)
    }
  })
  it('university pattern requires exactly one slug segment', () => {
    expect(getPolicy('/university/a').index).toBe(true)
    expect(getPolicy('/university/a/b').index).toBe(false)
  })
  it('robots strings', () => {
    expect(robotsFor({ index: true, follow: true })).toBe('index, follow')
    expect(robotsFor({ index: false, follow: true })).toBe('noindex, follow')
    expect(robotsFor({ index: false, follow: false })).toBe('noindex, nofollow')
  })
})

describe('meta: buildPageHead', () => {
  it('falls back to the site name + default description', () => {
    const h = buildPageHead({ path: '/' })
    expect(h.title).toBe(SITE.name)
    expect(h.canonical).toBe(`${PROD_ORIGIN}/`)
    expect(h.html).toContain(SITE.defaultDescription.slice(0, 40))
    expect(h.html).toContain('content="index, follow"')
  })
  it('appends site name to titles and clamps long titles', () => {
    expect(buildPageHead({ path: '/x', title: 'Hello' }).title).toBe(`Hello | ${SITE.name}`)
    const long = 'x'.repeat(80)
    expect(buildPageHead({ path: '/x', title: long }).title.length).toBeLessThanOrEqual(60)
  })
  it('respects explicit index/follow overrides', () => {
    const h = buildPageHead({ path: '/p', index: false })
    expect(h.canonical).toBe(`${PROD_ORIGIN}/p/`)
    expect(h.robots).toBe('noindex, follow')
    expect(h.html).toContain('noindex')
  })
  it('emits og + twitter + jsonld tags with absolute image', () => {
    const h = buildPageHead({
      path: '/u',
      title: 'T',
      image: '/og/default.png',
      jsonLd: ['{"@type":"Thing"}'],
    })
    expect(h.html).toContain('og:title')
    expect(h.html).toContain('twitter:card')
    expect(h.html).toContain('application/ld+json')
    expect(h.html).toContain(`${PROD_ORIGIN}/og/default.png`)
  })
  it('clamps long descriptions', () => {
    const h = buildPageHead({ path: '/x', description: 'y'.repeat(200) })
    expect(h.description.length).toBeLessThanOrEqual(160)
  })
})

describe('slugify', () => {
  it('normalizes to lowercase hyphen slugs', () => {
    expect(slugify('Beijing University of Technology')).toBe('beijing-university-of-technology')
    expect(slugify('  Shanghai  Jiao Tong ')).toBe('shanghai-jiao-tong')
    expect(slugify('Nanjing (NJU)')).toBe('nanjing-nju')
  })
  it('collapses anything non-ascii to hyphens (pinyin names only)', () => {
    expect(slugify('École Test')).toBe('cole-test')
    expect(slugify('信息工程大学')).toBe('')
  })
})

describe('escape', () => {
  it('escapes attribute/html special chars', () => {
    expect(escapeAttr(`<b>"'&`)).toBe('&lt;b&gt;&quot;&#39;&amp;')
  })
  it('escapeJsonLd breaks out of script tags but stays valid JSON', () => {
    const s = escapeJsonLd({ x: '</script><script>alert(1)</script>' })
    expect(s).not.toContain('</script>')
    expect(JSON.parse(s)).toEqual({ x: '</script><script>alert(1)</script>' })
  })
})

describe('siteUrl', () => {
  it('builds absolute prod URLs', () => {
    expect(siteUrl('/')).toBe(`${PROD_ORIGIN}/`)
    expect(siteUrl('university/x')).toBe(`${PROD_ORIGIN}/university/x/`)
    expect(siteUrl('/x', 'https://preview.netlify.app')).toBe('https://preview.netlify.app/x/')
  })
})

describe('registry sanity', () => {
  it('covers all hub prefixes', () => {
    const src = INDEXABLE_PATTERNS.map((r) => r.source).join('|')
    for (const p of [
      'university',
      'city',
      'program',
      'degree',
      'guide',
      'authors',
      'universities',
      'reviews',
    ]) {
      expect(src).toContain(p)
    }
  })
})
