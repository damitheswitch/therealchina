import { assertEquals, assertNotEquals } from 'jsr:@std/assert'
import {
  escapeLike,
  selectRecipients,
  signUnsubscribeToken,
  throttleCutoff,
  verifyUnsubscribeToken,
  type PingCandidate,
} from './qaPing.ts'

const cand = (email: string, userId?: string): PingCandidate => ({
  email,
  kind: userId ? 'member' : 'anonymous',
  userId,
})

const none = new Set<string>()

Deno.test('selectRecipients drops the asker by id and by address', () => {
  const out = selectRecipients(
    [
      cand('Asker@x.com', 'u-asker'),
      cand('a@x.com', 'u-asker'),
      cand('asker@x.com'),
      cand('b@x.com'),
    ],
    { askerId: 'u-asker', askerEmail: 'ASKER@x.com', throttled: none }
  )
  assertEquals(
    out.map((c) => c.email),
    ['b@x.com']
  )
})

Deno.test('selectRecipients dedupes, skips throttled and bad addresses, keeps order', () => {
  const out = selectRecipients(
    [cand('a@x.com'), cand('A@x.com'), cand('nope'), cand('c@x.com'), cand('d@x.com')],
    { askerId: 'u', askerEmail: null, throttled: new Set(['c@x.com']) }
  )
  assertEquals(
    out.map((c) => c.email),
    ['a@x.com', 'd@x.com']
  )
})

Deno.test('selectRecipients caps at five by default', () => {
  const many = Array.from({ length: 12 }, (_, i) => cand(`p${i}@x.com`))
  assertEquals(selectRecipients(many, { askerId: 'u', askerEmail: null, throttled: none }).length, 5)
  assertEquals(
    selectRecipients(many, { askerId: 'u', askerEmail: null, throttled: none, limit: 2 }).length,
    2
  )
})

Deno.test('throttleCutoff is seven days back', () => {
  const now = Date.UTC(2026, 9, 30)
  assertEquals(throttleCutoff(now), new Date(Date.UTC(2026, 9, 23)).toISOString())
})

Deno.test('unsubscribe token round-trips for both kinds', async () => {
  const id = '0b9f1c3e-1111-2222-3333-444455556666'
  const t1 = await signUnsubscribeToken('member', id, 's3cret')
  assertEquals(await verifyUnsubscribeToken(t1, 's3cret'), { kind: 'member', subject: id })
  const t2 = await signUnsubscribeToken('anonymous', 'Zoë+tag@example.com', 's3cret')
  assertEquals(await verifyUnsubscribeToken(t2, 's3cret'), {
    kind: 'anonymous',
    subject: 'Zoë+tag@example.com',
  })
})

Deno.test('unsubscribe token rejects tampering, wrong secret and junk', async () => {
  const t = await signUnsubscribeToken('anonymous', 'a@x.com', 's3cret')
  assertEquals(await verifyUnsubscribeToken(t, 'other'), null)
  assertEquals(await verifyUnsubscribeToken(t, ''), null)
  const [k, s, sig] = t.split('.')
  const forged = await signUnsubscribeToken('anonymous', 'victim@x.com', 'wrong')
  assertNotEquals(forged, t)
  assertEquals(await verifyUnsubscribeToken(`${k}.${forged.split('.')[1]}.${sig}`, 's3cret'), null)
  assertEquals(await verifyUnsubscribeToken(`member.${s}.${sig}`, 's3cret'), null)
  assertEquals(await verifyUnsubscribeToken(`${k}.${s}`, 's3cret'), null)
  assertEquals(await verifyUnsubscribeToken('x.y.z', 's3cret'), null)
  assertEquals(await verifyUnsubscribeToken('', 's3cret'), null)
})

Deno.test('escapeLike neutralises wildcards', () => {
  assertEquals(escapeLike('a_b%c\\d@x.com'), 'a\\_b\\%c\\\\d@x.com')
})
