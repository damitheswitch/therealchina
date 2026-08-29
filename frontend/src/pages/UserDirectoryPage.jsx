import { useState, useEffect } from 'react'
import { useDebounce } from '../hooks/useDebounce'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { SealAvatar } from '../components/SealAvatar'
import { Icons } from '../components/Icons'
import { CityAutocomplete } from '../components/CityAutocomplete'
import { UniversityAutocomplete } from '../components/UniversityAutocomplete'

export const UserDirectoryPage = () => {
  const { user, loading: authLoading } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Filter state
  const [cityFilter, setCityFilter] = useState('')
  const [universityFilter, setUniversityFilter] = useState('')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const USERS_PER_PAGE = 12
  const debouncedCity = useDebounce(cityFilter, 300)
  const debouncedUniversity = useDebounce(universityFilter, 300)

  useEffect(() => {
    if (user) {
      const controller = new AbortController()
      fetchUsers(controller.signal)
      return () => controller.abort()
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [user, authLoading, currentPage, debouncedCity, debouncedUniversity])

  const fetchUsers = async (signal) => {
    setLoading(true)
    setError(null)
    
    try {
      let query = supabase
        .from('profiles')
        .select('id, display_name, avatar_url, location, university, bio, show_social_handle, social_platform, social_handle, social_handles', { count: 'exact' })
        .neq('id', user.id) // Exclude current user
        .order('created_at', { ascending: false })

      // Apply filters if provided
      if (debouncedCity.trim() && debouncedCity !== '__not_listed') {
        query = query.ilike('location', `%${debouncedCity.trim()}%`)
      }
      
      if (debouncedUniversity.trim() && debouncedUniversity !== '__not_listed') {
        query = query.ilike('university', `%${debouncedUniversity.trim()}%`)
      }

      // Calculate pagination
      const from = (currentPage - 1) * USERS_PER_PAGE
      const to = from + USERS_PER_PAGE - 1

      const { data, error, count } = await query
        .abortSignal(signal)
        .range(from, to)

      if (error) throw error

      setUsers(data || [])
      setTotalCount(count || 0)
      setTotalPages(Math.ceil((count || 0) / USERS_PER_PAGE))
    } catch (err) {
      if (signal?.aborted) return
      console.error('Error fetching users:', err)
      setError('Failed to load users. Please try again.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setCurrentPage(1) // Reset to first page on new search
  }

  const clearFilters = () => {
    setCityFilter('')
    setUniversityFilter('')
    setCurrentPage(1)
  }

  if (authLoading) {
    return <div className="loading">Loading...</div>
  }

  if (!user) {
    return (
      <div className="container empty-state" style={{ paddingTop: '6rem' }}>
        <h3>Authentication Required</h3>
        <p>Please sign in to browse the user directory.</p>
        <Link to="/" className="btn btn-primary mt-2">
          <Icons.ArrowLeft /> Back to universities
        </Link>
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-4)' }}>
      <div className="section">
        <div className="section-header">
          <h1 className="section-title">User Directory</h1>
          <p className="muted">Find and connect with other community members</p>
        </div>

        {/* Filter Form */}
        <form onSubmit={handleSearch} className="filter-form">
          <div className="filter-row">
            <div className="filter-group">
              <label className="form-label">City</label>
              <CityAutocomplete
                id="city-filter"
                placeholder="e.g. Beijing, Shanghai"
                value={cityFilter}
                onChange={setCityFilter}
              />
            </div>
            
            <div className="filter-group">
              <label className="form-label">University</label>
              <UniversityAutocomplete
                id="university-filter"
                placeholder="e.g. Peking University"
                value={universityFilter}
                onChange={setUniversityFilter}
              />
            </div>

            <div className="filter-actions">
              <button type="submit" className="btn btn-primary">
                <Icons.Search /> Search
              </button>
              <button 
                type="button" 
                onClick={clearFilters}
                className="btn btn-outline"
                disabled={!cityFilter && !universityFilter}
              >
                Clear
              </button>
            </div>
          </div>
        </form>

        {/* Results */}
        {loading ? (
          <div className="loading">Loading users...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <Icons.Users size={48} />
            <h3>No users found</h3>
            <p>
              {cityFilter || universityFilter 
                ? 'Try adjusting your filters or search terms.' 
                : 'Be the first to join the directory!'}
            </p>
          </div>
        ) : (
          <>
            <div className="results-count">
              <p className="muted">Found {totalCount} user{totalCount !== 1 ? 's' : ''}</p>
            </div>

            <div className="user-grid">
              {users.map((profile) => (
                <Link 
                  key={profile.id} 
                  to={`/profile/${profile.id}`}
                  className="user-card"
                >
                  <div className="user-card-avatar">
                    <SealAvatar displayName={profile.display_name} size={60} />
                  </div>
                  <div className="user-card-content">
                    <h3 className="user-card-name">{profile.display_name}</h3>
                    {profile.location && (
                      <div className="user-card-location">
                        <Icons.MapPin size={14} /> {profile.location}
                      </div>
                    )}
                    {profile.university && (
                      <div className="user-card-university">
                        <Icons.Book size={14} /> {profile.university}
                      </div>
                    )}
                    {profile.bio && (
                      <p className="user-card-bio">{profile.bio.substring(0, 100)}{profile.bio.length > 100 ? '...' : ''}</p>
                    )}
                    {(() => {
                      let socialHandles = []
                      if (profile.social_handles && Array.isArray(profile.social_handles)) {
                        socialHandles = profile.social_handles
                      } else if (profile.social_platform || profile.social_handle) {
                        socialHandles = [{ platform: profile.social_platform, handle: profile.social_handle }]
                      }
                      const hasSocialHandles = socialHandles.some(sh => sh.handle && sh.handle.trim())
                      return profile.show_social_handle && hasSocialHandles && (
                        <div className="user-card-social">
                          <Icons.Link size={14} /> Social handles available
                        </div>
                      )
                    })()}
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="btn btn-outline"
                >
                  <Icons.ArrowLeft /> Previous
                </button>
                
                <span className="pagination-info">
                  Page {currentPage} of {totalPages}
                </span>
                
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="btn btn-outline"
                >
                  Next <Icons.ArrowRight />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
