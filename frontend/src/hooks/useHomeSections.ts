import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  HOME_FLIGHT_COUNT,
  HOME_LOGO_COUNT,
  HOME_QUESTION_COUNT,
  pickLandingReviews,
  pickLogoStrip,
  type HomeLogo,
  pickOpenQuestions,
  type HomeQuestionRow,
  type HomeReviewPick,
} from '../lib/homeSections'
import { PUBLIC_FLIGHT_COLUMNS, todayLocal, type PublicFlightRow } from '../lib/flightListings'

// Live homepage sections. Everything loads in the browser after mount, so the
// prerendered HTML never contains these blocks and hydration always matches.
// List hooks return null while loading and an array once settled: an empty
// array means "nothing to show" (or the request failed), so the section can
// render a short empty state instead of vanishing.

// Shared fallback so the effect dependency never changes between renders.
const NO_ITEMS: never[] = []

const isAbort = (err: unknown): boolean => {
  const e = err as { name?: string; message?: string }
  return e?.name === 'AbortError' || !!e?.message?.startsWith('AbortError')
}

// Runs `load` once with an abort signal; failures leave the section hidden.
const useLiveSection = <T>(
  label: string,
  load: (signal: AbortSignal) => Promise<T | null>,
  onFail: T | null = null
) => {
  const [value, setValue] = useState<T | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    const run = async () => {
      try {
        const next = await load(controller.signal)
        if (!controller.signal.aborted) setValue(next)
      } catch (err) {
        if (controller.signal.aborted || isAbort(err)) return
        console.error(`Error fetching ${label}:`, err)
        setValue(onFail)
      }
    }
    run()
    return () => controller.abort()
    // `load` and `onFail` are module-level constants, so they never change.
  }, [label, load, onFail])
  return value
}

export interface HomeStats {
  universities: number
  reviews: number
}

const loadStats = async (signal: AbortSignal): Promise<HomeStats | null> => {
  const [uniRes, reviewRes] = await Promise.all([
    supabase.from('universities').select('id', { count: 'exact', head: true }).abortSignal(signal),
    supabase.from('reviews').select('id', { count: 'exact', head: true }).abortSignal(signal),
  ])
  if (uniRes.error) throw uniRes.error
  if (reviewRes.error) throw reviewRes.error
  return { universities: uniRes.count ?? 0, reviews: reviewRes.count ?? 0 }
}

// Public reviews are already filtered to non-deleted rows by row-level security.
export const useHomeStats = (): HomeStats | null => useLiveSection('home stats', loadStats)

// Real campus logos for the hero, mirrored under /logos.
const LOGO_CANDIDATES = 40

const loadLogos = async (signal: AbortSignal): Promise<HomeLogo[] | null> => {
  const { data, error } = await supabase
    .from('universities')
    .select('id, name, slug, logo_url')
    .not('logo_url', 'is', null)
    .order('name', { ascending: true })
    .limit(LOGO_CANDIDATES)
    .abortSignal(signal)
  if (error) throw error
  return pickLogoStrip(data ?? [], HOME_LOGO_COUNT)
}

export const useHomeLogos = (): HomeLogo[] | null =>
  useLiveSection('home logos', loadLogos, NO_ITEMS)

export interface LandingReview extends HomeReviewPick {
  universityName: string
  universitySlug: string
  universityLogoUrl: string | null
}

const REVIEW_CANDIDATES = 40

const loadReviews = async (signal: AbortSignal): Promise<LandingReview[] | null> => {
  const { data, error } = await supabase
    .from('reviews')
    .select(
      'id, university_id, rating, text, pros, cons, tags, upvote_count, created_at, degree_level, start_year, end_year'
    )
    .not('text', 'is', null)
    .order('created_at', { ascending: false })
    .limit(REVIEW_CANDIDATES)
    .abortSignal(signal)
  if (error) throw error
  const picks = pickLandingReviews(data ?? [])
  if (picks.length === 0) return []
  const ids = [...new Set(picks.map((p) => p.row.university_id))]
  const { data: unis, error: uniError } = await supabase
    .from('universities')
    .select('id, name, slug, logo_url')
    .in('id', ids)
    .abortSignal(signal)
  if (uniError) throw uniError
  const byId = new Map((unis ?? []).map((u) => [u.id, u]))
  const out: LandingReview[] = []
  for (const p of picks) {
    const uni = byId.get(p.row.university_id)
    if (uni) {
      out.push({
        ...p,
        universityName: uni.name,
        universitySlug: uni.slug,
        universityLogoUrl: uni.logo_url,
      })
    }
  }
  return out
}

export const useLandingReviews = (): LandingReview[] | null =>
  useLiveSection('landing reviews', loadReviews, NO_ITEMS)

const QUESTION_CANDIDATES = 30

const loadQuestions = async (signal: AbortSignal): Promise<HomeQuestionRow[] | null> => {
  const { data, error } = await supabase
    .from('qa_questions_public')
    .select(
      'id, slug, title, city, university_name, university_slug, answer_count, upvote_count, created_at'
    )
    .eq('answer_count', 0)
    .order('upvote_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(QUESTION_CANDIDATES)
    .abortSignal(signal)
  if (error) throw error
  const picks = pickOpenQuestions((data ?? []) as HomeQuestionRow[], HOME_QUESTION_COUNT)
  return picks
}

export const useOpenQuestions = (): HomeQuestionRow[] | null =>
  useLiveSection('open questions', loadQuestions, NO_ITEMS)

const loadFlights = async (signal: AbortSignal): Promise<PublicFlightRow[] | null> => {
  const { data, error } = await supabase
    .from('flight_listings_public')
    .select(PUBLIC_FLIGHT_COLUMNS)
    .gte('departure_date', todayLocal())
    .order('departure_date', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(HOME_FLIGHT_COUNT)
    .abortSignal(signal)
  if (error) throw error
  const rows = (data ?? []) as PublicFlightRow[]
  return rows
}

export const useUpcomingFlights = (): PublicFlightRow[] | null =>
  useLiveSection('upcoming flights', loadFlights, NO_ITEMS)
