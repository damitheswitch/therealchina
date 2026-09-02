import { useState } from 'react'
import { useDebounce } from '../hooks/useDebounce'
import { useMemberDirectory } from '../hooks/useMemberDirectory'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useAuthModal } from '../contexts/AuthModalContext'
import { SealAvatar } from '../components/SealAvatar'
import { Icons } from '../components/Icons'
import { CityAutocomplete } from '../components/CityAutocomplete'
import { UniversityAutocomplete } from '../components/UniversityAutocomplete'
import { getSocialHandles } from '../lib/socialHandles'

export const UserDirectoryPage = () => {
  const { user, loading: authLoading } = useAuth()
  const { openAuthModal } = useAuthModal()

  // Filter state
  const [cityFilter, setCityFilter] = useState('')
  const [universityFilter, setUniversityFilter] = useState('')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const debouncedCity = useDebounce(cityFilter, 300)
  const debouncedUniversity = useDebounce(universityFilter, 300)

  const { users, loading, error, totalCount, totalPages } = useMemberDirectory({
    page: currentPage,
    city: debouncedCity,
    university: debouncedUniversity,
    currentUserId: user?.id,
  })

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
        <Icons.Users size={48} />
        <h1>Discover the community</h1>
        <p>
          Join The Real China to find and connect with people in your target city or university.
          Sign in or create a free account to start exploring the directory.
        </p>
        <div
          style={{
            marginTop: '1rem',
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button onClick={() => openAuthModal('register')} className="btn btn-primary">
            Create account
          </button>
          <button onClick={() => openAuthModal('login')} className="btn btn-outline">
            Sign in
          </button>
        </div>
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
              <p className="muted">
                Found {totalCount} user{totalCount !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="user-grid">
              {users.map((profile) => (
                <Link key={profile.id} to={`/profile/${profile.id}`} className="user-card">
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
                      <p className="user-card-bio">
                        {profile.bio.substring(0, 100)}
                        {profile.bio.length > 100 ? '...' : ''}
                      </p>
                    )}
                    {(() => {
                      const socialHandles = getSocialHandles(profile)
                      const hasSocialHandles = socialHandles.some(
                        (sh) => sh.handle && sh.handle.trim()
                      )
                      return (
                        profile.show_social_handle &&
                        hasSocialHandles && (
                          <div className="user-card-social">
                            <Icons.Link size={14} /> Social handles available
                          </div>
                        )
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
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="btn btn-outline"
                >
                  <Icons.ArrowLeft /> Previous
                </button>

                <span className="pagination-info">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
