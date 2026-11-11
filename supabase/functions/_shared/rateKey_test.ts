import { assertEquals } from 'jsr:@std/assert'
import { anonRateKey } from './rateKey.ts'

Deno.test('anonRateKey keys known IPs per address', () => {
  assertEquals(anonRateKey('review-ip:', '203.0.113.7'), 'review-ip:203.0.113.7')
  assertEquals(anonRateKey('ip:', '2001:db8::1'), 'ip:2001:db8::1')
})

Deno.test('anonRateKey puts unknown IPs in one shared bucket instead of skipping', () => {
  const original = console.error
  console.error = () => {}
  try {
    assertEquals(anonRateKey('review-ip:', 'unknown'), 'review-ip:unknown')
    assertEquals(anonRateKey('review-ip:', ''), 'review-ip:unknown')
    assertEquals(anonRateKey('ip:', 'unknown'), 'ip:unknown')
  } finally {
    console.error = original
  }
})
