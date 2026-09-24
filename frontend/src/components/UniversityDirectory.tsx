import { Link, useSearchParams } from 'react-router-dom'
import { useDebounce } from '../hooks/useDebounce'
import { useUniversities, type SortBy } from '../hooks/useUniversities'
import { useCities } from '../hooks/useCities'
import { UniversityCard } from './UniversityCard'

const VALID_SORTS: SortBy[] = ['name', 'rating', 'reviews']

// Shared browse/search/sort/paginate grid — used by the homepage and the
// canonical /universities index page. Filters and page live in the URL
// (?q=&city=&sort=&page=) so filtered views are linkable and crawlers can
// reach beyond page 1.
export const UniversityDirectory = () => {
  const [params, setParams] = useSearchParams()
  const searchQuery = params.get('q') ?? ''
  const cityFilter = params.get('city') ?? ''
  const sortParam = params.get('sort') ?? 'reviews'
  const sortBy = (VALID_SORTS.includes(sortParam as SortBy) ? sortParam : 'reviews') as SortBy
  const page = Math.max(1, Number(params.get('page')) || 1)
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  const { groups } = useCities()
  const { universities, totalCount, pageCount, loading } = useUniversities({
    search: debouncedSearchQuery,
    city: cityFilter,
    sortBy,
    page,
  })

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { preventScrollReset: true })
  }

  const handleSearchChange = (value: string) => update({ q: value || null, page: null })
  const handleCityChange = (value: string) => update({ city: value || null, page: null })
  const handleSortChange = (value: string) =>
    update({ sort: value === 'reviews' ? null : value, page: null })

  const pageLink = (p: number) => {
    const next = new URLSearchParams(params)
    if (p <= 1) next.delete('page')
    else next.set('page', String(p))
    const q = next.toString()
    return `/universities${q ? `?${q}` : ''}`
  }

  return (
    <section className="section" id="grid">
      <div className="container">
        <div className="filter-bar">
          <input
            type="text"
            id="uni-search"
            className="search-input"
            placeholder="Search by university name or city..."
            aria-label="Search universities by name or city"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          <select
            id="uni-city-filter"
            className="filter-select"
            aria-label="Filter by city or province"
            value={cityFilter}
            onChange={(e) => handleCityChange(e.target.value)}
          >
            <option value="">All locations</option>
            {groups.map((g) =>
              g.province === null ? (
                g.cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))
              ) : (
                <optgroup key={g.province} label={g.province}>
                  <option value={`prov:${g.province}`}>All of {g.province}</option>
                  {g.cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </optgroup>
              )
            )}
          </select>
          <select
            id="uni-sort"
            className="filter-select"
            aria-label="Sort universities"
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

            {pageCount > 1 && (
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
                {page > 1 ? (
                  <Link to={pageLink(page - 1)} className="btn btn-outline" rel="prev">
                    Previous
                  </Link>
                ) : (
                  <span className="btn btn-outline" aria-disabled="true" style={{ opacity: 0.5 }}>
                    Previous
                  </span>
                )}
                <span className="muted">
                  Page {page} of {pageCount} · {totalCount} results
                </span>
                {page < pageCount ? (
                  <Link to={pageLink(page + 1)} className="btn btn-outline" rel="next">
                    Next
                  </Link>
                ) : (
                  <span className="btn btn-outline" aria-disabled="true" style={{ opacity: 0.5 }}>
                    Next
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
