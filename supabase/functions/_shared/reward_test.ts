import { assertEquals } from 'jsr:@std/assert'
import {
  REWARD_CODE_RE,
  evaluateReward,
  newRewardCode,
  normalizeEmail,
  withHandoff,
  type RewardReviewRow,
} from './reward.ts'
import fixtures from './reward.fixtures.json' with { type: 'json' }

for (const c of fixtures.cases) {
  Deno.test(`reward rule: ${c.name}`, () => {
    const result = evaluateReward(c.row as unknown as RewardReviewRow)
    assertEquals(result.full, c.expect.full)
    assertEquals(result.missing, c.expect.missing)
  })
}

Deno.test('gift codes match the database format', () => {
  for (let n = 0; n < 200; n++) {
    assertEquals(/^TRC-[0-9A-HJKMNP-TV-Z]{6}$/.test(newRewardCode()), true)
  }
})

Deno.test('email normalization: one gift per person', () => {
  assertEquals(normalizeEmail(' Foo.Bar+gift@Gmail.com '), 'foobar@gmail.com')
  assertEquals(normalizeEmail('a.b@googlemail.com'), 'ab@gmail.com')
  assertEquals(normalizeEmail('Li.Wei+x@qq.com'), 'li.wei@qq.com')
})

Deno.test('WeChat ID only goes out with an earned gift', () => {
  assertEquals(withHandoff({ state: 'sent', code: 'TRC-ABC123' }, 'wx1').wechatId, 'wx1')
  assertEquals(withHandoff({ state: 'failed', code: 'TRC-ABC123' }, 'wx1').wechatId, 'wx1')
  assertEquals(withHandoff({ state: 'waiting', code: 'TRC-ABC123' }, 'wx1').wechatId, undefined)
  assertEquals(withHandoff({ state: 'failed' }, 'wx1').wechatId, undefined)
  assertEquals(withHandoff({ state: 'sent', code: 'TRC-ABC123' }, undefined).wechatId, undefined)
})

Deno.test('referral codes accept only gift code shapes', () => {
  assertEquals(REWARD_CODE_RE.test(newRewardCode()), true)
  assertEquals(REWARD_CODE_RE.test('TRC-ABCDEI'), false)
  assertEquals(REWARD_CODE_RE.test('trc-abc123'), false)
})
