#!/usr/bin/env node
// mirror_logos.mjs — download every ShanghaiRanking logo referenced by the
// seed files into frontend/public/logos/, so the site serves first-party
// /logos/<id>.<ext> instead of hotlinking shanghairanking.cn.
//
//   node scripts/mirror_logos.mjs
//
// Idempotent: existing files are skipped. Source of truth for which ids to
// fetch: the SR logo URLs in supabase/seed.sql, supabase/seed_universities.sql
// and supabase/seed_merge.sql.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HEADERS } from './lib/shanghairanking.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = resolve(ROOT, 'frontend/public/logos')
const SEED_FILES = [
  'supabase/seed.sql',
  'supabase/seed_universities.sql',
  'supabase/seed_merge.sql',
]
const LOGO_RE = /https:\/\/www\.shanghairanking\.cn\/_uni\/logo(?:-jpg)?\/(\d+)\.(png|jpg)/g
const DELAY_MS = 250

const urls = new Map() // url -> {id, ext}
for (const f of SEED_FILES) {
  const src = readFileSync(resolve(ROOT, f), 'utf8')
  for (const m of src.matchAll(LOGO_RE)) urls.set(m[0], { id: m[1], ext: m[2] })
}
console.log(`found ${urls.size} unique logo URLs in seed files`)

mkdirSync(OUT_DIR, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const REFERER = 'https://www.shanghairanking.cn/rankings/bcur/2026'

async function download(url, dest) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Logo endpoints are Referer-gated (same as the Nuxt payload).
      const res = await fetch(url, { headers: { ...HEADERS, referer: REFERER } })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 200) throw new Error(`suspiciously small (${buf.length}B)`)
      writeFileSync(dest, buf)
      return buf.length
    } catch (err) {
      if (attempt === 2) throw err
      await sleep(1000 * (attempt + 1))
    }
  }
}

let done = 0
let skipped = 0
let failed = 0
const big = []
for (const [url, { id, ext }] of urls) {
  const dest = resolve(OUT_DIR, `${id}.${ext}`)
  if (existsSync(dest) && statSync(dest).size > 0) {
    skipped++
    continue
  }
  try {
    const bytes = await download(url, dest)
    done++
    if (bytes > 150 * 1024) big.push(`${id}.${ext} ${Math.round(bytes / 1024)}KB`)
    if (done % 50 === 0) console.log(`  ${done} downloaded...`)
  } catch (err) {
    failed++
    console.error(`FAILED ${url}: ${err.message}`)
  }
  await sleep(DELAY_MS)
}

console.log(`done: ${done} downloaded, ${skipped} already present, ${failed} failed`)
if (big.length) console.log('over 150KB:\n  ' + big.join('\n  '))
