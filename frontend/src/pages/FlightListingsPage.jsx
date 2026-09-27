import { useState, useEffect, useMemo, useCallback } from 'react'
import { Seo } from '../components/Seo'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useAuthModal } from '../contexts/AuthModalContext'
import { useToast } from '../contexts/ToastContext'
import { useFlightListings } from '../hooks/useFlightListings'
import { FlightListingCard } from '../components/FlightListingCard'
import { FlightListingForm } from '../components/FlightListingForm'
import { SocialHandlesSetupModal } from '../components/SocialHandlesSetupModal'
import { Icons } from '../components/Icons'
import { CountryAutocomplete, isCountryName } from '../components/CountryAutocomplete'
import { hasSocialHandles } from '../lib/socialHandles'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
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
const sameCountry = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

// Local calendar date (YYYY-MM-DD), unlike toISOString() which is UTC
const todayLocal = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export const FlightListingsPage = () => {
  const { user, loading: authLoading } = useAuth()
  const { openAuthModal } = useAuthModal()
  const { showToast } = useToast()

  const [showForm, setShowForm] = useState(false)
  const [ownProfile, setOwnProfile] = useState(null)
  const [showSetupModal, setShowSetupModal] = useState(false)

  // Filter states
  const [departureCountry, setDepartureCountry] = useState('')
  const [arrivalCountry, setArrivalCountry] = useState('')
  const [month, setMonth] = useState('')

  // View + sort states
  const [viewTab, setViewTab] = useState('upcoming')
  const [sortBy, setSortBy] = useState('departure_asc')
  const [editingListing, setEditingListing] = useState(null)

  // TODO(scale): when listings grow into the hundreds, filter and paginate
  // server-side instead of downloading every visible row.
  const {
    listings,
    loading,
    error: listingsError,
    refetch: refetchListings,
  } = useFlightListings({ enabled: !!user })

  // Surface fetch errors as a toast (preserves previous inline behavior).
  useEffect(() => {
    if (listingsError) showToast('Failed to load flight listings', 'error')
  }, [listingsError, showToast])

  const fetchOwnProfile = useCallback(async () => {
    if (!user) return null
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, social_handles, social_handle, social_platform, show_social_handle')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setOwnProfile(data)
      return data
    } catch (error) {
      console.error('Error fetching own profile:', error)
      return null
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchOwnProfile()
    }
  }, [user, fetchOwnProfile])

  const handleStartPosting = async () => {
    setEditingListing(null)
    const currentProfile = ownProfile || (await fetchOwnProfile())
    if (!hasSocialHandles(currentProfile)) {
      setShowSetupModal(true)
    } else {
      setShowForm(true)
    }
  }

  const handleSetupSaved = async () => {
    await fetchOwnProfile()
    setShowSetupModal(false)
    setShowForm(true)
  }

  // Deep link from the profile dropdown (/flights?post=1) opens the form
  // once the session and profile have been restored
  useEffect(() => {
    if (!user || !ownProfile) return
    if (new URLSearchParams(window.location.search).get('post') === '1') {
      if (hasSocialHandles(ownProfile)) {
        setShowForm(true)
      } else {
        setShowSetupModal(true)
      }
      window.history.replaceState({}, '', '/flights')
    }
  }, [user, ownProfile])

  // Filtering runs on the latest state on every render, so results always
  // match the filter inputs. Country filters only apply once the typed text
  // resolves to a canonical country (partial text is ignored, invalid text
  // is cleared by the autocomplete itself).
  const filteredListings = useMemo(() => {
    const from = isCountryName(departureCountry) ? departureCountry.trim() : ''
    const to = isCountryName(arrivalCountry) ? arrivalCountry.trim() : ''
    const mon = month ? parseInt(month, 10) : null

    return listings.filter((listing) => {
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

  const handleTabChange = (newTab) => {
    setViewTab(newTab)
    if (newTab === 'past' && sortBy === 'departure_asc') {
      setSortBy('departure_desc')
    } else if (newTab === 'upcoming' && sortBy === 'departure_desc') {
      setSortBy('departure_asc')
    }
  }

  const counts = useMemo(() => {
    const today = todayLocal()
    let upcoming = 0
    let past = 0
    let mine = 0
    let all = 0
    for (const listing of filteredListings) {
      const departed = Boolean(listing.departure_date && listing.departure_date < today)
      const own = Boolean(user && listing.user_id === user.id)
      if (own) mine++
      // Closed (is_active=false) rows stay visible to their owner only —
      // they count toward My Flights and All, never Upcoming/Past
      if (listing.is_active) {
        if (departed) past++
        else upcoming++
        all++
      } else if (own) {
        all++
      }
    }
    return { upcoming, past, mine, all }
  }, [filteredListings, user])

  const displayedListings = useMemo(() => {
    const today = todayLocal()
    let list = filteredListings

    if (viewTab === 'upcoming') {
      list = list.filter((l) => l.is_active && (!l.departure_date || l.departure_date >= today))
    } else if (viewTab === 'past') {
      list = list.filter((l) => l.is_active && l.departure_date && l.departure_date < today)
    } else if (viewTab === 'my_flights') {
      list = list.filter((l) => user && l.user_id === user.id)
    } else {
      // 'all': public active listings plus the viewer's own closed ones
      list = list.filter((l) => l.is_active || (user && l.user_id === user.id))
    }

    const departedLast = viewTab === 'all' || viewTab === 'my_flights'

    return [...list].sort((a, b) => {
      const aDeparted = Boolean(a.departure_date && a.departure_date < today)
      const bDeparted = Boolean(b.departure_date && b.departure_date < today)

      if (sortBy === 'departure_asc') {
        if (departedLast && aDeparted !== bDeparted) {
          return aDeparted ? 1 : -1
        }
        return (a.departure_date || '').localeCompare(b.departure_date || '')
      }
      if (sortBy === 'departure_desc') {
        if (departedLast && aDeparted !== bDeparted) {
          return aDeparted ? 1 : -1
        }
        return (b.departure_date || '').localeCompare(a.departure_date || '')
      }
      if (sortBy === 'price_asc') {
        return (Number(a.price_per_kg) || 0) - (Number(b.price_per_kg) || 0)
      }
      if (sortBy === 'kgs_desc') {
        return (Number(b.available_kgs) || 0) - (Number(a.available_kgs) || 0)
      }
      if (sortBy === 'created_desc') {
        return (b.created_at || '').localeCompare(a.created_at || '')
      }
      return 0
    })
  }, [filteredListings, viewTab, sortBy, user])

  const clearFilters = () => {
    setDepartureCountry('')
    setArrivalCountry('')
    setMonth('')
  }

  const handleListingSaved = () => {
    setShowForm(false)
    setEditingListing(null)
    refetchListings()
  }

  const handleFormCancel = () => {
    setShowForm(false)
    setEditingListing(null)
  }

  const handleListingDeleted = () => {
    refetchListings()
  }

  const handleEditListing = (listing) => {
    setEditingListing(listing)
    setShowForm(true)
  }

  const handleToggleActive = async (listing) => {
    try {
      const { error } = await supabase
        .from('flight_listings')
        .update({ is_active: !listing.is_active })
        .eq('id', listing.id)

      if (error) throw error
      showToast(listing.is_active ? 'Listing marked as full' : 'Listing reopened', 'success')
      refetchListings()
    } catch (error) {
      console.error('Error updating listing status:', error)
      showToast('Failed to update listing', 'error')
    }
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
        <p>List your unused luggage space for cash, or hire a traveler to carry your parcel.</p>
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
    <div className="container" style={{ paddingTop: 'var(--sp-4)', paddingBottom: 'var(--sp-4)' }}>
      <Seo path="/flights" title="Flight listings" index={false} />
      <div className="section-header">
        <h1 className="section-title">Flight Listings</h1>
        <p className="page-subtitle">Find people flying your way and send packages through them</p>
      </div>

      {/* Inline filter toolbar + Post CTA */}
      <div className="flight-toolbar">
        <div className="flight-toolbar-field">
          <label className="flight-toolbar-label" htmlFor="filter-from">
            From
          </label>
          <CountryAutocomplete
            id="filter-from"
            placeholder="Departure country"
            value={departureCountry}
            onChange={setDepartureCountry}
          />
        </div>

        <div className="flight-toolbar-field">
          <label className="flight-toolbar-label" htmlFor="filter-to">
            To
          </label>
          <CountryAutocomplete
            id="filter-to"
            placeholder="Arrival country"
            value={arrivalCountry}
            onChange={setArrivalCountry}
          />
        </div>

        <div className="flight-toolbar-field">
          <label className="flight-toolbar-label" htmlFor="filter-month">
            Month
          </label>
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
          <button onClick={handleStartPosting} className="btn btn-primary btn-sm">
            <Icons.Plus /> Post Your Flight
          </button>
        )}
      </div>

      {showForm ? (
        <FlightListingForm
          listing={editingListing}
          onRequiresSocialHandles={() => setShowSetupModal(true)}
          onSuccess={handleListingSaved}
          onCancel={handleFormCancel}
        />
      ) : (
        <>
          <div className="listings-header">
            <div className="flight-tabs" role="tablist" aria-label="Flight listing views">
              <button
                type="button"
                role="tab"
                aria-selected={viewTab === 'upcoming'}
                className={`flight-tab-btn ${viewTab === 'upcoming' ? 'active' : ''}`}
                onClick={() => handleTabChange('upcoming')}
              >
                Upcoming <span className="flight-tab-count">({counts.upcoming})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewTab === 'past'}
                className={`flight-tab-btn ${viewTab === 'past' ? 'active' : ''}`}
                onClick={() => handleTabChange('past')}
              >
                Past Flights <span className="flight-tab-count">({counts.past})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewTab === 'my_flights'}
                className={`flight-tab-btn ${viewTab === 'my_flights' ? 'active' : ''}`}
                onClick={() => handleTabChange('my_flights')}
              >
                My Flights <span className="flight-tab-count">({counts.mine})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewTab === 'all'}
                className={`flight-tab-btn ${viewTab === 'all' ? 'active' : ''}`}
                onClick={() => handleTabChange('all')}
              >
                All <span className="flight-tab-count">({counts.all})</span>
              </button>
            </div>

            <div className="flight-sort-wrapper">
              <label htmlFor="flight-sort" className="flight-sort-label">
                Sort by
              </label>
              <select
                id="flight-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="form-select flight-sort-select"
              >
                <option value="departure_asc">Departure (Soonest first)</option>
                <option value="departure_desc">Departure (Latest first)</option>
                <option value="price_asc">Price (Lowest first)</option>
                <option value="kgs_desc">Space (Most kg first)</option>
                <option value="created_desc">Recently posted</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading">Loading listings...</div>
          ) : displayedListings.length === 0 ? (
            <div className="empty-state">
              <Icons.Plane />
              <h3>
                {viewTab === 'past'
                  ? 'No past flight listings found'
                  : viewTab === 'my_flights'
                    ? 'No flights posted yet'
                    : viewTab === 'all'
                      ? 'No flight listings found'
                      : 'No upcoming flight listings found'}
              </h3>
              <p>
                {hasActiveFilters
                  ? 'Try adjusting your filters or clearing them to see more listings.'
                  : viewTab === 'past'
                    ? 'No historical flight listings have been recorded yet.'
                    : viewTab === 'my_flights'
                      ? "You haven't posted any flights yet."
                      : 'Be the first to post a flight listing!'}
              </p>
              {viewTab === 'upcoming' && counts.past > 0 && !hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => handleTabChange('past')}
                  className="btn btn-outline btn-sm"
                  style={{ marginTop: '0.5rem' }}
                >
                  View past flights ({counts.past})
                </button>
              )}
              {user && !hasActiveFilters && viewTab !== 'past' && (
                <button
                  type="button"
                  onClick={handleStartPosting}
                  className="btn btn-primary"
                  style={{ marginTop: '0.75rem' }}
                >
                  <Icons.Plus /> Post Your Flight
                </button>
              )}
            </div>
          ) : (
            <div className="flight-rows">
              {displayedListings.map((listing) => (
                <FlightListingCard
                  key={listing.id}
                  listing={listing}
                  canDelete={user?.id === listing.user_id}
                  onDelete={handleListingDeleted}
                  onEdit={handleEditListing}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          )}
        </>
      )}

      <SocialHandlesSetupModal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onSaved={handleSetupSaved}
      />
    </div>
  )
}
