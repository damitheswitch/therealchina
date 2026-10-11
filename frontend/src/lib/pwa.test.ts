import { describe, it, expect } from 'vitest'
import { isProdOrigin, isProdSite, isInstalledPwa, prodUrlFor } from './pwa'
import { PROD_ORIGIN } from './seo/site'

describe('isProdOrigin', () => {
  it('accepts only the prod www origin', () => {
    expect(isProdOrigin(PROD_ORIGIN)).toBe(true)
    expect(isProdOrigin('https://www.therealchina.net')).toBe(true)
  })

  it.each([
    'https://staging.therealchina.net',
    'https://deploy-preview-57--therealchina.netlify.app',
    'https://therealchina.netlify.app',
    'https://therealchina.net', // apex 301s to www and never serves the app
    'http://localhost:5173',
    'http://127.0.0.1:4173',
  ])('rejects non-prod origin %s', (origin) => {
    expect(isProdOrigin(origin)).toBe(false)
  })
})

describe('isProdSite / isInstalledPwa (jsdom is never a prod install)', () => {
  it('isProdSite is false on the test localhost origin', () => {
    expect(isProdSite()).toBe(false)
  })

  it('isInstalledPwa is false in a normal browser context', () => {
    expect(isInstalledPwa()).toBe(false)
  })
})

describe('prodUrlFor', () => {
  it('builds a prod URL preserving path and query', () => {
    expect(prodUrlFor('/university/tsinghua-university', '?x=1')).toBe(
      'https://www.therealchina.net/university/tsinghua-university?x=1'
    )
    expect(prodUrlFor()).toBe('https://www.therealchina.net/')
  })
})
