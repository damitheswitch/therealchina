import { countries } from 'countries-list'
import { Autocomplete } from './Autocomplete'
import { COUNTRIES as COUNTRY_NAMES, LEGACY_COUNTRY_NAMES } from '../lib/constants'

// Legacy spellings by canonical name — added to each entry's haystack so
// stored values and old spellings ("Turkey", "Korea (South)") still match.
const LEGACY_BY_CANONICAL = {}
for (const [legacy, canonical] of Object.entries(LEGACY_COUNTRY_NAMES)) {
  ;(LEGACY_BY_CANONICAL[canonical] ??= []).push(legacy)
}

// Searchable haystack per country: English name, native name, aliases
// (e.g. "USA", "America") and legacy spellings, so users can find a
// country by any of them
const COUNTRY_ENTRIES = Object.values(countries).map((c) => ({
  name: c.name,
  words: [c.name, c.native, ...(c.alias || []), ...(LEGACY_BY_CANONICAL[c.name] || [])]
    .join(' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean),
}))

const matchesQuery = (entry, query) => {
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!queryWords.length) return false
  return queryWords.every((qw) => entry.words.some((nw) => nw.startsWith(qw)))
}

const loadCountryOptions = (query) =>
  COUNTRY_ENTRIES.filter((e) => matchesQuery(e, query)).map((e) => ({
    key: e.name,
    value: e.name,
    label: e.name,
  }))

// Resolve what the user typed into a canonical country name, or clear it:
// a case-insensitive name hit or an unambiguous entry match (alias, native
// or legacy spelling) is rewritten to the canonical spelling, anything else
// is dropped (strict input — no free-form countries).
const commitTypedText = (typed, onChange) => {
  const t = (typed ?? '').trim()
  if (!t || COUNTRY_NAMES.includes(t)) return
  const canonical = COUNTRY_NAMES.find((name) => name.toLowerCase() === t.toLowerCase())
  if (canonical) {
    onChange(canonical)
    return
  }
  const hits = COUNTRY_ENTRIES.filter((e) => matchesQuery(e, t))
  onChange(hits.length === 1 ? hits[0].name : '')
}

// Strict country input built on the shared Autocomplete machinery: values
// must come from the canonical list. Typing filters suggestions; on blur or
// Enter an unambiguous case-insensitive match is canonicalized and anything
// else is cleared.
export const CountryAutocomplete = ({ id, value, onChange, placeholder }) => (
  <Autocomplete
    id={id}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    loadOptions={loadCountryOptions}
    maxSuggestions={8}
    debounceMs={0}
    selectSingleOnEnter
    onCommitText={(typed) => commitTypedText(typed, onChange)}
  />
)
