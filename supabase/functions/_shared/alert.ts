// Owner alert emails (new content reports). Best effort: an alert failure is
// logged and never fails the request that triggered it. Disabled until
// REPORT_ALERT_EMAIL and RESEND_API_KEY are set for the environment.

const FROM_EMAIL =
  Deno.env.get('NOTIFY_FROM_EMAIL') || 'The Real China <notifications@therealchina.net>'

export const SITE_URL = (Deno.env.get('NOTIFY_SITE_URL') || 'https://www.therealchina.net').replace(
  /\/$/,
  ''
)

export async function sendOwnerAlert(subject: string, lines: string[]): Promise<void> {
  const to = Deno.env.get('REPORT_ALERT_EMAIL')
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!to || !apiKey) {
    console.error('Owner alert skipped (REPORT_ALERT_EMAIL or RESEND_API_KEY unset):', subject)
    return
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, text: lines.join('\n') }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`Owner alert failed: Resend ${res.status}: ${body.slice(0, 300)}`)
    }
  } catch (err) {
    console.error('Owner alert failed:', err)
  }
}
