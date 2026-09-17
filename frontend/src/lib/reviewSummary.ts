import { SUBSCORE_FIELDS, type ReviewDisplayData, type SubScoreKey } from './reviewDisplay'

export interface ReviewSummary {
  reviewCount: number
  avgRating: number
  /** Ordered 5 → 1. */
  ratingDist: { stars: number; count: number }[]
  recommend: {
    /** Raw counts per answer. */
    yes: number
    maybe: number
    no: number
    /** Reviews with a non-null recommend answer. */
    answered: number
    /** Math.round'ed share of `answered`; all 0 when unanswered. */
    yesPct: number
    maybePct: number
    noPct: number
  }
  subscores: { key: SubScoreKey; label: string; avg: number; count: number }[]
  /** Top 8 tags by count. */
  topTags: { tag: string; count: number }[]
  /** Raw status strings, count desc — labels are resolved at render. */
  enrollment: { status: string; count: number }[]
  modalLivingCost: string | null
  modalTuition: string | null
}

type ReviewInput = ReviewDisplayData & { rating: number }

// Shared by the listing card pill: yes / (yes + maybe + no), rounded.
// Returns null when nobody answered so callers can hide the badge entirely.
export const getRecommendYesPct = (yes: number, maybe: number, no: number): number | null => {
  const answered = yes + maybe + no
  return answered === 0 ? null : Math.round((yes / answered) * 100)
}

const countBy = (values: (string | null | undefined)[]): Map<string, number> => {
  const counts = new Map<string, number>()
  for (const v of values) {
    if (!v) continue
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return counts
}

// Most frequent non-null value; ties resolve alphabetically so the output
// is deterministic regardless of row order.
const modalValue = (values: (string | null | undefined)[]): string | null => {
  const counts = countBy(values)
  let best: string | null = null
  for (const [value, count] of counts) {
    const bestCount = best === null ? -1 : (counts.get(best) ?? 0)
    if (count > bestCount || (count === bestCount && value < (best as string))) best = value
  }
  return best
}

export const buildReviewSummary = (reviews: ReviewInput[]): ReviewSummary => {
  const reviewCount = reviews.length
  const avgRating = reviewCount ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : 0

  const dist = new Map<number, number>()
  for (const r of reviews) {
    if (r.rating >= 1 && r.rating <= 5) dist.set(r.rating, (dist.get(r.rating) ?? 0) + 1)
  }
  const ratingDist = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: dist.get(stars) ?? 0 }))

  let yes = 0
  let maybe = 0
  let no = 0
  for (const r of reviews) {
    if (r.recommend === 'yes') yes++
    else if (r.recommend === 'maybe') maybe++
    else if (r.recommend === 'no') no++
  }
  const answered = yes + maybe + no
  const pct = (n: number) => (answered ? Math.round((n / answered) * 100) : 0)

  const subscores = SUBSCORE_FIELDS.map(({ key, label }) => {
    let sum = 0
    let count = 0
    for (const r of reviews) {
      const v = r[key]
      if (typeof v === 'number') {
        sum += v
        count++
      }
    }
    return { key, label, avg: count ? sum / count : 0, count }
  }).filter((s) => s.count > 0)

  const tagCounts = countBy(reviews.flatMap((r) => (r.tags ?? []).filter(Boolean)))
  const topTags = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, 8)

  const enrollment = [...countBy(reviews.map((r) => r.enrollment_status)).entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status))

  return {
    reviewCount,
    avgRating,
    ratingDist,
    recommend: {
      yes,
      maybe,
      no,
      answered,
      yesPct: pct(yes),
      maybePct: pct(maybe),
      noPct: pct(no),
    },
    subscores,
    topTags,
    enrollment,
    modalLivingCost: modalValue(reviews.map((r) => r.living_cost_range)),
    modalTuition: modalValue(reviews.map((r) => r.tuition_range)),
  }
}
