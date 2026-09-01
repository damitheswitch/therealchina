import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export const useFlightListings = ({ enabled = true } = {}) => {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const mounted = useRef(true)

  useLayoutEffect(() => {
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
      const { data, error: fetchError } = await supabase
        .from('flight_listings_with_profile')
        .select(
          'id, user_id, departure_country, arrival_country, departure_city, arrival_city, departure_date, arrival_date, available_kgs, price_per_kg, currency, notes, is_active, created_at, display_name, avatar_url, social_handles, show_social_handle'
        )
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      if (mounted.current) setListings(data || [])
    } catch (err) {
      console.error('Error fetching flight listings:', err)
      if (mounted.current) setError(err)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    fetchListings()
  }, [fetchListings, enabled])

  return { listings, loading, error, refetch: fetchListings }
}
