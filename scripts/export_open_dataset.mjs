#!/usr/bin/env node
// export_open_dataset.mjs — dump the merged universities dataset from the
// local Supabase REST API into ../china-universities-dataset/data/ as
// universities.{json,csv,sql} for the public repo.
//
//   node scripts/export_open_dataset.mjs [target-dir]

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(
  readFileSync(join(ROOT, 'frontend/.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
)
const OUT_DIR = resolve(
  process.argv[2] ?? join(ROOT, '..', 'china-universities-dataset', 'data')
)
const RANK_YEAR = 2026

const url = new URL(`${env.VITE_SUPABASE_URL}/rest/v1/universities`)
url.searchParams.set(
  'select',
  'slug,slug_aliases,name,name_zh,city,province,country,uni_category,uni_type,languages_of_instruction,website,logo_url,rankings'
)
url.searchParams.set('limit', '2000')

const res = await fetch(url, { headers: { apikey: env.VITE_SUPABASE_ANON_KEY } })
if (!res.ok) throw new Error(`REST ${res.status}: ${await res.text()}`)
const rows = await res.json()
// rank is stored in jsonb — sort numerically client-side (text order would
// give 1, 10, 100, 2…)
rows.sort((a, b) => {
  const ra = a.rankings?.shanghai_national ?? Infinity
  const rb = b.rankings?.shanghai_national ?? Infinity
  return ra - rb || a.name.localeCompare(b.name)
})
console.log(`fetched ${rows.length} rows`)

const records = rows.map((r) => {
  const rk = r.rankings && typeof r.rankings === 'object' ? r.rankings : {}
  return {
    slug: r.slug,
    name: r.name,
    name_zh: r.name_zh,
    city: r.city,
    province: r.province,
    country: r.country,
    category: r.uni_category,
    uni_type: r.uni_type,
    languages_of_instruction: r.languages_of_instruction ?? [],
    website: r.website,
    logo_url: r.logo_url,
    slug_aliases: r.slug_aliases ?? [],
    shanghairanking: {
      year: RANK_YEAR,
      national_rank: rk.shanghai_national ?? null,
      score: rk.shanghai_score ?? null,
      url: rk.shanghai_url ?? null,
      tags: rk.shanghai_tags ?? [],
      ...(rk.shanghai_indicators ? { indicators: rk.shanghai_indicators } : {}),
    },
  }
})

// ---------- JSON ----------
writeFileSync(join(OUT_DIR, 'universities.json'), JSON.stringify(records, null, 2) + '\n')

// ---------- CSV ----------
const csvEsc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
const csvCols = [
  'slug', 'name', 'name_zh', 'city', 'province', 'country', 'category',
  'uni_type', 'languages_of_instruction', 'website',
  'national_rank', 'score', 'tags', 'institution_url', 'logo_url', 'slug_aliases',
]
const csv = [
  csvCols.join(','),
  ...records.map((r) =>
    [
      r.slug, r.name, r.name_zh, r.city, r.province, r.country, r.category,
      r.uni_type, r.languages_of_instruction.join(';'), r.website,
      r.shanghairanking.national_rank, r.shanghairanking.score,
      r.shanghairanking.tags.join(';'), r.shanghairanking.url,
      r.logo_url, r.slug_aliases.join(';'),
    ]
      .map(csvEsc)
      .join(',')
  ),
].join('\n')
writeFileSync(join(OUT_DIR, 'universities.csv'), csv + '\n')

// ---------- SQL ----------
const s = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
const arr = (a) => (a?.length ? `'{${a.map((x) => `"${x.replace(/"/g, '\\"')}"`).join(',')}}'` : "'{}'")
const sql = [
  `-- China Universities Dataset — ${records.length} rows`,
  `-- Rankings: ShanghaiRanking 软科中国大学排名 ${RANK_YEAR} · generated ${new Date().toISOString().slice(0, 10)}`,
  ``,
  `CREATE TABLE IF NOT EXISTS china_universities (`,
  `  slug TEXT PRIMARY KEY,`,
  `  name TEXT NOT NULL,`,
  `  name_zh TEXT,`,
  `  city TEXT,`,
  `  province TEXT,`,
  `  country TEXT,`,
  `  category TEXT,`,
  `  uni_type TEXT,`,
  `  languages_of_instruction TEXT[] NOT NULL DEFAULT '{}',`,
  `  website TEXT,`,
  `  national_rank INTEGER,`,
  `  score NUMERIC(6,1),`,
  `  tags TEXT[] NOT NULL DEFAULT '{}',`,
  `  institution_url TEXT,`,
  `  logo_url TEXT,`,
  `  slug_aliases TEXT[] NOT NULL DEFAULT '{}'`,
  `);`,
  ``,
  ...records.map(
    (r) =>
      `INSERT INTO china_universities (slug, name, name_zh, city, province, country, category, uni_type, languages_of_instruction, website, national_rank, score, tags, institution_url, logo_url, slug_aliases)\n` +
      `VALUES (${s(r.slug)}, ${s(r.name)}, ${s(r.name_zh)}, ${s(r.city)}, ${s(r.province)}, ${s(r.country)}, ${s(r.category)}, ${s(r.uni_type)}, ${arr(r.languages_of_instruction)}, ${s(r.website)}, ${r.shanghairanking.national_rank ?? 'NULL'}, ${r.shanghairanking.score ?? 'NULL'}, ${arr(r.shanghairanking.tags)}, ${s(r.shanghairanking.url)}, ${s(r.logo_url)}, ${arr(r.slug_aliases)})\n` +
      `ON CONFLICT (slug) DO NOTHING;`
  ),
].join('\n')
writeFileSync(join(OUT_DIR, 'universities.sql'), sql + '\n')

const ranked = records.filter((r) => r.shanghairanking.national_rank != null).length
console.log(`wrote ${OUT_DIR}: ${records.length} rows (${ranked} ranked)`)
