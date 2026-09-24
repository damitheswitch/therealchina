import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { UserLink } from './UserLink'

describe('UserLink', () => {
  it('always renders ugc + nofollow + noopener + noreferrer on user URLs', () => {
    const html = renderToStaticMarkup(<UserLink href="https://example.com">site</UserLink>)
    expect(html).toContain('rel="ugc nofollow noopener noreferrer"')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
  })
})
