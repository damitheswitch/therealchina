// indexnow.mjs — submit the sitemap's URLs to IndexNow (Bing, Yandex, Naver…).
// The key file is public/<key>.txt — served at /<key>.txt on every deploy.
//   node scripts/indexnow.mjs                 → submit all sitemap URLs
//   node scripts/indexnow.mjs /path /path2    → submit specific paths
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HOST = 'therealchina.net'
const KEY = '0f4d0874e85f43c1933b9fd11f9b60ad'
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`

const cliPaths = process.argv.slice(2)
let urls = cliPaths.map((p) => `https://${HOST}${p.startsWith('/') ? p : `/${p}`}`)

if (urls.length === 0) {
  const sm = resolve(FRONTEND, 'dist/sitemap.xml')
  if (!existsSync(sm)) {
    console.error('dist/sitemap.xml missing — build first')
    process.exit(1)
  }
  urls = [...readFileSync(sm, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
}

console.log(`IndexNow: submitting ${urls.length} URL(s) for ${HOST}`)
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls }),
})
console.log(`IndexNow response: ${res.status} ${res.statusText}`)
if (!res.ok) process.exit(1)
