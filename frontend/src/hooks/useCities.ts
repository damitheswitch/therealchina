import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePrerenderData } from '../lib/prerenderData'
import type { Tables } from '../types/database.types'

export interface CityGroup {
  province: string | null
  cities: string[]
}

export const useCities = () => {
  const pd = usePrerenderData<{ cities: string[]; groups: CityGroup[] }>('cities')
  const [cities, setCities] = useState<string[]>(pd?.cities ?? [])
  const [groups, setGroups] = useState<CityGroup[]>(pd?.groups ?? [])
  const [loading, setLoading] = useState<boolean>(!pd)

  useEffect(() => {
    if (pd) {
      setCities(pd.cities)
      setGroups(pd.groups)
      setLoading(false)
      return
    }
    const controller = new AbortController()

    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('universities')
          .select('city, province')
          .abortSignal(controller.signal)

        if (error) throw error
        const rows = (data || []) as Array<Pick<Tables<'universities'>, 'city' | 'province'>>
        setCities([...new Set(rows.map((u) => u.city))].sort())

        // province → sorted city list; municipalities collapse to the city
        const byProv = new Map<string | null, Set<string>>()
        for (const r of rows) {
          const prov = r.province && r.province !== r.city ? r.province : null
          if (!byProv.has(prov)) byProv.set(prov, new Set())
          byProv.get(prov)!.add(r.city)
        }
        setGroups(
          [...byProv.entries()]
            .map(([province, set]) => ({ province, cities: [...set].sort() }))
            .sort((a, b) => (a.province ?? '').localeCompare(b.province ?? ''))
        )
      } catch (err) {
        const e = err as Error
        if (e?.name === 'AbortError') return
        console.error('Error fetching cities:', e)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    run()
    return () => controller.abort()
  }, [pd])

  return { cities, groups, loading }
}
