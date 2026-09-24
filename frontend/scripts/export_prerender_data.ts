// export_prerender_data.ts — pulls the public dataset the prerenderer needs
// into frontend/.prerender-data/*.json. Runs once per build, so pages are
// rendered from identical data without 500+ individual queries.
//
//   vite-node scripts/export_prerender_data.ts
//
// Credentials: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY from env or
// .env.local — the anon key is enough (all these tables are publicly readable).
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { buildEnv } from './lib/env'

const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = resolve(FRONTEND, '.prerender-data')
const PAGE = 1000

const env = buildEnv(FRONTEND)

// CI fixture mode: build from the committed dataset — no Supabase needed.
if (env.TRC_EXPORT_FIXTURE === '1') {
  const { copyFileSync, readdirSync } = await import('node:fs')
  const FIXTURES = resolve(FRONTEND, 'scripts/fixtures/prerender-data')
  mkdirSync(OUT_DIR, { recursive: true })
  for (const f of readdirSync(FIXTURES)) {
    copyFileSync(resolve(FIXTURES, f), resolve(OUT_DIR, f))
  }
  console.log(`fixture export → ${OUT_DIR} (${readdirSync(FIXTURES).join(', ')})`)
  process.exit(0)
}

const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing (env or .env.local)')
  process.exit(1)
}
const supabase = createClient(url, key)

const UNI_COLS =
  'id, name, name_zh, city, country, province, uni_category, slug, slug_aliases, logo_url, is_verified, uni_type, languages_of_instruction, website, rankings, created_at'
const REVIEW_COLS =
  'id, university_id, user_id, rating, text, program, degree_level, media, created_at, enrollment_status, start_year, end_year, language_of_instruction, tuition_range, living_cost_range, funding_type, funding_coverage, recommend, pros, cons, tags, rating_academics, rating_campus, rating_accommodation, rating_cost, rating_intl_office, rating_social, rating_extracurricular, rating_career'

const fetchAll = async (table: string, columns: string): Promise<unknown[]> => {
  const rows: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

const universities = await fetchAll('universities', UNI_COLS)
const stats = await fetchAll(
  'university_stats',
  'university_id, avg_rating, review_count, has_verified_review, recommend_yes_count, recommend_maybe_count, recommend_no_count, updated_at'
)
const reviews = await fetchAll('reviews', REVIEW_COLS)
const authors = await fetchAll('profile_public', 'id, display_name, avatar_url')
// review_id only — voter identity never enters the public payload.
const upvotes = await fetchAll('upvotes', 'review_id')

mkdirSync(OUT_DIR, { recursive: true })
for (const [name, rows] of Object.entries({ universities, stats, reviews, authors, upvotes })) {
  writeFileSync(resolve(OUT_DIR, `${name}.json`), JSON.stringify(rows))
}
console.log(
  `exported ${universities.length} universities, ${stats.length} stats, ${reviews.length} reviews, ${authors.length} author profiles, ${upvotes.length} upvotes → ${OUT_DIR}`
)
