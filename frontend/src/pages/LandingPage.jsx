import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from '../hooks/useDebounce'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { UniversityCard } from '../components/UniversityCard'
import { Icons } from '../components/Icons'

const PAGE_SIZE = 20

// LandingPage component
export const LandingPage = () => {
  const [universities, setUniversities] = useState([])
  const [cities, setCities] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [sortBy, setSortBy] = useState('reviews')
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  const fetchCities = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('universities').select('city')
      if (error) throw error

      const uniqueCities = [...new Set((data || []).map((u) => u.city))].sort()
      setCities(uniqueCities)
    } catch (error) {
      console.error('Error fetching cities:', error)
    }
  }, [])

  useEffect(() => {
    fetchCities()
  }, [fetchCities])

  const fetchData = useCallback(
    async (signal) => {
      setLoading(true)
      try {
        // Embed university_stats so sorting by rating/reviews happens in the DB,
        // not in the browser on a single page of results.
        let query = supabase
          .from('universities')
          .select('*, university_stats(avg_rating, review_count, has_verified_review)', {
            count: 'exact',
          })

        if (debouncedSearchQuery.trim()) {
          const trimmed = debouncedSearchQuery.trim()
          query = query.or(
            `name.ilike.%${trimmed}%,name_zh.ilike.%${trimmed}%,city.ilike.%${trimmed}%`
          )
        }

        if (cityFilter) {
          query = query.eq('city', cityFilter)
        }

        const start = (page - 1) * PAGE_SIZE
        const end = start + PAGE_SIZE - 1

        const sortConfig = {
          name: { column: 'name', ascending: true },
          rating: { column: 'university_stats(avg_rating)', ascending: false },
          reviews: { column: 'university_stats(review_count)', ascending: false },
        }
        const { column, ascending } = sortConfig[sortBy] || sortConfig.reviews

        const {
          data: universitiesData,
          error: universitiesError,
          count,
        } = await query
          .order(column, { ascending, nullsFirst: false })
          .abortSignal(signal)
          .range(start, end)

        if (universitiesError) throw universitiesError

        const mappedUniversities = (universitiesData || []).map((u) => {
          // university_stats may be null for universities with no reviews,
          // or an object/array depending on how PostgREST returns the one-to-one join.
          const rawStat = u.university_stats
          const stat = Array.isArray(rawStat) ? rawStat[0] : rawStat
          return {
            ...u,
            avg_rating: stat?.avg_rating || 0,
            review_count: stat?.review_count || 0,
            is_verified: stat?.has_verified_review || false,
          }
        })

        setUniversities(mappedUniversities)
        setTotalCount(count || 0)
        setPageCount(Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)))
      } catch (error) {
        if (signal?.aborted) return
        console.error('Error fetching data:', error)
        setUniversities([])
        setTotalCount(0)
        setPageCount(1)
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [page, debouncedSearchQuery, cityFilter, sortBy]
  )

  useEffect(() => {
    const controller = new AbortController()
    fetchData(controller.signal)
    return () => controller.abort()
  }, [fetchData])

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
