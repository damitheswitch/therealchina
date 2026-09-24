// Server entry — used ONLY by scripts/prerender.tsx inside vite-node.
// Renders a route to HTML + collects its <Seo> declarations into head tags.
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import App from './App'
import { AppProviders } from './components/AppProviders'
import { createHeadStore, HeadStoreContext, mergeSeoInputs } from './lib/seo/collector'
import { buildPageHead, type PageHead } from './lib/seo/meta'

export interface RenderResult {
  html: string
  head: PageHead
}

// Pages are React.lazy — renderToString throws on a suspended boundary, so the
// prerender script must warm every page chunk before rendering.
const pageImporters = import.meta.glob('./pages/*.{jsx,tsx}')
export const warmup = (): Promise<unknown[]> =>
  Promise.all(Object.values(pageImporters).map((f) => f()))

export const render = (path: string, data: Record<string, unknown> = {}): RenderResult => {
  const store = createHeadStore()
  const html = renderToString(
    <StaticRouter location={path}>
      <HeadStoreContext.Provider value={store}>
        <AppProviders prerenderData={data}>
          <App />
        </AppProviders>
      </HeadStoreContext.Provider>
    </StaticRouter>
  )
  const merged = mergeSeoInputs(store.inputs)
  // A page's <Seo> may declare its canonical path (alias → canonical); the
  // route path is the fallback when it doesn't.
  if (!merged.path) merged.path = path
  const head = buildPageHead(merged)
  return { html, head }
}
