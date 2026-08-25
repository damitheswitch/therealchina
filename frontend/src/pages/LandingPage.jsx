import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { UniversityCard } from '../components/UniversityCard'
import { Icons } from '../components/Icons'

// LandingPage component
export const LandingPage = () => {
  const [universities, setUniversities] = useState([])
  const [stats, setStats] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch universities
      const { data: universitiesData, error: universitiesError } = await supabase
        .from('universities')
        .select('*')
        .order('name')

      if (universitiesError) throw universitiesError

      // Fetch stats
      const { data: statsData, error: statsError } = await supabase
        .from('university_stats')
        .select('*')

      if (statsError) throw statsError

      setUniversities(universitiesData || [])
      setStats(statsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get unique cities for filter
  const cities = [...new Set(universities.map((u) => u.city))].sort()

  // Filter and sort universities
  const filteredUniversities = universities
    .filter((u) => {
      const matchesSearch =
        !searchQuery ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.name_zh?.includes(searchQuery) ||
        u.city.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCity = !cityFilter || u.city === cityFilter

      return matchesSearch && matchesCity
    })
    .map((u) => {
      const stat = stats.find((s) => s.university_id === u.id)
      return {
        ...u,
        avg_rating: stat?.avg_rating || 0,
        review_count: stat?.review_count || 0,
        is_verified: stat?.has_verified_review || false,
      }
    })
    .sort((a, b) => {
      if (sortBy === 'rating') {
        return b.avg_rating - a.avg_rating
      } else if (sortBy === 'reviews') {
        return b.review_count - a.review_count
      } else {
        return a.name.localeCompare(b.name)
      }
    })

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
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              id="uni-city-filter"
              className="filter-select"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
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
              onChange={(e) => setSortBy(e.target.value)}
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
          ) : filteredUniversities.length === 0 ? (
            <div className="empty-state">
              <h3>No universities found</h3>
              <p>Try a different search term or filter.</p>
            </div>
          ) : (
            <div className="uni-grid">
              {filteredUniversities.map((university) => (
                <UniversityCard key={university.id} university={university} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
