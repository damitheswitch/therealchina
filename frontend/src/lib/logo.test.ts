import { describe, it, expect } from 'vitest'
import { firstPartyLogo } from './logo'

describe('firstPartyLogo', () => {
  it('maps png logos to local paths', () => {
    expect(firstPartyLogo('https://www.shanghairanking.cn/_uni/logo/27532357.png')).toBe(
      '/logos/27532357.png'
    )
  })

  it('maps logo-jpg variants to local paths', () => {
    expect(firstPartyLogo('https://www.shanghairanking.cn/_uni/logo-jpg/8551212700.jpg')).toBe(
      '/logos/8551212700.jpg'
    )
  })

  it('returns null for non-SR urls, empty strings and nullish input', () => {
    expect(firstPartyLogo('https://images.pexels.com/photos/123.jpeg')).toBeNull()
    expect(firstPartyLogo('https://www.shanghairanking.cn/other/123.png')).toBeNull()
    expect(firstPartyLogo('')).toBeNull()
    expect(firstPartyLogo(null)).toBeNull()
    expect(firstPartyLogo(undefined)).toBeNull()
  })
})
