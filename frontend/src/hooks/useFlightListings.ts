import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Tables } from '../types/database.types'
import { todayLocal } from '../lib/flightListings'

const FLIGHT_LISTINGS_LIMIT = 200

type FlightListing = Tables<'flight_listings_with_profile'>

const FLIGHT_LISTING_COLUMNS =
  'id, user_id, departure_country, arrival_country, departure_city, arrival_city, departure_date, arrival_date, available_kgs, price_per_kg, currency, notes, is_active, created_at, display_name, avatar_url, social_handles, show_social_handle, contact_platforms'

export const useFlightListings = ({
  enabled = true,
  userId = null,
}: { enabled?: boolean; userId?: string | null } = {}) => {
  const [listings, setListings] = useState<FlightListing[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const mounted = useRef<boolean>(true)

  // Plain effect — useLayoutEffect warns under renderToString and this only
  // syncs loading state, never measures layout.
  useEffect(() => {
    if (enabled) {
      setLoading(true)
    } else {
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
    setLoading(true)
    setError(null)
    try {
      // Split upcoming, past and the viewer's own trips into separate queries
      // so each section gets its own row budget: past or closed history can
      // never crowd out upcoming trips on the main board, the Past Flights tab
      // still shows departed active trips from everyone, and My Flights always
      // includes all of the owner's listings.
      const today = todayLocal()
      const [upcomingRes, pastRes, ownRes] = await Promise.all([
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
        userId
          ? supabase
              .from('flight_listings_with_profile')
              .select(FLIGHT_LISTING_COLUMNS)
              .eq('user_id', userId)
              .order('departure_date', { ascending: true })
          : Promise.resolve({ data: [] as FlightListing[], error: null }),
      ])

      if (upcomingRes.error) throw upcomingRes.error
      if (pastRes.error) throw pastRes.error
      if (ownRes.error) throw ownRes.error
      const merged: FlightListing[] = []
      const seen = new Set<string>()
      for (const group of [ownRes.data, upcomingRes.data, pastRes.data]) {
        for (const row of (group as FlightListing[] | null) || []) {
          if (row.id && !seen.has(row.id)) {
            seen.add(row.id)
            merged.push(row)
          }
        }
      }
      if (mounted.current) setListings(merged)
    } catch (err) {
      console.error('Error fetching flight listings:', err)
      if (mounted.current) setError(err as Error)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [enabled, userId])

  useEffect(() => {
    if (!enabled) return
    fetchListings()
  }, [fetchListings, enabled])

  return { listings, loading, error, refetch: fetchListings }
}
