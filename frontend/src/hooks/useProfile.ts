import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Tables } from '../types/database.types'

export type Profile = Pick<
  Tables<'profiles'>,
  | 'display_name'
  | 'bio'
  | 'location'
  | 'university'
  | 'program'
  | 'social_handles'
  | 'social_platform'
  | 'social_handle'
  | 'show_social_handle'
  | 'is_discoverable'
  | 'onboarding_completed'
>

export const useProfile = (userId: string, { retry = false }: { retry?: boolean } = {}) => {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const mounted = useRef<boolean>(true)

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
        setProfile(retryData as Profile)
        return retryData as Profile
      } else if (fetchError) {
        throw fetchError
      }
      setProfile(data as Profile)
      return data as Profile
    } catch (err) {
      if (!mounted.current) return null
      console.error('Error fetching profile:', err)
      setError(err as Error)
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
