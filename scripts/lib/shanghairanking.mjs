// Shared helpers for the ShanghaiRanking (软科) scripts:
//   fetch the ranking payload · parse our seed rows · match the two.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const BASE = 'https://www.shanghairanking.cn'

const HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'accept-language': 'zh-CN,zh;q=0.9',
}

async function fetchText(url, referer) {
  const res = await fetch(url, { headers: referer ? { ...HEADERS, referer } : HEADERS })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return res.text()
}

// The ranking page is Nuxt SSR; its sibling payload.js (Referer-gated) holds
// the full list as structured data — no HTML table scraping needed.
export async function fetchUnivData(year = '2026') {
  const listUrl = `${BASE}/rankings/bcur/${year}`
  const html = await fetchText(listUrl)
  const payloadPath = html.match(/(\/_nuxt\/static\/[^"]+\/payload\.js)/)?.[1]
  if (!payloadPath) throw new Error('payload.js URL not found in list page HTML')
  const payloadSrc = await fetchText(`${BASE}${payloadPath}`, listUrl)
  let captured
  const __NUXT_JSONP__ = (_p, d) => (captured = d)
  eval(payloadSrc) // eslint-disable-line no-eval — trusted vendor payload
  const univData = captured?.data?.[0]?.univData
  if (!Array.isArray(univData) || univData.length < 100)
    throw new Error(`univData missing/short (got ${univData?.length})`)
  return { univData, listUrl }
}

// Parse the VALUES tuples of `INSERT INTO universities` in our seed files.
// Column order differs per file — pass 0-based indexes of the slug/logo
// fields (counting single-quoted fields only):
//   seed_universities.sql: (name, name_zh, city, slug, logo_url, is_verified)
//   seed.sql:              (name, name_zh, city, country, province,
//                           uni_category, slug, logo_url, is_verified, ...)
const FIELD_RE = /'((?:[^'\\]|\\.|'')*)'/g
const unquote = (s) => s.replace(/''/g, "'").replace(/\\'/g, "'")
export function parseSeedRows(rootDir) {
  const ours = []
  for (const [file, slugIx, logoIx] of [
    ['supabase/seed_universities.sql', 3, 4],
    ['supabase/seed.sql', 6, 7],
  ]) {
    const sql = readFileSync(join(rootDir, file), 'utf8')
    for (const stmt of sql.split(/;(?=\s*(?:--|INSERT|$))/g)) {
      if (!/INSERT INTO universities/i.test(stmt)) continue
      for (const tuple of stmt.matchAll(/\(([^()]*)\)/g)) {
        const fields = [...tuple[1].matchAll(FIELD_RE)].map((f) => unquote(f[1]))
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
  return ours
}

export const norm = (s) =>
  s
    .toLowerCase()
    .replace(/[\s'.,()\-–—]+/g, ' ')
    .trim()

// Match scraped rows to ours: logo id (strong) → name_zh → name_en.
// Returns pairs; `ours` duplicates (same school, two slugs across seed
// files) collapse onto the first-parsed row — caller handles dedupe.
export function matchUniversities(univData, ours) {
  const byLogo = new Map(),
    byZh = new Map(),
    byEn = new Map()
  for (const r of ours) {
    if (r.logoId && !byLogo.has(r.logoId)) byLogo.set(r.logoId, r)
    if (!byZh.has(r.nameZh)) byZh.set(r.nameZh, r)
    if (!byEn.has(norm(r.name))) byEn.set(norm(r.name), r)
  }
  const matched = []
  const unmatchedTheirs = []
  for (const u of univData) {
    const logoId = /logo\/(\d+)\.png/.exec(u.univLogo ?? '')?.[1]
    const hit = (logoId && byLogo.get(logoId)) || byZh.get(u.univNameCn) || byEn.get(norm(u.univNameEn))
    if (!hit) {
      unmatchedTheirs.push(u)
      continue
    }
    matched.push({
      ours: hit,
      theirs: u,
      logoId,
      via: logoId && byLogo.get(logoId) === hit ? 'logo' : byZh.get(u.univNameCn) === hit ? 'name_zh' : 'name_en',
    })
  }
  return { matched, unmatchedTheirs }
}

export const sqlString = (s) => `'${String(s).replace(/'/g, "''")}'`

// zh → en maps for fields we persist
export const PROVINCE_EN = {
  '北京': 'Beijing', '上海': 'Shanghai', '天津': 'Tianjin', '重庆': 'Chongqing',
  '河北': 'Hebei', '山西': 'Shanxi', '内蒙古': 'Inner Mongolia', '辽宁': 'Liaoning',
  '吉林': 'Jilin', '黑龙江': 'Heilongjiang', '江苏': 'Jiangsu', '浙江': 'Zhejiang',
  '安徽': 'Anhui', '福建': 'Fujian', '江西': 'Jiangxi', '山东': 'Shandong',
  '河南': 'Henan', '湖北': 'Hubei', '湖南': 'Hunan', '广东': 'Guangdong',
  '广西': 'Guangxi', '海南': 'Hainan', '四川': 'Sichuan', '贵州': 'Guizhou',
  '云南': 'Yunnan', '西藏': 'Tibet', '陕西': 'Shaanxi', '甘肃': 'Gansu',
  '青海': 'Qinghai', '宁夏': 'Ningxia', '新疆': 'Xinjiang',
}
export const CATEGORY_EN = {
  '综合': 'comprehensive', '理工': 'stem', '师范': 'normal', '农业': 'agriculture',
  '林业': 'forestry', '医药': 'medicine', '财经': 'finance', '语言': 'language',
  '政法': 'politics', '民族': 'ethnic', '体育': 'sports', '艺术': 'arts',
  '中医药': 'tcm', '合作办学': 'cooperative',
}
