#!/usr/bin/env node
// diff_live_vs_merged.mjs — compare the raw seed files (= what's deployed)
// against the merged dataset currently in the LOCAL database.
//
//   node scripts/diff_live_vs_merged.mjs

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSeedRows } from './lib/shanghairanking.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(
  readFileSync(join(ROOT, 'frontend/.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
)

const ours = parseSeedRows(ROOT)
const res = await fetch(
  `${env.VITE_SUPABASE_URL}/rest/v1/universities?select=slug,name,name_zh,city,country,province,uni_category,logo_url,rankings,slug_aliases&limit=2000`,
  { headers: { apikey: env.VITE_SUPABASE_ANON_KEY } }
)
if (!res.ok) throw new Error(await res.text())
const merged = await res.json()
const mm = new Map(merged.map((u) => [u.slug, u]))
const rawSlugs = new Set(ours.map((u) => u.slug))

console.log(`live seeds: ${ours.length} rows (${rawSlugs.size} distinct slugs) | merged local: ${merged.length}`)

// live-side duplicates removed by merge
const zh = new Map()
const dupes = []
for (const r of ours) {
  const p = zh.get(r.nameZh)
  if (p && p.slug !== r.slug) dupes.push(`${p.slug} ↔ ${r.slug}`)
  zh.set(r.nameZh, r)
}
console.log(`dupe slugs collapsed: ${dupes.join(', ') || 'none'}`)

const diffs = { name: [], name_zh: [], city: [], logo_url: [] }
let unchanged = 0,
  missing = 0
for (const raw of ours) {
  const m = mm.get(raw.slug)
  if (!m) {
    missing++
    continue
  }
  if (m.name === raw.name && m.name_zh === raw.nameZh && m.city === raw.city && m.logo_url === raw.logoUrl) {
    unchanged++
    continue
  }
  if (m.name !== raw.name) diffs.name.push([raw.slug, raw.name, m.name])
  if (m.name_zh !== raw.nameZh) diffs.name_zh.push([raw.slug, raw.nameZh, m.name_zh])
  if (m.city !== raw.city) diffs.city.push([raw.slug, raw.city, m.city])
  if (m.logo_url !== raw.logoUrl) diffs.logo_url.push([raw.slug, raw.logoUrl, m.logo_url])
}
console.log(`unchanged rows: ${unchanged} | seed rows whose slug is gone: ${missing}`)
for (const [f, list] of Object.entries(diffs)) {
  console.log(`\n== ${f}: ${list.length}`)
  list.slice(0, 10).forEach((d) => console.log(`   ${d[0]}: ${String(d[1]).slice(0, 60)} → ${String(d[2]).slice(0, 60)}`))
  if (list.length > 10) console.log(`   … +${list.length - 10} more`)
}

const has = (fn) => merged.filter(fn).length
console.log(`\nmerged-only fields coverage:`)
console.log(`  national rank: ${has((u) => u.rankings?.shanghai_national)}`)
console.log(`  score:         ${has((u) => u.rankings?.shanghai_score)}`)
console.log(`  tags:          ${has((u) => u.rankings?.shanghai_tags)}`)
console.log(`  indicators:    ${has((u) => u.rankings?.shanghai_indicators)}`)
console.log(`  institution:   ${has((u) => u.rankings?.shanghai_url)}`)
console.log(`  province:      ${has((u) => u.province)}`)
console.log(`  category:      ${has((u) => u.uni_category)}`)
console.log(`  slug_aliases:  ${has((u) => u.slug_aliases?.length)}`)
console.log(`  country:       ${has((u) => u.country)}`)
