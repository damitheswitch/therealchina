import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { buildRewardEmail, escapeHtml } from "./rewardEmail.ts";

const input = {
  code: "TRC-7K3F2A",
  wechatId: "dami_theSwitch",
  ownerName: "Dami",
  discountText: "20% off",
  supportEmail: "nihao@therealchina.net",
  siteUrl: "https://www.therealchina.net",
};

Deno.test("email carries the code, WeChat ID and support address", () => {
  const email = buildRewardEmail(input);
  assertStringIncludes(email.text, "TRC-7K3F2A");
  assertStringIncludes(email.text, "dami_theSwitch");
  assertStringIncludes(email.text, "nihao@therealchina.net");
  assertStringIncludes(email.html, "<b>dami_theSwitch</b>");
  assertStringIncludes(email.html, "/apple-touch-icon.png");
});

Deno.test("subject does not say VPN (mail filters)", () => {
  assertEquals(/vpn/i.test(buildRewardEmail(input).subject), false);
});

Deno.test("copy has no em or en dashes", () => {
  const email = buildRewardEmail(input);
  assert(!/[–—]/.test(email.text));
});

Deno.test("html escapes every injected value", () => {
  const email = buildRewardEmail({
    ...input,
    ownerName: "<script>x</script>",
    discountText: "a&b",
  });
  assertEquals(email.html.includes("<script>"), false);
  assertStringIncludes(email.html, "a&amp;b");
  assertEquals(escapeHtml(`"'<>&`), "&quot;&#39;&lt;&gt;&amp;");
});
