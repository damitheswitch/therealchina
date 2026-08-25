// Landing page: compact hero + searchable/filterable university grid.
import { universities, getUniversityStats } from '../data.js'
import { starRating, sealBadge, icons } from '../components.js'

export function renderLandingPage() {
  return `
    <section class="hero">
      <div class="container hero-inner">
        <h1>Real reviews from real students.</h1>
        <p class="hero-subtitle">Authentic, community-driven university reviews for international students in China.</p>
        <div class="hero-buttons">
          <a href="#grid" class="btn btn-primary btn-lg">Browse Universities</a>
          <a href="#/review" class="btn btn-outline btn-lg">${icons.pen} Leave a Review</a>
        </div>
      </div>
    </section>

    <section class="section" id="grid">
      <div class="container">
        <div class="filter-bar">
          <input type="text" id="uni-search" class="search-input" placeholder="Search by university name or city..." />
          <select id="uni-city-filter" class="filter-select">
            <option value="">All cities</option>
          </select>
          <select id="uni-sort" class="filter-select">
            <option value="name">Sort: Name (A-Z)</option>
            <option value="rating">Sort: Highest rated</option>
            <option value="reviews">Sort: Most reviewed</option>
          </select>
        </div>
        <div id="uni-grid" class="uni-grid"></div>
        <div id="no-results" class="empty-state hidden">
          <h3>No universities found</h3>
          <p>Try a different search term or filter.</p>
        </div>
      </div>
    </section>
  `
}

export function initLandingPage() {
  const grid = document.getElementById('uni-grid')
  const searchInput = document.getElementById('uni-search')
  const cityFilter = document.getElementById('uni-city-filter')
  const sortSelect = document.getElementById('uni-sort')
  const noResults = document.getElementById('no-results')

  // Populate city filter
  const cities = [...new Set(universities.map((u) => u.city))].sort()
  cities.forEach((city) => {
    const opt = document.createElement('option')
    opt.value = city
    opt.textContent = city
    cityFilter.appendChild(opt)
  })

  function renderGrid() {
    const query = searchInput.value.toLowerCase().trim()
    const city = cityFilter.value
    const sortBy = sortSelect.value

    let filtered = universities.filter((u) => {
      const matchesQuery =
        !query ||
        u.name.toLowerCase().includes(query) ||
        u.nameZh.includes(query) ||
        u.city.toLowerCase().includes(query)
      const matchesCity = !city || u.city === city
      return matchesQuery && matchesCity
    })

    // Sort
    if (sortBy === 'rating') {
      filtered.sort((a, b) => getUniversityStats(b.id).avgRating - getUniversityStats(a.id).avgRating)
    } else if (sortBy === 'reviews') {
      filtered.sort((a, b) => getUniversityStats(b.id).count - getUniversityStats(a.id).count)
    } else {
      filtered.sort((a, b) => a.name.localeCompare(b.name))
    }

    if (filtered.length === 0) {
      grid.innerHTML = ''
      noResults.classList.remove('hidden')
      return
    }
    noResults.classList.add('hidden')

    grid.innerHTML = filtered
      .map((u) => {
        const stats = getUniversityStats(u.id)
        const ratingDisplay =
          stats.count > 0
            ? `<div class="uni-card-rating">${starRating(stats.avgRating)} <span class="num">${stats.avgRating.toFixed(1)}</span></div>`
            : `<span class="uni-card-no-reviews">No reviews yet</span>`

        return `<a href="#/university/${u.id}" class="uni-card fade-in">
          <img src="${u.image}" alt="${u.name} campus" class="uni-card-img" loading="lazy" />
          <div class="uni-card-body">
            <div>
              <div class="uni-card-name">${u.name}</div>
              <div class="uni-card-name-zh">${u.nameZh}</div>
            </div>
            <div class="uni-card-meta">
              <span class="uni-card-city">${icons.mapPin} ${u.city}</span>
              ${stats.hasVerified ? sealBadge() : ''}
            </div>
            <div class="uni-card-meta">
              ${ratingDisplay}
              ${stats.count > 0 ? `<span class="text-xs muted">${stats.count} review${stats.count !== 1 ? 's' : ''}</span>` : ''}
            </div>
          </div>
        </a>`
      })
      .join('')
  }

  searchInput.addEventListener('input', renderGrid)
  cityFilter.addEventListener('change', renderGrid)
  sortSelect.addEventListener('change', renderGrid)

  renderGrid()
}
