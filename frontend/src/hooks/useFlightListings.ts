import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Tables } from '../types/database.types'
import { mergeListingSets } from '../lib/flightListings'

// Cap for everyone's listings. The viewer's own listings load separately and
// uncapped, so this never hides a listing from its owner.
const FLIGHT_LISTINGS_LIMIT = 200
const LISTING_COLUMNS =
  'id, user_id, departure_country, arrival_country, departure_city, arrival_city, departure_date, arrival_date, available_kgs, price_per_kg, currency, notes, is_active, created_at, display_name, avatar_url, social_handles, show_social_handle, contact_platforms'

type FlightListing = Tables<'flight_listings_with_profile'>

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
      // No client-side is_active filter: the view already returns active rows
      // plus the viewer's own closed listings. The cap keeps the latest
      // departure dates, so upcoming trips win over long-past ones.
      const [generalRes, ownRes] = await Promise.all([
        supabase
          .from('flight_listings_with_profile')
          .select(LISTING_COLUMNS)
          .order('departure_date', { ascending: false })
          .limit(FLIGHT_LISTINGS_LIMIT),
        userId
          ? supabase
              .from('flight_listings_with_profile')
              .select(LISTING_COLUMNS)
              .eq('user_id', userId)
          : Promise.resolve({ data: [] as FlightListing[], error: null }),
      ])

      if (generalRes.error) throw generalRes.error
      if (ownRes.error) throw ownRes.error
      if (mounted.current) {
        setListings(
          mergeListingSets(
            (generalRes.data as FlightListing[] | null) || [],
            (ownRes.data as FlightListing[] | null) || []
          )
        )
      }
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
