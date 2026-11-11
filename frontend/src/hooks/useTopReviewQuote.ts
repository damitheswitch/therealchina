import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { pickNewestQuote, pickTopQuote, type QuoteCandidate } from '../lib/reviewQuote'

export type TopQuote = QuoteCandidate & { text: string }

const COLUMNS = 'id, rating, text, upvote_count, created_at'
const CANDIDATES = 10

// One quote for the top of a university page: the most upvoted review with
// text, else the newest with text. `seeded` is the prerender payload's full
// review list (zero requests, and the quote lands in the static HTML);
// client-side navigations fetch a handful of top candidates instead.
export const useTopReviewQuote = (
  universityId: string | undefined,
  seeded: QuoteCandidate[] | null
): TopQuote | null => {
  const [fetched, setFetched] = useState<{ uid: string; quote: TopQuote | null } | null>(null)

  useEffect(() => {
    if (!universityId || seeded) return
    const controller = new AbortController()
    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select(COLUMNS)
          .eq('university_id', universityId)
          .not('text', 'is', null)
          .order('upvote_count', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(CANDIDATES)
          .abortSignal(controller.signal)
        if (error) throw error
        const rows = (data ?? []) as QuoteCandidate[]
        const quote = (pickTopQuote(rows) ?? pickNewestQuote(rows)) as TopQuote | null
        if (!controller.signal.aborted) setFetched({ uid: universityId, quote })
      } catch (err) {
        const e = err as { name?: string; message?: string }
        if (e?.name === 'AbortError' || e?.message?.startsWith('AbortError')) return
        console.error('Error fetching top review quote:', err)
      }
    }
    run()
    return () => controller.abort()
  }, [universityId, seeded])

  if (seeded) return (pickTopQuote(seeded) ?? pickNewestQuote(seeded)) as TopQuote | null
  return fetched && universityId && fetched.uid === universityId ? fetched.quote : null
}
