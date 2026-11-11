import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export interface UniversityIndexEntry {
  id: string
  name: string
  name_zh: string | null
  slug: string
  city: string | null
  province: string | null
}

// The whole university list (about 600 rows) is small and changes rarely, so
// it is fetched once per page load and searched in memory. The cache holds the
// in-flight promise (immutable once resolved); a failure clears it so the next
// keystroke or mount retries.
let indexPromise: Promise<UniversityIndexEntry[]> | null = null

export const loadUniversityIndex = (): Promise<UniversityIndexEntry[]> => {
  if (!indexPromise) {
    indexPromise = Promise.resolve(
      supabase
        .from('universities')
        .select('id, name, name_zh, slug, city, province')
        .order('name')
        .range(0, 1999)
    )
      .then(({ data, error }) => {
        if (error) throw error
        return ((data ?? []) as UniversityIndexEntry[]).filter((u) => u.name && u.slug)
      })
      .catch((err) => {
        indexPromise = null
        throw err
      })
  }
  return indexPromise
}

const norm = (s: string | null | undefined): string => (s ?? '').toLowerCase()

// Case-insensitive; every typed word must appear in the English name, Chinese
// name, city or province. Names that start with the query rank first.
export const searchUniversityIndex = (
  index: UniversityIndexEntry[],
  query: string,
  limit = 50
): UniversityIndexEntry[] => {
  const q = norm(query).trim()
  if (!q) return []
  const words = q.split(/\s+/)
  const matches: { u: UniversityIndexEntry; rank: number }[] = []
  for (const u of index) {
    const hay = `${norm(u.name)} ${norm(u.name_zh)} ${norm(u.city)} ${norm(u.province)}`
    if (!words.every((w) => hay.includes(w))) continue
    const name = norm(u.name)
    const rank = name.startsWith(q) || norm(u.name_zh).startsWith(q) ? 0 : name.includes(q) ? 1 : 2
    matches.push({ u, rank })
  }
  matches.sort((a, b) => a.rank - b.rank)
  return matches.slice(0, limit).map((m) => m.u)
}

// Warms the cache as soon as a search box mounts, so the first keystroke
// already has data.
export const useUniversityIndex = () => {
  const [universities, setUniversities] = useState<UniversityIndexEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    loadUniversityIndex()
      .then((rows) => {
        if (mounted) setUniversities(rows)
      })
      .catch((err) => {
        console.error('Error loading university list:', err)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  return { universities, loading }
}
