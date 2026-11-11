import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Tables } from '../types/database.types'
import {
  guestListingFromRow,
  PUBLIC_FLIGHT_COLUMNS,
  todayLocal,
  type PublicFlightRow,
} from '../lib/flightListings'

const FLIGHT_LISTINGS_LIMIT = 200

type FlightListing = Tables<'flight_listings_with_profile'>

const FLIGHT_LISTING_COLUMNS =
  'id, user_id, departure_country, arrival_country, departure_city, arrival_city, departure_date, arrival_date, available_kgs, price_per_kg, currency, notes, is_active, created_at, updated_at, display_name, avatar_url, social_handles, show_social_handle, contact_platforms'

async function fetchOwnListings(userId: string | null): Promise<FlightListing[]> {
  if (!userId) return []
  const rows: FlightListing[] = []
  let after: string | null = null
  for (;;) {
    let query = supabase
      .from('flight_listings_with_profile')
      .select(FLIGHT_LISTING_COLUMNS)
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .limit(FLIGHT_LISTINGS_LIMIT)
    if (after) query = query.gt('id', after)
    const { data, error } = await query
    if (error) throw error
    if (!data?.length) return rows
    rows.push(...data)
    after = data[data.length - 1].id
  }
}

export const useFlightListings = ({
  enabled = true,
  userId = null,
}: { enabled?: boolean; userId?: string | null } = {}) => {
  const [listings, setListings] = useState<FlightListing[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const mounted = useRef<boolean>(true)
  // Latest request wins: a slow guest fetch must not overwrite the member
  // fetch that replaced it when the session resolves.
  const requestSeq = useRef<number>(0)

  // Plain effect — useLayoutEffect warns under renderToString and this only
  // syncs loading state, never measures layout.
  useEffect(() => {
    if (enabled) {
      setLoading(true)
    } else {
      requestSeq.current++
      setLoading(false)
      setListings([])
      setError(null)
    }
  }, [enabled])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const fetchListings = useCallback(async () => {
    if (!enabled) return
    const seq = ++requestSeq.current
    const isCurrent = () => mounted.current && seq === requestSeq.current
    setLoading(true)
    setError(null)
    try {
      // Split upcoming, past and the viewer's own trips into separate queries
      // so each section gets its own row budget: past or closed history can
      // never crowd out upcoming trips on the main board, the Past Flights tab
      // still shows departed active trips from everyone, and My Flights always
      // includes all of the owner's listings.
      const today = todayLocal()
      const merged: FlightListing[] = []
      const seen = new Set<string>()
      const addRows = (rows: FlightListing[] | null) => {
        for (const row of rows || []) {
          if (row.id && !seen.has(row.id)) {
            seen.add(row.id)
            merged.push(row)
          }
        }
      }

      if (!userId) {
        // Guests read the public view: route, dates, space, price and a
        // coarse poster label only. No owner id, notes or contact data.
        const guestBoard = (past: boolean) => {
          const base = supabase.from('flight_listings_public').select(PUBLIC_FLIGHT_COLUMNS)
          return (past ? base.lt('departure_date', today) : base.gte('departure_date', today))
            .order('departure_date', { ascending: !past })
            .order('created_at', { ascending: false })
            .limit(FLIGHT_LISTINGS_LIMIT)
        }
        const [upcomingRes, pastRes] = await Promise.all([guestBoard(false), guestBoard(true)])
        if (upcomingRes.error) throw upcomingRes.error
        if (pastRes.error) throw pastRes.error
        for (const group of [upcomingRes.data, pastRes.data]) {
          addRows(((group as PublicFlightRow[] | null) || []).map(guestListingFromRow))
        }
      } else {
        const [upcomingRes, pastRes, ownRows] = await Promise.all([
          supabase
            .from('flight_listings_with_profile')
            .select(FLIGHT_LISTING_COLUMNS)
            .eq('is_active', true)
            .gte('departure_date', today)
            .order('departure_date', { ascending: true })
            .order('created_at', { ascending: false })
            .limit(FLIGHT_LISTINGS_LIMIT),
          supabase
            .from('flight_listings_with_profile')
            .select(FLIGHT_LISTING_COLUMNS)
            .eq('is_active', true)
            .lt('departure_date', today)
            .order('departure_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(FLIGHT_LISTINGS_LIMIT),
          fetchOwnListings(userId),
        ])

        if (upcomingRes.error) throw upcomingRes.error
        if (pastRes.error) throw pastRes.error
        for (const group of [ownRows, upcomingRes.data, pastRes.data]) {
          addRows(group as FlightListing[] | null)
        }
      }
      if (isCurrent()) setListings(merged)
    } catch (err) {
      console.error('Error fetching flight listings:', err)
      if (isCurrent()) setError(err as Error)
    } finally {
      if (isCurrent()) setLoading(false)
    }
  }, [enabled, userId])

  useEffect(() => {
    if (!enabled) return
    fetchListings()
  }, [fetchListings, enabled])

  return { listings, loading, error, refetch: fetchListings }
}
