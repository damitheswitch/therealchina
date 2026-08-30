import { supabase } from '../lib/supabaseClient'
import { Autocomplete } from './Autocomplete'

const loadUniversities = async (query) => {
  const words = query.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  // AND across words: every typed word must appear in the combined name/city text.
  let dbQuery = supabase.from('universities').select('name, city, slug')
  words.forEach((w) => {
    dbQuery = dbQuery.ilike('search_text', `%${w}%`)
  })

  const { data, error } = await dbQuery.order('name').limit(50)

  if (error) throw error

  return (data || [])
    .filter((u) => u.name && u.slug)
    .map((u) => ({
      key: u.slug,
      value: u.name,
      label: `${u.name} — ${u.city}`,
      data: u,
    }))
}

export const UniversityAutocomplete = (props) => (
  <Autocomplete
    {...props}
    loadOptions={loadUniversities}
    renderOption={(option) => option.label}
  />
)
