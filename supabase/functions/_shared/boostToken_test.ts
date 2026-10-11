import { assertEquals } from 'jsr:@std/assert'
import { asBoostToken, hashBoostToken } from './boostToken.ts'

const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' // 43-char base64url shape

Deno.test('asBoostToken accepts the minted format and rejects everything else', () => {
  assertEquals(asBoostToken(TOKEN), TOKEN)
  assertEquals(asBoostToken('short'), null)
  assertEquals(asBoostToken('00000000-0000-4000-8000-000000000001'), null) // legacy uuid claim token
  assertEquals(asBoostToken(`${TOKEN},claim_dismissed.eq.true`), null)
  assertEquals(asBoostToken(`${TOKEN}!`), null)
  assertEquals(asBoostToken(42), null)
  assertEquals(asBoostToken(null), null)
  assertEquals(asBoostToken(undefined), null)
})

Deno.test('hashBoostToken produces lowercase sha256 hex', async () => {
  const hash = await hashBoostToken(TOKEN)
  assertEquals(/^[0-9a-f]{64}$/.test(hash), true)
  // Deterministic — this is a digest, not salted.
  assertEquals(await hashBoostToken(TOKEN), hash)
  assertEquals((await hashBoostToken(`${TOKEN}x`)) !== hash, true)
})
