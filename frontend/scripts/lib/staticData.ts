// Shared data access for the static pipeline — loads .prerender-data/*.json
// (written by export_prerender_data.ts) and shapes route payloads that match
// what the data hooks expect on hydration.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getRecommendYesPct } from '../../src/lib/reviewSummary'
import { indexableByReviews } from '../../src/lib/seo/indexable'
import { slugify } from '../../src/lib/seo/slugify'

export interface UniRow {
  id: string
  name: string
  name_zh: string | null
  city: string | null
  country: string | null
  province: string | null
  uni_category: string | null
  slug: string
  slug_aliases: string[] | null
  logo_url: string | null
  is_verified: boolean | null
  uni_type: string | null
  languages_of_instruction: string[] | null
  website: string | null
  rankings: Record<string, unknown> | null
  created_at: string | null
}
export interface StatsRow {
  university_id: string
  avg_rating: number | null
  review_count: number | null
  has_verified_review: boolean | null
  recommend_yes_count: number | null
  recommend_maybe_count: number | null
  recommend_no_count: number | null
}
export interface ReviewRow {
  id: string
  university_id: string
  user_id: string | null
  rating: number
  text: string | null
  program: string | null
  degree_level: string | null
  created_at: string
  [k: string]: unknown
}
export interface AuthorRow {
  id: string
  display_name: string | null
  avatar_url: string | null
}

const load = <T>(dir: string, name: string): T => {
  const p = resolve(dir, `${name}.json`)
  if (!existsSync(p)) {
    throw new Error(`${p} missing — run npm run export:data first`)
  }
  return JSON.parse(readFileSync(p, 'utf8')) as T
}

export interface UpvoteRow {
  review_id: string
}

export const loadData = (dataDir: string) => {
  const universities = load<UniRow[]>(dataDir, 'universities')
  const stats = load<StatsRow[]>(dataDir, 'stats')
  const reviews = load<ReviewRow[]>(dataDir, 'reviews')
  const authors = load<AuthorRow[]>(dataDir, 'authors')
  const upvotes = existsSync(resolve(dataDir, 'upvotes.json'))
    ? load<UpvoteRow[]>(dataDir, 'upvotes')
    : []
  return { universities, stats, reviews, authors, upvotes }
}

/** review_id → public count. Voter identity is never exported. */
export const upvoteCounts = (upvotes: UpvoteRow[]): Record<string, number> => {
  const counts: Record<string, number> = {}
  for (const u of upvotes) counts[u.review_id] = (counts[u.review_id] ?? 0) + 1
  return counts
}

// ── Indexability ────────────────────────────────────────────────────────────
// A university page earns indexing when it has at least one substantive review.
// Everything else is reachable via the SPA (noindex) but kept out of the index
// — keeps the site from launching as 500+ thin pages.
export const indexableUniversities = (unis: UniRow[], reviews: ReviewRow[]): UniRow[] => {
  const byUni = new Map<string, ReviewRow[]>()
  for (const r of reviews) {
    if (!byUni.has(r.university_id)) byUni.set(r.university_id, [])
    byUni.get(r.university_id)!.push(r)
  }
  return unis.filter((u) => indexableByReviews(byUni.get(u.id)))
}

// ── Payload builders (must mirror the app hooks) ────────────────────────────
type UniDisplay = UniRow & {
  avg_rating: number
  review_count: number
  is_verified: boolean
  recommendYesPct: number | null
  recommendAnswered: number
}

export const toDisplay = (u: UniRow, stat: StatsRow | undefined): UniDisplay => {
  const recYes = stat?.recommend_yes_count ?? 0
  const recMaybe = stat?.recommend_maybe_count ?? 0
  const recNo = stat?.recommend_no_count ?? 0
  return {
    ...u,
    avg_rating: stat?.avg_rating ?? 0,
    review_count: stat?.review_count ?? 0,
    is_verified: stat?.has_verified_review ?? false,
    recommendYesPct: getRecommendYesPct(recYes, recMaybe, recNo),
    recommendAnswered: recYes + recMaybe + recNo,
  }
}

const PAGE_SIZE = 20

export const universitiesPageData = (
  unis: UniRow[],
  stats: StatsRow[]
): { rows: UniDisplay[]; totalCount: number; pageCount: number } => {
  const statById = new Map(stats.map((s) => [s.university_id, s]))
  // Mirrors useUniversities sort=reviews: university_stats(review_count) desc
  const sorted = unis
    .map((u) => toDisplay(u, statById.get(u.id)))
    .sort((a, b) => b.review_count - a.review_count || a.name.localeCompare(b.name))
  const totalCount = sorted.length
  return {
    rows: sorted.slice(0, PAGE_SIZE),
    totalCount,
    pageCount: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
  }
}

export const citiesData = (unis: UniRow[]) => {
  const byProv = new Map<string | null, Set<string>>()
  for (const u of unis) {
    const city = u.city ?? ''
    const prov = u.province && u.province !== city ? u.province : null
    if (!byProv.has(prov)) byProv.set(prov, new Set())
    byProv.get(prov)!.add(city)
  }
  const groups = [...byProv.entries()]
    .map(([province, set]) => ({ province, cities: [...set].sort() }))
    .sort((a, b) => (a.province ?? '').localeCompare(b.province ?? ''))
  return {
    cities: [...new Set(unis.map((u) => u.city ?? '').filter(Boolean))].sort(),
    groups,
  }
}

export const universityPageData = (
  uni: UniRow,
  reviews: ReviewRow[],
  stats: StatsRow[],
  authors: AuthorRow[]
) => {
  const rows = reviews
    .filter((r) => r.university_id === uni.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const authorIds = new Set(rows.map((r) => r.user_id).filter(Boolean))
  const authorMap = Object.fromEntries(
    authors.filter((a) => authorIds.has(a.id)).map((a) => [a.id, a])
  )
  const stat = stats.find((s) => s.university_id === uni.id) ?? null
  return { university: uni, reviews: rows, authors: authorMap, stats: stat }
}

// ── Hub/index payload builders ──────────────────────────────────────────────
import { normalizeProgram, PROGRAM_HUBS, type HubDef } from '../../src/lib/seo/programs'
import { normalizeDegree, DEGREE_HUBS } from '../../src/lib/seo/degrees'
import { indexableByReviews } from '../../src/lib/seo/indexable'

const REVIEW_PAGE_SIZE = 50

export const reviewsPageData = (
  reviews: ReviewRow[],
  unis: UniRow[],
  authors: AuthorRow[],
  upvotes: UpvoteRow[]
) => {
  const rows = [...reviews]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, REVIEW_PAGE_SIZE)
  const uniIds = new Set(rows.map((r) => r.university_id))
  const authorIds = new Set(rows.map((r) => r.user_id).filter(Boolean))
  const rowIds = new Set(rows.map((r) => r.id))
  const counts = upvoteCounts(upvotes.filter((u) => rowIds.has(u.review_id)))
  return {
    reviews: rows,
    universities: Object.fromEntries(
      unis
        .filter((u) => uniIds.has(u.id))
        .map((u) => [u.id, { id: u.id, name: u.name, slug: u.slug }])
    ),
    authors: Object.fromEntries(authors.filter((a) => authorIds.has(a.id)).map((a) => [a.id, a])),
    upvoteCounts: counts,
  }
}

export interface CityEntry {
  city: string
  slug: string
  universities: UniDisplay[]
  reviewCount: number
  indexable: boolean
}

export const allCities = (unis: UniRow[], reviews: ReviewRow[], stats: StatsRow[]): CityEntry[] => {
  const reviewCountByUni = new Map<string, number>()
  for (const r of reviews)
    reviewCountByUni.set(r.university_id, (reviewCountByUni.get(r.university_id) ?? 0) + 1)
  const statById = new Map(stats.map((s) => [s.university_id, s]))
  const byCity = new Map<string, UniRow[]>()
  for (const u of unis) {
    const c = u.city ?? ''
    if (!c) continue
    if (!byCity.has(c)) byCity.set(c, [])
    byCity.get(c)!.push(u)
  }
  return [...byCity.entries()].map(([city, list]) => {
    const reviewCount = list.reduce((n, u) => n + (reviewCountByUni.get(u.id) ?? 0), 0)
    return {
      city,
      slug: slugify(city),
      // Cards need stats — a raw UniRow renders "No reviews yet" on reviewed unis.
      universities: list
        .map((u) => toDisplay(u, statById.get(u.id)))
        .sort((a, b) => a.name.localeCompare(b.name)),
      reviewCount,
      // Same rule the page applies — ≥3 unis or ≥3 reviews earns indexing.
      indexable: list.length >= 3 || reviewCount >= 3,
    }
  })
}

export interface HubEntry {
  kind: 'program' | 'degree'
  hub: HubDef
  universities: UniDisplay[]
  reviews: ReviewRow[]
  indexable: boolean
}

export const allHubs = (unis: UniRow[], reviews: ReviewRow[], stats: StatsRow[]): HubEntry[] => {
  const statById = new Map(stats.map((s) => [s.university_id, s]))
  const build = (
    kind: 'program' | 'degree',
    hubs: HubDef[],
    norm: (r: ReviewRow) => string | null
  ) =>
    hubs.map((hub): HubEntry => {
      const rows = reviews.filter((r) => norm(r) === hub.slug)
      const uniIds = new Set(rows.map((r) => r.university_id))
      return {
        kind,
        hub,
        universities: unis
          .filter((u) => uniIds.has(u.id))
          .map((u) => toDisplay(u, statById.get(u.id)))
          .sort((a, b) => a.name.localeCompare(b.name)),
        reviews: rows,
        indexable: indexableByReviews(rows),
      }
    })
  return [
    ...build('program', PROGRAM_HUBS, (r) => normalizeProgram(r.program)),
    ...build('degree', DEGREE_HUBS, (r) => normalizeDegree(r.degree_level)),
  ]
}

export const hubPageData = (entry: HubEntry, authors: AuthorRow[], upvotes: UpvoteRow[]) => {
  const authorIds = new Set(entry.reviews.map((r) => r.user_id).filter(Boolean))
  const rowIds = new Set(entry.reviews.map((r) => r.id))
  return {
    kind: entry.kind,
    hub: entry.hub,
    universities: entry.universities,
    reviews: entry.reviews,
    authors: Object.fromEntries(authors.filter((a) => authorIds.has(a.id)).map((a) => [a.id, a])),
    upvoteCounts: upvoteCounts(upvotes.filter((u) => rowIds.has(u.review_id))),
  }
}

// ── URL sets ────────────────────────────────────────────────────────────────
// alias → canonical 301 map. Aliases that collide with any canonical slug are
// dropped (and reported) — a canonical always wins over an alias.
export const aliasRedirects = (unis: UniRow[]): { from: string; to: string }[] => {
  const canonical = new Set(unis.map((u) => u.slug))
  const out: { from: string; to: string }[] = []
  const seen = new Set<string>()
  for (const u of unis) {
    for (const a of u.slug_aliases ?? []) {
      if (!a || a === u.slug || canonical.has(a) || seen.has(a)) {
        if (canonical.has(a) && a !== u.slug) {
          console.warn(`alias ${a} collides with a canonical slug — skipped (uni ${u.slug})`)
        }
        continue
      }
      seen.add(a)
      out.push({ from: `/university/${a}`, to: `/university/${u.slug}` })
    }
  }
  return out
}

export { slugify }
