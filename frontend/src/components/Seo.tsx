import { useContext, useEffect } from 'react'
import { applyHead } from '../lib/seo/head'
import { HeadStoreContext } from '../lib/seo/collector'
import type { PageHeadInput } from '../lib/seo/meta'

/**
 * Declares a page's SEO tags. During prerendering the declaration is collected
 * via HeadStoreContext and baked into generated HTML; in the browser
 * applyHead() replaces data-seo-managed nodes on every render — route changes
 * always update the head, never duplicate.
 */
export const Seo = (props: PageHeadInput) => {
  const store = useContext(HeadStoreContext)
  if (typeof document === 'undefined') store?.inputs.push(props)
  useEffect(() => {
    applyHead(props)
  })
  return null
}
