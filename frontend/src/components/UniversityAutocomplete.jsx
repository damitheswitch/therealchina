import {
  loadUniversityIndex,
  searchUniversityIndex,
  useUniversityIndex,
} from '../hooks/useUniversityIndex'
import { Autocomplete } from './Autocomplete'

// Searches the cached full university list in memory (see useUniversityIndex),
// so suggestions appear without a network round trip per keystroke.
const loadUniversities = async (query) => {
  const index = await loadUniversityIndex()
  return searchUniversityIndex(index, query)
    .filter((u) => u.name && u.slug)
    .map((u) => ({
      key: u.slug,
      value: u.name,
      label: [u.name, u.city || u.province].filter(Boolean).join(', '),
      data: u,
    }))
}

export const UniversityAutocomplete = (props) => {
  // Start fetching the list as soon as the field mounts.
  useUniversityIndex()
  return (
    <Autocomplete
      debounceMs={0}
      notListedText="I can't find my university"
      {...props}
      loadOptions={loadUniversities}
      renderOption={(option) => option.label}
    />
  )
}
