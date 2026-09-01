import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const USERS_PER_PAGE = 12

export const useMemberDirectory = ({ page, city, university, currentUserId }) => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  useEffect(() => {
    if (!currentUserId) {
      setLoading(false)
      return
    }

    const controller = new AbortController()

    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        let query = supabase
          .from('member_profiles')
          .select(
            'id, display_name, avatar_url, location, university, bio, show_social_handle, social_platform, social_handle, social_handles',
            { count: 'exact' }
          )
          .neq('id', currentUserId)
          .eq('onboarding_completed', true)
          .eq('is_discoverable', true)
          .order('created_at', { ascending: false })

        if (city?.trim() && city !== '__not_listed') {
          query = query.ilike('location', `%${city.trim()}%`)
        }

        if (university?.trim() && university !== '__not_listed') {
          query = query.ilike('university', `%${university.trim()}%`)
        }

        const from = (page - 1) * USERS_PER_PAGE
        const to = from + USERS_PER_PAGE - 1

        const {
          data,
          error: fetchError,
          count,
        } = await query.abortSignal(controller.signal).range(from, to)

        if (fetchError) throw fetchError

        setUsers(data || [])
        setTotalCount(count || 0)
        setTotalPages(Math.ceil((count || 0) / USERS_PER_PAGE))
      } catch (err) {
        if (controller.signal.aborted) return
        console.error('Error fetching users:', err)
        setError('Failed to load users. Please try again.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    run()
    return () => controller.abort()
  }, [page, city, university, currentUserId])

  return { users, loading, error, totalCount, totalPages }
}
