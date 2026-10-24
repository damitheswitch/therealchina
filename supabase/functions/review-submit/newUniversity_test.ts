import { assertEquals, assertThrows } from 'jsr:@std/assert'
import { NEW_UNIVERSITY_REQUIRED, parseNewUniversity, planNewUniversity } from './newUniversity.ts'

Deno.test('parseNewUniversity: absent payload means no new university', () => {
  assertEquals(parseNewUniversity(undefined), undefined)
  assertEquals(parseNewUniversity(null), undefined)
})

Deno.test('parseNewUniversity keeps the province the wizard sends', () => {
  assertEquals(
    parseNewUniversity({ name: ' Example   University ', city: 'Hangzhou', province: 'Zhejiang' }),
    { name: 'Example University', city: 'Hangzhou', province: 'Zhejiang' }
  )
})

Deno.test('parseNewUniversity: province is optional', () => {
  assertEquals(parseNewUniversity({ name: '北京语言大学', city: 'Beijing' }), {
    name: '北京语言大学',
    city: 'Beijing',
    province: null,
  })
  assertEquals(
    parseNewUniversity({ name: 'Example University', city: 'Hangzhou', province: '  ' }),
    {
      name: 'Example University',
      city: 'Hangzhou',
      province: null,
    }
  )
})

Deno.test('parseNewUniversity rejects a payload without name or city', () => {
  for (const raw of [
    {},
    { name: 'Example University' },
    { city: 'Hangzhou' },
    { name: ' ', city: 'Hangzhou' },
    'x',
    [],
  ]) {
    assertThrows(() => parseNewUniversity(raw), Error, NEW_UNIVERSITY_REQUIRED)
  }
})

Deno.test('parseNewUniversity rejects wrong types and over-long fields', () => {
  assertThrows(() =>
    parseNewUniversity({ name: 'Example University', city: 'Hangzhou', province: 42 })
  )
  assertThrows(() => parseNewUniversity({ name: 'x'.repeat(161), city: 'Hangzhou' }))
  assertThrows(() =>
    parseNewUniversity({ name: 'Example University', city: 'Hangzhou', province: 'x'.repeat(121) })
  )
})

Deno.test('planNewUniversity matches identifying names by slug', () => {
  assertEquals(planNewUniversity('Zhejiang University'), {
    kind: 'by-slug',
    base: 'zhejiang-university',
  })
})

Deno.test('planNewUniversity sends weak names to the name resolver', () => {
  assertEquals(planNewUniversity('北京语言大学'), { kind: 'by-name', base: '' })
  assertEquals(planNewUniversity('International University'), {
    kind: 'by-name',
    base: 'international-university',
  })
})
