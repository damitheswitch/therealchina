import {
  corsHeaders,
  jsonResponse,
  supabaseAdmin,
} from '../_shared/guard.ts'

// qa-notify: emails a question's author when someone answers it.
//
// Triggered by community-submit right after the answer row is written, over
// HTTPS with a shared secret in x-notify-secret (QA_NOTIFY_SECRET). This is
// the comment-notify pattern with one deliberate change: instead of a pg_net
// DB trigger reading function URL + secret from Vault, community-submit is
// the only write path and invokes this function directly — same secret auth,
// same claim-then-send + log pipeline, but nothing to provision per
// environment in the database.
//
// Skip reasons: question_deleted, answer_deleted, opted_out
// (notify_on_answer=false, the author's own toggle), self_answer,
// no_owner_email, throttled, daily_cap, already_processed.

const ANSWER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const THROTTLE_MINUTES = 30 // one email per question+author per window
const DAILY_CAP = 20 // per author across all their questions
const EXCERPT_LEN = 400
const SITE_URL = Deno.env.get('NOTIFY_SITE_URL') || 'https://www.therealchina.net'
const FROM_EMAIL = Deno.env.get('NOTIFY_FROM_EMAIL') || 'The Real China <hello@therealchina.net>'

async function logResult(
  answerId: string,
  questionId: string,
  recipientId: string | null,
  recipientEmail: string | null,
  status: string,
  detail: string | null
) {
  const { error } = await supabaseAdmin
    .from('qa_email_log')
    .update({
      recipient_user_id: recipientId,
      recipient_email: recipientEmail,
      status,
      detail,
    })
    .eq('answer_id', answerId)
  if (error) console.error('Failed to log qa email result:', error)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function sendEmail(to: string, subject: string, text: string, html: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) throw new Error('RESEND_API_KEY not configured')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, text, html }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`)
  }
}

async function handleNotify(req: Request): Promise<Response> {
  const secret = Deno.env.get('QA_NOTIFY_SECRET')
  if (!secret || req.headers.get('x-notify-secret') !== secret) {
    return jsonResponse(req, { error: 'Unauthorized' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse(req, { error: 'Invalid JSON body' }, 400)
  }
  const answerId = typeof body.answer_id === 'string' ? body.answer_id : ''
  if (!ANSWER_ID_RE.test(answerId)) {
    return jsonResponse(req, { error: 'answer_id must be a uuid' }, 400)
  }

  const { data: answer } = await supabaseAdmin
    .from('qa_answers')
    .select('id, question_id, author_id, body, is_anonymous, deleted_at')
    .eq('id', answerId)
    .maybeSingle()
  if (!answer) return jsonResponse(req, { error: 'Answer not found' }, 404)

  const { data: question } = await supabaseAdmin
    .from('qa_questions')
    .select('id, slug, title, author_id, notify_on_answer, deleted_at')
    .eq('id', answer.question_id)
    .maybeSingle()

  // Claim the answer before doing any work: a duplicate delivery of the same
  // answer_id exits here instead of double-sending.
  const { data: claimed } = await supabaseAdmin
    .from('qa_email_log')
    .insert({
      answer_id: answerId,
      question_id: answer.question_id,
      status: 'pending',
    })
    .select('answer_id')
    .maybeSingle()
  if (!claimed) return jsonResponse(req, { ok: true, skipped: 'already_processed' }, 200)

  const skip = async (reason: string) => {
    await logResult(
      answerId,
      answer.question_id,
      question?.author_id ?? null,
      null,
      'skipped',
      reason
    )
    return jsonResponse(req, { ok: true, skipped: reason }, 200)
  }

  if (answer.deleted_at) return skip('answer_deleted')
  if (!question || question.deleted_at) return skip('question_deleted')
  if (question.author_id === answer.author_id) return skip('self_answer')
  if (!question.notify_on_answer) return skip('opted_out')

  // Throttle: at most one email per question+author per window, plus a
  // daily cap across all of the author's questions.
  const windowStart = new Date(Date.now() - THROTTLE_MINUTES * 60_000).toISOString()
  const { count: recentForQuestion } = await supabaseAdmin
    .from('qa_email_log')
    .select('answer_id', { count: 'exact', head: true })
    .eq('question_id', question.id)
    .eq('recipient_user_id', question.author_id)
    .eq('status', 'sent')
    .gte('created_at', windowStart)
  if ((recentForQuestion ?? 0) > 0) return skip('throttled')

  const dayStart = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
  const { count: todayForAuthor } = await supabaseAdmin
    .from('qa_email_log')
    .select('answer_id', { count: 'exact', head: true })
    .eq('recipient_user_id', question.author_id)
    .eq('status', 'sent')
    .gte('created_at', dayStart)
  if ((todayForAuthor ?? 0) >= DAILY_CAP) return skip('daily_cap')

  const {
    data: { user: owner },
    error: ownerError,
  } = await supabaseAdmin.auth.admin.getUserById(question.author_id)
  if (ownerError || !owner?.email) return skip('no_owner_email')

  const { data: answerer } = await supabaseAdmin
    .from('profiles')
    .select('display_name')
    .eq('id', answer.author_id)
    .maybeSingle()
  // "Post anonymously" is display-only — an anonymous answer shows "Someone"
  // in the email just like it does on the page.
  const answererName = answer.is_anonymous ? 'Someone' : answerer?.display_name || 'Someone'

  const excerpt =
    answer.body.length > EXCERPT_LEN ? `${answer.body.slice(0, EXCERPT_LEN)}…` : answer.body
  const link = `${SITE_URL}/community/q/${question.slug}`

  const subject = `New answer: ${question.title}`
  const text = [
    `Hi,`,
    ``,
    `${answererName} answered your question "${question.title}":`,
    ``,
    `"${excerpt}"`,
    ``,
    `Read it and mark the best answer: ${link}`,
    ``,
    `No more of these? Open your question and switch off answer notifications.`,
    ``,
    `The Real China`,
  ].join('\n')
  const html = `<p>Hi,</p>
<p><strong>${escapeHtml(answererName)}</strong> answered your question <strong>${escapeHtml(
    question.title
  )}</strong>:</p>
<blockquote style="margin:12px 0;padding:8px 12px;border-left:3px solid #ccc;color:#444;">${escapeHtml(
    excerpt
  )}</blockquote>
<p><a href="${link}">Read it and mark the best answer</a></p>
<p style="color:#888;font-size:12px;">No more of these? Open your question and switch off answer notifications.<br>The Real China</p>`

  try {
    await sendEmail(owner.email, subject, text, html)
  } catch (err) {
    await logResult(
      answerId,
      question.id,
      question.author_id,
      owner.email,
      'failed',
      err instanceof Error ? err.message : 'send failed'
    )
    return jsonResponse(req, { error: 'Email send failed' }, 502)
  }

  await logResult(answerId, question.id, question.author_id, owner.email, 'sent', null)
  return jsonResponse(req, { ok: true, sent: true }, 200)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed' }, 405)
  }
  try {
    return await handleNotify(req)
  } catch (err) {
    console.error('qa-notify error:', err)
    return jsonResponse(req, { error: 'Internal error' }, 500)
  }
})
