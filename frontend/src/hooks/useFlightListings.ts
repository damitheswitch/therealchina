import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Tables } from '../types/database.types'

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
      // The view hides departed trips (except the viewer's own), so the
      // board is ordered by departure: if the cap bites, it drops the trips
      // furthest in the future, never ones that leave soon. The viewer's own
      // listings load separately so My Flights and the owner controls see
      // every one of them regardless of the cap.
      const [boardRes, ownRes] = await Promise.all([
        supabase
          .from('flight_listings_with_profile')
          .select(FLIGHT_LISTING_COLUMNS)
          .order('departure_date', { ascending: true })
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

      if (boardRes.error) throw boardRes.error
      if (ownRes.error) throw ownRes.error
      const own = (ownRes.data as FlightListing[] | null) || []
      const ownIds = new Set(own.map((l) => l.id))
      const board = ((boardRes.data as FlightListing[] | null) || []).filter(
        (l) => !ownIds.has(l.id)
      )
      if (mounted.current) setListings([...own, ...board])
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
