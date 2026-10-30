import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { pickNewestQuote, type QuoteCandidate } from '../lib/reviewQuote'

export interface HeroReview {
  id: string
  rating: number
  text: string
  universityName: string
  universitySlug: string
}

const CANDIDATES = 20

// One recent written review for the home hero. Two small queries (reviews,
// then that review's university), no per-row fetching. Null until loaded or
// when nothing qualifies, so the hero simply renders without a quote.
export const useHeroReview = (): HeroReview | null => {
  const [review, setReview] = useState<HeroReview | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select('id, university_id, rating, text, upvote_count, created_at')
          .not('text', 'is', null)
          .order('created_at', { ascending: false })
          .limit(CANDIDATES)
          .abortSignal(controller.signal)
        if (error) throw error
        const rows = (data ?? []) as (QuoteCandidate & { university_id: string })[]
        const pick = pickNewestQuote(rows)
        if (!pick) return
        const { data: uni, error: uniError } = await supabase
          .from('universities')
          .select('name, slug')
          .eq('id', pick.university_id)
          .abortSignal(controller.signal)
          .maybeSingle()
        if (uniError) throw uniError
        if (controller.signal.aborted || !uni) return
        setReview({
          id: pick.id,
          rating: pick.rating,
          text: pick.text ?? '',
          universityName: uni.name,
          universitySlug: uni.slug,
        })
      } catch (err) {
        const e = err as { name?: string; message?: string }
        if (e?.name === 'AbortError' || e?.message?.startsWith('AbortError')) return
        console.error('Error fetching hero review:', err)
      }
    }
    run()
    return () => controller.abort()
  }, [])

  return review
}
