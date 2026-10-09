import type { Tables } from '../types/database.types'

export type FlightListing = Tables<'flight_listings_with_profile'>
export type FlightViewTab = 'upcoming' | 'past' | 'my_flights' | 'all'
export type FlightSort =
  'departure_asc' | 'departure_desc' | 'price_asc' | 'kgs_desc' | 'created_desc'

export interface FlightCounts {
  upcoming: number
  past: number
  mine: number
  all: number
}

// Local calendar date (YYYY-MM-DD), unlike toISOString() which is UTC
export const todayLocal = (): string => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

// A listing is departed once its departure date is before today. Both sides
// are YYYY-MM-DD strings, so a plain string compare avoids timezone shifts.
export const hasDeparted = (
  listing: Pick<FlightListing, 'departure_date'>,
  today: string
): boolean => Boolean(listing.departure_date && listing.departure_date < today)

export const isOwn = (
  listing: Pick<FlightListing, 'user_id'>,
  userId: string | null | undefined
): boolean => Boolean(userId && listing.user_id === userId)

// Rows a tab is allowed to show. Inactive (is_active <> true) listings are
// owner-only: they never enter Upcoming/Past, and enter All only for the
// owner — matching what the flight_listings_with_profile view returns.
export const filterByTab = (
  listings: FlightListing[],
  viewTab: FlightViewTab,
  today: string,
  userId: string | null | undefined
): FlightListing[] => {
  if (viewTab === 'upcoming') {
    return listings.filter((l) => l.is_active === true && !hasDeparted(l, today))
  }
  if (viewTab === 'past') {
    return listings.filter((l) => l.is_active === true && hasDeparted(l, today))
  }
  if (viewTab === 'my_flights') {
    return listings.filter((l) => isOwn(l, userId))
  }
  return listings.filter((l) => l.is_active === true || isOwn(l, userId))
}

// Live per-tab counts over the same visibility rules as filterByTab.
export const flightCounts = (
  listings: FlightListing[],
  today: string,
  userId: string | null | undefined
): FlightCounts => {
  const counts: FlightCounts = { upcoming: 0, past: 0, mine: 0, all: 0 }
  for (const listing of listings) {
    const own = isOwn(listing, userId)
    if (own) counts.mine++
    if (listing.is_active === true) {
      if (hasDeparted(listing, today)) counts.past++
      else counts.upcoming++
      counts.all++
    } else if (own) {
      counts.all++
    }
  }
  return counts
}

// Contact picker helpers. flight_listings.contact_platforms stores which of
// the owner's profile platforms a listing exposes:
//   NULL      -> every profile handle (legacy rows and "select all")
//   []        -> no contact shown
//   ['wechat']-> handles on those platforms only

// Checkbox state for the form: a stored array is intersected with the
// platforms still on the profile; anything else (NULL, malformed) means all.
export const contactPlatformSelection = (
  stored: unknown,
  currentPlatforms: readonly string[]
): Set<string> => {
  const current = new Set(currentPlatforms)
  if (!Array.isArray(stored)) return current
  return new Set(stored.filter((p): p is string => typeof p === 'string' && current.has(p)))
}

// Value to persist: "all checked" collapses to NULL so the listing keeps
// following future profile handles; a real subset (including empty) stores
// as an explicit array.
export const contactPlatformsToStore = (
  selected: ReadonlySet<string> | null,
  allPlatforms: readonly string[]
): string[] | null => {
  if (!selected) return null
  const all = new Set(allPlatforms)
  const coversAll = selected.size === all.size && [...selected].every((p) => all.has(p))
  return coversAll ? null : [...selected]
}

// departedLast keeps actionable rows ahead of history in mixed tabs
// (All / My Flights) regardless of the chosen sort direction.
export const sortListings = (
  listings: FlightListing[],
  sortBy: FlightSort,
  departedLast: boolean,
  today: string
): FlightListing[] =>
  [...listings].sort((a, b) => {
    if (sortBy === 'departure_asc' || sortBy === 'departure_desc') {
      if (departedLast) {
        const aDeparted = hasDeparted(a, today)
        const bDeparted = hasDeparted(b, today)
        if (aDeparted !== bDeparted) return aDeparted ? 1 : -1
      }
      const cmp = (a.departure_date || '').localeCompare(b.departure_date || '')
      return sortBy === 'departure_asc' ? cmp : -cmp
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
