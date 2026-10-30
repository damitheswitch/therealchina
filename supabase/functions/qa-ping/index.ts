import { corsHeaders, jsonResponse, supabaseAdmin, SUPABASE_URL } from '../_shared/guard.ts'
import { safeEqual } from '../_shared/safeEqual.ts'
import {
  escapeLike,
  normalizeEmail,
  selectRecipients,
  signUnsubscribeToken,
  throttleCutoff,
  verifyUnsubscribeToken,
  type PingCandidate,
} from '../_shared/qaPing.ts'

// qa-ping: tells up to 5 past reviewers of a university that someone asked a
// question about it, and handles the one-click unsubscribe from that email.
//
//   POST + x-notify-secret (QA_NOTIFY_SECRET)  body {question_id}
//       Called best-effort by community-submit after a question is written.
//   GET or POST with ?t=<token>
//       Unsubscribe. No login: the token is an HMAC (QA_PING_SECRET) over the
//       recipient, so only addresses we emailed can be switched off. GET
//       only redirects to a confirm button on the site; POST (that button,
//       or a mail client's one-click) unsubscribes and answers JSON.
//
// Recipients: members whose profiles.email_consent is true (confirmed auth
// address) and anonymous reviewers whose reviewer_context has an email AND
// email_consent. Never the asker. At most one ping per address per 7 days
// (qa_ping_log). Fails closed: no QA_PING_SECRET means nothing is sent, since
// every email must carry a working unsubscribe link.

const QUESTION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SITE_URL = Deno.env.get('NOTIFY_SITE_URL') || 'https://www.therealchina.net'
const FROM_EMAIL = Deno.env.get('NOTIFY_FROM_EMAIL') || 'The Real China <hello@therealchina.net>'
const REVIEW_SCAN_LIMIT = 100 // newest reviews of the university to look through
const MEMBER_LOOKUP_LIMIT = 20 // auth address lookups per question

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html: string,
  unsubscribeUrl: string
) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) throw new Error('RESEND_API_KEY not configured')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      text,
      html,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`)
  }
}

// ---- Candidate lookup --------------------------------------------------------

async function findCandidates(universityId: string, askerId: string): Promise<PingCandidate[]> {
  const { data: reviews, error } = await supabaseAdmin
    .from('reviews')
    .select('id, user_id')
    .eq('university_id', universityId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(REVIEW_SCAN_LIMIT)
  if (error || !reviews?.length) {
    if (error) console.error('qa-ping review lookup failed:', error)
    return []
  }

  const out: PingCandidate[] = []

  // Members: consent lives on the profile, the address on auth.users.
  const memberIds = [
    ...new Set(reviews.map((r) => r.user_id).filter((id): id is string => !!id && id !== askerId)),
  ]
  if (memberIds.length) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .in('id', memberIds)
      .eq('email_consent', true)
    for (const p of (profiles ?? []).slice(0, MEMBER_LOOKUP_LIMIT)) {
      const {
        data: { user },
      } = await supabaseAdmin.auth.admin.getUserById(p.id)
      // Confirmed addresses only.
      if (user?.email && user.email_confirmed_at) {
        out.push({ email: user.email, kind: 'member', userId: p.id })
      }
    }
  }

  // Anonymous reviewers: consent and address both live on reviewer_context.
  const { data: contexts } = await supabaseAdmin
    .from('reviewer_context')
    .select('email, owner_id')
    .in(
      'review_id',
      reviews.map((r) => r.id)
    )
    .eq('email_consent', true)
    .not('email', 'is', null)
  for (const c of contexts ?? []) {
    if (c.email) out.push({ email: c.email, kind: 'anonymous', userId: c.owner_id })
  }
  return out
}

// ---- Ping --------------------------------------------------------------------

async function handlePing(req: Request): Promise<Response> {
  const secret = Deno.env.get('QA_NOTIFY_SECRET')
  if (!secret || !safeEqual(req.headers.get('x-notify-secret') ?? '', secret)) {
    return jsonResponse(req, { error: 'Unauthorized' }, 401)
  }
  const signingSecret = Deno.env.get('QA_PING_SECRET')
  if (!signingSecret) {
    console.error('QA_PING_SECRET not configured, skipping reviewer pings')
    return jsonResponse(req, { ok: true, skipped: 'not_configured' }, 200)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse(req, { error: 'Invalid JSON body' }, 400)
  }
  const questionId = typeof body.question_id === 'string' ? body.question_id : ''
  if (!QUESTION_ID_RE.test(questionId)) {
    return jsonResponse(req, { error: 'question_id must be a uuid' }, 400)
  }

  const { data: question } = await supabaseAdmin
    .from('qa_questions')
    .select('id, slug, title, author_id, university_id, deleted_at')
    .eq('id', questionId)
    .maybeSingle()
  if (!question || question.deleted_at) return jsonResponse(req, { ok: true, skipped: 'gone' }, 200)
  if (!question.university_id) return jsonResponse(req, { ok: true, skipped: 'no_university' }, 200)

  const [{ data: uni }, askerRes, candidates] = await Promise.all([
    supabaseAdmin.from('universities').select('name').eq('id', question.university_id).maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(question.author_id),
    findCandidates(question.university_id, question.author_id),
  ])
  const askerEmail = askerRes.data?.user?.email ?? null

  // Throttle: anyone already pinged (or being pinged) inside the window.
  const emails = [...new Set(candidates.map((c) => normalizeEmail(c.email)))]
  const throttled = new Set<string>()
  if (emails.length) {
    const { data: recent } = await supabaseAdmin
      .from('qa_ping_log')
      .select('recipient_email')
      .in('recipient_email', emails)
      .in('status', ['pending', 'sent'])
      .gte('created_at', throttleCutoff())
    for (const r of recent ?? []) throttled.add(r.recipient_email)
  }

  const recipients = selectRecipients(candidates, {
    askerId: question.author_id,
    askerEmail,
    throttled,
  })

  const uniName = uni?.name ?? 'your university'
  const link = `${SITE_URL}/community/q/${question.slug}`
  let sent = 0
  for (const r of recipients) {
    // Claim first: the unique (question, address) key stops a duplicate
    // delivery from emailing twice.
    const { data: claimed } = await supabaseAdmin
      .from('qa_ping_log')
      .insert({ question_id: question.id, recipient_email: r.email, recipient_kind: r.kind })
      .select('id')
      .maybeSingle()
    if (!claimed) continue

    const subject = `A question about ${uniName}`
    try {
      const token = await signUnsubscribeToken(
        r.kind,
        r.kind === 'member' ? (r.userId as string) : r.email,
        signingSecret
      )
      const unsubscribeUrl = `${SUPABASE_URL}/functions/v1/qa-ping?t=${token}`
      const text = [
        `Hi,`,
        ``,
        `You reviewed ${uniName} on The Real China. Someone just asked:`,
        ``,
        `"${question.title}"`,
        ``,
        `If you can help, you can answer without signing in: ${link}`,
        ``,
        `You get this because you agreed to hear from us. Stop these emails: ${unsubscribeUrl}`,
        ``,
        `The Real China`,
      ].join('\n')
      const html = `<p>Hi,</p>
<p>You reviewed <strong>${escapeHtml(uniName)}</strong> on The Real China. Someone just asked:</p>
<p><strong>${escapeHtml(question.title)}</strong></p>
<p><a href="${link}">Answer it here</a> (no sign-in needed)</p>
<p style="color:#888;font-size:12px;">You get this because you agreed to hear from us. <a href="${unsubscribeUrl}">Stop these emails</a><br>The Real China</p>`
      await sendEmail(r.email, subject, text, html, unsubscribeUrl)
      await supabaseAdmin.from('qa_ping_log').update({ status: 'sent' }).eq('id', claimed.id)
      sent++
    } catch (err) {
      console.error('qa-ping send failed:', err)
      await supabaseAdmin
        .from('qa_ping_log')
        .update({
          status: 'failed',
          detail: err instanceof Error ? err.message.slice(0, 300) : 'send failed',
        })
        .eq('id', claimed.id)
    }
  }
  return jsonResponse(req, { ok: true, sent }, 200)
}

// ---- Unsubscribe -------------------------------------------------------------

async function applyUnsubscribe(token: string): Promise<boolean> {
  const signingSecret = Deno.env.get('QA_PING_SECRET')
  if (!signingSecret) return false
  const parsed = await verifyUnsubscribeToken(token, signingSecret)
  if (!parsed) return false

  if (parsed.kind === 'member') {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ email_consent: false })
      .eq('id', parsed.subject)
    if (error) console.error('qa-ping unsubscribe (member) failed:', error)
    return !error
  }
  const { error } = await supabaseAdmin
    .from('reviewer_context')
    .update({ email_consent: false })
    .ilike('email', escapeLike(parsed.subject))
  if (error) console.error('qa-ping unsubscribe (anonymous) failed:', error)
  return !error
}

// GET never changes anything: mail scanners open links to check them, which
// would silently unsubscribe people. It sends the reader to a confirm button
// on the site, and that button (or a mail client's one-click POST) does it.
async function handleUnsubscribe(req: Request, token: string): Promise<Response> {
  if (req.method === 'GET') {
    return new Response(null, {
      status: 302,
      headers: { Location: `${SITE_URL}/community?unsubscribe=${encodeURIComponent(token)}` },
    })
  }
  const ok = await applyUnsubscribe(token)
  return jsonResponse(req, ok ? { ok: true } : { error: 'Invalid link' }, ok ? 200 : 400)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req.headers.get('origin') ?? undefined),
    })
  }
  try {
    const token = new URL(req.url).searchParams.get('t')
    if (token && (req.method === 'GET' || req.method === 'POST')) {
      return await handleUnsubscribe(req, token)
    }
    if (req.method === 'POST') return await handlePing(req)
    return jsonResponse(req, { error: 'Method not allowed' }, 405)
  } catch (err) {
    console.error('qa-ping error:', err)
    return jsonResponse(req, { error: 'Internal error' }, 500)
  }
})
