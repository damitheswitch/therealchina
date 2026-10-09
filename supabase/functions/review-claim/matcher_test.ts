import { assertEquals } from 'jsr:@std/assert'
import { asBoostHash, asCallerEmail, asClaimToken, claimMatcher } from './matcher.ts'

// Low-entropy fixture: a real-looking UUID secret would trip secret scanners.
const TOKEN = '00000000-0000-4000-8000-000000000001'

Deno.test('asClaimToken accepts a valid UUID and rejects everything else', () => {
  assertEquals(asClaimToken(TOKEN), TOKEN)
  assertEquals(asClaimToken(TOKEN.toUpperCase()), TOKEN.toUpperCase())
  assertEquals(asClaimToken('not-a-uuid'), null)
  assertEquals(asClaimToken(''), null)
  assertEquals(asClaimToken(42), null)
  assertEquals(asClaimToken(null), null)
  assertEquals(asClaimToken(undefined), null)
  // No smuggling a second condition through the token slot.
  assertEquals(asClaimToken(`${TOKEN},claim_dismissed.eq.false`), null)
})

Deno.test('asCallerEmail normalizes and validates', () => {
  assertEquals(asCallerEmail('  USER@Example.COM '), 'user@example.com')
  assertEquals(asCallerEmail('a@b.co'), 'a@b.co')
  assertEquals(asCallerEmail('not-an-email'), null)
  assertEquals(asCallerEmail('a@b'), null)
  assertEquals(asCallerEmail(null), null)
  assertEquals(asCallerEmail(undefined), null)
  assertEquals(asCallerEmail(''), null)
})

Deno.test('claimMatcher builds token, email, or combined .or() strings', () => {
  assertEquals(claimMatcher(TOKEN, null), `claim_token.eq.${TOKEN}`)
  assertEquals(claimMatcher(null, 'a@b.co'), 'email.ilike.a@b.co')
  assertEquals(
    claimMatcher(TOKEN, 'a@b.co'),
    `claim_token.eq.${TOKEN},email.ilike.a@b.co`
  )
  assertEquals(claimMatcher(null, null), null)
})

Deno.test('claimMatcher escapes ilike wildcards in emails so they match literally', () => {
  // % and _ are PostgREST ilike wildcards — escaping keeps them literal.
  const m = claimMatcher(null, 'a%b_c@d.co')
  assertEquals(m, 'email.ilike.a\\%b\\_c@d.co')
})

Deno.test('claimMatcher cannot be widened by a crafted email', () => {
  // Commas/parens would otherwise let an email smuggle extra .or() terms into
  // the PostgREST filter — the email regex rejects them outright.
  assertEquals(claimMatcher(null, 'x@y.co),owner_id.eq.z'), null)
})

const HASH = 'a'.repeat(64)

Deno.test('asBoostHash accepts lowercase sha256 hex only', () => {
  assertEquals(asBoostHash(HASH), HASH)
  assertEquals(asBoostHash(HASH.toUpperCase()), HASH)
  assertEquals(asBoostHash('z'.repeat(64)), null)
  assertEquals(asBoostHash('a'.repeat(63)), null)
  assertEquals(asBoostHash(null), null)
})

Deno.test('claimMatcher adds boost_secret_hash atoms for valid hashes', () => {
  const other = 'b'.repeat(64)
  assertEquals(
    claimMatcher(null, null, [HASH]),
    `boost_secret_hash.eq.${HASH}`
  )
  assertEquals(
    claimMatcher(null, null, [HASH, other]),
    `boost_secret_hash.in.(${HASH},${other})`
  )
  assertEquals(
    claimMatcher(TOKEN, 'a@b.co', [HASH]),
    `claim_token.eq.${TOKEN},boost_secret_hash.eq.${HASH},email.ilike.a@b.co`
  )
  // Malformed hashes are dropped, never concatenated into the filter.
  assertEquals(claimMatcher(null, null, ['not-a-hash', HASH, 'x)']), `boost_secret_hash.eq.${HASH}`)
})
