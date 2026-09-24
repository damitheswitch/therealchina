import { createContext } from 'react'
import type { PageHeadInput } from './meta'

/**
 * Per-render store collecting <Seo> declarations during renderToString.
 * Scoped to one render call via context — no module-level mutable state.
 * A page may render several <Seo> nodes; inputs merge at read time
 * (later wins, jsonLd arrays concatenate).
 */
export interface HeadStore {
  inputs: PageHeadInput[]
}

export const HeadStoreContext = createContext<HeadStore | null>(null)

export const createHeadStore = (): HeadStore => ({ inputs: [] })

export const mergeSeoInputs = (inputs: PageHeadInput[]): PageHeadInput =>
  inputs.reduce<PageHeadInput>(
    (acc, i) => ({ ...acc, ...i, jsonLd: [...(acc.jsonLd ?? []), ...(i.jsonLd ?? [])] }),
    { path: '' }
  )
