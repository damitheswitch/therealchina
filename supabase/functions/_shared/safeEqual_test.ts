import { assertEquals } from 'jsr:@std/assert'
import { safeEqual } from './safeEqual.ts'

Deno.test('safeEqual matches only identical strings', () => {
  assertEquals(safeEqual('s3cret-value', 's3cret-value'), true)
  assertEquals(safeEqual('s3cret-value', 's3cret-valuf'), false)
  assertEquals(safeEqual('s3cret', 's3cret-value'), false)
  assertEquals(safeEqual('', 's3cret'), false)
  assertEquals(safeEqual('', ''), true)
  assertEquals(safeEqual('密钥', '密钥'), true)
})
