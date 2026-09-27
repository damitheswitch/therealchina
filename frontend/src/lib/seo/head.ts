// applyHead — keeps the browser <head> in sync with the route's SEO tags.
// Uses data-seo-managed="1" markers: on each call we remove previously-managed
// nodes and insert the new set, so no stale tags linger and no duplicates pile
// up. The prerendered HTML's tags carry the same marker and are replaced
// rather than duplicated.
import { buildPageHead, type PageHeadInput } from './meta'

export const MANAGED_ATTR = 'data-seo-managed'

export const applyHead = (input: PageHeadInput): void => {
  if (typeof document === 'undefined') return
  const head = buildPageHead(input)
  document.title = head.title
  document.head.querySelectorAll(`[${MANAGED_ATTR}]`).forEach((n) => n.remove())
  const tpl = document.createElement('template')
  tpl.innerHTML = head.html
  Array.from(tpl.content.children).forEach((el) => el.setAttribute(MANAGED_ATTR, '1'))
  document.head.appendChild(tpl.content)
}
