import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export const useProfile = (userId, { retry = false } = {}) => {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const mounted = useRef(true)

  useLayoutEffect(() => {
    if (userId) {
      setLoading(true)
    } else {
      setLoading(false)
      setProfile(null)
      setError(null)
    }
  }, [userId])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const fetchProfile = useCallback(async () => {
    if (!userId) return null
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select(
          'display_name, bio, location, university, program, social_handles, social_platform, social_handle, show_social_handle, is_discoverable, onboarding_completed'
        )
        .eq('id', userId)
        .single()

      if (fetchError && fetchError.code === 'PGRST116' && retry) {
        await new Promise((resolve) => setTimeout(resolve, 800))
        if (!mounted.current) return null
        const { data: retryData, error: retryError } = await supabase
          .from('profiles')
          .select(
            'display_name, bio, location, university, program, social_handles, social_platform, social_handle, show_social_handle, is_discoverable, onboarding_completed'
          )
          .eq('id', userId)
          .single()
        if (retryError) throw retryError
        setProfile(retryData)
        return retryData
      } else if (fetchError) {
        throw fetchError
      }
      setProfile(data)
      return data
    } catch (err) {
      if (!mounted.current) return null
      console.error('Error fetching profile:', err)
      setError(err)
      setProfile(null)
      return null
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [userId, retry])

  useEffect(() => {
    if (!userId) return
    fetchProfile()
  }, [fetchProfile, userId])

  return { profile, loading, error, refetch: fetchProfile }
}
