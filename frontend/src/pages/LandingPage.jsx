import { useState } from 'react'
import { useDebounce } from '../hooks/useDebounce'
import { useUniversities } from '../hooks/useUniversities'
import { useCities } from '../hooks/useCities'
import { Link } from 'react-router-dom'
import { UniversityCard } from '../components/UniversityCard'
import { Icons } from '../components/Icons'

// LandingPage component
export const LandingPage = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [sortBy, setSortBy] = useState('reviews')
  const [page, setPage] = useState(1)
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  const { cities } = useCities()
  const { universities, totalCount, pageCount, loading } = useUniversities({
    search: debouncedSearchQuery,
    city: cityFilter,
    sortBy,
    page,
  })

  const handleSearchChange = (value) => {
    setPage(1)
    setSearchQuery(value)
  }

  const handleCityChange = (value) => {
    setPage(1)
    setCityFilter(value)
  }

  const handleSortChange = (value) => {
    setPage(1)
    setSortBy(value)
  }

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <h1>Real reviews from real students.</h1>
          <p className="hero-subtitle">
            Authentic, community-driven university reviews for international students in China.
          </p>
          <div className="hero-buttons">
            <a href="#grid" className="btn btn-primary btn-lg">
              Browse Universities
            </a>
            <Link to="/review" className="btn btn-outline btn-lg">
              <Icons.Pen /> Leave a Review
            </Link>
          </div>
        </div>
      </section>

      <section className="section" id="grid">
        <div className="container">
          <div className="filter-bar">
            <input
              type="text"
              id="uni-search"
              className="search-input"
              placeholder="Search by university name or city..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            <select
              id="uni-city-filter"
              className="filter-select"
              value={cityFilter}
              onChange={(e) => handleCityChange(e.target.value)}
            >
              <option value="">All cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <select
              id="uni-sort"
              className="filter-select"
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
            >
              <option value="name">Sort: Name (A-Z)</option>
              <option value="rating">Sort: Highest rated</option>
              <option value="reviews">Sort: Most reviewed</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">
              <p>Loading universities...</p>
            </div>
          ) : universities.length === 0 ? (
            <div className="empty-state">
              <h3>No universities found</h3>
              <p>Try a different search term or filter.</p>
            </div>
          ) : (
            <>
              <div className="uni-grid">
                {universities.map((university) => (
                  <UniversityCard key={university.id} university={university} />
                ))}
              </div>

              <div
                className="pagination-row"
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 'var(--sp-2)',
                  marginTop: 'var(--sp-4)',
                }}
              >
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1 || loading}
                >
                  Previous
                </button>
                <span className="muted">
                  Page {page} of {pageCount} · {totalCount} results
                </span>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  disabled={page >= pageCount || loading}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  )
}
