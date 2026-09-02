import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Tables } from '../types/database.types'

type MemberProfile = Pick<
  Tables<'member_profiles'>,
  | 'display_name'
  | 'location'
  | 'university'
  | 'program'
  | 'bio'
  | 'social_handles'
  | 'show_social_handle'
>

type ReviewWithUniversity = Pick<
  Tables<'reviews'>,
  'id' | 'university_id' | 'rating' | 'text' | 'program' | 'degree_level' | 'media' | 'created_at'
> & {
  universities?: { name: string; city: string; slug: string } | null
}

export const useMemberProfileData = (
  userId: string,
  { enabled = true }: { enabled?: boolean } = {}
) => {
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [reviews, setReviews] = useState<ReviewWithUniversity[]>([])
  const [loading, setLoading] = useState<boolean>(enabled && !!userId)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!enabled || !userId) {
      setLoading(false)
      return
    }

    const controller = new AbortController()

    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('member_profiles')
          .select(
            'display_name, location, university, program, bio, social_handles, show_social_handle'
          )
          .eq('id', userId)
          .abortSignal(controller.signal)
          .single()

        if (profileError) throw profileError
        setProfile(profileData as MemberProfile)

        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select(
            'id, university_id, rating, text, program, degree_level, media, created_at, universities(name, city, slug)'
          )
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (reviewsError) throw reviewsError
        setReviews((reviewsData as unknown as ReviewWithUniversity[] | null) || [])
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        console.error('Error fetching profile data:', err)
        setError(err as Error)
        setProfile(null)
        setReviews([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    run()
    return () => controller.abort()
  }, [userId, enabled])

  return { profile, reviews, loading, error }
}
