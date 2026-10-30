import { describe, expect, it } from 'vitest'
import { activeTab, isTabBarHidden, reviewHref } from './tabBar'

describe('MobileTabBar helpers', () => {
  it('hides on routes with their own sticky actions', () => {
    for (const p of ['/review', '/onboarding', '/community/ask', '/reset-password', '/review/']) {
      expect(isTabBarHidden(p)).toBe(true)
    }
    expect(isTabBarHidden('/')).toBe(false)
    expect(isTabBarHidden('/community')).toBe(false)
  })

  it('deep links the review button on a university page', () => {
    expect(reviewHref('/university/peking-university')).toBe('/review?uni=peking-university')
    expect(reviewHref('/university/peking-university/')).toBe('/review?uni=peking-university')
    expect(reviewHref('/universities')).toBe('/review')
    expect(reviewHref('/')).toBe('/review')
  })

  it('maps routes to the active tab', () => {
    expect(activeTab('/')).toBe('home')
    expect(activeTab('/universities')).toBe('universities')
    expect(activeTab('/university/x')).toBe('universities')
    expect(activeTab('/community/q/abc')).toBe('community')
    expect(activeTab('/profile')).toBe('me')
    expect(activeTab('/guides')).toBeNull()
  })
})
