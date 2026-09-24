#!/usr/bin/env node
// audit_university_merge.mjs — dry-run merge check between our seeded
// universities and the ShanghaiRanking (软科) national list. Reports every
// field-level conflict so we can decide per-field which source wins.
// Pure analysis: writes nothing.
//
//   node scripts/audit_university_merge.mjs [--year 2026]

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const YEAR = process.argv.includes('--year')
  ? process.argv[process.argv.indexOf('--year') + 1]
  : '2026'
const BASE = 'https://www.shanghairanking.cn'
const LIST_URL = `${BASE}/rankings/bcur/${YEAR}`
const HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'accept-language': 'zh-CN,zh;q=0.9',
}

async function fetchText(url, referer) {
  const res = await fetch(url, { headers: referer ? { ...HEADERS, referer } : HEADERS })
  if (!res.ok) throw new Error(`${res.status} — ${url}`)
  return res.text()
}

const html = await fetchText(LIST_URL)
const payloadPath = html.match(/(\/_nuxt\/static\/[^"]+\/payload\.js)/)?.[1]
const payloadSrc = await fetchText(`${BASE}${payloadPath}`, LIST_URL)
let captured
const __NUXT_JSONP__ = (_p, d) => (captured = d)
eval(payloadSrc) // eslint-disable-line no-eval
const theirs = captured.data[0].univData

// our seed rows — extract each parenthesized VALUES tuple, then all
// single-quoted fields inside it. Column order differs per file:
//   seed_universities.sql: (name, name_zh, city, slug, logo_url, is_verified)
//   seed.sql:              (name, name_zh, city, country, slug, logo_url, is_verified, ...)
const fieldRe = /'((?:[^'\\]|\\.|'')*)'/g
const unescape = (s) => s.replace(/''/g, "'").replace(/\\'/g, "'")
const ours = []
for (const [file, slugIx, logoIx] of [
  ['supabase/seed_universities.sql', 3, 4],
  ['supabase/seed.sql', 4, 5],
]) {
  const sql = readFileSync(join(ROOT, file), 'utf8')
  for (const stmt of sql.split(/;(?=\s*(?:--|INSERT|$))/g)) {
    if (!/INSERT INTO universities/i.test(stmt)) continue
    for (const tuple of stmt.matchAll(/\(([^()]*)\)/g)) {
      const fields = [...tuple[1].matchAll(fieldRe)].map((f) => unescape(f[1]))
      if (fields.length <= Math.max(slugIx, logoIx)) continue
      ours.push({
        file,
        name: fields[0],
        nameZh: fields[1],
        city: fields[2],
        slug: fields[slugIx],
        logoUrl: fields[logoIx],
        logoId: /logo(?:-jpg)?\/(\d+)\.(?:png|jpg)/.exec(fields[logoIx])?.[1] ?? null,
      })
    }
  }
}

const norm = (s) =>
  s
    .toLowerCase()
    .replace(/[\s'.,()\-–—]+/g, ' ')
    .trim()
const byLogo = new Map(),
  byZh = new Map(),
  byEn = new Map()
for (const r of ours) {
  if (r.logoId) byLogo.set(r.logoId, r)
  byZh.set(r.nameZh, r)
  byEn.set(norm(r.name), r)
}

// expected province for a city — municipalities + capitals + major uni
// cities; cities not listed are skipped, not flagged.
const CITY_PROVINCE = {
  Beijing: '北京', Shanghai: '上海', Tianjin: '天津', Chongqing: '重庆',
  Guangzhou: '广东', Shenzhen: '广东', Hangzhou: '浙江', Nanjing: '江苏',
  Wuhan: '湖北', Chengdu: '四川', "Xi'an": '陕西', Xian: '陕西',
  Changsha: '湖南', Harbin: '黑龙江', Shenyang: '辽宁', Dalian: '辽宁',
  Changchun: '吉林', Jinan: '山东', Qingdao: '山东', Xiamen: '福建',
  Fuzhou: '福建', Hefei: '安徽', Zhengzhou: '河南', Nanchang: '江西',
  Kunming: '云南', Guiyang: '贵州', Lanzhou: '甘肃', Taiyuan: '山西',
  Shijiazhuang: '河北', Urumqi: '新疆', Hohhot: '内蒙古', Nanning: '广西',
  Haikou: '海南', Yinchuan: '宁夏', Xining: '青海', Lhasa: '西藏',
  Suzhou: '江苏', Wuxi: '江苏', Xuzhou: '江苏', Changzhou: '江苏',
  Ningbo: '浙江', Wenzhou: '浙江', Luoyang: '河南', Qinhuangdao: '河北',
  Baoding: '河北', Tangshan: '河北', Guilin: '广西', Liuzhou: '广西',
  Quanzhou: '福建', Dongguan: '广东', Foshan: '广东', Zhuhai: '广东',
  Jilin: '吉林', Yantai: '山东', Weifang: '山东', Zibo: '山东',
  Mianyang: '四川', Yichang: '湖北', Xiangyang: '湖北', Wuhu: '安徽',
  Ganzhou: '江西', Jiujiang: '江西', Zunyi: '贵州', Dali: '云南',
  Qujing: '云南', Baoji: '陕西', Xianyang: '陕西', Tianshui: '甘肃',
}

const conflicts = { nameEn: [], nameZh: [], logo: [], province: [], internalDupes: [] }
const seenLogo = new Map()
const matchedOurs = new Set()
const matchedTheirs = new Set()

for (const u of theirs) {
  const logoId = /logo\/(\d+)\.png/.exec(u.univLogo ?? '')?.[1]
  const hit = (logoId && byLogo.get(logoId)) || byZh.get(u.univNameCn) || byEn.get(norm(u.univNameEn))
  if (!hit) continue
  matchedOurs.add(hit)
  matchedTheirs.add(u.univNameCn)
  const via =
    logoId && byLogo.get(logoId) === hit
      ? 'logo'
      : byZh.get(u.univNameCn) === hit
        ? 'name_zh'
        : 'name_en'

  if (norm(hit.name) !== norm(u.univNameEn)) {
    conflicts.nameEn.push({ slug: hit.slug, ours: hit.name, theirs: u.univNameEn, via })
  }
  if (hit.nameZh !== u.univNameCn) {
    conflicts.nameZh.push({ slug: hit.slug, ours: hit.nameZh, theirs: u.univNameCn, via })
  }
  if (hit.logoId && logoId && hit.logoId !== logoId) {
    conflicts.logo.push({ slug: hit.slug, ours: hit.logoId, theirs: logoId, via })
  }
  const expect = CITY_PROVINCE[hit.city]
  if (expect && expect !== u.province) {
    conflicts.province.push({ slug: hit.slug, city: hit.city, ourProv: expect, theirProv: u.province })
  }
}

// internal dupes: same school under two of our slugs (logo id or name_zh)
for (const r of ours) {
  if (r.logoId) {
    const prev = seenLogo.get(r.logoId)
    if (prev && prev.slug !== r.slug) {
      conflicts.internalDupes.push({ a: prev.slug, b: r.slug, via: `logo ${r.logoId}` })
    }
    seenLogo.set(r.logoId, r)
  }
}
const zhSeen = new Map()
for (const r of ours) {
  const prev = zhSeen.get(r.nameZh)
  if (prev && prev.slug !== r.slug) {
    conflicts.internalDupes.push({ a: prev.slug, b: r.slug, via: `name_zh ${r.nameZh}` })
  }
  zhSeen.set(r.nameZh, r)
}

const ourUnmatched = [...ours].filter((r) => !matchedOurs.has(r))
const theirUnmatched = theirs.filter((u) => !matchedTheirs.has(u.univNameCn))

console.log(`\n===== MERGE AUDIT (${YEAR} 软科) =====`)
console.log(`ours: ${ours.length} rows · theirs: ${theirs.length} · matched: ${matchedOurs.size}`)
console.log(`\n--- CONFLICTS ---`)
console.log(`name differs (en): ${conflicts.nameEn.length}`)
conflicts.nameEn.slice(0, 15).forEach((c) => console.log(`   ${c.slug}: "${c.ours}" ≠ "${c.theirs}" [${c.via}]`))
if (conflicts.nameEn.length > 15) console.log(`   … +${conflicts.nameEn.length - 15} more`)
console.log(`name differs (zh): ${conflicts.nameZh.length}`)
conflicts.nameZh.slice(0, 15).forEach((c) => console.log(`   ${c.slug}: "${c.ours}" ≠ "${c.theirs}" [${c.via}]`))
if (conflicts.nameZh.length > 15) console.log(`   … +${conflicts.nameZh.length - 15} more`)
console.log(`logo id mismatch: ${conflicts.logo.length}`)
conflicts.logo.slice(0, 10).forEach((c) => console.log(`   ${c.slug}: ours ${c.ours} ≠ theirs ${c.theirs} [${c.via}]`))
console.log(`city/province disagree: ${conflicts.province.length}`)
conflicts.province.slice(0, 15).forEach((c) => console.log(`   ${c.slug}: our ${c.city}(${c.ourProv}) vs their ${c.theirProv}`))
if (conflicts.province.length > 15) console.log(`   … +${conflicts.province.length - 15} more`)
console.log(`internal duplicate rows (same uni, 2 slugs): ${conflicts.internalDupes.length}`)
conflicts.internalDupes.slice(0, 15).forEach((c) => console.log(`   ${c.a} ↔ ${c.b} [${c.via}]`))
console.log(`\n--- COVERAGE GAPS ---`)
console.log(`ours unranked/unmatched: ${ourUnmatched.length}`)
ourUnmatched.slice(0, 20).forEach((r) => console.log(`   ${r.slug} (${r.nameZh || r.name})`))
if (ourUnmatched.length > 20) console.log(`   … +${ourUnmatched.length - 20} more`)
console.log(`theirs not in our DB: ${theirUnmatched.length}`)
theirUnmatched.slice(0, 20).forEach((u) => console.log(`   ${u.univNameCn} #${u.ranking}`))
if (theirUnmatched.length > 20) console.log(`   … +${theirUnmatched.length - 20} more`)
