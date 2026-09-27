// Shared university-stats → display-fields mapping. Used by every hook and
// the prerender pipeline so cards/pages can never disagree about what a
// stat row means (missing stats row = 0 reviews, not an error).
import { getRecommendYesPct } from './reviewSummary'

export const STATS_EMBED =
  'university_stats(avg_rating, review_count, has_verified_review, recommend_yes_count, recommend_maybe_count, recommend_no_count)'

export interface StatsEmbed {
  avg_rating: number | null
  review_count: number | null
  has_verified_review: boolean | null
  recommend_yes_count: number | null
  recommend_maybe_count: number | null
  recommend_no_count: number | null
}

export interface UniStatFields {
  avg_rating: number
  review_count: number
  is_verified: boolean
  recommendYesPct: number | null
  recommendAnswered: number
}

export const withStats = <T extends { university_stats?: StatsEmbed | StatsEmbed[] | null }>(
  u: T
): Omit<T, 'university_stats'> & UniStatFields => {
  const rawStat = u.university_stats
  const stat = Array.isArray(rawStat) ? rawStat[0] : rawStat
  const recYes = stat?.recommend_yes_count ?? 0
  const recMaybe = stat?.recommend_maybe_count ?? 0
  const recNo = stat?.recommend_no_count ?? 0
  const { university_stats: _s, ...rest } = u
  return {
    ...rest,
    avg_rating: stat?.avg_rating ?? 0,
    review_count: stat?.review_count ?? 0,
    is_verified: stat?.has_verified_review ?? false,
    recommendYesPct: getRecommendYesPct(recYes, recMaybe, recNo),
    recommendAnswered: recYes + recMaybe + recNo,
  }
}
