import { FUNDING_LABELS, type ReviewDisplayData } from './reviewDisplay'

// Aggregate profile facts derived from the review rows themselves — no extra
// fetches or schema needed. Powers the university page sidebar cards (facts,
// programs, funding) and the photo strip.

export interface ProgramStat {
  name: string
  count: number
  /** Distinct degree levels seen for this program, in first-seen order. */
  levels: string[]
}

export interface FundingStat {
  type: string
  label: string
  count: number
  /** Share of reviewers who answered the funding question. */
  pct: number
  /** Share of this type's reviewers with funding_coverage 'full'; null if none answered coverage. */
  fullPct: number | null
}

export interface MediaItem {
  url: string
  name: string
}

export interface UniversityExtras {
  topPrograms: ProgramStat[]
  /** Total distinct programs mentioned (topPrograms is capped). */
  programCount: number
  degreeLevels: { level: string; count: number }[]
  funding: FundingStat[]
  fundingAnswered: number
  /** % of funding-answered reviewers on any scholarship (non-'self'). Null when unanswered. */
  scholarshipPct: number | null
  /** Distinct instruction languages reviewers reported, most common first. */
  reportedLanguages: string[]
  /** Image media across reviews, newest-review first, capped. */
  photos: MediaItem[]
}

const MAX_PROGRAMS = 6
const MAX_PHOTOS = 8

const countBy = (values: (string | null | undefined)[]): Map<string, number> => {
  const counts = new Map<string, number>()
  for (const v of values) {
    const key = v?.trim()
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

const isVideoUrl = (url: string) => /\.(mp4|webm|mov)$/i.test(url)

// Media JSONB accepts objects ({url, type, name}) or bare URL strings.
const toMediaItem = (item: unknown): MediaItem | null => {
  if (typeof item === 'string') {
    return isVideoUrl(item) ? null : { url: item, name: '' }
  }
  if (item && typeof item === 'object') {
    const { url, type, name } = item as { url?: unknown; type?: unknown; name?: unknown }
    if (typeof url === 'string' && url && type !== 'video') {
      return { url, name: typeof name === 'string' ? name : '' }
    }
  }
  return null
}

type ReviewInput = ReviewDisplayData & { media?: unknown }

export const buildUniversityExtras = (reviews: ReviewInput[]): UniversityExtras => {
  const programCounts = countBy(reviews.map((r) => r.program))
  const levelByProgram = new Map<string, Set<string>>()
  for (const r of reviews) {
    const name = r.program?.trim()
    if (!name) continue
    if (!levelByProgram.has(name)) levelByProgram.set(name, new Set())
    if (r.degree_level) levelByProgram.get(name)!.add(r.degree_level)
  }
  const topPrograms = [...programCounts.entries()]
    .map(([name, count]) => ({
      name,
      count,
      levels: [...(levelByProgram.get(name) ?? [])],
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, MAX_PROGRAMS)

  const degreeLevels = [...countBy(reviews.map((r) => r.degree_level)).entries()]
    .map(([level, count]) => ({ level, count }))
    .sort((a, b) => b.count - a.count || a.level.localeCompare(b.level))

  const fundingCounts = countBy(reviews.map((r) => r.funding_type))
  const fundingAnswered = [...fundingCounts.values()].reduce((a, b) => a + b, 0)
  const funding = [...fundingCounts.entries()]
    .map(([type, count]) => {
      const ofType = reviews.filter((r) => r.funding_type?.trim() === type)
      const coverageAnswered = ofType.filter((r) => r.funding_coverage).length
      const fullCount = ofType.filter((r) => r.funding_coverage === 'full').length
      return {
        type,
        label: FUNDING_LABELS[type] ?? type,
        count,
        pct: fundingAnswered ? Math.round((count / fundingAnswered) * 100) : 0,
        fullPct: coverageAnswered ? Math.round((fullCount / coverageAnswered) * 100) : null,
      }
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  const scholarshipPct =
    fundingAnswered === 0
      ? null
      : Math.round(((fundingAnswered - (fundingCounts.get('self') ?? 0)) / fundingAnswered) * 100)

  const reportedLanguages = [...countBy(reviews.map((r) => r.language_of_instruction)).entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([lang]) => lang)

  const photos = reviews
    .flatMap((r) => (Array.isArray(r.media) ? r.media : []))
    .map(toMediaItem)
    .filter((m): m is MediaItem => m !== null)
    .slice(0, MAX_PHOTOS)

  return {
    topPrograms,
    programCount: programCounts.size,
    degreeLevels,
    funding,
    fundingAnswered,
    scholarshipPct,
    reportedLanguages,
    photos,
  }
}
