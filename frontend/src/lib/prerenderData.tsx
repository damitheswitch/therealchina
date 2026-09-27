import { createContext, useContext, type ReactNode } from 'react'

/**
 * Data baked into the prerendered page (window.__PRERENDERED_DATA__). On the
 * client, data hooks read this first — zero re-fetch on hydration, identical
 * markup. Inside vite-node the value is provided directly by the renderer.
 */
const PrerenderDataContext = createContext<Record<string, unknown>>({})

export const PrerenderDataProvider = ({
  data,
  children,
}: {
  data: Record<string, unknown>
  children: ReactNode
}) => <PrerenderDataContext.Provider value={data}>{children}</PrerenderDataContext.Provider>

/** Read the prerendered payload for a key, or undefined on non-prerendered pages. */
export const usePrerenderData = <T,>(key: string): T | undefined =>
  useContext(PrerenderDataContext)[key] as T | undefined

declare global {
  interface Window {
    __PRERENDERED_DATA__?: Record<string, unknown>
  }
}
