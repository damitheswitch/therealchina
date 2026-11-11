import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { STATS_EMBED, withStats, type StatsEmbed, type UniStatFields } from '../lib/universityStats'
import { UNI_COLUMNS } from '../lib/queryColumns'
import { pickFirstReviewCandidates } from '../lib/homeFeed'
import type { Tables } from '../types/database.types'

type CandidateRow = Pick<
  Tables<'universities'>,
  'id' | 'name' | 'name_zh' | 'city' | 'province' | 'slug' | 'logo_url' | 'rankings'
>

type CandidateWithStats = CandidateRow & {
  university_stats?: StatsEmbed | StatsEmbed[] | null
}

export type FirstReviewCandidate = CandidateRow & UniStatFields

// How many top-ranked universities to scan for ones with no reviews yet. The
// top of the national ranking is where the first-review gaps matter most, and
// a bounded scan keeps this to a single cheap query.
const SCAN_SIZE = 120

// Client-only: the board is a nice-to-have below the fold, so it is fetched
// after hydration and renders nothing until it has rows.
export const useFirstReviewCandidates = () => {
  const [candidates, setCandidates] = useState<FirstReviewCandidate[]>([])

  useEffect(() => {
    const controller = new AbortController()

    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('universities')
          .select(`${UNI_COLUMNS}, ${STATS_EMBED}`)
          .order('rankings->shanghai_national', { ascending: true, nullsFirst: false })
          .order('name', { ascending: true })
          .abortSignal(controller.signal)
          .limit(SCAN_SIZE)

        if (error) throw error
        const rows = ((data as unknown as CandidateWithStats[] | null) ?? []).map(
          (u) => withStats(u) as FirstReviewCandidate
        )
        setCandidates(pickFirstReviewCandidates(rows))
      } catch (err) {
        if (controller.signal.aborted) return
        console.error('Error fetching first-review candidates:', err)
        setCandidates([])
      }
    }

    run()
    return () => controller.abort()
  }, [])

  return candidates
}
