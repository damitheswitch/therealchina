// The thank-you gift email: subject, plain text and a simple HTML version.
// Every value is escaped for HTML, and nothing in it comes from reviewer input
// (it carries the gift code, the owner's WeChat ID and fixed copy only).

export interface RewardEmailInput {
  code: string
  wechatId: string
  ownerName: string
  discountText: string
  supportEmail: string
  siteUrl: string
}

export interface RewardEmail {
  subject: string
  text: string
  html: string
}

export const REWARD_SUBJECT = 'Your free gift from The Real China'

export const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export function buildRewardEmail(i: RewardEmailInput): RewardEmail {
  const intro =
    'Thank you for writing a full review on The Real China. Students who are choosing a university will read it. It helps them a lot.'
  const gift =
    'Your thank-you gift is a free trial of a very fast VPN: 2GB, one time. It is a VPN and online services trial from a trusted friend of TRC who runs the service.'
  const steps = [
    `Add me on WeChat. My WeChat ID is ${i.wechatId}.`,
    'Send me your gift code, or the email you used.',
    'If you can, send a small proof that you are a real student. A campus photo or a screenshot of your university portal is fine. Please cover your name, face and student number. This is optional, but it helps me trust that it is you.',
    'I send you the link for your free 2GB.',
    'I will also add you to the TRC WeChat group. We share gifts and tips for international students in China. You can leave at any time.',
  ]
  const why =
    "Why I ask for proof: TRC is a small student project with no money. I am a master's student without a scholarship, and I pay for this myself. Some people try to take free gifts many times. A small proof keeps the gifts for real students. If you cannot send proof, just tell me."
  const discount = i.discountText.trim()
    ? ` with a TRC discount of ${i.discountText.trim()}`
    : ' with a TRC discount'
  const more = `Want more? You can buy a monthly plan${discount}. Paid plans also come with 150GB of online storage. Just ask me on WeChat. You never have to buy anything.`
  const about = [
    'Every full review gets the same gift, good or bad. You never need to change your review or mention the VPN.',
    'When you message me, I will know which review is yours. I keep this private and never share it with anyone, including any university.',
  ]
  const emailNote =
    'Your email: we used it only to send this gift. You are not on any mailing list. We delete it 90 days after this email. To delete it now, reply "delete".'
  const reason =
    'You got this email because this address was used for a gift after a review on therealchina.net. If this was not you, ignore this email.'

  const text = [
    'Hi,',
    '',
    intro,
    '',
    gift,
    '',
    `Your gift code: ${i.code}`,
    '',
    'How to get it:',
    ...steps.map((s, n) => `${n + 1}. ${s}`),
    '',
    why,
    '',
    more,
    '',
    'About this gift:',
    ...about.map((a) => `- ${a}`),
    '',
    emailNote,
    '',
    reason,
    '',
    `Need help? ${i.supportEmail}`,
    '',
    'Thank you,',
    `${i.ownerName}, The Real China`,
    i.siteUrl,
  ].join('\n')

  const p = (s: string) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(s)}</p>`
  const html = `<!doctype html>
<html lang="en"><body style="margin:0;background:#faf6ef;font-family:Arial,Helvetica,sans-serif;color:#1a1613">
<div style="max-width:560px;margin:0 auto;padding:24px 20px">
<img src="${escapeHtml(i.siteUrl)}/apple-touch-icon.png" width="60" height="60" alt="The Real China" style="display:block;margin:0 0 18px;border-radius:12px">
${p('Hi,')}
${p(intro)}
${p(gift)}
<div style="margin:0 0 18px;padding:14px 16px;border:2px solid #a6192e;border-radius:10px;text-align:center">
<div style="font-size:12px;color:#8a7f76;margin-bottom:4px">Your gift code</div>
<div style="font-size:26px;font-weight:700;letter-spacing:2px">${escapeHtml(i.code)}</div>
</div>
<p style="margin:0 0 8px;font-weight:700">How to get it</p>
<ol style="margin:0 0 14px;padding-left:20px;line-height:1.55">
${steps.map((s) => `<li style="margin-bottom:8px">${escapeHtml(s).replace(escapeHtml(i.wechatId), `<b>${escapeHtml(i.wechatId)}</b>`)}</li>`).join('\n')}
</ol>
${p(why)}
${p(more)}
<p style="margin:0 0 8px;font-weight:700">About this gift</p>
<ul style="margin:0 0 14px;padding-left:20px;line-height:1.55">
${about.map((a) => `<li style="margin-bottom:8px">${escapeHtml(a)}</li>`).join('\n')}
</ul>
${p(emailNote)}
<p style="margin:0 0 14px;line-height:1.55;font-size:12px;color:#8a7f76">${escapeHtml(reason)}</p>
${p(`Need help? ${i.supportEmail}`)}
${p('Thank you,')}
<p style="margin:0">${escapeHtml(i.ownerName)}, The Real China</p>
</div></body></html>`

  return { subject: REWARD_SUBJECT, text, html }
}
