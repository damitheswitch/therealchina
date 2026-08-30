import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useAuthModal } from '../contexts/AuthModalContext'
import { useToast } from '../contexts/ToastContext'
import { FlightListingCard } from '../components/FlightListingCard'
import { FlightListingForm } from '../components/FlightListingForm'
import { Icons } from '../components/Icons'
import { CountryAutocomplete, isCountryName } from '../components/CountryAutocomplete'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// Extract the month (1-12) from a YYYY-MM-DD string without Date(), so the
// value is not shifted by timezone conversion
const monthOf = (dateString) => {
  if (!dateString) return null
  const month = parseInt(dateString.split('-')[1], 10)
  return Number.isNaN(month) ? null : month
}

// Case-insensitive exact match, tolerant of legacy rows stored before the
// strict country dropdown existed
const sameCountry = (a, b) =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

export const FlightListingsPage = () => {
  const { user, loading: authLoading } = useAuth()
  const { openAuthModal } = useAuthModal()
  const { showToast } = useToast()

  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Filter states
  const [departureCountry, setDepartureCountry] = useState('')
  const [arrivalCountry, setArrivalCountry] = useState('')
  const [month, setMonth] = useState('')

  const fetchListings = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('flight_listings_with_profile')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setListings(data || [])
    } catch (error) {
      console.error('Error fetching flight listings:', error)
      showToast('Failed to load flight listings', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchListings()
    }
  }, [user])

  // Deep link from the profile dropdown (/flights?post=1) opens the form
  // once the session has been restored
  useEffect(() => {
    if (!user) return
    if (new URLSearchParams(window.location.search).get('post') === '1') {
      setShowForm(true)
      window.history.replaceState({}, '', '/flights')
    }
  }, [user])

  // Filtering runs on the latest state on every render, so results always
  // match the filter inputs. Country filters only apply once the typed text
  // resolves to a canonical country (partial text is ignored, invalid text
  // is cleared by the autocomplete itself).
  const filteredListings = useMemo(() => {
    const from = isCountryName(departureCountry) ? departureCountry.trim() : ''
    const to = isCountryName(arrivalCountry) ? arrivalCountry.trim() : ''
    const mon = month ? parseInt(month, 10) : null

    return listings.filter(listing => {
      if (from && !sameCountry(listing.departure_country, from)) return false
      if (to && !sameCountry(listing.arrival_country, to)) return false
      if (mon !== null) {
        // Single month filter: match departure OR arrival month
        if (monthOf(listing.departure_date) !== mon && monthOf(listing.arrival_date) !== mon) {
          return false
        }
      }
      return true
    })
  }, [listings, departureCountry, arrivalCountry, month])

  const clearFilters = () => {
    setDepartureCountry('')
    setArrivalCountry('')
    setMonth('')
  }

  const handleListingCreated = () => {
    setShowForm(false)
    fetchListings()
  }

  const handleListingDeleted = () => {
    fetchListings()
  }

  const hasActiveFilters = departureCountry || arrivalCountry || month

  if (authLoading) {
    return <div className="loading">Loading...</div>
  }

  if (!user) {
    return (
      <div className="container empty-state" style={{ paddingTop: '6rem' }}>
        <Icons.Plane size={48} />
        <h1>Get paid to fly</h1>
        <p>
          List your unused luggage space for cash, or hire a traveler to carry your parcel.
        </p>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => openAuthModal('register')}
            className="btn btn-primary"
          >
            Create account
          </button>
          <button
            onClick={() => openAuthModal('login')}
            className="btn btn-outline"
          >
            Sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-4)', paddingBottom: 'var(--sp-4)' }}>
      <div className="section-header">
        <h1 className="section-title">Flight Listings</h1>
        <p className="page-subtitle">Find people flying your way and send packages through them</p>
      </div>

      {/* Inline filter toolbar + Post CTA */}
      <div className="flight-toolbar">
        <div className="flight-toolbar-field">
          <label className="flight-toolbar-label" htmlFor="filter-from">From</label>
          <CountryAutocomplete
            id="filter-from"
            placeholder="Departure country"
            value={departureCountry}
            onChange={setDepartureCountry}
          />
        </div>

        <div className="flight-toolbar-field">
          <label className="flight-toolbar-label" htmlFor="filter-to">To</label>
          <CountryAutocomplete
            id="filter-to"
            placeholder="Arrival country"
            value={arrivalCountry}
            onChange={setArrivalCountry}
          />
        </div>

        <div className="flight-toolbar-field">
          <label className="flight-toolbar-label" htmlFor="filter-month">Month</label>
          <select
            id="filter-month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="form-select"
            title="Matches flights departing or arriving in this month"
          >
            <option value="">Any month</option>
            {MONTHS.map((name, index) => (
              <option key={name} value={String(index + 1).padStart(2, '0')}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button onClick={clearFilters} className="btn btn-outline btn-sm flight-clear-btn">
            <Icons.X /> Clear
          </button>
        )}

        <div className="flight-toolbar-spacer" />

        {user && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary btn-sm"
          >
            <Icons.Plus /> Post Your Flight
          </button>
        )}
      </div>

      {showForm ? (
        <FlightListingForm
          onSuccess={handleListingCreated}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <>
          <div className="listings-header">
            <h2>
              {hasActiveFilters ? 'Filtered Results' : 'All Listings'}
              <span className="count">({filteredListings.length})</span>
            </h2>
          </div>

          {loading ? (
            <div className="loading">Loading listings...</div>
          ) : filteredListings.length === 0 ? (
            <div className="empty-state">
              <Icons.Plane />
              <h3>No flight listings found</h3>
              <p>
                {hasActiveFilters
                  ? 'Try adjusting your filters or clearing them to see more listings.'
                  : 'Be the first to post a flight listing!'}
              </p>
              {user && !hasActiveFilters && (
                <button
                  onClick={() => setShowForm(true)}
                  className="btn btn-primary"
                >
                  <Icons.Plus /> Post Your Flight
                </button>
              )}
            </div>
          ) : (
            <div className="flight-rows">
              {filteredListings.map(listing => (
                <FlightListingCard
                  key={listing.id}
                  listing={listing}
                  canDelete={user?.id === listing.user_id}
                  onDelete={handleListingDeleted}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
