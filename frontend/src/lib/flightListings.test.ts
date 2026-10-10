import { describe, it, expect } from 'vitest'
import {
  contactPlatformsToStore,
  contactPlatformSelection,
  filterByTab,
  flightCounts,
  hasDeparted,
  isOwn,
  sortListings,
  type FlightListing,
} from './flightListings'

const TODAY = '2026-09-27'

// Minimal listing factory — only the fields the helpers read
const l = (
  id: string,
  user_id: string,
  departure_date: string | null,
  is_active: boolean | null = true,
  extra: Partial<FlightListing> = {}
) =>
  ({
    id,
    user_id,
    departure_date,
    is_active,
    ...extra,
  }) as FlightListing

const ME = 'u1'
const OTHER = 'u2'

const mixed = [
  l('upcoming-mine', ME, '2026-10-01'),
  l('upcoming-other', OTHER, '2026-10-05'),
  l('past-other', OTHER, '2026-09-01'),
  l('closed-mine', ME, '2026-10-03', false),
  l('closed-other', OTHER, '2026-10-02', false),
]

describe('hasDeparted', () => {
  it('is true only when departure_date is strictly before today', () => {
    expect(hasDeparted(l('x', OTHER, '2026-09-26'), TODAY)).toBe(true)
    expect(hasDeparted(l('x', OTHER, '2026-09-27'), TODAY)).toBe(false)
    expect(hasDeparted(l('x', OTHER, '2026-09-28'), TODAY)).toBe(false)
    expect(hasDeparted(l('x', OTHER, null), TODAY)).toBe(false)
  })
})

describe('isOwn', () => {
  it('matches only the given user id', () => {
    expect(isOwn(l('x', ME, null), ME)).toBe(true)
    expect(isOwn(l('x', OTHER, null), ME)).toBe(false)
    expect(isOwn(l('x', ME, null), null)).toBe(false)
  })
})

describe('filterByTab', () => {
  it('upcoming keeps active non-departed rows only', () => {
    expect(filterByTab(mixed, 'upcoming', TODAY, ME).map((x) => x.id)).toEqual([
      'upcoming-mine',
      'upcoming-other',
    ])
  })

  it('past keeps active departed rows only', () => {
    expect(filterByTab(mixed, 'past', TODAY, ME).map((x) => x.id)).toEqual(['past-other'])
  })

  it('my_flights keeps every own row including closed and departed', () => {
    expect(filterByTab(mixed, 'my_flights', TODAY, ME).map((x) => x.id)).toEqual([
      'upcoming-mine',
      'closed-mine',
    ])
  })

  it('all keeps public active rows plus the viewer’s own closed ones', () => {
    expect(filterByTab(mixed, 'all', TODAY, ME).map((x) => x.id)).toEqual([
      'upcoming-mine',
      'upcoming-other',
      'past-other',
      'closed-mine',
    ])
    // someone else's closed listing is never visible
    expect(filterByTab(mixed, 'all', TODAY, OTHER).map((x) => x.id)).toEqual([
      'upcoming-mine',
      'upcoming-other',
      'past-other',
      'closed-other',
    ])
  })

  it('treats is_active=null as not publicly listed (matches the view)', () => {
    const rows = [l('null-active', OTHER, '2026-10-01', null)]
    expect(filterByTab(rows, 'upcoming', TODAY, OTHER)).toEqual([])
    expect(filterByTab(rows, 'all', TODAY, OTHER).map((x) => x.id)).toEqual(['null-active'])
  })
})

describe('flightCounts', () => {
  it('counts match the same visibility rules as the tabs', () => {
    expect(flightCounts(mixed, TODAY, ME)).toEqual({
      upcoming: 2,
      past: 1,
      mine: 2,
      all: 4,
    })
  })
})

describe('sortListings', () => {
  it('departure_asc sorts soonest first', () => {
    const rows = [l('b', OTHER, '2026-11-01'), l('a', OTHER, '2026-10-01')]
    expect(sortListings(rows, 'departure_asc', false, TODAY).map((x) => x.id)).toEqual(['a', 'b'])
    expect(sortListings(rows, 'departure_desc', false, TODAY).map((x) => x.id)).toEqual(['b', 'a'])
  })

  it('departedLast pushes departed rows to the end for both departure directions', () => {
    const rows = [
      l('old', OTHER, '2026-01-01'),
      l('soon', OTHER, '2026-10-01'),
      l('later', OTHER, '2026-11-01'),
    ]
    expect(sortListings(rows, 'departure_asc', true, TODAY).map((x) => x.id)).toEqual([
      'soon',
      'later',
      'old',
    ])
    expect(sortListings(rows, 'departure_desc', true, TODAY).map((x) => x.id)).toEqual([
      'later',
      'soon',
      'old',
    ])
  })

  it('price_asc and kgs_desc order by the numeric fields', () => {
    const rows = [
      l('cheap', OTHER, null, true, { price_per_kg: 10, available_kgs: 1 }),
      l('pricey', OTHER, null, true, { price_per_kg: 99, available_kgs: 20 }),
    ]
    expect(sortListings(rows, 'price_asc', false, TODAY).map((x) => x.id)).toEqual([
      'cheap',
      'pricey',
    ])
    expect(sortListings(rows, 'kgs_desc', false, TODAY).map((x) => x.id)).toEqual([
      'pricey',
      'cheap',
    ])
  })

  it('created_desc sorts newest post first', () => {
    const rows = [
      l('old', OTHER, null, true, { created_at: '2026-01-01T00:00:00Z' }),
      l('new', OTHER, null, true, { created_at: '2026-09-01T00:00:00Z' }),
    ]
    expect(sortListings(rows, 'created_desc', false, TODAY).map((x) => x.id)).toEqual([
      'new',
      'old',
    ])
  })

  it('does not mutate the input array', () => {
    const rows = [l('b', OTHER, '2026-11-01'), l('a', OTHER, '2026-10-01')]
    sortListings(rows, 'departure_asc', false, TODAY)
    expect(rows.map((x) => x.id)).toEqual(['b', 'a'])
  })
})

describe('contactPlatformSelection', () => {
  const current = ['wechat', 'whatsapp']

  it('defaults to every current platform when nothing is stored', () => {
    expect(contactPlatformSelection(null, current)).toEqual(new Set(current))
    expect(contactPlatformSelection(undefined, current)).toEqual(new Set(current))
  })

  it('keeps only stored platforms that still exist on the profile', () => {
    expect(contactPlatformSelection(['wechat', 'instagram'], current)).toEqual(new Set(['wechat']))
  })

  it('returns an empty set for a stored empty selection', () => {
    expect(contactPlatformSelection([], current)).toEqual(new Set())
  })
})

describe('contactPlatformsToStore', () => {
  const all = ['wechat', 'whatsapp']

  it('stores NULL when every platform is checked, in any order', () => {
    expect(contactPlatformsToStore(new Set(['whatsapp', 'wechat']), all)).toBeNull()
  })

  it('stores a subset as an explicit array', () => {
    expect(contactPlatformsToStore(new Set(['wechat']), all)).toEqual(['wechat'])
  })

  it('stores an empty selection as an empty array (contact hidden)', () => {
    expect(contactPlatformsToStore(new Set(), all)).toEqual([])
  })

  it('passes NULL through untouched (failed picker load never rewrites)', () => {
    expect(contactPlatformsToStore(null, all)).toBeNull()
  })
})
