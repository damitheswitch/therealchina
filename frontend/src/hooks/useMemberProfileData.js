import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export const useMemberProfileData = (userId, { enabled = true } = {}) => {
  const [profile, setProfile] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(enabled && !!userId)
  const [error, setError] = useState(null)

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
        setProfile(profileData)

        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select(
            'id, university_id, rating, text, program, degree_level, media, created_at, universities(name, city, slug)'
          )
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (reviewsError) throw reviewsError
        setReviews(reviewsData || [])
      } catch (err) {
        if (err?.name === 'AbortError') return
        console.error('Error fetching profile data:', err)
        setError(err)
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
