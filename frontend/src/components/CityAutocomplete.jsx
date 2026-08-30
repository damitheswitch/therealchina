import { supabase } from '../lib/supabaseClient'
import { Autocomplete } from './Autocomplete'

const loadCities = async (query) => {
  const { data, error } = await supabase
    .from('universities')
    .select('city')
    .ilike('city', `%${query}%`)
    .order('city')
    .limit(50)

  if (error) throw error

  const unique = [...new Set((data || []).map((u) => u.city))].sort()
  return unique.map((city) => ({ value: city, label: city, key: city }))
}

export const CityAutocomplete = (props) => (
  <Autocomplete
    {...props}
    allowNotListed
    notListedText="I can't find my city..."
    loadOptions={loadCities}
  />
)
