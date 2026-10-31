import { firstPartyLogo } from './logo'
import { countUnits, looksLikeFiller, ownWordsText } from './reviewReward'

// Pure selection helpers for the homepage sections. No I/O, so they run in
// unit tests and never touch the browser during prerender.

export const HOME_REVIEW_MIN_UNITS = 20
export const HOME_REVIEW_COUNT = 4
export const HOME_QUESTION_COUNT = 3
export const HOME_FLIGHT_COUNT = 2
export const HOME_LOGO_COUNT = 8
export const CAROUSEL_INTERVAL_MS = 5000

export interface HomeReviewRow {
  id: string
  university_id: string
  rating: number
  text: string | null
  pros: string | null
  cons: string | null
  tags: string[] | null
  upvote_count: number | null
  created_at: string | null
  degree_level: string | null
  start_year: number | null
  end_year: number | null
}

export interface HomeReviewPick {
  row: HomeReviewRow
  // The student's own words, with the sentence built from tapped chips removed.
  body: string
}

const isPositive = (r: { rating: number }) => r.rating >= 4

const byVotesThenRecency = (
  a: { upvote_count: number | null; created_at: string | null },
  b: { upvote_count: number | null; created_at: string | null }
): number => {
  const dv = (b.upvote_count ?? 0) - (a.upvote_count ?? 0)
  if (dv !== 0) return dv
  const ac = a.created_at ?? ''
  const bc = b.created_at ?? ''
  if (ac === bc) return 0
  return ac < bc ? 1 : -1
}

// Picks the reviews shown under "What students say". Only reviews whose own
// words reach HOME_REVIEW_MIN_UNITS qualify, ranked by upvotes then recency,
// one per university. If the set would hold no 4 or 5 star review while one
// exists, the weakest-ranked pick makes room for it.
export const pickLandingReviews = (
  rows: HomeReviewRow[],
  max = HOME_REVIEW_COUNT
): HomeReviewPick[] => {
  const bodies = new Map<string, string>()
  const ranked = rows
    .filter((r) => {
      const body = ownWordsText(r)
      if (countUnits(body) < HOME_REVIEW_MIN_UNITS || looksLikeFiller(body)) return false
      bodies.set(r.id, body)
      return true
    })
    .sort(byVotesThenRecency)

  const seen = new Set<string>()
  const unique: HomeReviewRow[] = []
  for (const r of ranked) {
    if (seen.has(r.university_id)) continue
    seen.add(r.university_id)
    unique.push(r)
  }

  let picks = unique.slice(0, max)
  if (picks.length > 0 && !picks.some(isPositive)) {
    const positive = unique.slice(max).find(isPositive)
    if (positive) picks = [...picks.slice(0, max - 1), positive]
  }
  return picks.map((row) => ({ row, body: bodies.get(row.id) ?? '' }))
}

// Short facts under a review, e.g. ["Master's", "2019 to 2023"], rendered as
// separate items.
export const reviewContextParts = (
  r: Pick<HomeReviewRow, 'degree_level' | 'start_year' | 'end_year'>
): string[] => {
  const parts: string[] = []
  if (r.degree_level) parts.push(r.degree_level)
  if (r.start_year && r.end_year && r.end_year !== r.start_year) {
    parts.push(`${r.start_year} to ${r.end_year}`)
  } else if (r.start_year || r.end_year) {
    parts.push(String(r.start_year ?? r.end_year))
  }
  return parts
}

export interface HomeQuestionRow {
  id: string
  slug: string
  title: string
  city: string | null
  university_name: string | null
  university_slug: string | null
  answer_count: number
  upvote_count: number
  created_at: string
}

// Unanswered questions, most upvoted first, newest breaking ties.
export const pickOpenQuestions = (
  rows: HomeQuestionRow[],
  max = HOME_QUESTION_COUNT
): HomeQuestionRow[] =>
  rows
    .filter((q) => q.answer_count === 0 && q.title.trim().length > 0)
    .sort((a, b) => {
      const dv = b.upvote_count - a.upvote_count
      if (dv !== 0) return dv
      if (a.created_at === b.created_at) return 0
      return a.created_at < b.created_at ? 1 : -1
    })
    .slice(0, max)

export interface HomeLogo {
  id: string
  name: string
  slug: string
  src: string
}

// Hero logo wall: only universities whose logo is mirrored under /logos, never
// the same logo twice.
export const pickLogoStrip = (
  rows: { id: string; name: string; slug: string; logo_url: string | null }[],
  max = HOME_LOGO_COUNT
): HomeLogo[] => {
  const seen = new Set<string>()
  const out: HomeLogo[] = []
  for (const r of rows) {
    const src = firstPartyLogo(r.logo_url)
    if (!src || seen.has(src)) continue
    seen.add(src)
    out.push({ id: r.id, name: r.name, slug: r.slug, src })
    if (out.length >= max) break
  }
  return out
}

// Step through `count` slides, wrapping at both ends.
export const stepIndex = (current: number, dir: 1 | -1, count: number): number =>
  count <= 0 ? 0 : (((current + dir) % count) + count) % count

// Scroll positions the carousel can rest on. Slides past the scroll range
// collapse into one final stop at the far end, so every dot is reachable.
export const slideStops = (offsets: readonly number[], maxScroll: number): number[] => {
  if (maxScroll <= 2 || offsets.length === 0) return [0]
  return [...offsets.filter((o) => o < maxScroll - 2), maxScroll]
}

// Which slide a scrolled track is showing: the one whose left edge is nearest
// the scroll position. At the far end the last slide wins even when it cannot
// reach the left edge.
export const nearestSlide = (
  scrollLeft: number,
  maxScroll: number,
  offsets: readonly number[]
): number => {
  if (offsets.length === 0) return 0
  if (maxScroll > 0 && scrollLeft >= maxScroll - 2) return offsets.length - 1
  let best = 0
  let bestDist = Infinity
  offsets.forEach((o, i) => {
    const d = Math.abs(o - scrollLeft)
    if (d < bestDist) {
      best = i
      bestDist = d
    }
  })
  return best
}
