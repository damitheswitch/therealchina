import { assertEquals } from "jsr:@std/assert";
import {
  evaluateReward,
  newRewardCode,
  normalizeEmail,
  type RewardReviewRow,
} from "./reward.ts";
import fixtures from "./reward.fixtures.json" with { type: "json" };

for (const c of fixtures.cases) {
  Deno.test(`reward rule: ${c.name}`, () => {
    const result = evaluateReward(c.row as unknown as RewardReviewRow);
    assertEquals(result.full, c.expect.full);
    assertEquals(result.missing, c.expect.missing);
  });
}

Deno.test("gift codes match the database format", () => {
  for (let n = 0; n < 200; n++) {
    assertEquals(/^TRC-[0-9A-HJKMNP-TV-Z]{6}$/.test(newRewardCode()), true);
  }
});

Deno.test("email normalization: one gift per person", () => {
  assertEquals(normalizeEmail(" Foo.Bar+gift@Gmail.com "), "foobar@gmail.com");
  assertEquals(normalizeEmail("a.b@googlemail.com"), "ab@gmail.com");
  assertEquals(normalizeEmail("Li.Wei+x@qq.com"), "li.wei@qq.com");
});
