import { assertEquals } from 'jsr:@std/assert'
import { REASON_MAX, parseReport } from './validate.ts'

const ID = '00000000-0000-4000-8000-0000000000AA'

Deno.test('parseReport accepts review and comment targets', () => {
  assertEquals(parseReport({ targetType: 'review', targetId: ID }), {
    targetType: 'review',
    targetId: ID.toLowerCase(),
    reason: null,
  })
  assertEquals(parseReport({ targetType: 'comment', targetId: ID, reason: '  spam  ' }), {
    targetType: 'comment',
    targetId: ID.toLowerCase(),
    reason: 'spam',
  })
})

Deno.test('parseReport treats a blank reason as none', () => {
  const parsed = parseReport({ targetType: 'review', targetId: ID, reason: '   ' })
  assertEquals('reason' in parsed ? parsed.reason : 'error', null)
})

Deno.test('parseReport rejects bad targets and reasons', () => {
  assertEquals('error' in parseReport(null), true)
  assertEquals('error' in parseReport([]), true)
  assertEquals('error' in parseReport({ targetType: 'question', targetId: ID }), true)
  assertEquals('error' in parseReport({ targetType: 'review', targetId: 'not-a-uuid' }), true)
  assertEquals(
    'error' in parseReport({ targetType: 'review', targetId: `${ID},deleted_at.is.null` }),
    true
  )
  assertEquals('error' in parseReport({ targetType: 'review', targetId: ID, reason: 42 }), true)
  assertEquals(
    'error' in
      parseReport({ targetType: 'review', targetId: ID, reason: 'x'.repeat(REASON_MAX + 1) }),
    true
  )
})
