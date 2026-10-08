// Shared profile/onboarding option lists. `current_status` values must stay in
// sync with the CHECK constraint on profiles.current_status (see
// supabase/schema_snapshot.sql).
import { countries } from 'countries-list'

// Canonical country names — one vocabulary for profile selects, the review
// wizard and flight-listing validation. Previously a hand-maintained list
// whose spellings had drifted from the countries-list names used by
// CountryAutocomplete ('Korea (South)' vs 'South Korea', 'Macau' vs 'Macao').
export const COUNTRIES: string[] = Object.values(countries)
  .map((c) => c.name)
  .filter((name, index, arr) => arr.indexOf(name) === index)
  .sort((a, b) => a.localeCompare(b))

// Spellings the previous hand-maintained list wrote into home_country and
// flight_listings — existing rows can still carry them, so reads, writes
// and filters all resolve through these aliases.
export const LEGACY_COUNTRY_NAMES: Record<string, string> = {
  'Cape Verde': 'Cabo Verde',
  Congo: 'Republic of the Congo',
  'Czech Republic': 'Czechia',
  'Korea (North)': 'North Korea',
  'Korea (South)': 'South Korea',
  Macau: 'Macao',
  'Timor-Leste': 'East Timor',
  Turkey: 'Türkiye',
}

const CANONICAL_LOWER = new Map(COUNTRIES.map((n) => [n.toLowerCase(), n]))

// Resolve any stored or typed value to the canonical countries-list
// spelling — exact, case-insensitive, or legacy. null when nothing matches.
export const canonicalCountryName = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (LEGACY_COUNTRY_NAMES[trimmed]) return LEGACY_COUNTRY_NAMES[trimmed]
  return CANONICAL_LOWER.get(trimmed.toLowerCase()) ?? null
}

// Strict check against the canonical list — legacy spellings count as valid
// (they're real stored data); use canonicalCountryName for the write value.
export const isCountryName = (value: unknown): value is string =>
  canonicalCountryName(value) !== null

export const LANGUAGES: string[] = [
  'Afrikaans',
  'Albanian',
  'Amharic',
  'Arabic',
  'Armenian',
  'Azerbaijani',
  'Basque',
  'Belarusian',
  'Bengali',
  'Bosnian',
  'Bulgarian',
  'Burmese',
  'Cantonese',
  'Catalan',
  'Cebuano',
  'Chichewa',
  'Croatian',
  'Czech',
  'Danish',
  'Dutch',
  'English',
  'Esperanto',
  'Estonian',
  'Filipino / Tagalog',
  'Finnish',
  'French',
  'Galician',
  'Georgian',
  'German',
  'Greek',
  'Gujarati',
  'Haitian Creole',
  'Hausa',
  'Hebrew',
  'Hindi',
  'Hungarian',
  'Icelandic',
  'Igbo',
  'Indonesian',
  'Irish',
  'Italian',
  'Japanese',
  'Javanese',
  'Kannada',
  'Kazakh',
  'Khmer',
  'Kinyarwanda',
  'Korean',
  'Kurdish',
  'Kyrgyz',
  'Lao',
  'Latin',
  'Latvian',
  'Lithuanian',
  'Macedonian',
  'Malagasy',
  'Malay',
  'Malayalam',
  'Maltese',
  'Mandarin Chinese',
  'Marathi',
  'Mongolian',
  'Nepali',
  'Norwegian',
  'Odia',
  'Pashto',
  'Persian / Farsi',
  'Polish',
  'Portuguese',
  'Punjabi',
  'Romanian',
  'Russian',
  'Serbian',
  'Shona',
  'Sindhi',
  'Sinhala',
  'Slovak',
  'Slovenian',
  'Somali',
  'Spanish',
  'Sundanese',
  'Swahili',
  'Swedish',
  'Tajik',
  'Tamil',
  'Tatar',
  'Telugu',
  'Thai',
  'Turkish',
  'Turkmen',
  'Ukrainian',
  'Urdu',
  'Uyghur',
  'Uzbek',
  'Vietnamese',
  'Welsh',
  'Wolof',
  'Xhosa',
  'Yiddish',
  'Yoruba',
  'Zulu',
]

export const CURRENT_STATUSES: { value: string; label: string }[] = [
  { value: 'studying', label: 'Studying' },
  { value: 'working', label: 'Working' },
  { value: 'internship', label: 'Doing an internship' },
  { value: 'job_hunting', label: 'Looking for work' },
  { value: 'break', label: 'Taking a break' },
  { value: 'other', label: 'Something else' },
]

// Review wizard cost buckets, ordered cheap → expensive. These strings are
// stored verbatim on reviews.tuition_range / reviews.living_cost_range, and
// the summary cost scale maps a stored value back to its index here.
export const TUITION_RANGES: string[] = [
  'Under ¥20k',
  '¥20k–¥40k',
  '¥40k–¥80k',
  '¥80k–¥150k',
  'Over ¥150k',
]

export const LIVING_COSTS: string[] = ['Under ¥2k', '¥2k–¥4k', '¥4k–¥8k', 'Over ¥8k']
